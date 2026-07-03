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
  const stubRequire = (mod) => {
    if (mod.includes("supabase") || mod.includes("openai")) return {};
    if (mod.includes("vectorMath")) {
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
    story_context_tags: [],
    final_confidence: 0.8,
    needs_review: false,
    itunes_preview_url: "https://example.com/preview.m4a",
    artwork_url: "https://example.com/art.jpg",
    apple_music_url: null,
    youtube_id: null,
    quality_score: 0.7,
    distance: 0.2,
    brief_embedding: null,
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
    photoConfidence: 1.0,
    sceneContextTags: [],
    aestheticTags: [],
    moodTags: [],
    energyBounds: { min: 0, max: 1 },
    photoBriefEmbedding: null,
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
  const { results } = rec.buildRecommendations(makeRequest({ recentlyShownSongIds: ["recent-id"] }), [song]);
  assert.equal(results[0].scoreComponents.freshnessPenalty, -20);
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

test("song with final_confidence below 0.35 is hard-removed with confidence_too_low", () => {
  const song = makeSong({ id: "unreliable", final_confidence: 0.2 });
  const { results, debugLog } = rec.buildRecommendations(makeRequest(), [song]);
  assert.equal(results.length, 0);
  const entry = debugLog.find((e) => e.id === "unreliable");
  assert.equal(entry.removedReason, "confidence_too_low");
});

test("song with final_confidence null (not yet tagged by this pipeline) is not hard-removed", () => {
  const song = makeSong({ id: "legacy", final_confidence: null });
  const { results } = rec.buildRecommendations(makeRequest(), [song]);
  assert.equal(results.length, 1);
});

test("manually reviewed song bypasses the confidence_too_low hard guard", () => {
  const song = makeSong({ id: "reviewed", final_confidence: 0.1, tag_source: "auto_plus_manual" });
  const { results } = rec.buildRecommendations(makeRequest(), [song]);
  assert.equal(results.length, 1, "admin approval should outweigh a low GPT confidence score");
});

test("song with language Unknown is hard-removed even outside strict language mode", () => {
  const song = makeSong({ id: "unknown-lang", language: "Unknown" });
  const req = makeRequest({ languageOpenness: "open" });
  const { results, debugLog } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 0);
  const entry = debugLog.find((e) => e.id === "unknown-lang");
  assert.equal(entry.removedReason, "language_unknown");
});

test("manual review does not bypass the language_unknown guard on its own", () => {
  const song = makeSong({ id: "unknown-lang-reviewed", language: "Unknown", tag_source: "auto_plus_manual" });
  const { results } = rec.buildRecommendations(makeRequest({ languageOpenness: "open" }), [song]);
  assert.equal(results.length, 0, "approving tags does not fix an unset language");
});

test("needs_review song still appears but with a scoring penalty, not full hiding", () => {
  const flagged = makeSong({ id: "flagged", final_confidence: 0.5, needs_review: true });
  const clean = makeSong({ id: "clean", final_confidence: 0.9, needs_review: false });
  const { results } = rec.buildRecommendations(makeRequest(), [flagged, clean]);
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("flagged"), "needs_review song should still be recommendable");
  const flaggedResult = results.find((r) => r.id === "flagged");
  assert.equal(flaggedResult.scoreComponents.needsReviewPenalty, -12);
  const cleanResult = results.find((r) => r.id === "clean");
  assert.equal(cleanResult.scoreComponents.needsReviewPenalty, 0);
});

test("energy tolerance derives from energyBounds half-width, floored at 0.3", () => {
  const req = makeRequest({ energyBounds: { min: 0.3, max: 0.5 } }); // half-width 0.1, floored to 0.3
  const song = makeSong({ energy: 0.75, emotional_vector: [0.5, 0.5, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 1, "0.25 gap should survive the 0.3 floor even though bounds half-width is only 0.1");
});

test("energy tolerance floor of 0.3 still rejects a gap beyond it", () => {
  const req = makeRequest({ energyBounds: { min: 0.3, max: 0.5 } }); // half-width 0.1, floored to 0.3
  const song = makeSong({ energy: 0.85, emotional_vector: [0.5, 0.5, 0.85, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 0, "0.35 gap exceeds the 0.3 floor and should be removed");
});

test("energy tolerance widens with energyBounds beyond the 0.3 floor", () => {
  const req = makeRequest({ energyBounds: { min: 0.1, max: 0.9 } });
  const song = makeSong({ energy: 0.85, emotional_vector: [0.5, 0.5, 0.85, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 1);
});

test("contextFit rewards story_context_tags overlap with sceneContextTags", () => {
  const withTag = makeSong({ id: "a", story_context_tags: ["night drive"] });
  const withoutTag = makeSong({ id: "b", story_context_tags: [] });
  const req = makeRequest({ sceneContextTags: ["night drive"] });
  const { results } = rec.buildRecommendations(req, [withTag, withoutTag]);
  const a = results.find((r) => r.id === "a");
  const b = results.find((r) => r.id === "b");
  assert.ok(a.scoreComponents.contextFit > b.scoreComponents.contextFit);
  assert.ok(a.scoreComponents.finalScore > b.scoreComponents.finalScore);
});

test("vibeAestheticFit rewards combined modern_aesthetic_tags/mood_tags overlap", () => {
  const withTags = makeSong({ id: "a", modern_aesthetic_tags: ["quiet luxury"], mood_tags: ["melancholic"] });
  const withoutTags = makeSong({ id: "b", modern_aesthetic_tags: [], mood_tags: [] });
  const req = makeRequest({ aestheticTags: ["quiet luxury"], moodTags: ["melancholic"] });
  const { results } = rec.buildRecommendations(req, [withTags, withoutTags]);
  const a = results.find((r) => r.id === "a");
  const b = results.find((r) => r.id === "b");
  assert.ok(a.scoreComponents.vibeAestheticFit > b.scoreComponents.vibeAestheticFit);
});

test("contextFit and vibeAestheticFit scale down with lower photoConfidence", () => {
  const song = makeSong({ story_context_tags: ["night drive"], modern_aesthetic_tags: ["quiet luxury"] });
  const highConf = rec.buildRecommendations(
    makeRequest({ sceneContextTags: ["night drive"], aestheticTags: ["quiet luxury"], photoConfidence: 1.0 }),
    [song]
  ).results[0];
  const lowConf = rec.buildRecommendations(
    makeRequest({ sceneContextTags: ["night drive"], aestheticTags: ["quiet luxury"], photoConfidence: 0.0 }),
    [{ ...song }]
  ).results[0];
  assert.ok(lowConf.scoreComponents.contextFit < highConf.scoreComponents.contextFit);
  assert.ok(lowConf.scoreComponents.vibeAestheticFit < highConf.scoreComponents.vibeAestheticFit);
  assert.ok(lowConf.scoreComponents.contextFit > 0);
});

test("briefFit is 0 when photoBriefEmbedding is null, even if the song has brief_embedding", () => {
  const song = makeSong({ brief_embedding: [1, 0, 0] });
  const req = makeRequest({ photoBriefEmbedding: null });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefFit, 0);
  assert.equal(results[0].scoreComponents.briefSimilarity, 0);
});

test("briefFit is 0 when the song has no brief_embedding, even if photoBriefEmbedding is present", () => {
  const song = makeSong({ brief_embedding: null });
  const req = makeRequest({ photoBriefEmbedding: [1, 0, 0] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefFit, 0);
});

test("briefFit rewards high cosine similarity between photoBriefEmbedding and song.brief_embedding, weighted at 20", () => {
  const song = makeSong({ brief_embedding: [1, 0, 0] });
  const req = makeRequest({ photoBriefEmbedding: [1, 0, 0] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefSimilarity, 1);
  assert.equal(results[0].scoreComponents.briefFit, 20);
});

test("briefFit scales down for a dissimilar brief embedding", () => {
  const song = makeSong({ brief_embedding: [0, 1, 0] });
  const req = makeRequest({ photoBriefEmbedding: [1, 0, 0] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefSimilarity, 0);
  assert.equal(results[0].scoreComponents.briefFit, 0);
});
