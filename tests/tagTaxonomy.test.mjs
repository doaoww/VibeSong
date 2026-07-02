import assert from "node:assert/strict";
import { test } from "node:test";

const taxonomy = await import("../lib/tagTaxonomy.ts");

test("STORY_INTENT_TAGS has 24 entries and includes known values", () => {
  assert.equal(taxonomy.STORY_INTENT_TAGS.length, 24);
  assert.ok(taxonomy.STORY_INTENT_TAGS_SET.has("healing era"));
  assert.ok(taxonomy.STORY_INTENT_TAGS_SET.has("soft revenge"));
});

test("MODERN_AESTHETIC_TAGS has 15 entries including the expanded set", () => {
  assert.equal(taxonomy.MODERN_AESTHETIC_TAGS.length, 15);
  for (const tag of ["old money", "soft grunge", "bedroom pop", "dark feminine", "night luxe", "mob wife", "pinterest girl", "russian indie", "alt girl"]) {
    assert.ok(taxonomy.MODERN_AESTHETIC_TAGS_SET.has(tag), `missing ${tag}`);
  }
});

test("MOOD_TAGS includes both original and newly added moods", () => {
  for (const tag of ["melancholic", "euphoric", "chaotic", "cozy", "nostalgic", "dreamy"]) {
    assert.ok(taxonomy.MOOD_TAGS_SET.has(tag), `missing ${tag}`);
  }
});

test("STORY_CONTEXT_TAGS covers the agreed scene/use-case list", () => {
  for (const tag of ["mirror selfie", "sunset", "night drive", "car selfie"]) {
    assert.ok(taxonomy.STORY_CONTEXT_TAGS_SET.has(tag), `missing ${tag}`);
  }
});

test("STORY_CONTEXT_TAGS includes the two new scene/use-case values", () => {
  assert.equal(taxonomy.STORY_CONTEXT_TAGS.length, 12);
  assert.ok(taxonomy.STORY_CONTEXT_TAGS_SET.has("travel"));
  assert.ok(taxonomy.STORY_CONTEXT_TAGS_SET.has("group photo"));
});

test("normalizeStringArray trims, drops non-strings and empties", () => {
  const result = taxonomy.normalizeStringArray(["  cozy ", "", 5, null, "dreamy"]);
  assert.deepEqual(result, ["cozy", "dreamy"]);
});

test("normalizeStringArray returns [] for non-array input", () => {
  assert.deepEqual(taxonomy.normalizeStringArray(null), []);
  assert.deepEqual(taxonomy.normalizeStringArray("not an array"), []);
});

test("ANTI_TAG_CANDIDATES_SET unions story intent, aesthetic, and mood tags but excludes context tags", () => {
  assert.ok(taxonomy.ANTI_TAG_CANDIDATES_SET.has("soft revenge"));
  assert.ok(taxonomy.ANTI_TAG_CANDIDATES_SET.has("old money"));
  assert.ok(taxonomy.ANTI_TAG_CANDIDATES_SET.has("euphoric"));
  assert.ok(!taxonomy.ANTI_TAG_CANDIDATES_SET.has("night drive"));
});

test("splitByCanonical separates accepted and rejected tags", () => {
  const { accepted, rejected } = taxonomy.splitByCanonical(
    ["healing era", "made-up-tag", "soft revenge"],
    taxonomy.STORY_INTENT_TAGS_SET
  );
  assert.deepEqual(accepted, ["healing era", "soft revenge"]);
  assert.deepEqual(rejected, ["made-up-tag"]);
});

test("splitByCanonical returns empty rejected array when everything is valid", () => {
  const { accepted, rejected } = taxonomy.splitByCanonical(
    ["cozy", "dreamy"],
    taxonomy.MOOD_TAGS_SET
  );
  assert.deepEqual(accepted, ["cozy", "dreamy"]);
  assert.deepEqual(rejected, []);
});
