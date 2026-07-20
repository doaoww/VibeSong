import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addVectors, normalizeVector, buildTasteVector, blendVectors, invertVector, ZERO_VECTOR
} from "../lib/emotionalVector.ts";

test("addVectors adds with scale", () => {
  const a = { ...ZERO_VECTOR, dreamy: 0.5 };
  const b = { ...ZERO_VECTOR, dreamy: 0.4 };
  const r = addVectors(a, b, 1.0);
  assert.equal(r.dreamy, 0.9);
});

test("normalizeVector clamps max to 1", () => {
  const v = { ...ZERO_VECTOR, dreamy: 2.0, nostalgia: 1.0 };
  const r = normalizeVector(v);
  assert.equal(r.dreamy, 1.0);
  assert.equal(r.nostalgia, 0.5);
});

test("buildTasteVector: likes add, skips subtract at 0.2", () => {
  const liked = [{ emotionalVector: { ...ZERO_VECTOR, dreamy: 1.0, energy: 0.5 } }];
  const skipped = [{ emotionalVector: { ...ZERO_VECTOR, dreamy: 0.5 } }];
  const v = buildTasteVector(liked, skipped);
  // dreamy: 1.0 - 0.5*0.2 = 0.9, energy: 0.5; max=0.9 → dreamy=1, energy≈0.56
  assert.ok(v.dreamy > v.energy);
});

test("buildTasteVector: all skipped still no negative values", () => {
  const skipped = [{ emotionalVector: { ...ZERO_VECTOR, dreamy: 1.0 } }];
  const v = buildTasteVector([], skipped);
  for (const val of Object.values(v)) assert.ok(val >= 0);
});

test("blendVectors: photo still dominates even at zero confidence", () => {
  const taste = { ...ZERO_VECTOR, dreamy: 1.0 };
  const photo = { ...ZERO_VECTOR, energy: 1.0 };
  const r = blendVectors(taste, photo, 0.0); // photoWeight=0.65
  // Low confidence is a hedge, not a license to substitute taste for the
  // photo — the photo must stay dominant even in the worst case.
  assert.ok(r.energy > r.dreamy);
});

test("blendVectors: high confidence leans even more on photo", () => {
  const taste = { ...ZERO_VECTOR, dreamy: 1.0 };
  const photo = { ...ZERO_VECTOR, energy: 1.0 };
  const low = blendVectors(taste, photo, 0.0); // photoWeight=0.65
  const high = blendVectors(taste, photo, 1.0); // photoWeight=0.95
  assert.ok(high.energy > low.energy);
});

test("invertVector flips values", () => {
  const v = { ...ZERO_VECTOR, dreamy: 0.8, energy: 0.2 };
  const r = invertVector(v);
  assert.equal(r.dreamy, 0.2);
  assert.equal(r.energy, 0.8);
});
