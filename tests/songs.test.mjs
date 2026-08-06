import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const mockSupabase = { rpc: async () => ({ data: [], error: null }) };

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const stubRequire = (mod) => {
    if (mod.includes("supabaseCatalog")) return { supabaseCatalog: mockSupabase };
    if (mod.includes("vectorMath")) return { vectorToArray: () => [] };
    return require(mod);
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process, Array });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const songsLib = loadTsModule("lib/db/songs.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("searchCatalogByTags calls match_songs_by_tags with the given tag arrays and a default match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => {
    captured = { name, args };
    return { data: [{ id: "1" }], error: null };
  };
  const result = await songsLib.searchCatalogByTags({ contextTags: ["night drive"] });
  assert.equal(captured.name, "match_songs_by_tags");
  assert.deepEqual(plain(captured.args), {
    p_context_tags: ["night drive"],
    p_intent_tags: [],
    p_aesthetic_tags: [],
    p_mood_tags: [],
    p_match_count: 25,
  });
  assert.deepEqual(plain(result), [{ id: "1", emotional_vector: null }]);
});

test("searchCatalogByTags accepts a custom match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: [], error: null }; };
  await songsLib.searchCatalogByTags({ intentTags: ["soft revenge"] }, 10);
  assert.equal(captured.args.p_match_count, 10);
  assert.deepEqual(captured.args.p_intent_tags, ["soft revenge"]);
});

test("searchCatalogByTags throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.searchCatalogByTags({}), /searchCatalogByTags failed: boom/);
});

test("searchCatalogByLanguage calls match_songs_by_language with languages and query vector", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => {
    captured = { name, args };
    return { data: [{ id: "1" }], error: null };
  };
  const result = await songsLib.searchCatalogByLanguage(["Russian", "English"], [0.1, 0.2]);
  assert.equal(captured.name, "match_songs_by_language");
  assert.deepEqual(plain(captured.args), {
    p_languages: ["Russian", "English"],
    query_vector: [0.1, 0.2],
    p_match_count: 25,
  });
  assert.deepEqual(plain(result), [{ id: "1", emotional_vector: null }]);
});

test("searchCatalogByLanguage accepts a custom match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: [], error: null }; };
  await songsLib.searchCatalogByLanguage(["Korean"], [0.1], 10);
  assert.equal(captured.args.p_match_count, 10);
});

test("searchCatalogByLanguage throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.searchCatalogByLanguage(["Russian"], [0.1]), /searchCatalogByLanguage failed: boom/);
});

test("searchCatalogByTaste calls match_songs_by_taste with artist patterns and positive genres", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: [{ id: "2" }], error: null }; };
  const result = await songsLib.searchCatalogByTaste({ artistPatterns: ["%The xx%"], positiveGenres: ["indie"] });
  assert.equal(captured.name, "match_songs_by_taste");
  assert.deepEqual(plain(captured.args), { p_artist_patterns: ["%The xx%"], p_positive_genres: ["indie"], p_match_count: 20 });
  assert.deepEqual(plain(result), [{ id: "2", emotional_vector: null }]);
});

test("recordFeedback calls record_song_feedback with the song id and action", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.recordFeedback("song-123", "save");
  assert.equal(captured.name, "record_song_feedback");
  assert.deepEqual(plain(captured.args), { p_song_id: "song-123", p_action: "save" });
});

test("recordFeedback throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.recordFeedback("song-123", "save"), /recordFeedback failed: boom/);
});

// toCatalogFeedbackAction is the seam between track_feedback's "saved"/"skipped"
// action strings (app/api/feedback/route.ts) and record_song_feedback's
// "save"/"skip"/"perfect" vocabulary, so the catalog's quality_score (fed by
// save_count/skip_count — see supabase/ranking-quality-fix-migration.sql) can
// finally be updated by the swipe UI that was never calling recordFeedback at all.
test("toCatalogFeedbackAction maps track_feedback action strings to record_song_feedback's vocabulary", () => {
  assert.equal(songsLib.toCatalogFeedbackAction("saved"), "save");
  assert.equal(songsLib.toCatalogFeedbackAction("skipped"), "skip");
});

test("searchCatalogByTaste throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.searchCatalogByTaste({}), /searchCatalogByTaste failed: boom/);
});

test("updateSong forwards story_context_tags and vibe_summary to update_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { story_context_tags: ["beach"], vibe_summary: "a sunny afternoon feeling" });
  assert.equal(captured.name, "update_song");
  assert.equal(captured.args.p_id, "song-id");
  assert.deepEqual(captured.args.p_story_context_tags, ["beach"]);
  assert.equal(captured.args.p_vibe_summary, "a sunny afternoon feeling");
});

test("searchCatalogByBrief calls match_songs_by_brief with the embedding and a default match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => {
    captured = { name, args };
    return { data: [{ id: "1" }], error: null };
  };
  const embedding = [0.1, 0.2, 0.3];
  const result = await songsLib.searchCatalogByBrief(embedding);
  assert.equal(captured.name, "match_songs_by_brief");
  assert.deepEqual(plain(captured.args), { p_brief_vector: embedding, p_match_count: 25 });
  assert.deepEqual(plain(result), [{ id: "1", emotional_vector: null }]);
});

test("searchCatalogByBrief accepts a custom match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: [], error: null }; };
  await songsLib.searchCatalogByBrief([0.1], 10);
  assert.equal(captured.args.p_match_count, 10);
});

test("searchCatalogByBrief throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.searchCatalogByBrief([0.1]), /searchCatalogByBrief failed: boom/);
});

test("getSongsByIds calls get_songs_by_ids with the given ids", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => {
    captured = { name, args };
    return { data: [{ id: "1" }, { id: "2" }], error: null };
  };
  const result = await songsLib.getSongsByIds(["1", "2"]);
  assert.equal(captured.name, "get_songs_by_ids");
  assert.deepEqual(plain(captured.args), { p_song_ids: ["1", "2"] });
  assert.deepEqual(plain(result), [
    { id: "1", emotional_vector: null },
    { id: "2", emotional_vector: null },
  ]);
});

test("getSongsByIds returns [] without calling the RPC when given an empty array", async () => {
  let called = false;
  mockSupabase.rpc = async () => { called = true; return { data: [], error: null }; };
  const result = await songsLib.getSongsByIds([]);
  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 0);
  assert.equal(called, false, "should short-circuit before hitting the RPC");
});

test("getSongsByIds throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.getSongsByIds(["1"]), /getSongsByIds failed: boom/);
});

test("getSongsByIds parses a string-form emotional_vector the same way as the other pool functions", async () => {
  mockSupabase.rpc = async () => ({
    data: [{ id: "1", emotional_vector: "[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1]" }],
    error: null,
  });
  const [song] = await songsLib.getSongsByIds(["1"]);
  assert.deepEqual(plain(song.emotional_vector), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
});

test("updateSong forwards music_supervisor_summary and brief_embedding to update_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", {
    music_supervisor_summary: "a quiet, unhurried night song",
    brief_embedding: [0.1, 0.2],
  });
  assert.equal(captured.name, "update_song");
  assert.equal(captured.args.p_id, "song-id");
  assert.equal(captured.args.p_music_supervisor_summary, "a quiet, unhurried night song");
  assert.equal(captured.args.p_brief_embedding, "[0.1,0.2]");
});

test("updateSong passes null for brief_embedding when not provided", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { language: "English" });
  assert.equal(captured.args.p_brief_embedding, null);
});

// PostgREST has no JSON mapping for pgvector's `vector` type - it returns
// vector columns as their Postgres text output format ("[0.1,0.2,...]"), a
// string, inside the JSON response. Every read path must parse that back
// into a real number[] before it reaches cosine(), or the math silently
// produces NaN. These tests lock in that parsing across every pool function.

test("searchCatalog parses a string-form emotional_vector into a real number array", async () => {
  mockSupabase.rpc = async () => ({
    data: [{ id: "1", emotional_vector: "[0.4,0.6,0.3,0.5,0.2,0.4,0.5,0.3,0.1,0.7]" }],
    error: null,
  });
  const [song] = await songsLib.searchCatalog([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.ok(Array.isArray(song.emotional_vector), "emotional_vector should be a real array, not a string");
  assert.deepEqual(plain(song.emotional_vector), [0.4, 0.6, 0.3, 0.5, 0.2, 0.4, 0.5, 0.3, 0.1, 0.7]);
});

test("searchCatalog preserves a null emotional_vector instead of crashing", async () => {
  mockSupabase.rpc = async () => ({ data: [{ id: "1", emotional_vector: null }], error: null });
  const [song] = await songsLib.searchCatalog([0.5]);
  assert.equal(song.emotional_vector, null);
});

test("searchCatalogByTags parses a string-form emotional_vector the same way", async () => {
  mockSupabase.rpc = async () => ({
    data: [{ id: "1", emotional_vector: "[1,0,0,0,0,0,0,0,0,0]" }],
    error: null,
  });
  const [song] = await songsLib.searchCatalogByTags({ intentTags: ["healing era"] });
  assert.deepEqual(plain(song.emotional_vector), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test("searchCatalogByTaste parses a string-form emotional_vector the same way", async () => {
  mockSupabase.rpc = async () => ({
    data: [{ id: "1", emotional_vector: "[1,0,0,0,0,0,0,0,0,0]" }],
    error: null,
  });
  const [song] = await songsLib.searchCatalogByTaste({ positiveGenres: ["indie"] });
  assert.deepEqual(plain(song.emotional_vector), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test("searchCatalogByBrief parses both string-form emotional_vector and brief_embedding", async () => {
  mockSupabase.rpc = async () => ({
    data: [{
      id: "1",
      emotional_vector: "[0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5]",
      brief_embedding: "[0.1,0.2,0.3]",
    }],
    error: null,
  });
  const [song] = await songsLib.searchCatalogByBrief([0.1, 0.2, 0.3]);
  assert.deepEqual(plain(song.emotional_vector), [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.ok(Array.isArray(song.brief_embedding), "brief_embedding should be a real array, not a string");
  assert.deepEqual(plain(song.brief_embedding), [0.1, 0.2, 0.3]);
});

test("listSongs also parses emotional_vector (admin catalog listing hits the same bug)", async () => {
  mockSupabase.rpc = async () => ({
    data: [{ id: "1", emotional_vector: "[0.9,0.1,0,0,0,0,0,0,0,0]" }],
    error: null,
  });
  const [song] = await songsLib.listSongs();
  assert.deepEqual(plain(song.emotional_vector), [0.9, 0.1, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test("updateSong forwards lyrical_address to update_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { lyrical_address: "male" });
  assert.equal(captured.name, "update_song");
  assert.equal(captured.args.p_lyrical_address, "male");
});

test("updateSong passes null for lyrical_address when not provided", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { language: "English" });
  assert.equal(captured.args.p_lyrical_address, null);
});

test("updateSong forwards flagForReview to update_song as p_flag_for_review", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { flagForReview: true });
  assert.equal(captured.name, "update_song");
  assert.equal(captured.args.p_flag_for_review, true);
});

test("updateSong omits p_flag_for_review entirely when not provided (not even as false)", async () => {
  // Deliberately NOT sent as false: the live update_song function (before
  // supabase/needs-review-flag-migration.sql is applied) has no
  // p_flag_for_review parameter at all, and PostgREST errors on any RPC call
  // naming a parameter no live overload has -- so every other call (Approve,
  // tag edits) must omit it entirely rather than defaulting to false.
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { language: "English" });
  assert.equal("p_flag_for_review" in captured.args, false);
});

test("insertSong forwards lyrical_address to create_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: "new-id", error: null }; };
  await songsLib.insertSong({
    title: "Song",
    artist: "Artist",
    album: null,
    year: null,
    duration_seconds: null,
    language: "English",
    popularity_tier: 3,
    emotional_vector: { dreamy: 0, nostalgia: 0, energy: 0, cinematic: 0, darkness: 0, confidence: 0, intimacy: 0, danceability: 0, electronic: 0, acoustic: 0 },
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: [],
    story_intent_tags: [],
    modern_aesthetic_tags: [],
    story_context_tags: [],
    discarded_tags: [],
    vibe_summary: "",
    music_supervisor_summary: "",
    brief_embedding: [],
    confidence_level: "uncertain",
    confidence_reason: "",
    gpt_confidence: 0.25,
    source_confidence: 0,
    final_confidence: 0,
    needs_review: true,
    evidence_sources: [],
    tagging_version: "v1",
    itunes_preview_url: null,
    artwork_url: null,
    apple_music_url: null,
    youtube_id: null,
    energy: 0.5,
    lyrical_address: "neutral",
  });
  assert.equal(captured.name, "create_song");
  assert.equal(captured.args.p_lyrical_address, "neutral");
});
