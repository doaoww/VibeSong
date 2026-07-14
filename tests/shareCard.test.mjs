import assert from "node:assert/strict";
import { test } from "node:test";

const { computeCoverFit } = await import("../lib/shareCard.ts");

test("computeCoverFit crops a wider-than-canvas image on the sides", () => {
  const fit = computeCoverFit(4000, 1000, 1080, 1920);
  assert.equal(fit.offsetY, 0);
  assert.equal(fit.drawHeight, 1920);
  assert.ok(fit.drawWidth > 1080);
  assert.ok(fit.offsetX < 0);
});

test("computeCoverFit crops a taller-than-canvas image on top/bottom", () => {
  const fit = computeCoverFit(1000, 4000, 1080, 1920);
  assert.equal(fit.offsetX, 0);
  assert.equal(fit.drawWidth, 1080);
  assert.ok(fit.drawHeight > 1920);
  assert.ok(fit.offsetY < 0);
});

test("computeCoverFit draws an exact-ratio image with no cropping", () => {
  const fit = computeCoverFit(1080, 1920, 1080, 1920);
  assert.equal(fit.offsetX, 0);
  assert.equal(fit.offsetY, 0);
  assert.equal(fit.drawWidth, 1080);
  assert.equal(fit.drawHeight, 1920);
});

test("computeCoverFit crops a square image into a portrait canvas on the sides", () => {
  const fit = computeCoverFit(1000, 1000, 1080, 1920);
  assert.equal(fit.offsetY, 0);
  assert.equal(fit.drawHeight, 1920);
  assert.ok(fit.drawWidth > 1080);
  assert.ok(fit.offsetX < 0);
});
