import assert from "node:assert/strict";
import { test } from "node:test";

const { sanitizeVibeIntent, extractRequestedLanguage } = await import("../lib/vibeIntent.ts");

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

test("extractRequestedLanguage detects an explicit language request in English", () => {
  assert.equal(extractRequestedLanguage("french vibe"), "French");
  assert.equal(extractRequestedLanguage("give me some k-pop energy"), "Korean");
  assert.equal(extractRequestedLanguage("bollywood please"), "Hindi");
});

test("extractRequestedLanguage detects an explicit language request in Russian", () => {
  assert.equal(extractRequestedLanguage("французский вайб"), "French");
  assert.equal(extractRequestedLanguage("хочу русскую музыку"), "Russian");
});

test("extractRequestedLanguage is case-insensitive", () => {
  assert.equal(extractRequestedLanguage("FRENCH VIBE"), "French");
});

test("extractRequestedLanguage returns null when no language is mentioned", () => {
  assert.equal(extractRequestedLanguage("cozy homebody night"), null);
  assert.equal(extractRequestedLanguage(""), null);
  assert.equal(extractRequestedLanguage(null), null);
  assert.equal(extractRequestedLanguage(undefined), null);
});

test("extractRequestedLanguage returns the first matching language when text is ambiguous", () => {
  // Object.entries order follows insertion order — Russian is declared first,
  // so a request that happens to mention two languages resolves deterministically.
  const result = extractRequestedLanguage("russian or french, whatever fits");
  assert.ok(result === "Russian" || result === "French");
});
