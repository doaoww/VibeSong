import assert from "node:assert/strict";
import { test } from "node:test";

const { computeShareCardLayout, truncateToWidth } = await import("../lib/shareCard.ts");

test("computeShareCardLayout keeps the plate fully inside the canvas", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.ok(layout.plate.x >= 0);
  assert.ok(layout.plate.y >= 0);
  assert.ok(layout.plate.x + layout.plate.width <= layout.width);
  assert.ok(layout.plate.y + layout.plate.height <= layout.height);
});

test("computeShareCardLayout keeps the artwork square fully inside the plate", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.ok(layout.artwork.x >= layout.plate.x);
  assert.ok(layout.artwork.y >= layout.plate.y);
  assert.ok(layout.artwork.x + layout.artwork.size <= layout.plate.x + layout.plate.width);
  assert.ok(layout.artwork.y + layout.artwork.size <= layout.plate.y + layout.plate.height);
});

test("computeShareCardLayout stacks the title above the artist at the same left edge", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.equal(layout.title.x, layout.artist.x);
  assert.ok(layout.title.y < layout.artist.y);
});

test("computeShareCardLayout produces a valid in-bounds layout for other aspect ratios", () => {
  const layout = computeShareCardLayout(720, 1280);
  assert.equal(layout.width, 720);
  assert.equal(layout.height, 1280);
  assert.ok(layout.plate.x + layout.plate.width <= 720);
  assert.ok(layout.plate.y + layout.plate.height <= 1280);
});

test("computeShareCardLayout places the gradient above the plate and ending at the bottom edge", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.ok(layout.gradientStartY < layout.plate.y);
  assert.equal(layout.gradientEndY, layout.height);
});

test("truncateToWidth returns the original text when it already fits", () => {
  const measure = (s) => s.length;
  assert.equal(truncateToWidth("Blinding Lights", 100, measure), "Blinding Lights");
});

test("truncateToWidth shortens and appends an ellipsis when text overflows", () => {
  const measure = (s) => s.length;
  assert.equal(truncateToWidth("Blinding Lights", 5, measure), "Blin…");
});

test("truncateToWidth never returns an empty string", () => {
  const measure = (s) => s.length * 100;
  const result = truncateToWidth("Blinding Lights", 1, measure);
  assert.ok(result.length >= 1);
});
