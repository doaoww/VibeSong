import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");
const moduleCache = new Map();
const stubState = {
  fetchImpl: (...args) => fetch(...args),
  openaiContent: "",
};

function resetHarness() {
  moduleCache.clear();
  stubState.fetchImpl = (...args) => fetch(...args);
  stubState.openaiContent = "";
}

function jsonResponse(data, ok = true) {
  return {
    ok,
    async json() {
      return data;
    },
  };
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
    if (id.includes("openai")) {
      return {
        __esModule: true,
        default: {
          chat: {
            completions: {
              create: async () => ({ choices: [{ message: { content: stubState.openaiContent } }] }),
            },
          },
        },
      };
    }

    if (id.startsWith(".")) {
      return loadTsModule(resolveLocalModule(dirname(resolvedPath), id));
    }

    try {
      return baseRequire(id);
    } catch {
      return {};
    }
  }

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process,
    URL,
    URLSearchParams,
    AbortSignal,
    fetch: (...args) => stubState.fetchImpl(...args),
    Array,
  });
  vm.runInContext(output, context, { filename: resolvedPath });
  return cjsModule.exports;
}

const autoTag = loadTsModule("lib/autoTag.ts");

test("buildGptTagPrompt includes title, artist and lastfm tags in output", () => {
  const { buildGptTagPrompt } = autoTag;
  const prompt = buildGptTagPrompt("Хочешь?", "Земфира", ["sad", "russian indie", "90s"]);
  assert.ok(prompt.includes("Хочешь?"));
  assert.ok(prompt.includes("Земфира"));
  assert.ok(prompt.includes("russian indie"));
});

test("buildGptTagPrompt enumerates all four canonical categories and asks for vibe_summary/confidence", () => {
  const { buildGptTagPrompt } = autoTag;
  const prompt = buildGptTagPrompt("Song", "Artist", []);
  assert.ok(prompt.includes("healing era"), "should list STORY_INTENT_TAGS options");
  assert.ok(prompt.includes("old money"), "should list expanded MODERN_AESTHETIC_TAGS options");
  assert.ok(prompt.includes("nostalgic"), "should list MOOD_TAGS options");
  assert.ok(prompt.includes("mirror selfie"), "should list STORY_CONTEXT_TAGS options");
  assert.ok(prompt.includes("vibe_summary"));
  assert.ok(prompt.includes("confidence_level"));
  assert.ok(prompt.includes("confidence_reason"));
});

test("parseGptTagResponse extracts emotional_vector and story_intent_tags", () => {
  const { parseGptTagResponse } = autoTag;
  const raw = JSON.stringify({
    language: "Russian",
    emotional_vector: { dreamy: 0.3, nostalgia: 0.8, energy: 0.2, cinematic: 0.6, darkness: 0.4, confidence: 0.3, intimacy: 0.7, danceability: 0.1, electronic: 0.2, acoustic: 0.8 },
    genre_tags: ["Russian indie", "alternative"],
    aesthetic_tags: ["raw", "nostalgic"],
    mood_tags: ["melancholic"],
    story_intent_tags: ["cold Russian melancholy", "bittersweet nostalgia"],
    modern_aesthetic_tags: ["russian indie"],
    story_context_tags: ["night drive"],
    vibe_summary: "A cold, wistful track about letting go.",
    confidence_level: "known_track",
    confidence_reason: "Recognized this exact track from training data.",
    popularity_tier: 2,
  });

  const result = parseGptTagResponse(raw);
  assert.equal(result.language, "Russian");
  assert.ok(result.story_intent_tags.includes("cold Russian melancholy"));
  assert.equal(result.emotional_vector.nostalgia, 0.8);
  assert.equal(result.vibe_summary, "A cold, wistful track about letting go.");
  assert.equal(result.confidence_level, "known_track");
  assert.equal(result.confidence_reason, "Recognized this exact track from training data.");
  assert.deepEqual([...result.discarded_tags], []);
});

test("parseGptTagResponse discards non-canonical tags into discarded_tags instead of silently dropping them", () => {
  const { parseGptTagResponse } = autoTag;
  const raw = JSON.stringify({
    language: "English",
    emotional_vector: {},
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: ["dreamy", "invented-mood"],
    story_intent_tags: ["healing era", "totally-made-up-intent"],
    modern_aesthetic_tags: ["mob wife", "unlisted-aesthetic"],
    story_context_tags: ["sunset", "unlisted-context"],
    vibe_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
    popularity_tier: 3,
  });

  const result = parseGptTagResponse(raw);
  assert.deepEqual([...result.mood_tags], ["dreamy"]);
  assert.deepEqual([...result.story_intent_tags], ["healing era"]);
  assert.deepEqual([...result.modern_aesthetic_tags], ["mob wife"]);
  assert.deepEqual([...result.story_context_tags], ["sunset"]);
  assert.deepEqual(
    [...result.discarded_tags].sort(),
    ["invented-mood", "totally-made-up-intent", "unlisted-aesthetic", "unlisted-context"].sort()
  );
});

test("parseGptTagResponse ignores non-string tag values before canonical splitting and DB arrays", () => {
  const { parseGptTagResponse } = autoTag;
  const raw = JSON.stringify({
    language: "English",
    emotional_vector: {},
    genre_tags: [" synthpop ", 42, true, { label: "nope" }, ""],
    aesthetic_tags: [" glossy ", false, ["nested"], null],
    mood_tags: ["dreamy", 99, { nope: true }],
    story_intent_tags: ["healing era", false],
    modern_aesthetic_tags: ["night luxe", { label: "bad" }],
    story_context_tags: ["night drive", ["bad"]],
    vibe_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
    popularity_tier: 3,
  });

  const result = parseGptTagResponse(raw);
  assert.deepEqual([...result.genre_tags], ["synthpop"]);
  assert.deepEqual([...result.aesthetic_tags], ["glossy"]);
  assert.deepEqual([...result.mood_tags], ["dreamy"]);
  assert.deepEqual([...result.story_intent_tags], ["healing era"]);
  assert.deepEqual([...result.modern_aesthetic_tags], ["night luxe"]);
  assert.deepEqual([...result.story_context_tags], ["night drive"]);
  assert.deepEqual([...result.discarded_tags], []);
});

test("parseGptTagResponse falls back to 'uncertain' for an unrecognized confidence_level", () => {
  const { parseGptTagResponse } = autoTag;
  const raw = JSON.stringify({
    language: "English",
    emotional_vector: {},
    genre_tags: [], aesthetic_tags: [], mood_tags: [], story_intent_tags: [],
    modern_aesthetic_tags: [], story_context_tags: [],
    vibe_summary: "",
    confidence_level: "super-duper-sure",
    confidence_reason: "",
    popularity_tier: 3,
  });
  const result = parseGptTagResponse(raw);
  assert.equal(result.confidence_level, "uncertain");
});

test("parseGptTagResponse falls back to defaults on malformed JSON", () => {
  const { parseGptTagResponse } = autoTag;
  const result = parseGptTagResponse("this is not json");
  assert.equal(result.language, "Unknown");
  assert.deepEqual([...result.story_intent_tags], []);
  assert.deepEqual([...result.discarded_tags], []);
  assert.equal(result.confidence_level, "uncertain");
});

test("mapConfidenceLevel maps each known level to its fixed score", () => {
  const { mapConfidenceLevel } = autoTag;
  assert.equal(mapConfidenceLevel("known_track"), 0.9);
  assert.equal(mapConfidenceLevel("known_artist_only"), 0.6);
  assert.equal(mapConfidenceLevel("metadata_inference"), 0.4);
  assert.equal(mapConfidenceLevel("uncertain"), 0.25);
});

test("mapConfidenceLevel falls back to the uncertain score for an unrecognized level", () => {
  const { mapConfidenceLevel } = autoTag;
  assert.equal(mapConfidenceLevel("something-else"), 0.25);
});

test("computeSourceConfidence combines evidence into a score and evidenceSources list", () => {
  const { computeSourceConfidence } = autoTag;

  const full = computeSourceConfidence("exact", ["russian indie"], 210, 2011);
  assert.ok(Math.abs(full.score - 0.85) < 0.001);
  assert.deepEqual([...full.evidenceSources].sort(), ["itunes_exact", "lastfm_tags", "metadata_complete"].sort());

  const nothing = computeSourceConfidence("none", [], null, null);
  assert.equal(nothing.score, 0);
  assert.deepEqual([...nothing.evidenceSources], []);

  const fallbackOnly = computeSourceConfidence("fallback", [], null, null);
  assert.ok(Math.abs(fallbackOnly.score - 0.2) < 0.001);
  assert.deepEqual([...fallbackOnly.evidenceSources], ["itunes_fallback"]);
});

test("autoTagSong keeps exact evidence conservative and surfaces final review fields", async () => {
  resetHarness();
  process.env.LASTFM_API_KEY = "test-lastfm-key";
  stubState.fetchImpl = async (url) => {
    if (url.startsWith("https://itunes.apple.com/search?")) {
      return jsonResponse({
        results: [
          {
            trackName: "Blinding Lights",
            artistName: "The Weeknd",
            collectionName: "After Hours",
            releaseDate: "2020-03-20T12:00:00Z",
            trackTimeMillis: 200040,
            previewUrl: "https://example.com/preview.m4a",
            artworkUrl100: "https://example.com/100x100bb.jpg",
            trackViewUrl: "https://example.com/apple-music",
          },
        ],
      });
    }

    if (url.startsWith("https://ws.audioscrobbler.com/2.0/")) {
      return jsonResponse({
        toptags: {
          tag: [{ name: "synthpop" }, { name: "pop" }],
        },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  stubState.openaiContent = JSON.stringify({
    language: "English",
    popularity_tier: 5,
    emotional_vector: {
      dreamy: 0.2,
      nostalgia: 0.7,
      energy: 0.8,
      cinematic: 0.4,
      darkness: 0.1,
      confidence: 0.9,
      intimacy: 0.2,
      danceability: 0.9,
      electronic: 0.8,
      acoustic: 0.1,
    },
    genre_tags: ["synthpop"],
    aesthetic_tags: ["neon"],
    mood_tags: ["euphoric"],
    story_intent_tags: ["main character energy"],
    modern_aesthetic_tags: ["night luxe"],
    story_context_tags: ["night drive"],
    vibe_summary: "Big neon heartbreak.",
    confidence_level: "known_artist_only",
    confidence_reason: "Recognize the artist and likely the song.",
  });

  const { autoTagSong } = loadTsModule("lib/autoTag.ts");
  const result = await autoTagSong("blinding lights", "the weeknd");

  assert.equal(result.source_confidence, 0.85);
  assert.equal(result.final_confidence, 0.6);
  assert.equal(result.needs_review, false);
  assert.deepEqual(
    [...result.evidence_sources],
    ["itunes_exact", "lastfm_tags", "metadata_complete"]
  );
  assert.equal(result.tagging_version, "v1");
});

test("autoTagSong treats artist-only iTunes hits as fallback evidence", async () => {
  resetHarness();
  delete process.env.LASTFM_API_KEY;
  stubState.fetchImpl = async (url) => {
    if (url.startsWith("https://itunes.apple.com/search?")) {
      return jsonResponse({
        results: [
          {
            trackName: "Save Your Tears",
            artistName: "The Weeknd",
            collectionName: "After Hours",
            releaseDate: "2020-03-20T12:00:00Z",
            trackTimeMillis: 215626,
            previewUrl: "https://example.com/fallback-preview.m4a",
            artworkUrl100: "https://example.com/fallback-100x100bb.jpg",
            trackViewUrl: "https://example.com/fallback-apple-music",
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  stubState.openaiContent = JSON.stringify({
    language: "English",
    popularity_tier: 5,
    emotional_vector: {
      dreamy: 0.1,
      nostalgia: 0.5,
      energy: 0.7,
      cinematic: 0.3,
      darkness: 0.1,
      confidence: 0.9,
      intimacy: 0.2,
      danceability: 0.7,
      electronic: 0.7,
      acoustic: 0.1,
    },
    genre_tags: ["pop"],
    aesthetic_tags: ["glossy"],
    mood_tags: ["confident"],
    story_intent_tags: ["main character energy"],
    modern_aesthetic_tags: ["night luxe"],
    story_context_tags: ["city lights"],
    vibe_summary: "Polished late-night pop.",
    confidence_level: "known_track",
    confidence_reason: "Recognize the exact song.",
  });

  const { autoTagSong } = loadTsModule("lib/autoTag.ts");
  const result = await autoTagSong("Blinding Lights", "The Weeknd");

  assert.equal(result.title, "Save Your Tears");
  assert.equal(result.source_confidence, 0.35);
  assert.equal(result.final_confidence, 0.35);
  assert.equal(result.needs_review, true);
  assert.deepEqual([...result.evidence_sources], ["itunes_fallback", "metadata_complete"]);
  assert.equal(result.tagging_version, "v1");
});

test("autoTagSong uses a provided lyrics provider without changing source_confidence", async () => {
  resetHarness();
  delete process.env.LASTFM_API_KEY;
  let lyricsCall = null;
  stubState.fetchImpl = async (url) => {
    if (url.startsWith("https://itunes.apple.com/search?")) {
      return jsonResponse({
        results: [
          {
            trackName: "Midnight City",
            artistName: "M83",
            collectionName: "Hurry Up, We're Dreaming",
            releaseDate: "2011-07-16T12:00:00Z",
            trackTimeMillis: 244000,
            previewUrl: "https://example.com/m83-preview.m4a",
            artworkUrl100: "https://example.com/m83-100x100bb.jpg",
            trackViewUrl: "https://example.com/m83-apple-music",
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  stubState.openaiContent = JSON.stringify({
    language: "English",
    popularity_tier: 4,
    emotional_vector: {
      dreamy: 0.9,
      nostalgia: 0.8,
      energy: 0.6,
      cinematic: 0.7,
      darkness: 0.1,
      confidence: 0.5,
      intimacy: 0.2,
      danceability: 0.5,
      electronic: 0.8,
      acoustic: 0.1,
    },
    genre_tags: ["synthpop"],
    aesthetic_tags: ["shimmering"],
    mood_tags: ["dreamy"],
    story_intent_tags: ["main character energy"],
    modern_aesthetic_tags: ["night luxe"],
    story_context_tags: ["night drive"],
    vibe_summary: "Big glowing nostalgia.",
    confidence_level: "known_track",
    confidence_reason: "Recognize the exact song.",
  });

  const { autoTagSong } = loadTsModule("lib/autoTag.ts");
  const lyricsProvider = {
    async fetchLyrics(title, artist) {
      lyricsCall = { title, artist };
      return "The city is my church.";
    },
  };

  const result = await autoTagSong("Midnight City", "M83", lyricsProvider);

  assert.deepEqual(lyricsCall, { title: "Midnight City", artist: "M83" });
  assert.equal(result.source_confidence, 0.55);
  assert.equal(result.final_confidence, 0.55);
});
