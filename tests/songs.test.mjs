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
