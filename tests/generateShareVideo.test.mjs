import assert from "node:assert/strict";
import { test } from "node:test";

const { buildShareVideoPlan } = await import("../lib/generateShareVideo.ts");

test("buildShareVideoPlan targets a 1080x1920, 15-second output", () => {
  const plan = buildShareVideoPlan(0);
  assert.equal(plan.width, 1080);
  assert.equal(plan.height, 1920);
  assert.equal(plan.durationSeconds, 15);
});

test("buildShareVideoPlan seeks the audio input to the given start second", () => {
  const plan = buildShareVideoPlan(42);
  assert.deepEqual(plan.audioInputOptions, ["-ss", "42"]);
});

test("buildShareVideoPlan clamps a negative start second to 0", () => {
  const plan = buildShareVideoPlan(-5);
  assert.deepEqual(plan.audioInputOptions, ["-ss", "0"]);
});

test("buildShareVideoPlan's scale/crop filter targets the exact output dimensions", () => {
  const plan = buildShareVideoPlan(0);
  assert.equal(
    plan.scaleCropFilter,
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
  );
});

test("buildShareVideoPlan's output options cap duration at 15s and mark it as the shortest stream", () => {
  const plan = buildShareVideoPlan(0);
  assert.ok(plan.outputOptions.includes("-shortest"));
  const tIndex = plan.outputOptions.indexOf("-t");
  assert.ok(tIndex !== -1);
  assert.equal(plan.outputOptions[tIndex + 1], "15");
});

test("buildShareVideoPlan marks the photo input to loop", () => {
  const plan = buildShareVideoPlan(0);
  assert.deepEqual(plan.photoInputOptions, ["-loop", "1"]);
});
