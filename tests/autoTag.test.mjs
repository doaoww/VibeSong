import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  // safeRequire: return a stub for any module that cannot be resolved
  // (e.g. sibling .ts files, SDK modules not available in the vm context)
  function safeRequire(id) {
    try {
      return baseRequire(id);
    } catch {
      return { default: {}, __esModule: true };
    }
  }

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: safeRequire,
    console,
    process,
    URLSearchParams,
    Array,
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const autoTag = loadTsModule("lib/autoTag.ts");

test("buildGptTagPrompt includes title, artist and lastfm tags in output", () => {
  const { buildGptTagPrompt } = autoTag;
  if (!buildGptTagPrompt) {
    assert.fail("buildGptTagPrompt not exported from lib/autoTag.ts");
  }
  const prompt = buildGptTagPrompt("Хочешь?", "Земфира", ["sad", "russian indie", "90s"]);
  assert.ok(prompt.includes("Хочешь?"));
  assert.ok(prompt.includes("Земфира"));
  assert.ok(prompt.includes("russian indie"));
});

test("parseGptTagResponse extracts emotional_vector and story_intent_tags", () => {
  const { parseGptTagResponse } = autoTag;
  if (!parseGptTagResponse) assert.fail("parseGptTagResponse not exported from lib/autoTag.ts");

  const raw = JSON.stringify({
    language: "Russian",
    emotional_vector: {
      dreamy: 0.3, nostalgia: 0.8, energy: 0.2, cinematic: 0.6, darkness: 0.4,
      confidence: 0.3, intimacy: 0.7, danceability: 0.1, electronic: 0.2, acoustic: 0.8,
    },
    genre_tags: ["Russian indie", "alternative"],
    aesthetic_tags: ["raw", "nostalgic"],
    mood_tags: ["melancholic", "yearning"],
    story_intent_tags: ["cold Russian melancholy", "bittersweet nostalgia"],
    modern_aesthetic_tags: ["Slavic sad girl"],
    popularity_tier: 2,
  });

  const result = parseGptTagResponse(raw);
  assert.equal(result.language, "Russian");
  assert.ok(Array.isArray(result.story_intent_tags));
  assert.ok(result.story_intent_tags.includes("cold Russian melancholy"));
  assert.ok(result.emotional_vector.nostalgia === 0.8);
});

test("parseGptTagResponse falls back to defaults on malformed JSON", () => {
  const { parseGptTagResponse } = autoTag;
  if (!parseGptTagResponse) assert.fail("parseGptTagResponse not exported");
  const result = parseGptTagResponse("this is not json");
  assert.equal(result.language, "Unknown");
  // Use length check to avoid cross-realm Array prototype mismatch in vm context
  assert.equal(result.story_intent_tags.length, 0);
});
