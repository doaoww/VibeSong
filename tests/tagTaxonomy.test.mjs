import assert from "node:assert/strict";
import { test } from "node:test";

const taxonomy = await import("../lib/tagTaxonomy.ts");

test("STORY_INTENT_TAGS has 32 entries and includes known values", () => {
  assert.equal(taxonomy.STORY_INTENT_TAGS.length, 32);
  assert.ok(taxonomy.STORY_INTENT_TAGS_SET.has("healing era"));
  assert.ok(taxonomy.STORY_INTENT_TAGS_SET.has("soft revenge"));
});

test("MODERN_AESTHETIC_TAGS has 20 entries including the expanded set", () => {
  assert.equal(taxonomy.MODERN_AESTHETIC_TAGS.length, 20);
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

test("STORY_CONTEXT_TAGS includes the new scene/use-case values", () => {
  assert.equal(taxonomy.STORY_CONTEXT_TAGS.length, 15);
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

test("STORY_INTENT_TAGS includes the new masculine/edge-coded entries", () => {
  assert.equal(taxonomy.STORY_INTENT_TAGS.length, 32);
  for (const tag of ["gym flex", "night drive alone", "hustle grind", "rap swagger", "rock grit", "stoic heartbreak", "streetwear energy", "game day"]) {
    assert.ok(taxonomy.STORY_INTENT_TAGS_SET.has(tag), `missing ${tag}`);
  }
});

test("MODERN_AESTHETIC_TAGS includes the new cultural-aesthetic entries", () => {
  assert.equal(taxonomy.MODERN_AESTHETIC_TAGS.length, 20);
  for (const tag of ["French chic", "Scandi minimal", "Latin heat", "Japanese minimalist", "K-pop glossy"]) {
    assert.ok(taxonomy.MODERN_AESTHETIC_TAGS_SET.has(tag), `missing ${tag}`);
  }
});

test("STORY_CONTEXT_TAGS includes the new context gaps", () => {
  assert.equal(taxonomy.STORY_CONTEXT_TAGS.length, 15);
  for (const tag of ["workout", "sports", "study grind"]) {
    assert.ok(taxonomy.STORY_CONTEXT_TAGS_SET.has(tag), `missing ${tag}`);
  }
});

test("coercePovSignal accepts the four valid values and rejects everything else", () => {
  assert.equal(taxonomy.coercePovSignal("male"), "male");
  assert.equal(taxonomy.coercePovSignal("female"), "female");
  assert.equal(taxonomy.coercePovSignal("neutral"), "neutral");
  assert.equal(taxonomy.coercePovSignal("unclear"), "unclear");
  assert.equal(taxonomy.coercePovSignal("masculine"), "unclear");
  assert.equal(taxonomy.coercePovSignal(undefined), "unclear");
  assert.equal(taxonomy.coercePovSignal(null), "unclear");
  assert.equal(taxonomy.coercePovSignal(42), "unclear");
});

test("POV_SIGNALS lists exactly the four canonical values", () => {
  assert.deepEqual([...taxonomy.POV_SIGNALS], ["male", "female", "neutral", "unclear"]);
});

test("coerceGeneration accepts the six valid values and rejects everything else", () => {
  assert.equal(taxonomy.coerceGeneration("gen-z"), "gen-z");
  assert.equal(taxonomy.coerceGeneration("millennial"), "millennial");
  assert.equal(taxonomy.coerceGeneration("gen-x"), "gen-x");
  assert.equal(taxonomy.coerceGeneration("boomer"), "boomer");
  assert.equal(taxonomy.coerceGeneration("timeless"), "timeless");
  assert.equal(taxonomy.coerceGeneration("unclear"), "unclear");
  assert.equal(taxonomy.coerceGeneration("zoomer"), "unclear");
  assert.equal(taxonomy.coerceGeneration(undefined), "unclear");
  assert.equal(taxonomy.coerceGeneration(null), "unclear");
  assert.equal(taxonomy.coerceGeneration(42), "unclear");
});

test("GENERATIONS lists exactly the six canonical values", () => {
  assert.deepEqual([...taxonomy.GENERATIONS], ["gen-z", "millennial", "gen-x", "boomer", "timeless", "unclear"]);
});
