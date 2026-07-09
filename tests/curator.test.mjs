import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const stubState = {
  fetchImpl: (..._args) => {
    throw new Error("fetch not stubbed for this test");
  },
};

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require,
    console,
    process,
    fetch: (...args) => stubState.fetchImpl(...args),
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

const curator = loadTsModule("lib/curator.ts");

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, async json() { return data; } };
}

test("TRENDING_COUNTRIES matches the language spread used by existing seed scripts", () => {
  assert.deepEqual(plain(curator.TRENDING_COUNTRIES), ["us", "ru", "fr", "es", "gb"]);
});

test("MAX_NEW_SONGS_PER_RUN caps daily GPT spend", () => {
  assert.equal(curator.MAX_NEW_SONGS_PER_RUN, 15);
});

test("fetchTrendingTracks maps Apple feed results into {title, artist} pairs", async () => {
  stubState.fetchImpl = async (url) => {
    assert.ok(url.includes("/us/music/most-played/"));
    return jsonResponse({
      feed: {
        results: [
          { name: "Janice STFU", artistName: "Drake" },
          { name: "Choosin' Texas", artistName: "Ella Langley" },
        ],
      },
    });
  };

  const candidates = await curator.fetchTrendingTracks("us");
  assert.deepEqual(plain(candidates), [
    { title: "Janice STFU", artist: "Drake" },
    { title: "Choosin' Texas", artist: "Ella Langley" },
  ]);
});

test("fetchTrendingTracks caps results at 25 even if the feed returns more", async () => {
  const results = Array.from({ length: 50 }, (_, i) => ({ name: `Song ${i}`, artistName: `Artist ${i}` }));
  stubState.fetchImpl = async () => jsonResponse({ feed: { results } });

  const candidates = await curator.fetchTrendingTracks("us");
  assert.equal(candidates.length, 25);
});

test("fetchTrendingTracks throws a descriptive error on a non-ok response", async () => {
  stubState.fetchImpl = async () => jsonResponse({}, false, 503);
  await assert.rejects(() => curator.fetchTrendingTracks("us"), /fetchTrendingTracks failed for us: 503/);
});
