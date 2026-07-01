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
