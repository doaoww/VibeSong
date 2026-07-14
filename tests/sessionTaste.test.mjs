import { strict as assert } from "node:assert";
import { test } from "node:test";
import { computeSessionTasteVector, scoreRemainingTracks } from "../lib/sessionTaste.ts";

test("computeSessionTasteVector returns null before any track is saved", () => {
  const result = computeSessionTasteVector([], [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]);
  assert.equal(result, null);
});

test("computeSessionTasteVector returns a 10-length vector once a track is saved", () => {
  const saved = [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }];
  const result = computeSessionTasteVector(saved, []);
  assert.equal(result.length, 10);
  assert.equal(result[0], 1);
});

test("computeSessionTasteVector weighs the saved track's dimension over a skipped one", () => {
  const saved = [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]; // dreamy
  const skipped = [{ emotionalVector: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] }]; // nostalgia
  const result = computeSessionTasteVector(saved, skipped);
  assert.ok(result[0] > result[1]);
});

test("computeSessionTasteVector ignores tracks without a usable emotionalVector", () => {
  const saved = [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { emotionalVector: null }, {}];
  const result = computeSessionTasteVector(saved, []);
  assert.equal(result.length, 10);
  assert.equal(result[0], 1);
});

test("scoreRemainingTracks ranks the track closer to the session vector first", () => {
  const sessionVector = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const tracks = [
    { id: "far", finalScore: 50, emotionalVector: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
    { id: "close", finalScore: 50, emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ];
  const result = scoreRemainingTracks(tracks, sessionVector);
  assert.equal(result[0].id, "close");
});

test("scoreRemainingTracks falls back to 60% of base score when a track has no vector", () => {
  const sessionVector = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const tracks = [{ id: "novector", finalScore: 80 }];
  const result = scoreRemainingTracks(tracks, sessionVector);
  assert.equal(result[0].liveScore, 48);
});
