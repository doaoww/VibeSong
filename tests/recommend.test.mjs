import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(path, extraContext = {}) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  // Stub out any imports that require external dependencies
  const stubRequire = (mod) => {
    if (mod.includes("supabase") || mod.includes("openai")) return {};
    if (mod.includes("vectorMath")) {
      // Load the real vectorMath module
      const vmSource = readFileSync("lib/vectorMath.ts", "utf8");
      const vmOutput = ts.transpileModule(vmSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      }).outputText;
      const vmMod = { exports: {} };
      const vmCtx = vm.createContext({ exports: vmMod.exports, module: vmMod, require: stubRequire, console, process, Array });
      vm.runInContext(vmOutput, vmCtx);
      return vmMod.exports;
    }
    if (mod.includes("emotionalVector")) return { ZERO_VECTOR: { dreamy:0,nostalgia:0,energy:0,cinematic:0,darkness:0,confidence:0,intimacy:0,danceability:0,electronic:0,acoustic:0 }, VECTOR_KEYS: ["dreamy","nostalgia","energy","cinematic","darkness","confidence","intimacy","danceability","electronic","acoustic"] };
    if (mod.includes("db/songs")) return {};
    try { return require(mod); } catch { return {}; }
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process, URLSearchParams, Array, ...extraContext });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const rec = loadTsModule("lib/recommend.ts");

function makeSong(overrides = {}) {
  return {
    id: "test-id",
    title: "Test Song",
    artist: "Test Artist",
    language: "English",
    energy: 0.5,
    popularity_tier: 3,
    emotional_vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    genre_tags: ["indie pop"],
    aesthetic_tags: ["dreamy"],
    mood_tags: ["melancholic"],
    story_intent_tags: ["main character walk"],
    modern_aesthetic_tags: ["quiet luxury"],
    itunes_preview_url: "https://example.com/preview.m4a",
    artwork_url: "https://example.com/art.jpg",
    apple_music_url: null,
    youtube_id: null,
    quality_score: 0.7,
    distance: 0.2,
    ...overrides,
  };
}

function makeRequest(overrides = {}) {
  return {
    queryVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    languages: ["English"],
    languageOpenness: "strict",
    discoveryStyle: "balanced",
    blockedSongs: [],
    blockedArtists: [],
    recentlyShownSongIds: [],
    genreScores: {},
    likedArtists: [],
    storyIntentTags: [],
    antiTags: [],
    ...overrides,
  };
}

test("strict language filter removes songs not in language list", () => {
  const candidates = [
    makeSong({ id: "1", language: "English" }),
    makeSong({ id: "2", language: "Russian" }),
  ];
  const { results } = rec.buildRecommendations(makeRequest({ languages: ["English"], languageOpenness: "strict" }), candidates);
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("1"), "English song should be kept");
  assert.ok(!ids.includes("2"), "Russian song should be removed with strict filter");
});

test("blocked song is removed from results", () => {
  const candidates = [makeSong({ id: "blocked-id" })];
  const { results } = rec.buildRecommendations(makeRequest({ blockedSongs: ["blocked-id"] }), candidates);
  assert.equal(results.length, 0);
});

test("blocked artist is removed from results", () => {
  const candidates = [makeSong({ id: "1", artist: "Bad Artist" })];
  const { results } = rec.buildRecommendations(makeRequest({ blockedArtists: ["Bad Artist"] }), candidates);
  assert.equal(results.length, 0);
});

test("freshness penalty applied to recently shown songs", () => {
  const song = makeSong({ id: "recent-id" });
  const { results: [result] } = rec.buildRecommendations(makeRequest({ recentlyShownSongIds: ["recent-id"] }), [song]);
  assert.ok(result.scoreComponents.freshnessPenalty === -20);
});

test("story intent tag match boosts score", () => {
  const withTag = makeSong({ id: "a", story_intent_tags: ["main character walk"] });
  const withoutTag = makeSong({ id: "b", story_intent_tags: [] });
  const req = makeRequest({ storyIntentTags: ["main character walk"] });
  const { results } = rec.buildRecommendations(req, [withTag, withoutTag]);
  const a = results.find((r) => r.id === "a");
  const b = results.find((r) => r.id === "b");
  assert.ok(a.scoreComponents.storyFit > b.scoreComponents.storyFit);
  assert.ok(a.scoreComponents.finalScore > b.scoreComponents.finalScore);
});

test("energy compatibility filter removes songs with energy too far from query", () => {
  const calmQuery = makeRequest({ queryVector: [0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const aggressiveSong = makeSong({ energy: 0.9, emotional_vector: [0.5, 0.5, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const { results } = rec.buildRecommendations(calmQuery, [aggressiveSong]);
  assert.equal(results.length, 0, "Song with energy 0.9 should be removed when query energy is 0.1");
});

test("results are sorted by finalScore descending", () => {
  const high = makeSong({ id: "high", emotional_vector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9] });
  const low  = makeSong({ id: "low",  emotional_vector: [0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] });
  const query = makeRequest({ queryVector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9] });
  const { results } = rec.buildRecommendations(query, [low, high]);
  assert.equal(results[0].id, "high");
});
