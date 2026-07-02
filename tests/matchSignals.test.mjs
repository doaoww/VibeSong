import assert from "node:assert/strict";
import { test } from "node:test";

const ms = await import("../lib/matchSignals.ts");

test("parseMatchSignals returns safe defaults when raw is not an object", () => {
  const result = ms.parseMatchSignals(null, 0.4);
  assert.deepEqual(result.scene_context_tags, []);
  assert.deepEqual(result.story_intent_tags, []);
  assert.deepEqual(result.modern_aesthetic_tags, []);
  assert.deepEqual(result.mood_tags, []);
  assert.deepEqual(result.anti_tags, []);
  assert.deepEqual(result.music_direction, { genres: [], references: [], avoid: [] });
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
  assert.deepEqual(result.scene_context_tags, ["night drive"]);
  assert.deepEqual(result.story_intent_tags, ["soft revenge"]);
  assert.deepEqual(result.modern_aesthetic_tags, ["old money"]);
  assert.deepEqual(result.mood_tags, ["melancholic"]);
});

test("parseMatchSignals validates anti_tags against the union vocabulary", () => {
  const result = ms.parseMatchSignals(
    {
      anti_tags: ["euphoric", "old money", "soft revenge", "night drive"],
    },
    0.4,
  );
  // "night drive" is a context tag, not in the union — rejected
  assert.deepEqual(result.anti_tags, ["euphoric", "old money", "soft revenge"]);
});

test("parseMatchSignals reads open-vocabulary music_direction fields as-is", () => {
  const result = ms.parseMatchSignals(
    {
      music_direction: { genres: ["slavic indie"], references: ["The xx", ""], avoid: ["EDM"] },
    },
    0.4,
  );
  assert.deepEqual(result.music_direction, { genres: ["slavic indie"], references: ["The xx"], avoid: ["EDM"] });
});

test("parseMatchSignals defaults music_direction when missing or malformed", () => {
  const result = ms.parseMatchSignals({ music_direction: "not an object" }, 0.4);
  assert.deepEqual(result.music_direction, { genres: [], references: [], avoid: [] });
});

test("parseMatchSignals accepts valid energy_bounds as-is", () => {
  const result = ms.parseMatchSignals({ energy_bounds: { min: 0.1, max: 0.3 } }, 0.4);
  assert.deepEqual(result.energy_bounds, { min: 0.1, max: 0.3 });
});

test("parseMatchSignals falls back to photoEnergy +/- 0.25 when energy_bounds has min > max", () => {
  const result = ms.parseMatchSignals({ energy_bounds: { min: 0.5, max: 0.2 } }, 0.6);
  assert.deepEqual(result.energy_bounds, { min: 0.35, max: 0.85 });
});

test("parseMatchSignals does not round fallback energy bounds for non-integer photoEnergy", () => {
  const result = ms.parseMatchSignals({}, 0.333);
  assert.equal(result.energy_bounds.min, 0.08300000000000002);
  assert.equal(result.energy_bounds.max, 0.583);
});

test("parseMatchSignals clamps the fallback energy_bounds to [0,1]", () => {
  const result = ms.parseMatchSignals({}, 0.05);
  assert.deepEqual(result.energy_bounds, { min: 0, max: 0.3 });
});
