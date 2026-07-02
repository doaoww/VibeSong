import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");
const moduleCache = new Map();

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
    if (id.startsWith(".")) {
      return loadTsModule(resolveLocalModule(dirname(resolvedPath), id));
    }
    return baseRequire(id);
  }

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process,
    Array,
  });
  vm.runInContext(output, context, { filename: resolvedPath });
  return cjsModule.exports;
}

const ms = loadTsModule("lib/matchSignals.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("parseMatchSignals returns safe defaults when raw is not an object", () => {
  const result = ms.parseMatchSignals(null, 0.4);
  assert.deepEqual(plain(result.scene_context_tags), []);
  assert.deepEqual(plain(result.story_intent_tags), []);
  assert.deepEqual(plain(result.modern_aesthetic_tags), []);
  assert.deepEqual(plain(result.mood_tags), []);
  assert.deepEqual(plain(result.anti_tags), []);
  assert.deepEqual(plain(result.music_direction), { genres: [], references: [], avoid: [] });
  assert.equal(result.energy_bounds.min, 0.15000000000000002);
  assert.equal(result.energy_bounds.max, 0.65);
});

test("parseMatchSignals keeps only canonical tags, drops hallucinated ones", () => {
  const result = ms.parseMatchSignals(
    {
      scene_context_tags: ["night drive", "made-up-scene"],
      story_intent_tags: ["soft revenge", "not-a-real-tag"],
      modern_aesthetic_tags: ["old money"],
      mood_tags: ["melancholic", "not-a-mood"],
    },
    0.4,
  );
  assert.deepEqual(plain(result.scene_context_tags), ["night drive"]);
  assert.deepEqual(plain(result.story_intent_tags), ["soft revenge"]);
  assert.deepEqual(plain(result.modern_aesthetic_tags), ["old money"]);
  assert.deepEqual(plain(result.mood_tags), ["melancholic"]);
});

test("parseMatchSignals validates anti_tags against the union vocabulary", () => {
  const result = ms.parseMatchSignals(
    {
      anti_tags: ["euphoric", "old money", "soft revenge", "night drive"],
    },
    0.4,
  );
  // "night drive" is a context tag, not in the union — rejected
  assert.deepEqual(plain(result.anti_tags), ["euphoric", "old money", "soft revenge"]);
});

test("parseMatchSignals reads open-vocabulary music_direction fields as-is", () => {
  const result = ms.parseMatchSignals(
    {
      music_direction: { genres: ["slavic indie"], references: ["The xx", ""], avoid: ["EDM"] },
    },
    0.4,
  );
  assert.deepEqual(plain(result.music_direction), { genres: ["slavic indie"], references: ["The xx"], avoid: ["EDM"] });
});

test("parseMatchSignals defaults music_direction when missing or malformed", () => {
  const result = ms.parseMatchSignals({ music_direction: "not an object" }, 0.4);
  assert.deepEqual(plain(result.music_direction), { genres: [], references: [], avoid: [] });
});

test("parseMatchSignals accepts valid energy_bounds as-is", () => {
  const result = ms.parseMatchSignals({ energy_bounds: { min: 0.1, max: 0.3 } }, 0.4);
  assert.deepEqual(plain(result.energy_bounds), { min: 0.1, max: 0.3 });
});

test("parseMatchSignals falls back to photoEnergy +/- 0.25 when energy_bounds has min > max", () => {
  const result = ms.parseMatchSignals({ energy_bounds: { min: 0.5, max: 0.2 } }, 0.6);
  assert.deepEqual(plain(result.energy_bounds), { min: 0.35, max: 0.85 });
});

test("parseMatchSignals does not round fallback energy bounds for non-integer photoEnergy", () => {
  const result = ms.parseMatchSignals({}, 0.333);
  assert.equal(result.energy_bounds.min, 0.08300000000000002);
  assert.equal(result.energy_bounds.max, 0.583);
});

test("parseMatchSignals clamps the fallback energy_bounds to [0,1]", () => {
  const result = ms.parseMatchSignals({}, 0.05);
  assert.deepEqual(plain(result.energy_bounds), { min: 0, max: 0.3 });
});

test("confidenceFactor scales 0.5-1.0 across the confidence range", () => {
  assert.equal(ms.confidenceFactor(0), 0.5);
  assert.equal(ms.confidenceFactor(1), 1.0);
  assert.ok(Math.abs(ms.confidenceFactor(0.5) - 0.75) < 1e-9);
});

test("confidenceFactor clamps out-of-range input", () => {
  assert.equal(ms.confidenceFactor(-1), 0.5);
  assert.equal(ms.confidenceFactor(2), 1.0);
});

test("gateAntiTags passes tags through at or above the 0.4 threshold", () => {
  assert.deepEqual(plain(ms.gateAntiTags(["euphoric"], 0.4)), ["euphoric"]);
  assert.deepEqual(plain(ms.gateAntiTags(["euphoric"], 0.9)), ["euphoric"]);
});

test("gateAntiTags drops tags below the 0.4 threshold", () => {
  assert.deepEqual(plain(ms.gateAntiTags(["euphoric"], 0.39)), []);
});

test("gateEnergyBounds passes bounds through unchanged at or above confidence 0.6", () => {
  const bounds = { min: 0.1, max: 0.3 };
  assert.deepEqual(ms.gateEnergyBounds(bounds, 0.5, 0.6), bounds);
  assert.deepEqual(ms.gateEnergyBounds(bounds, 0.5, 1.0), bounds);
});

test("gateEnergyBounds widens fully toward photoEnergy +/- 0.25 at confidence 0", () => {
  const result = ms.gateEnergyBounds({ min: 0.1, max: 0.3 }, 0.5, 0);
  assert.deepEqual(plain(result), { min: 0.25, max: 0.75 });
});

test("gateEnergyBounds blends linearly between confidence 0 and 0.6", () => {
  // confidence 0.3 -> t = 0.5 -> halfway between GPT bounds and the safe bounds
  const result = ms.gateEnergyBounds({ min: 0.1, max: 0.3 }, 0.5, 0.3);
  assert.ok(Math.abs(result.min - 0.175) < 1e-9); // 0.1*0.5 + 0.25*0.5
  assert.ok(Math.abs(result.max - 0.525) < 1e-9); // 0.3*0.5 + 0.75*0.5
});

test("mergeGenreScores adds positive weight for genres and negative for avoid, scaled by confidence", () => {
  const result = ms.mergeGenreScores({ "indie pop": 0.5 }, ["slavic indie"], ["EDM"], 1.0);
  assert.equal(result["indie pop"], 0.5);
  assert.ok(Math.abs(result["slavic indie"] - 0.6) < 1e-9);
  assert.ok(Math.abs(result["EDM"] - -0.6) < 1e-9);
});

test("mergeGenreScores scales contribution by confidenceFactor", () => {
  const result = ms.mergeGenreScores({}, ["slavic indie"], [], 0);
  assert.ok(Math.abs(result["slavic indie"] - 0.3) < 1e-9); // 0.6 * confidenceFactor(0)=0.5
});

test("mergeLikedArtists unions and dedupes", () => {
  const result = ms.mergeLikedArtists(["Zemfira", "The xx"], ["The xx", "Molchat Doma"]);
  assert.deepEqual(plain(result), ["Zemfira", "The xx", "Molchat Doma"]);
});
