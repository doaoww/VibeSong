import assert from "node:assert/strict";
import { test } from "node:test";

const { sanitizeVibeIntent } = await import("../lib/vibeIntent.ts");

test("sanitizeVibeIntent trims surrounding whitespace", () => {
  assert.equal(sanitizeVibeIntent("  cozy homebody night  "), "cozy homebody night");
});

test("sanitizeVibeIntent returns empty string for non-string input", () => {
  assert.equal(sanitizeVibeIntent(null), "");
  assert.equal(sanitizeVibeIntent(undefined), "");
  assert.equal(sanitizeVibeIntent(42), "");
  assert.equal(sanitizeVibeIntent(["a"]), "");
});

test("sanitizeVibeIntent caps length at 120 characters", () => {
  const result = sanitizeVibeIntent("x".repeat(500));
  assert.equal(result.length, 120);
});

test("sanitizeVibeIntent returns empty string for whitespace-only input", () => {
  assert.equal(sanitizeVibeIntent("   "), "");
});
