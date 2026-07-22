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
    favoriteSongIds: [],
    storyIntentTags: [],
    hardAntiTags: [],
    softAntiTags: [],
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

test("hardAntiTags (explicit avoid-list) hard-removes a matching song regardless of confidence", () => {
  const song = makeSong({ id: "hyped", mood_tags: ["euphoric"] });
  const req = makeRequest({ hardAntiTags: ["euphoric"], photoConfidence: 0.1 });
  const { results, debugLog } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 0);
  const entry = debugLog.find((e) => e.id === "hyped");
  assert.equal(entry.removedReason, "anti_tag");
});

test("softAntiTags (photo-derived) never hard-removes a song — it only applies a scoring penalty", () => {
  const song = makeSong({ id: "hyped", mood_tags: ["euphoric"] });
  const req = makeRequest({ softAntiTags: ["euphoric"], photoConfidence: 0.1 });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 1, "a low-confidence photo anti-tag must not silently disqualify the song");
  assert.ok(results[0].scoreComponents.softAntiTagPenalty < 0);
});

test("softAntiTagPenalty scales with photoConfidence — a confident 'calm' read pushes back harder against a euphoric song than an unsure one", () => {
  const song = makeSong({ id: "hyped", mood_tags: ["euphoric"] });
  const unsure = rec.buildRecommendations(makeRequest({ softAntiTags: ["euphoric"], photoConfidence: 0 }), [song]);
  const confident = rec.buildRecommendations(makeRequest({ softAntiTags: ["euphoric"], photoConfidence: 1 }), [song]);
  const unsurePenalty = unsure.results[0].scoreComponents.softAntiTagPenalty;
  const confidentPenalty = confident.results[0].scoreComponents.softAntiTagPenalty;
  assert.ok(confidentPenalty < unsurePenalty, "higher confidence should apply a stronger (more negative) penalty");
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

test("flexible language filter hard-removes a mismatched-language song even when it's a much stronger overall match", () => {
  // mismatched song is a perfect taste match (liked artist + liked genre + aesthetic tag)
  // but wrong language; matched song has none of those boosts but is the right language.
  // A pure scoring penalty was reliably beaten by strong-enough matches elsewhere
  // (e.g. "Satranga" outranking matched-language songs), so this must be a hard block.
  const mismatched = makeSong({
    id: "ru",
    language: "Russian",
    artist: "Loved Artist",
    genre_tags: ["pop"],
    aesthetic_tags: ["dreamy"],
  });
  const matched = makeSong({ id: "en", language: "English", artist: "Nobody", genre_tags: [], aesthetic_tags: [] });
  const req = makeRequest({
    languages: ["English"],
    languageOpenness: "flexible",
    likedArtists: ["Loved Artist"],
    genreScores: { pop: 1 },
  });
  const { results, debugLog } = rec.buildRecommendations(req, [matched, mismatched]);
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("en"), "matched-language song should be kept");
  assert.ok(!ids.includes("ru"), "mismatched-language song should be removed even with a strong taste-fit boost");
  const entry = debugLog.find((e) => e.id === "ru");
  assert.equal(entry.removedReason, "language_mismatch");
});

test("open language openness lets a mismatched-language song through untouched", () => {
  const song = makeSong({ id: "ru", language: "Russian" });
  const req = makeRequest({ languages: ["English"], languageOpenness: "open" });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 1, "open mode should not filter by language at all");
  assert.equal(results[0].scoreComponents.languagePenalty, 0);
});

test("no language filtering is applied when the user has no language preference set", () => {
  const song = makeSong({ id: "ru", language: "Russian" });
  const req = makeRequest({ languages: [], languageOpenness: "flexible" });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(
    results.length,
    1,
    "empty languages means no preference was expressed, so nothing should be filtered or penalized"
  );
  assert.equal(results[0].scoreComponents.languagePenalty, 0);
});

test("mainstreamPenalty applies at reduced weight for balanced discoveryStyle", () => {
  const mainstream = makeSong({ id: "m", popularity_tier: 5 });
  const req = makeRequest({ discoveryStyle: "balanced" });
  const { results } = rec.buildRecommendations(req, [mainstream]);
  assert.ok(
    results[0].scoreComponents.mainstreamPenalty < 0,
    "balanced discovery should still mildly deprioritize highly mainstream tracks"
  );
  assert.ok(
    results[0].scoreComponents.mainstreamPenalty > -22,
    "balanced penalty should be lighter than the niche/hidden-gems penalty for the same tier"
  );
});

test("mainstreamPenalty is steeper for tier 5 (globally known) than tier 4 (mainstream), same discoveryStyle", () => {
  const tier4 = makeSong({ id: "t4", popularity_tier: 4 });
  const tier5 = makeSong({ id: "t5", popularity_tier: 5 });
  const balancedReq = makeRequest({ discoveryStyle: "balanced" });
  const { results: balancedResults } = rec.buildRecommendations(balancedReq, [tier4, tier5]);
  const balancedByTier = Object.fromEntries(balancedResults.map((r) => [r.id, r.scoreComponents.mainstreamPenalty]));
  assert.ok(
    balancedByTier.t5 < balancedByTier.t4,
    "tier 5 should be penalized more heavily than tier 4 under balanced discovery — global anthems carry broad viral tags that easily outscore a shallow flat penalty"
  );

  const nicheReq = makeRequest({ discoveryStyle: "niche" });
  const { results: nicheResults } = rec.buildRecommendations(nicheReq, [tier4, tier5]);
  const nicheByTier = Object.fromEntries(nicheResults.map((r) => [r.id, r.scoreComponents.mainstreamPenalty]));
  assert.ok(nicheByTier.t5 < nicheByTier.t4, "same steeper-for-tier-5 relationship should hold under niche discovery");
});

test("mainstreamPenalty does not apply for popular-ok discoveryStyle", () => {
  const mainstream = makeSong({ id: "m", popularity_tier: 5 });
  const req = makeRequest({ discoveryStyle: "popular-ok" });
  const { results } = rec.buildRecommendations(req, [mainstream]);
  assert.equal(results[0].scoreComponents.mainstreamPenalty, 0);
});

test("resolveRecentlyShownSongIds matches candidates against feedback by title+artist, case-insensitively", () => {
  const candidates = [
    { id: "1", title: "Anti-Hero", artist: "Taylor Swift" },
    { id: "2", title: "Holostyak", artist: "Egor Kreed" },
  ];
  const feedback = [{ title: "anti-hero", artist: "taylor swift" }];
  const ids = rec.resolveRecentlyShownSongIds(candidates, feedback);
  assert.deepEqual(ids, ["1"]);
});

test("resolveRecentlyShownSongIds returns empty array when no feedback overlaps", () => {
  const candidates = [{ id: "1", title: "Song A", artist: "Artist A" }];
  const ids = rec.resolveRecentlyShownSongIds(candidates, []);
  assert.deepEqual(ids, []);
});

test("applyArtistDiversityCap caps a dominant artist at maxPerArtist, backfilling from other artists", () => {
  const sorted = [
    { id: "1", artist: "Taylor Swift" },
    { id: "2", artist: "Taylor Swift" },
    { id: "3", artist: "Taylor Swift" },
    { id: "4", artist: "Taylor Swift" },
    { id: "5", artist: "Other Artist" },
  ];
  const result = rec.applyArtistDiversityCap(sorted, 5, 2);
  const ids = [...result].map((r) => r.id);
  assert.deepEqual(ids, ["1", "2", "5", "3", "4"], "cap defers 3rd/4th Taylor Swift song behind Other Artist, then backfills to reach the limit");
  assert.equal(ids.filter((id) => ["1", "2", "3", "4"].includes(id)).length, 4);
});

test("applyArtistDiversityCap is a no-op when no artist exceeds the cap", () => {
  const sorted = [
    { id: "1", artist: "A" },
    { id: "2", artist: "B" },
    { id: "3", artist: "C" },
  ];
  const result = rec.applyArtistDiversityCap(sorted, 3, 2);
  assert.deepEqual([...result].map((r) => r.id), ["1", "2", "3"]);
});

test("applyArtistDiversityCap matches artist names case-insensitively", () => {
  const sorted = [
    { id: "1", artist: "Taylor Swift" },
    { id: "2", artist: "taylor swift" },
    { id: "3", artist: "TAYLOR SWIFT" },
    { id: "4", artist: "Other Artist" },
  ];
  const result = rec.applyArtistDiversityCap(sorted, 4, 2);
  assert.deepEqual([...result].map((r) => r.id), ["1", "2", "4", "3"]);
});

test("capFavoriteSongs demotes favorites beyond maxFavorites to the back, preserving relative order otherwise", () => {
  const sorted = [
    { id: "f1" }, { id: "n1" }, { id: "f2" }, { id: "f3" }, { id: "n2" }, { id: "f4" },
  ];
  const result = rec.capFavoriteSongs(sorted, ["f1", "f2", "f3", "f4"], 2);
  assert.deepEqual(
    [...result].map((r) => r.id),
    ["f1", "n1", "f2", "n2", "f3", "f4"],
    "first 2 favorites stay in place, the rest are pushed after all non-favorites"
  );
});

test("capFavoriteSongs is a no-op when there are no favorite song ids", () => {
  const sorted = [{ id: "1" }, { id: "2" }];
  const result = rec.capFavoriteSongs(sorted, [], 2);
  assert.deepEqual([...result].map((r) => r.id), ["1", "2"]);
});

test("capFavoriteSongs is a no-op when favorites never exceed maxFavorites", () => {
  const sorted = [{ id: "f1" }, { id: "n1" }, { id: "f2" }];
  const result = rec.capFavoriteSongs(sorted, ["f1", "f2"], 2);
  assert.deepEqual([...result].map((r) => r.id), ["f1", "n1", "f2"]);
});

test("sampleFavoriteSongIds returns the full list unchanged when it's already at or under maxEligible", () => {
  assert.deepEqual([...rec.sampleFavoriteSongIds(["a", "b", "c"], 6)], ["a", "b", "c"]);
  assert.deepEqual([...rec.sampleFavoriteSongIds(["a", "b"], 2)], ["a", "b"]);
});

test("sampleFavoriteSongIds returns exactly maxEligible distinct ids drawn from the input when the list is larger", () => {
  const ids = Array.from({ length: 22 }, (_, i) => `id-${i}`);
  const sample = [...rec.sampleFavoriteSongIds(ids, 6)];
  assert.equal(sample.length, 6);
  assert.equal(new Set(sample).size, 6, "sample must not contain duplicates");
  for (const id of sample) assert.ok(ids.includes(id), `${id} must come from the original list`);
});

test("sampleFavoriteSongIds does not always return the same subset across calls (rotation, not a fixed favorite)", () => {
  const ids = Array.from({ length: 22 }, (_, i) => `id-${i}`);
  const samples = new Set();
  for (let i = 0; i < 30; i++) {
    samples.add([...rec.sampleFavoriteSongIds(ids, 6)].sort().join(","));
  }
  assert.ok(samples.size > 1, "30 draws of 6-of-22 should not all land on the identical subset");
});

test("genreOverlapScore does not match a fused-word genre that merely contains a scored genre as a substring", () => {
  // "hyperpop"/"britpop"/"electropop" are distinct genres from mainstream "pop" -
  // raw substring matching wrongly pulled them into any "pop" boost or avoid.
  // aesthetic_tags cleared so tasteFit isolates the genre-match component.
  const fused = makeSong({ id: "fused", genre_tags: ["hyperpop"], artist: "A", aesthetic_tags: [] });
  const req = makeRequest({ genreScores: { pop: 1 } });
  const { results } = rec.buildRecommendations(req, [fused]);
  assert.equal(results[0].scoreComponents.tasteFit, 0, "hyperpop must not inherit the 'pop' genre score");
});

test("genreOverlapScore still matches a hyphen/space-separated genre against a scored genre", () => {
  const spaced = makeSong({ id: "spaced", genre_tags: ["indie pop"], artist: "A", aesthetic_tags: [] });
  const req = makeRequest({ genreScores: { pop: 1 } });
  const { results } = rec.buildRecommendations(req, [spaced]);
  assert.ok(results[0].scoreComponents.tasteFit > 0, "indie pop should still match a scored 'pop' genre");
});

test("genreOverlapScore resolves a compound genre against its own specific score, not a disliked generic root word", () => {
  // Reproduced directly: a real user profile with pop: -1 and indie pop: 1
  // (also liking synthpop/electropop) gave "indie pop" songs a near-zero
  // tasteFit — "pop" (word-boundary substring of "indie pop") and "indie
  // pop" (exact) both matched and summed to ~0, silently erasing the
  // user's stated love of the compound genre whenever they also disliked
  // plain "pop".
  const song = makeSong({ id: "ip", genre_tags: ["indie pop"], artist: "A", aesthetic_tags: [] });
  const req = makeRequest({ genreScores: { pop: -1, "indie pop": 1 } });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.ok(
    results[0].scoreComponents.tasteFit > 0,
    "the specific 'indie pop' score must win over the generic disliked 'pop' root"
  );
});

test("artistProximityScore does not give partial credit to an unrelated artist whose name embeds a liked artist's name", () => {
  // aesthetic_tags cleared so tasteFit isolates the artist-match component
  // (makeSong's default aesthetic_tags otherwise contributes a flat +2.5 via
  // the unrelated "has any aesthetic tags" presence signal).
  const unrelated = makeSong({ id: "unrelated", artist: "Bad Cats", aesthetic_tags: [] });
  const req = makeRequest({ likedArtists: ["Cat"] });
  const { results } = rec.buildRecommendations(req, [unrelated]);
  assert.equal(results[0].scoreComponents.tasteFit, 0, "'Bad Cats' must not match liked artist 'Cat'");
});

test("favoriteSongBonus is applied to a song whose id is in favoriteSongIds", () => {
  const favorite = makeSong({ id: "fav" });
  const req = makeRequest({ favoriteSongIds: ["fav"] });
  const { results } = rec.buildRecommendations(req, [favorite]);
  assert.equal(results[0].scoreComponents.favoriteSongBonus, 8);
});

test("favoriteSongBonus is 0 for a song not in favoriteSongIds", () => {
  const other = makeSong({ id: "other" });
  const req = makeRequest({ favoriteSongIds: ["some-other-id"] });
  const { results } = rec.buildRecommendations(req, [other]);
  assert.equal(results[0].scoreComponents.favoriteSongBonus, 0);
});

test("favoriteSongBonus boosts a favorited song above an otherwise-identical non-favorited one", () => {
  const favorite = makeSong({ id: "fav" });
  const other = makeSong({ id: "other" });
  const req = makeRequest({ favoriteSongIds: ["fav"] });
  const { results } = rec.buildRecommendations(req, [favorite, other]);
  const fav = results.find((r) => r.id === "fav");
  const rest = results.find((r) => r.id === "other");
  assert.ok(fav.scoreComponents.finalScore > rest.scoreComponents.finalScore);
});

test("favoriteSongBonus does not override a hard filter — a favorited song with the wrong language is still removed", () => {
  const favorite = makeSong({ id: "fav", language: "Russian" });
  const req = makeRequest({ favoriteSongIds: ["fav"], languages: ["English"], languageOpenness: "strict" });
  const { results } = rec.buildRecommendations(req, [favorite]);
  assert.equal(results.length, 0, "favoriting a song must not bypass the language hard filter");
});

test("favoriteSongBonus alone does not outrank a much stronger photo/mood match", () => {
  // favorited song is a near-total vector mismatch; the competing song is a
  // near-perfect vector match with no favorite bonus at all — the +8 flat
  // bonus (comparable to noveltyFit's max) should not be enough to overturn
  // a large photoFit gap on its own.
  const favoritedButMismatched = makeSong({
    id: "fav-bad-fit",
    emotional_vector: [0.05, 0.05, 0.5, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
  });
  const greatFitNotFavorited = makeSong({
    id: "great-fit",
    emotional_vector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  });
  const req = makeRequest({
    queryVector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
    favoriteSongIds: ["fav-bad-fit"],
  });
  const { results } = rec.buildRecommendations(req, [favoritedButMismatched, greatFitNotFavorited]);
  assert.equal(results[0].id, "great-fit", "a great photo/mood fit should still win over a favorited-but-mismatched song");
});

test("emotional_vector stored as an empty array is treated the same as missing (no NaN scores)", () => {
  const broken = makeSong({ id: "broken", emotional_vector: [] });
  const { results, debugLog } = rec.buildRecommendations(makeRequest(), [broken]);
  assert.equal(results.length, 0, "song with an empty emotional_vector should be excluded, not scored as NaN");
  assert.equal(debugLog[0].removedReason, "no_emotional_vector");
});
