import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");
const moduleCache = new Map();

const ZERO_VECTOR = {
  dreamy: 0,
  nostalgia: 0,
  energy: 0,
  cinematic: 0,
  darkness: 0,
  confidence: 0,
  intimacy: 0,
  danceability: 0,
  electronic: 0,
  acoustic: 0,
};

const state = {
  autoTagCalls: [],
  insertCalls: [],
  activeTags: 0,
  maxActiveTags: 0,
  existingTaste: null,
  existingVector: null,
  upsertedTaste: null,
  upsertedVector: null,
};

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetState() {
  moduleCache.clear();
  state.autoTagCalls = [];
  state.insertCalls = [];
  state.activeTags = 0;
  state.maxActiveTags = 0;
  state.existingTaste = {
    favoriteArtists: ["Frank Ocean"],
    defaultMood: "",
    discoveryStyle: "balanced",
    languages: ["English"],
    languageOpenness: "flexible",
    energyPreference: "depends",
    aestheticTags: [],
    genreScores: { pop: 0.2 },
    avoidedStoryTags: ["too dramatic"],
    favoriteStorySongs: ["existing-song"],
    setupComplete: true,
  };
  state.existingVector = { ...ZERO_VECTOR, dreamy: 0.2 };
  state.upsertedTaste = null;
  state.upsertedVector = null;
}

function resolveLocalModule(fromDir, specifier) {
  const resolved = resolve(fromDir, specifier);
  const candidates = extname(resolved)
    ? [resolved]
    : [`${resolved}.ts`, `${resolved}.js`, resolve(resolved, "index.ts"), resolve(resolved, "index.js")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return resolved;
}

function makeTagged(title, artist) {
  return {
    title,
    artist,
    artwork_url: `https://img.example/${title}.jpg`,
    emotional_vector: { ...ZERO_VECTOR, dreamy: 0.5, energy: 0.5 },
    genre_tags: ["pop", "dream pop"],
  };
}

function loadTsModule(path) {
  const resolvedPath = resolve(path);
  const cached = moduleCache.get(resolvedPath);
  if (cached) return cached.exports;

  const source = readFileSync(resolvedPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  moduleCache.set(resolvedPath, cjsModule);

  function stubRequire(id) {
    if (id.includes("lib/autoTag") || id.endsWith("../autoTag")) {
      return {
        autoTagSong: async (title, artist) => {
          state.autoTagCalls.push({ title, artist });
          state.activeTags += 1;
          state.maxActiveTags = Math.max(state.maxActiveTags, state.activeTags);
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
          state.activeTags -= 1;
          if (title === "Broken Track") throw new Error("tag failed");
          return makeTagged(title, artist);
        },
      };
    }
    if (id.includes("lib/db/songs") || id.endsWith("../db/songs")) {
      return {
        insertSong: async (tagged) => {
          state.insertCalls.push({ title: tagged.title, artist: tagged.artist });
          return { id: `${tagged.title.toLowerCase().replace(/\s+/g, "-")}-id` };
        },
      };
    }
    if (id.includes("lib/db/userTaste") || id.endsWith("../db/userTaste")) {
      return {
        getUserTaste: async () => state.existingTaste,
        upsertUserTaste: async (_userId, taste) => {
          state.upsertedTaste = taste;
        },
        getEmotionalVector: async () => state.existingVector,
        upsertEmotionalVector: async (_userId, vector) => {
          state.upsertedVector = vector;
        },
      };
    }
    if (id.includes("lib/emotionalVector") || id.endsWith("../emotionalVector")) {
      return loadTsModule("lib/emotionalVector.ts");
    }
    if (id.startsWith(".")) return loadTsModule(resolveLocalModule(dirname(resolvedPath), id));
    return baseRequire(id);
  }

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process,
    setTimeout,
    Math,
  });
  vm.runInContext(output, context, { filename: resolvedPath });
  return cjsModule.exports;
}

test("importSongsIntoTaste batches tagging at five songs and skips failed tracks", async () => {
  resetState();
  const { importSongsIntoTaste } = loadTsModule("lib/taste/importSongs.ts");
  const songs = Array.from({ length: 12 }, (_, i) => ({
    title: i === 6 ? "Broken Track" : `Track ${i + 1}`,
    artist: `Artist ${i + 1}`,
  }));

  const result = await importSongsIntoTaste("user-123", songs, { batchSize: 5 });

  assert.equal(state.maxActiveTags, 5);
  assert.equal(result.resolved.length, 11);
  assert.equal(result.skipped, 1);
});

test("importSongsIntoTaste merges imported songs into existing taste and vector", async () => {
  resetState();
  const { importSongsIntoTaste } = loadTsModule("lib/taste/importSongs.ts");

  const result = await importSongsIntoTaste("user-123", [
    { title: "Pink + White", artist: "Frank Ocean" },
    { title: "Midnight City", artist: "M83" },
  ]);

  assert.deepEqual(plain(result.resolved.map((song) => song.id)), ["pink-+-white-id", "midnight-city-id"]);
  assert.deepEqual(plain(state.upsertedTaste.favoriteArtists), ["Frank Ocean"]);
  assert.deepEqual(plain(state.upsertedTaste.languages), ["English"]);
  assert.equal(state.upsertedTaste.setupComplete, true);
  assert.equal(state.upsertedTaste.genreScores.pop, 1);
  assert.equal(state.upsertedTaste.genreScores["dream pop"], 1);
  assert.deepEqual(plain(state.upsertedTaste.favoriteStorySongs), [
    "existing-song",
    "pink-+-white-id",
    "midnight-city-id",
  ]);
  assert.ok(state.upsertedVector.dreamy > 0.2);
  assert.ok(state.upsertedVector.energy > 0);
});

test("importSongsIntoTaste does not write taste when no songs resolve", async () => {
  resetState();
  const { importSongsIntoTaste } = loadTsModule("lib/taste/importSongs.ts");

  const result = await importSongsIntoTaste("user-123", [
    { title: "", artist: "M83" },
    { title: "Broken Track", artist: "Artist" },
  ]);

  assert.deepEqual(plain(result), { resolved: [], skipped: 1 });
  assert.equal(state.upsertedTaste, null);
  assert.equal(state.upsertedVector, null);
});
