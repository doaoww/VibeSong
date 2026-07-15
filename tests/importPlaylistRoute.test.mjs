import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

let mockUser = { id: "user-123" };
let parserResult = [];
let parserError = null;
let importResult = { resolved: [], skipped: 0 };
const calls = [];

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetRouteState() {
  mockUser = { id: "user-123" };
  parserResult = {
    tracks: [
      { title: "Pink + White", artist: "Frank Ocean" },
      { title: "Midnight City", artist: "M83" },
    ],
    truncated: false,
    totalFound: 2,
  };
  parserError = null;
  importResult = {
    resolved: [
      { id: "song-1", title: "Pink + White", artist: "Frank Ocean", artworkUrl: "https://img.example/1.jpg" },
    ],
    skipped: 1,
  };
  calls.length = 0;
}

function loadRoute(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  class InvalidUrlError extends Error {}
  class ParseError extends Error {}
  if (parserError === "invalid") parserError = new InvalidUrlError("invalid playlist url");
  if (parserError === "parse") parserError = new ParseError("playlist tracks unavailable");

  const cjsModule = { exports: {} };
  const stubRequire = (id) => {
    if (id === "next/server") {
      return {
        NextResponse: {
          json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
        },
      };
    }
    if (id.includes("lib/supabase/server")) {
      return { getSupabaseUser: async () => mockUser };
    }
    if (id.includes("lib/appleMusicPlaylist")) {
      return {
        InvalidUrlError,
        ParseError,
        parseAppleMusicPlaylist: async (url) => {
          calls.push({ fn: "parseAppleMusicPlaylist", url });
          if (parserError) throw parserError;
          return parserResult;
        },
      };
    }
    if (id.includes("lib/taste/importSongs")) {
      return {
        importSongsIntoTaste: async (userId, songs, options) => {
          calls.push({ fn: "importSongsIntoTaste", userId, songs, options });
          return importResult;
        },
      };
    }
    return require(id);
  };

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process,
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

function req(body) {
  return { json: async () => body };
}

test("POST /api/taste/import-playlist rejects signed-out users", async () => {
  resetRouteState();
  mockUser = null;
  const route = loadRoute("app/api/taste/import-playlist/route.ts");

  const res = await route.POST(req({ url: "https://music.apple.com/us/playlist/test/pl.u-test" }));

  assert.equal(res.status, 401);
  assert.deepEqual(plain(res.body), { error: "Sign in required" });
});

test("POST /api/taste/import-playlist maps invalid playlist URLs to 422", async () => {
  resetRouteState();
  parserError = "invalid";
  const route = loadRoute("app/api/taste/import-playlist/route.ts");

  const res = await route.POST(req({ url: "https://example.com/nope" }));

  assert.equal(res.status, 422);
  assert.match(res.body.error, /Apple Music playlist/i);
  assert.equal(res.body.code, "invalid_url");
});

test("POST /api/taste/import-playlist maps unreadable playlists to 422", async () => {
  resetRouteState();
  parserError = "parse";
  const route = loadRoute("app/api/taste/import-playlist/route.ts");

  const res = await route.POST(req({ url: "https://music.apple.com/us/playlist/private/pl.u-test" }));

  assert.equal(res.status, 422);
  assert.match(res.body.error, /Couldn't read/i);
  assert.equal(res.body.code, "parse_error");
});

test("POST /api/taste/import-playlist imports parsed tracks with batch size five", async () => {
  resetRouteState();
  const route = loadRoute("app/api/taste/import-playlist/route.ts");

  const res = await route.POST(req({ url: "https://music.apple.com/us/playlist/test/pl.u-test" }));

  assert.equal(res.status, 200);
  assert.deepEqual(plain(res.body), {
    resolved: importResult.resolved,
    truncated: false,
    skipped: 1,
  });
  assert.deepEqual(plain(calls), [
    { fn: "parseAppleMusicPlaylist", url: "https://music.apple.com/us/playlist/test/pl.u-test" },
    {
      fn: "importSongsIntoTaste",
      userId: "user-123",
      songs: parserResult.tracks,
      options: { batchSize: 5 },
    },
  ]);
});

test("POST /api/taste/import-playlist reports parser truncation", async () => {
  resetRouteState();
  parserResult = {
    tracks: Array.from({ length: 30 }, (_, i) => ({ title: `Track ${i + 1}`, artist: "Artist" })),
    truncated: true,
    totalFound: 35,
  };
  importResult = { resolved: [], skipped: 30 };
  const route = loadRoute("app/api/taste/import-playlist/route.ts");

  const res = await route.POST(req({ url: "https://music.apple.com/us/playlist/long/pl.u-test" }));

  assert.equal(res.status, 200);
  assert.equal(res.body.truncated, true);
});
