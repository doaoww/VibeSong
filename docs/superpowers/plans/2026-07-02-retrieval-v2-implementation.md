# Retrieval v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge the gap between what GPT-4o's photo analysis already knows (scene, story intent, aesthetic, mood, musical direction) and what the recommendation pipeline can actually retrieve on, by extending the photo-analysis output, adding two new tag/taste-based retrieval pools alongside the existing pgvector pool, and making the photo/taste blend and energy filter confidence-aware.

**Architecture:** Extend the single existing GPT-4o vision call with a closed-vocabulary `matchSignals` block; validate/gate it in a new pure `lib/matchSignals.ts` module; add two new Postgres RPCs (`match_songs_by_tags`, `match_songs_by_taste`) mirroring the existing `match_songs` pattern; merge four candidate pools in `/api/recommend` before the existing Rules+Scoring layer, which gains two new scoring components and a photo-aware energy tolerance.

**Tech Stack:** Next.js 16 App Router API routes, TypeScript, Supabase Postgres + pgvector, GPT-4o (existing `openai` client), Node's built-in test runner (`node --test`) with the codebase's existing VM-based TS-transpile test harness for files with external dependencies, and direct `await import("*.ts")` (Node 24 type-stripping) for dependency-free pure modules.

## Global Constraints

- No new OpenAI/embedding API calls — everything extends the existing single GPT-4o vision call in `app/api/analyze/route.ts`.
- No new columns on `songs` — reuse `story_context_tags`, `story_intent_tags`, `modern_aesthetic_tags`, `mood_tags`, `genre_tags` exactly as they exist.
- `matchSignals` JSON fields are snake_case (matches the existing `autoTagSong()` catalog-tagging convention); `/api/recommend` request body fields are camelCase (matches that route's existing fields).
- New Postgres RPCs must use explicit `RETURNS TABLE(...)` column lists, never `RETURNS SETOF songs` — PostgREST cannot resolve the pgvector `vector` column type through schema-cache introspection on the raw table (this is why `match_songs` already uses this pattern; see `lib/db/songs.ts`'s top comment).
- New RPC parameter names are unprefixed (`match_count`, not `p_match_count`) to match `match_songs`'s existing convention — the `p_` prefix in this codebase is reserved for the CRUD-style RPCs (`create_song`, `update_song`, etc.).
- `music_direction.references` (and any Taste Pool artist match) must never bypass Rules + Scoring to become a recommendation directly — every candidate from every pool is scored identically.
- Full source spec: `docs/superpowers/specs/2026-07-02-retrieval-v2-design.md`.

---

## File Structure

**New files:**
- `lib/matchSignals.ts` — pure functions: parse/validate GPT's `matchSignals` block, confidence-gate anti-tags and energy bounds, merge photo-derived genre/artist signals into a taste profile. No external dependencies (mirrors `lib/tagTaxonomy.ts`, `lib/vectorMath.ts`).
- `tests/matchSignals.test.mjs` — unit tests for the above, loaded via direct `await import()`.
- `tests/songs.test.mjs` — unit tests for the two new `lib/db/songs.ts` functions, using a mocked Supabase client (same VM-transpile pattern as `tests/recommend.test.mjs`).
- `supabase/retrieval-v2-migration.sql` — GIN indexes + two new RPCs + extended `update_song` RPC (manually applied to the Supabase catalog project).
- `scripts/verify-retrieval-v2-rpcs.mjs` — smoke-tests the two new RPCs against the real database after the migration is applied.
- `scripts/backfill-story-context-tags.mjs` — re-tags the 327 catalog songs missing `story_context_tags` (parallel, non-blocking per the spec).

**Modified files:**
- `lib/tagTaxonomy.ts` — expand `STORY_CONTEXT_TAGS`; add `normalizeStringArray` (moved here from `lib/autoTag.ts` for reuse) and `ANTI_TAG_CANDIDATES_SET`.
- `lib/autoTag.ts` — import `normalizeStringArray` from `lib/tagTaxonomy.ts` instead of defining it locally.
- `lib/vectorMath.ts` — `blendQueryVector` becomes confidence-aware in its 2-signal path.
- `tests/vectorMath.test.mjs` — updated for the new `blendQueryVector` signature.
- `app/api/analyze/route.ts` — extended prompt schema + response shape.
- `lib/db/songs.ts` — two new functions: `searchCatalogByTags`, `searchCatalogByTaste`; `SongPatch`/`updateSong` gain `story_context_tags`/`vibe_summary`.
- `lib/recommend.ts` — `RecommendRequest`/`ScoreComponents` gain new fields; energy tolerance and two new scoring components.
- `tests/recommend.test.mjs` — fixture updates + new tests for the above.
- `app/api/recommend/route.ts` — four-pool merge, confidence gating, `poolStats` debug log.
- `app/app/page.tsx` — forwards the new `matchSignals`/`photoConfidence` fields to `/api/recommend`.

---

### Task 1: Expand catalog taxonomy and extract `normalizeStringArray`

**Files:**
- Modify: `lib/tagTaxonomy.ts`
- Modify: `lib/autoTag.ts:224-230` (remove local `normalizeStringArray`), `lib/autoTag.ts:1-16` (import it instead)
- Test: `tests/tagTaxonomy.test.mjs`

**Interfaces:**
- Produces: `normalizeStringArray(value: unknown): string[]`, `ANTI_TAG_CANDIDATES_SET: Set<string>`, expanded `STORY_CONTEXT_TAGS` (12 entries).

- [ ] **Step 1: Write the failing tests**

Add to `tests/tagTaxonomy.test.mjs` (after the existing `STORY_CONTEXT_TAGS` test):

```js
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
  assert.ok(taxonomy.ANTI_TAG_CANDIDATES_SET.has("soft revenge"));   // story intent
  assert.ok(taxonomy.ANTI_TAG_CANDIDATES_SET.has("old money"));      // modern aesthetic
  assert.ok(taxonomy.ANTI_TAG_CANDIDATES_SET.has("euphoric"));       // mood
  assert.ok(!taxonomy.ANTI_TAG_CANDIDATES_SET.has("night drive"));   // context tag, excluded
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/tagTaxonomy.test.mjs`
Expected: FAIL — `STORY_CONTEXT_TAGS.length` is 10 not 12, `normalizeStringArray`/`ANTI_TAG_CANDIDATES_SET` are undefined.

- [ ] **Step 3: Implement in `lib/tagTaxonomy.ts`**

Change the `STORY_CONTEXT_TAGS` array (add two entries):

```ts
export const STORY_CONTEXT_TAGS = [
  "mirror selfie",
  "sunset",
  "night drive",
  "cafe",
  "car selfie",
  "gym",
  "beach",
  "city walk",
  "party",
  "outfit check",
  "travel",
  "group photo",
] as const;
```

Add at the end of the file (after `splitByCanonical`):

```ts
export const ANTI_TAG_CANDIDATES_SET: Set<string> = new Set([
  ...STORY_INTENT_TAGS,
  ...MODERN_AESTHETIC_TAGS,
  ...MOOD_TAGS,
]);

/** Cleans a proposed string array from GPT: keeps only non-empty trimmed strings. */
export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
```

- [ ] **Step 4: Update `lib/autoTag.ts` to reuse the moved helper**

In `lib/autoTag.ts`, change the import block (lines 4-14) to add `normalizeStringArray`:

```ts
import {
  STORY_INTENT_TAGS,
  MODERN_AESTHETIC_TAGS,
  MOOD_TAGS,
  STORY_CONTEXT_TAGS,
  STORY_INTENT_TAGS_SET,
  MODERN_AESTHETIC_TAGS_SET,
  MOOD_TAGS_SET,
  STORY_CONTEXT_TAGS_SET,
  splitByCanonical,
  normalizeStringArray,
} from "./tagTaxonomy";
```

Delete the local definition at lines 224-230 (`function normalizeStringArray(value: unknown): string[] { ... }`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/tagTaxonomy.test.mjs tests/autoTag.test.mjs`
Expected: PASS — all tests green, including the pre-existing `autoTag` tests (confirms the refactor didn't change behavior).

- [ ] **Step 6: Commit**

```bash
git add lib/tagTaxonomy.ts lib/autoTag.ts tests/tagTaxonomy.test.mjs
git commit -m "feat: expand STORY_CONTEXT_TAGS and extract normalizeStringArray/ANTI_TAG_CANDIDATES_SET"
```

---

### Task 2: Create `lib/matchSignals.ts` — parsing and validation

**Files:**
- Create: `lib/matchSignals.ts`
- Create: `tests/matchSignals.test.mjs`

**Interfaces:**
- Consumes: `STORY_CONTEXT_TAGS_SET`, `STORY_INTENT_TAGS_SET`, `MODERN_AESTHETIC_TAGS_SET`, `MOOD_TAGS_SET`, `ANTI_TAG_CANDIDATES_SET`, `splitByCanonical`, `normalizeStringArray` from `./tagTaxonomy` (Task 1).
- Produces: `MusicDirection`, `EnergyBounds`, `MatchSignals` types; `parseMatchSignals(raw: unknown, photoEnergy: number): MatchSignals`. Later tasks (5, 9) depend on this exact shape.

- [ ] **Step 1: Write the failing tests**

Create `tests/matchSignals.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const ms = await import("../lib/matchSignals.ts");

test("parseMatchSignals returns safe defaults when raw is not an object", () => {
  const result = ms.parseMatchSignals(null, 0.4);
  assert.deepEqual(result.scene_context_tags, []);
  assert.deepEqual(result.story_intent_tags, []);
  assert.deepEqual(result.modern_aesthetic_tags, []);
  assert.deepEqual(result.mood_tags, []);
  assert.deepEqual(result.anti_tags, []);
  assert.deepEqual(result.music_direction, { genres: [], references: [], avoid: [] });
  assert.deepEqual(result.energy_bounds, { min: 0.15, max: 0.65 });
});

test("parseMatchSignals keeps only canonical tags, drops hallucinated ones", () => {
  const result = ms.parseMatchSignals({
    scene_context_tags: ["night drive", "made-up-scene"],
    story_intent_tags: ["soft revenge", "not-a-real-tag"],
    modern_aesthetic_tags: ["old money"],
    mood_tags: ["melancholic", "not-a-mood"],
  }, 0.4);
  assert.deepEqual(result.scene_context_tags, ["night drive"]);
  assert.deepEqual(result.story_intent_tags, ["soft revenge"]);
  assert.deepEqual(result.modern_aesthetic_tags, ["old money"]);
  assert.deepEqual(result.mood_tags, ["melancholic"]);
});

test("parseMatchSignals validates anti_tags against the union vocabulary", () => {
  const result = ms.parseMatchSignals({
    anti_tags: ["euphoric", "old money", "soft revenge", "night drive"],
  }, 0.4);
  // "night drive" is a context tag, not in the union — rejected
  assert.deepEqual(result.anti_tags, ["euphoric", "old money", "soft revenge"]);
});

test("parseMatchSignals reads open-vocabulary music_direction fields as-is", () => {
  const result = ms.parseMatchSignals({
    music_direction: { genres: ["slavic indie"], references: ["The xx", ""], avoid: ["EDM"] },
  }, 0.4);
  assert.deepEqual(result.music_direction, { genres: ["slavic indie"], references: ["The xx"], avoid: ["EDM"] });
});

test("parseMatchSignals defaults music_direction when missing or malformed", () => {
  const result = ms.parseMatchSignals({ music_direction: "not an object" }, 0.4);
  assert.deepEqual(result.music_direction, { genres: [], references: [], avoid: [] });
});

test("parseMatchSignals accepts valid energy_bounds as-is", () => {
  const result = ms.parseMatchSignals({ energy_bounds: { min: 0.1, max: 0.3 } }, 0.4);
  assert.deepEqual(result.energy_bounds, { min: 0.1, max: 0.3 });
});

test("parseMatchSignals falls back to photoEnergy +/- 0.25 when energy_bounds has min > max", () => {
  const result = ms.parseMatchSignals({ energy_bounds: { min: 0.5, max: 0.2 } }, 0.6);
  assert.deepEqual(result.energy_bounds, { min: 0.35, max: 0.85 });
});

test("parseMatchSignals clamps the fallback energy_bounds to [0,1]", () => {
  const result = ms.parseMatchSignals({}, 0.05);
  assert.deepEqual(result.energy_bounds, { min: 0, max: 0.3 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/matchSignals.test.mjs`
Expected: FAIL — `Cannot find module '../lib/matchSignals.ts'`.

- [ ] **Step 3: Implement `lib/matchSignals.ts`**

```ts
import {
  STORY_CONTEXT_TAGS_SET,
  STORY_INTENT_TAGS_SET,
  MODERN_AESTHETIC_TAGS_SET,
  MOOD_TAGS_SET,
  ANTI_TAG_CANDIDATES_SET,
  splitByCanonical,
  normalizeStringArray,
} from "./tagTaxonomy";

export interface MusicDirection {
  genres: string[];
  references: string[];
  avoid: string[];
}

export interface EnergyBounds {
  min: number;
  max: number;
}

export interface MatchSignals {
  scene_context_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  mood_tags: string[];
  anti_tags: string[];
  music_direction: MusicDirection;
  energy_bounds: EnergyBounds;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function safeEnergyBounds(photoEnergy: number): EnergyBounds {
  return { min: clamp01(photoEnergy - 0.25), max: clamp01(photoEnergy + 0.25) };
}

function parseMusicDirection(raw: unknown): MusicDirection {
  if (!raw || typeof raw !== "object") return { genres: [], references: [], avoid: [] };
  const obj = raw as Record<string, unknown>;
  return {
    genres: normalizeStringArray(obj.genres),
    references: normalizeStringArray(obj.references),
    avoid: normalizeStringArray(obj.avoid),
  };
}

function parseEnergyBounds(raw: unknown, photoEnergy: number): EnergyBounds {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const min = obj.min;
    const max = obj.max;
    if (
      typeof min === "number" && typeof max === "number" &&
      Number.isFinite(min) && Number.isFinite(max) &&
      min >= 0 && max <= 1 && min <= max
    ) {
      return { min, max };
    }
  }
  return safeEnergyBounds(photoEnergy);
}

/**
 * Validates GPT's photo-analysis matchSignals block: closed-vocabulary tags
 * are checked against the catalog's own taxonomy (lib/tagTaxonomy.ts) so a
 * hallucinated tag can never reach retrieval or scoring.
 */
export function parseMatchSignals(raw: unknown, photoEnergy: number): MatchSignals {
  if (!raw || typeof raw !== "object") {
    return {
      scene_context_tags: [],
      story_intent_tags: [],
      modern_aesthetic_tags: [],
      mood_tags: [],
      anti_tags: [],
      music_direction: { genres: [], references: [], avoid: [] },
      energy_bounds: safeEnergyBounds(photoEnergy),
    };
  }
  const parsed = raw as Record<string, unknown>;

  return {
    scene_context_tags: splitByCanonical(normalizeStringArray(parsed.scene_context_tags), STORY_CONTEXT_TAGS_SET).accepted,
    story_intent_tags: splitByCanonical(normalizeStringArray(parsed.story_intent_tags), STORY_INTENT_TAGS_SET).accepted,
    modern_aesthetic_tags: splitByCanonical(normalizeStringArray(parsed.modern_aesthetic_tags), MODERN_AESTHETIC_TAGS_SET).accepted,
    mood_tags: splitByCanonical(normalizeStringArray(parsed.mood_tags), MOOD_TAGS_SET).accepted,
    anti_tags: splitByCanonical(normalizeStringArray(parsed.anti_tags), ANTI_TAG_CANDIDATES_SET).accepted,
    music_direction: parseMusicDirection(parsed.music_direction),
    energy_bounds: parseEnergyBounds(parsed.energy_bounds, photoEnergy),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/matchSignals.test.mjs`
Expected: PASS — 8/8 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/matchSignals.ts tests/matchSignals.test.mjs
git commit -m "feat: add parseMatchSignals for validating photo-analysis matching signals"
```

---

### Task 3: Add confidence gating and signal-merging to `lib/matchSignals.ts`

**Files:**
- Modify: `lib/matchSignals.ts`
- Modify: `tests/matchSignals.test.mjs`

**Interfaces:**
- Produces: `confidenceFactor(photoConfidence: number): number`, `gateAntiTags(antiTags: string[], photoConfidence: number): string[]`, `gateEnergyBounds(bounds: EnergyBounds, photoEnergy: number, photoConfidence: number): EnergyBounds`, `mergeGenreScores(base: Record<string, number>, genres: string[], avoid: string[], photoConfidence: number): Record<string, number>`, `mergeLikedArtists(base: string[], references: string[]): string[]`. Task 8 (scoring) and Task 9 (recommend route) depend on these exact names/signatures.

- [ ] **Step 1: Write the failing tests**

Append to `tests/matchSignals.test.mjs`:

```js
test("confidenceFactor scales 0.5-1.0 across the confidence range", () => {
  assert.equal(ms.confidenceFactor(0), 0.5);
  assert.equal(ms.confidenceFactor(1), 1.0);
  assert.ok(Math.abs(ms.confidenceFactor(0.5) - 0.75) < 1e-9);
});

test("confidenceFactor clamps out-of-range input", () => {
  assert.equal(ms.confidenceFactor(-1), 0.5);
  assert.equal(ms.confidenceFactor(2), 1.0);
});

test("gateAntiTags passes tags through at or above the 0.4 threshold", () => {
  assert.deepEqual(ms.gateAntiTags(["euphoric"], 0.4), ["euphoric"]);
  assert.deepEqual(ms.gateAntiTags(["euphoric"], 0.9), ["euphoric"]);
});

test("gateAntiTags drops tags below the 0.4 threshold", () => {
  assert.deepEqual(ms.gateAntiTags(["euphoric"], 0.39), []);
});

test("gateEnergyBounds passes bounds through unchanged at or above confidence 0.6", () => {
  const bounds = { min: 0.1, max: 0.3 };
  assert.deepEqual(ms.gateEnergyBounds(bounds, 0.5, 0.6), bounds);
  assert.deepEqual(ms.gateEnergyBounds(bounds, 0.5, 1.0), bounds);
});

test("gateEnergyBounds widens fully toward photoEnergy +/- 0.25 at confidence 0", () => {
  const result = ms.gateEnergyBounds({ min: 0.1, max: 0.3 }, 0.5, 0);
  assert.deepEqual(result, { min: 0.25, max: 0.75 });
});

test("gateEnergyBounds blends linearly between confidence 0 and 0.6", () => {
  // confidence 0.3 -> t = 0.5 -> halfway between GPT bounds and the safe bounds
  const result = ms.gateEnergyBounds({ min: 0.1, max: 0.3 }, 0.5, 0.3);
  assert.ok(Math.abs(result.min - 0.175) < 1e-9); // 0.1*0.5 + 0.25*0.5
  assert.ok(Math.abs(result.max - 0.525) < 1e-9); // 0.3*0.5 + 0.75*0.5
});

test("mergeGenreScores adds positive weight for genres and negative for avoid, scaled by confidence", () => {
  const result = ms.mergeGenreScores({ "indie pop": 0.5 }, ["slavic indie"], ["EDM"], 1.0);
  assert.equal(result["indie pop"], 0.5);
  assert.ok(Math.abs(result["slavic indie"] - 0.6) < 1e-9);
  assert.ok(Math.abs(result["EDM"] - -0.6) < 1e-9);
});

test("mergeGenreScores scales contribution by confidenceFactor", () => {
  const result = ms.mergeGenreScores({}, ["slavic indie"], [], 0);
  assert.ok(Math.abs(result["slavic indie"] - 0.3) < 1e-9); // 0.6 * confidenceFactor(0)=0.5
});

test("mergeLikedArtists unions and dedupes", () => {
  const result = ms.mergeLikedArtists(["Zemfira", "The xx"], ["The xx", "Molchat Doma"]);
  assert.deepEqual(result, ["Zemfira", "The xx", "Molchat Doma"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/matchSignals.test.mjs`
Expected: FAIL — the 10 new tests fail with "is not a function".

- [ ] **Step 3: Implement in `lib/matchSignals.ts`**

Append to the file:

```ts
/** Scales down (never to zero) how much a low-confidence photo reading can influence scoring. */
export function confidenceFactor(photoConfidence: number): number {
  return 0.5 + clamp01(photoConfidence) * 0.5;
}

/** Anti-tags are a hard filter — only trusted when GPT itself was reasonably confident. */
export function gateAntiTags(antiTags: string[], photoConfidence: number): string[] {
  return photoConfidence >= 0.4 ? antiTags : [];
}

/**
 * Below confidence 0.6, blends GPT's energy_bounds toward the safe
 * photoEnergy +/- 0.25 default, linearly reaching full trust at 0.6.
 */
export function gateEnergyBounds(
  bounds: EnergyBounds,
  photoEnergy: number,
  photoConfidence: number
): EnergyBounds {
  if (photoConfidence >= 0.6) return bounds;
  const t = Math.max(0, photoConfidence) / 0.6;
  const safe = safeEnergyBounds(photoEnergy);
  return {
    min: bounds.min * t + safe.min * (1 - t),
    max: bounds.max * t + safe.max * (1 - t),
  };
}

/** Folds music_direction.genres/.avoid into a genreScores map, confidence-scaled. */
export function mergeGenreScores(
  base: Record<string, number>,
  genres: string[],
  avoid: string[],
  photoConfidence: number
): Record<string, number> {
  const factor = confidenceFactor(photoConfidence);
  const result = { ...base };
  for (const genre of genres) result[genre] = (result[genre] ?? 0) + 0.6 * factor;
  for (const genre of avoid) result[genre] = (result[genre] ?? 0) - 0.6 * factor;
  return result;
}

/** Unions music_direction.references into the user's liked-artists list for this request only. */
export function mergeLikedArtists(base: string[], references: string[]): string[] {
  return Array.from(new Set([...base, ...references]));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/matchSignals.test.mjs`
Expected: PASS — 18/18 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/matchSignals.ts tests/matchSignals.test.mjs
git commit -m "feat: add confidence gating and signal-merge helpers to lib/matchSignals"
```

---

### Task 4: Confidence-aware `blendQueryVector`

**Files:**
- Modify: `lib/vectorMath.ts:35-53`
- Modify: `tests/vectorMath.test.mjs:65-81`

**Interfaces:**
- Produces: `blendQueryVector(photoArr, tasteArr, vibeArr, boosts, photoConfidence: number): number[]` — signature gains a required 5th parameter. Task 9 (recommend route) is the only caller and is updated in that task.

- [ ] **Step 1: Write the failing tests**

In `tests/vectorMath.test.mjs`, replace the existing test:

```js
test("blendQueryVector weights photo 0.55 + taste 0.45 when no vibe", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, null, {});
  assert.ok(Math.abs(result[0] - 0.55) < 0.001);
  assert.ok(Math.abs(result[1] - 0.45) < 0.001);
});
```

with:

```js
test("blendQueryVector at photoConfidence 0.7 reproduces the legacy 0.55/0.45 split", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, null, {}, 0.7);
  assert.ok(Math.abs(result[0] - 0.55) < 0.001);
  assert.ok(Math.abs(result[1] - 0.45) < 0.001);
});

test("blendQueryVector gives the photo more weight as confidence rises", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const low = vm2.blendQueryVector(photo, taste, null, {}, 0.0);
  const high = vm2.blendQueryVector(photo, taste, null, {}, 1.0);
  assert.ok(Math.abs(low[0] - 0.2) < 0.001);
  assert.ok(Math.abs(high[0] - 0.7) < 0.001);
});

test("blendQueryVector clamps out-of-range photoConfidence", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, null, {}, 5);
  assert.ok(Math.abs(result[0] - 0.7) < 0.001); // clamped to confidence=1
});
```

Also update the existing 3-signal test to pass the now-required 5th argument (unused by that branch):

```js
test("blendQueryVector weights photo 0.40 + taste 0.25 + vibe 0.35 when vibe provided", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const vibe  = [0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, vibe, {}, 0.5);
  assert.ok(Math.abs(result[0] - 0.40) < 0.001);
  assert.ok(Math.abs(result[1] - 0.25) < 0.001);
  assert.ok(Math.abs(result[2] - 0.35) < 0.001);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/vectorMath.test.mjs`
Expected: FAIL — the 0.55/0.45 test now expects a 5-arg call the current 4-arg function ignores the confidence effect for (it'll actually still pass numerically by coincidence only if you hardcoded 0.55 elsewhere — verify by running; the "more weight as confidence rises" test will FAIL since today's function ignores the 5th argument entirely and always returns 0.55/0.45).

- [ ] **Step 3: Implement in `lib/vectorMath.ts`**

Replace the `blendQueryVector` function (lines 35-53):

```ts
/**
 * Build the final query vector from photo + taste + optional vibe signals.
 * boosts: partial map of dimension name → boost value from vibe parsing.
 * If vibeVec is null, uses a confidence-weighted 2-signal blend (photoWeight
 * ranges 0.2-0.7 as photoConfidence goes 0-1, mirroring blendVectors in
 * lib/emotionalVector.ts so the query vector and the persisted taste profile
 * use the same trust-the-photo-more-when-confident principle).
 * With vibeVec, uses the fixed 3-signal blend (photoConfidence unused there —
 * the requested-vibe feature is not yet live).
 */
export function blendQueryVector(
  photoArr: number[],
  tasteArr: number[],
  vibeArr: number[] | null,
  boosts: Partial<Record<keyof EmotionalVector, number>>,
  photoConfidence: number
): number[] {
  if (!vibeArr) {
    const photoWeight = 0.2 + Math.max(0, Math.min(1, photoConfidence)) * 0.5;
    const tasteWeight = 1 - photoWeight;
    return photoArr.map((p, i) => p * photoWeight + tasteArr[i] * tasteWeight);
  }
  return photoArr.map((p, i) => {
    const key = VECTOR_KEYS[i];
    const blended = p * 0.40 + tasteArr[i] * 0.25 + vibeArr[i] * 0.35;
    const boost = boosts[key];
    if (boost !== undefined) {
      return applyVibeCap(p, boost);
    }
    return blended;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/vectorMath.test.mjs`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/vectorMath.ts tests/vectorMath.test.mjs
git commit -m "feat: make blendQueryVector's 2-signal blend confidence-aware"
```

---

### Task 5: Extend the photo-analysis prompt and response with `matchSignals`

**Files:**
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `parseMatchSignals` from `lib/matchSignals.ts` (Task 2); `STORY_CONTEXT_TAGS`, `STORY_INTENT_TAGS`, `MODERN_AESTHETIC_TAGS`, `MOOD_TAGS` from `lib/tagTaxonomy.ts`.
- Produces: `/api/analyze` response gains `matchSignals` (validated `MatchSignals`) and an explicit, clamped `photoConfidence` field.

- [ ] **Step 1: Add imports**

At the top of `app/api/analyze/route.ts`, add two imports after the existing ones (after line 16):

```ts
import {
  STORY_CONTEXT_TAGS,
  STORY_INTENT_TAGS,
  MODERN_AESTHETIC_TAGS,
  MOOD_TAGS,
} from "../../../lib/tagTaxonomy";
import { parseMatchSignals } from "../../../lib/matchSignals";
```

- [ ] **Step 2: Extend `BASE_SYSTEM_PROMPT`**

Replace the `BASE_SYSTEM_PROMPT` constant (lines 20-89) with:

```ts
const BASE_SYSTEM_PROMPT = `You are a photo vibe analyst. Your job is to understand the emotional and aesthetic character of a photo so that songs can be matched to it from a database.

ABSOLUTE RULE: Analyze ANY image. Abstract images, memes, dark photos, screenshots — everything has visual energy. Never refuse. Only return JSON.

PHOTO ANALYSIS — READ THE MOMENT:
Understand WHAT IS HAPPENING and HOW THE PERSON FEELS, not just aesthetics.

- A broken nail / chaos → frustration, high energy, LOW valence
- A gym selfie → confidence, hustle, HIGH energy
- A sunset / nature → nostalgic, peaceful, LOW energy
- A mirror selfie → read face + body language carefully
- Memes, screenshots → read the emotional energy, not the content
- HUMOR & IRONY: If this would be posted with 😭💀💅 "send help" "not me" — that IS the energy. High energy, chaotic, NOT serene.

vibeCaption = 3–6 words capturing the exact cultural moment: "chaos but make it cute" | "main character moment" | "expensive and cold" | "she's fine (she's not)"

Return ONLY valid JSON, no markdown:
{
  "scene": {
    "setting": "string",
    "timeOfDay": "morning|afternoon|evening|night|unknown",
    "season": "spring|summer|autumn|winter|unknown",
    "weather": "string",
    "activity": "string",
    "cameraMood": "string"
  },
  "people": {
    "count": 0,
    "visibleEmotions": ["string"],
    "socialVibe": "string",
    "activity": "string"
  },
  "emotion": {
    "primary": "string",
    "secondary": "string",
    "intensity": 0.0
  },
  "visual": {
    "dominantColors": ["string"],
    "brightness": 0.0,
    "aesthetic": "string"
  },
  "musicDNA": {
    "energy": 0.0,
    "valence": 0.0,
    "tempo": "slow|medium|fast",
    "genres": ["string"],
    "mood": "string"
  },
  "vibeMetrics": {
    "intimacy": 0.0,
    "confidence": 0.0,
    "nostalgia": 0.0,
    "movement": 0.0
  },
  "vibeCaption": "string",
  "vibeTags": ["string", "string", "string"],
  "momentType": "reflective-solo|social|nature-escape|urban|romance|high-energy|unknown",
  "photoConfidence": 0.85,
  "photoVector": {
    "dreamy": 0.0, "nostalgia": 0.0, "energy": 0.0, "cinematic": 0.0,
    "darkness": 0.0, "confidence": 0.0, "intimacy": 0.0,
    "danceability": 0.0, "electronic": 0.0, "acoustic": 0.0
  },
  "matchSignals": {
    "scene_context_tags": ["1-3 tags, ONLY from this list: ${STORY_CONTEXT_TAGS.join(", ")}"],
    "story_intent_tags": ["1-3 tags, ONLY from this list: ${STORY_INTENT_TAGS.join(", ")}"],
    "modern_aesthetic_tags": ["0-3 tags, ONLY from this list: ${MODERN_AESTHETIC_TAGS.join(", ")}"],
    "mood_tags": ["1-2 tags, ONLY from this list: ${MOOD_TAGS.join(", ")}"],
    "anti_tags": ["0-4 tags this photo's vibe clearly CONTRADICTS, drawn from the story_intent_tags/modern_aesthetic_tags/mood_tags lists above — e.g. a quiet reflective photo should list euphoric/party-coded tags here"],
    "music_direction": {
      "genres": ["1-3 genre/style strings, e.g. slavic indie, moody r&b"],
      "references": ["0-3 real artist names whose music matches this photo's vibe — these are search hints only, never final song picks"],
      "avoid": ["0-3 genre/style strings that would NOT fit"]
    },
    "energy_bounds": { "min": 0.0, "max": 0.0 }
  }
}
NUMBER RULES:
- energy, valence, brightness, intensity, vibeMetrics fields: floats 0.0–1.0
- photoConfidence: float 0.0–1.0
- photoVector fields: all floats 0.0–1.0
- vibeTags: exactly 3
- energy_bounds: floats 0.0-1.0 describing how tightly a fitting song's energy should match this specific photo. Narrow (e.g. min 0.15 / max 0.30) for a still, unambiguous moment; wider (e.g. min 0.2 / max 0.55) if the photo's energy is more open to interpretation.`;
```

- [ ] **Step 3: Wire `parseMatchSignals` into the response**

In the `POST` handler, after the existing block that computes `photoVector`/`photoConfidence`/`momentType` (lines 270-279), add:

```ts
    const matchSignals = parseMatchSignals(result.matchSignals, photoVector.energy);
```

Then change the final success response (line 294) from:

```ts
    return NextResponse.json({ ...result, photoVectorArray });
```

to:

```ts
    return NextResponse.json({ ...result, photoVectorArray, photoConfidence, matchSignals });
```

(`photoConfidence` and `matchSignals` are listed after the `...result` spread so the validated/clamped values win over GPT's raw, unvalidated `result.photoConfidence`/`result.matchSignals`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors introduced by `app/api/analyze/route.ts`. (There is no existing unit-test harness for this route — it makes live OpenAI/Supabase calls — so a clean typecheck plus Task 11's manual end-to-end verification are this task's test coverage.)

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: extend photo-analysis prompt with matchSignals block"
```

---

### Task 6: Database migration — two new RPCs + indexes + extended `update_song`

**Files:**
- Create: `supabase/retrieval-v2-migration.sql`
- Create: `scripts/verify-retrieval-v2-rpcs.mjs`
- Modify: `supabase/songs-rpc.sql` (documentation-in-place — see step 1 note)

**Interfaces:**
- Produces: RPCs `match_songs_by_tags(context_tags, intent_tags, aesthetic_tags, mood_tags, match_count)`, `match_songs_by_taste(artist_patterns, positive_genres, match_count)`, and an extended `update_song` accepting `p_story_context_tags`/`p_vibe_summary`. Task 7 (`lib/db/songs.ts`) and Task 12 (backfill) depend on these exact RPC names and parameter names.

- [ ] **Step 1: Write `supabase/retrieval-v2-migration.sql`**

```sql
-- Retrieval v2: hybrid retrieval pools (tag overlap + taste match), plus
-- extending update_song so the backfill script can write story_context_tags
-- and vibe_summary onto existing rows (the original update_song predates
-- those two columns and never exposed them).
--
-- Apply this against the SUPABASE_CATALOG_URL project (not the main auth
-- project) via the Supabase SQL editor. Idempotent — safe to re-run.

CREATE INDEX IF NOT EXISTS songs_story_context_tags_idx ON public.songs USING gin (story_context_tags);
CREATE INDEX IF NOT EXISTS songs_story_intent_tags_idx ON public.songs USING gin (story_intent_tags);
CREATE INDEX IF NOT EXISTS songs_modern_aesthetic_tags_idx ON public.songs USING gin (modern_aesthetic_tags);
CREATE INDEX IF NOT EXISTS songs_mood_tags_idx ON public.songs USING gin (mood_tags);
CREATE INDEX IF NOT EXISTS songs_genre_tags_idx ON public.songs USING gin (genre_tags);
CREATE INDEX IF NOT EXISTS songs_artist_idx ON public.songs (artist);

-- Story Tags Pool + Context/Scene Pool share this one function, called twice
-- with different arguments populated (see lib/db/songs.ts::searchCatalogByTags).
DROP FUNCTION IF EXISTS public.match_songs_by_tags(text[], text[], text[], text[], int);

CREATE OR REPLACE FUNCTION public.match_songs_by_tags(
  context_tags   text[] DEFAULT '{}',
  intent_tags    text[] DEFAULT '{}',
  aesthetic_tags text[] DEFAULT '{}',
  mood_tags      text[] DEFAULT '{}',
  match_count    int DEFAULT 25
)
RETURNS TABLE (
  id                    uuid,
  title                 text,
  artist                text,
  language              text,
  energy                float,
  popularity_tier       int,
  emotional_vector      vector(10),
  genre_tags            text[],
  aesthetic_tags        text[],
  mood_tags             text[],
  story_intent_tags     text[],
  modern_aesthetic_tags text[],
  story_context_tags    text[],
  final_confidence      float,
  needs_review          boolean,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float,
  distance              float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score, NULL::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
    AND (
      (cardinality(context_tags)   > 0 AND s.story_context_tags    && context_tags)
      OR (cardinality(intent_tags)    > 0 AND s.story_intent_tags    && intent_tags)
      OR (cardinality(aesthetic_tags) > 0 AND s.modern_aesthetic_tags && aesthetic_tags)
      OR (cardinality(mood_tags)      > 0 AND s.mood_tags            && mood_tags)
    )
  ORDER BY s.quality_score DESC, s.id
  LIMIT match_count;
END;
$$;

-- Taste Pool: liked artists, music_direction.references artists (pre-wrapped
-- with %...% by the app layer), or positive genre overlap.
DROP FUNCTION IF EXISTS public.match_songs_by_taste(text[], text[], int);

CREATE OR REPLACE FUNCTION public.match_songs_by_taste(
  artist_patterns  text[] DEFAULT '{}',
  positive_genres  text[] DEFAULT '{}',
  match_count      int DEFAULT 20
)
RETURNS TABLE (
  id                    uuid,
  title                 text,
  artist                text,
  language              text,
  energy                float,
  popularity_tier       int,
  emotional_vector      vector(10),
  genre_tags            text[],
  aesthetic_tags        text[],
  mood_tags             text[],
  story_intent_tags     text[],
  modern_aesthetic_tags text[],
  story_context_tags    text[],
  final_confidence      float,
  needs_review          boolean,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float,
  distance              float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score, NULL::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
    AND (
      (cardinality(artist_patterns) > 0 AND s.artist ILIKE ANY (artist_patterns))
      OR (cardinality(positive_genres) > 0 AND s.genre_tags && positive_genres)
    )
  ORDER BY s.quality_score DESC, s.id
  LIMIT match_count;
END;
$$;

-- Extend update_song so the backfill script (scripts/backfill-story-context-tags.mjs)
-- can write story_context_tags/vibe_summary onto existing rows. Postgres requires
-- dropping the old signature before adding parameters via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.update_song(uuid, text, int, text[], text[], text[], text[], text[]);

CREATE OR REPLACE FUNCTION public.update_song(
  p_id                    uuid,
  p_language              text    DEFAULT NULL,
  p_popularity_tier       int     DEFAULT NULL,
  p_genre_tags            text[]  DEFAULT NULL,
  p_aesthetic_tags        text[]  DEFAULT NULL,
  p_mood_tags             text[]  DEFAULT NULL,
  p_story_intent_tags     text[]  DEFAULT NULL,
  p_modern_aesthetic_tags text[]  DEFAULT NULL,
  p_story_context_tags    text[]  DEFAULT NULL,
  p_vibe_summary          text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs SET
    language              = COALESCE(p_language,              language),
    popularity_tier       = COALESCE(p_popularity_tier,       popularity_tier),
    genre_tags            = COALESCE(p_genre_tags,            genre_tags),
    aesthetic_tags        = COALESCE(p_aesthetic_tags,        aesthetic_tags),
    mood_tags             = COALESCE(p_mood_tags,             mood_tags),
    story_intent_tags     = COALESCE(p_story_intent_tags,     story_intent_tags),
    modern_aesthetic_tags = COALESCE(p_modern_aesthetic_tags, modern_aesthetic_tags),
    story_context_tags    = COALESCE(p_story_context_tags,    story_context_tags),
    vibe_summary          = COALESCE(p_vibe_summary,           vibe_summary),
    updated_at            = now()
  WHERE id = p_id;
END;
$$;
```

- [ ] **Step 2: Apply the migration**

Run the contents of `supabase/retrieval-v2-migration.sql` in the Supabase SQL editor for the project referenced by `SUPABASE_CATALOG_URL` in `.env.local` (the catalog project, not the main auth project). If PostgREST doesn't pick up the new/changed functions immediately, run `NOTIFY pgrst, 'reload schema';` (same fix already documented in `scripts/test-supabase.mjs`).

- [ ] **Step 3: Write `scripts/verify-retrieval-v2-rpcs.mjs`**

```js
import dns from "node:dns";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

dns.setDefaultResultOrder("ipv4first");

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnvLocal();
const supabase = createClient(env.SUPABASE_CATALOG_URL, env.SUPABASE_CATALOG_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log("1. Calling match_songs_by_tags with a real context tag...");
const { data: tagsData, error: tagsErr } = await supabase.rpc("match_songs_by_tags", {
  context_tags: ["night drive"],
  intent_tags: [],
  aesthetic_tags: [],
  mood_tags: [],
  match_count: 5,
});
if (tagsErr) {
  console.error("   FAIL:", tagsErr.message);
  process.exit(1);
}
console.log(`   OK — ${tagsData.length} rows returned`);

console.log("2. Calling match_songs_by_taste with a genre filter...");
const { data: tasteData, error: tasteErr } = await supabase.rpc("match_songs_by_taste", {
  artist_patterns: [],
  positive_genres: ["indie pop", "indie"],
  match_count: 5,
});
if (tasteErr) {
  console.error("   FAIL:", tasteErr.message);
  process.exit(1);
}
console.log(`   OK — ${tasteData.length} rows returned`);

console.log("3. Calling extended update_song with story_context_tags/vibe_summary...");
if (!tagsData[0]) {
  console.log("   SKIPPED — no song available to test against");
} else {
  const { error: updateErr } = await supabase.rpc("update_song", {
    p_id: tagsData[0].id,
    p_story_context_tags: tagsData[0].story_context_tags,
    p_vibe_summary: "verification no-op update",
  });
  if (updateErr) {
    console.error("   FAIL:", updateErr.message);
    process.exit(1);
  }
  console.log("   OK — update_song accepted the new parameters");
}

console.log("\nAll retrieval v2 RPCs verified.");
```

- [ ] **Step 4: Run the verification script**

Run: `node scripts/verify-retrieval-v2-rpcs.mjs`
Expected: All three steps print `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/retrieval-v2-migration.sql scripts/verify-retrieval-v2-rpcs.mjs
git commit -m "feat: add match_songs_by_tags/match_songs_by_taste RPCs and extend update_song"
```

---

### Task 7: `lib/db/songs.ts` — new pool queries and extended `updateSong`

**Files:**
- Modify: `lib/db/songs.ts`
- Create: `tests/songs.test.mjs`

**Interfaces:**
- Consumes: RPCs from Task 6.
- Produces: `searchCatalogByTags(args, matchCount?): Promise<CatalogSong[]>`, `searchCatalogByTaste(args, matchCount?): Promise<CatalogSong[]>`. Task 9 (recommend route) depends on these exact names/shapes.

- [ ] **Step 1: Write the failing tests**

Create `tests/songs.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const mockSupabase = { rpc: async () => ({ data: [], error: null }) };

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const stubRequire = (mod) => {
    if (mod.includes("supabaseCatalog")) return { supabaseCatalog: mockSupabase };
    if (mod.includes("vectorMath")) return { vectorToArray: () => [] };
    return require(mod);
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process, Array });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const songsLib = loadTsModule("lib/db/songs.ts");

test("searchCatalogByTags calls match_songs_by_tags with the given tag arrays and a default match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => {
    captured = { name, args };
    return { data: [{ id: "1" }], error: null };
  };
  const result = await songsLib.searchCatalogByTags({ contextTags: ["night drive"] });
  assert.equal(captured.name, "match_songs_by_tags");
  assert.deepEqual(captured.args, {
    context_tags: ["night drive"],
    intent_tags: [],
    aesthetic_tags: [],
    mood_tags: [],
    match_count: 25,
  });
  assert.deepEqual(result, [{ id: "1" }]);
});

test("searchCatalogByTags accepts a custom match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: [], error: null }; };
  await songsLib.searchCatalogByTags({ intentTags: ["soft revenge"] }, 10);
  assert.equal(captured.args.match_count, 10);
  assert.deepEqual(captured.args.intent_tags, ["soft revenge"]);
});

test("searchCatalogByTags throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.searchCatalogByTags({}), /searchCatalogByTags failed: boom/);
});

test("searchCatalogByTaste calls match_songs_by_taste with artist patterns and positive genres", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: [{ id: "2" }], error: null }; };
  const result = await songsLib.searchCatalogByTaste({ artistPatterns: ["%The xx%"], positiveGenres: ["indie"] });
  assert.equal(captured.name, "match_songs_by_taste");
  assert.deepEqual(captured.args, { artist_patterns: ["%The xx%"], positive_genres: ["indie"], match_count: 20 });
  assert.deepEqual(result, [{ id: "2" }]);
});

test("searchCatalogByTaste throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.searchCatalogByTaste({}), /searchCatalogByTaste failed: boom/);
});

test("updateSong forwards story_context_tags and vibe_summary to update_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { story_context_tags: ["beach"], vibe_summary: "a sunny afternoon feeling" });
  assert.equal(captured.name, "update_song");
  assert.equal(captured.args.p_id, "song-id");
  assert.deepEqual(captured.args.p_story_context_tags, ["beach"]);
  assert.equal(captured.args.p_vibe_summary, "a sunny afternoon feeling");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/songs.test.mjs`
Expected: FAIL — `searchCatalogByTags`/`searchCatalogByTaste` are undefined; the `updateSong` test fails because `p_story_context_tags`/`p_vibe_summary` aren't sent yet.

- [ ] **Step 3: Implement in `lib/db/songs.ts`**

Add two new functions after the existing `searchCatalog` function:

```ts
export interface TagPoolArgs {
  contextTags?: string[];
  intentTags?: string[];
  aestheticTags?: string[];
  moodTags?: string[];
}

export async function searchCatalogByTags(
  args: TagPoolArgs,
  matchCount = 25
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs_by_tags", {
    context_tags: args.contextTags ?? [],
    intent_tags: args.intentTags ?? [],
    aesthetic_tags: args.aestheticTags ?? [],
    mood_tags: args.moodTags ?? [],
    match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalogByTags failed: ${error.message}`);
  return (data ?? []) as CatalogSong[];
}

export interface TastePoolArgs {
  artistPatterns?: string[];
  positiveGenres?: string[];
}

export async function searchCatalogByTaste(
  args: TastePoolArgs,
  matchCount = 20
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs_by_taste", {
    artist_patterns: args.artistPatterns ?? [],
    positive_genres: args.positiveGenres ?? [],
    match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalogByTaste failed: ${error.message}`);
  return (data ?? []) as CatalogSong[];
}
```

Update the `SongPatch` interface (add two optional fields):

```ts
export interface SongPatch {
  language: string;
  popularity_tier: number;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  story_context_tags?: string[];
  vibe_summary?: string;
}
```

Update `updateSong` to forward the two new fields:

```ts
export async function updateSong(id: string, patch: Partial<SongPatch>): Promise<void> {
  const { error } = await supabase.rpc("update_song", {
    p_id:                    id,
    p_language:              patch.language              ?? null,
    p_popularity_tier:       patch.popularity_tier       ?? null,
    p_genre_tags:            patch.genre_tags            ?? null,
    p_aesthetic_tags:        patch.aesthetic_tags        ?? null,
    p_mood_tags:             patch.mood_tags             ?? null,
    p_story_intent_tags:     patch.story_intent_tags     ?? null,
    p_modern_aesthetic_tags: patch.modern_aesthetic_tags ?? null,
    p_story_context_tags:    patch.story_context_tags    ?? null,
    p_vibe_summary:          patch.vibe_summary           ?? null,
  });
  if (error) throw new Error(`updateSong failed: ${error.message}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/songs.test.mjs`
Expected: PASS — 6/6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/db/songs.ts tests/songs.test.mjs
git commit -m "feat: add searchCatalogByTags/searchCatalogByTaste and extend updateSong"
```

---

### Task 8: `lib/recommend.ts` — energy tolerance, contextFit, vibeAestheticFit

**Files:**
- Modify: `lib/recommend.ts`
- Modify: `tests/recommend.test.mjs`

**Interfaces:**
- Consumes: nothing new (pure formula changes).
- Produces: `RecommendRequest` gains `photoConfidence: number`, `sceneContextTags: string[]`, `aestheticTags: string[]`, `moodTags: string[]`, `energyBounds: { min: number; max: number }`. `ScoreComponents` gains `contextFit: number`, `vibeAestheticFit: number`. Task 9 (recommend route) depends on these exact field names.

- [ ] **Step 1: Write the failing tests**

In `tests/recommend.test.mjs`, update the shared `makeRequest()` helper to include the new required fields (so every existing test keeps compiling/passing unaffected):

```js
function makeRequest(overrides = {}) {
  return {
    queryVector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    languages: ["English"],
    languageOpenness: "strict",
    discoveryStyle: "balanced",
    blockedSongs: [],
    blockedArtists: [],
    recentlyShownSongIds: [],
    genreScores: {},
    likedArtists: [],
    storyIntentTags: [],
    antiTags: [],
    photoConfidence: 1.0,
    sceneContextTags: [],
    aestheticTags: [],
    moodTags: [],
    energyBounds: { min: 0, max: 1 }, // half-width 0.5 == today's old hardcoded tolerance
    ...overrides,
  };
}
```

Append new tests:

```js
test("energy tolerance derives from energyBounds half-width, floored at 0.2", () => {
  // half-width = (0.5-0.3)/2 = 0.1, floored to 0.2 -> a 0.15 energy gap should survive
  const req = makeRequest({ energyBounds: { min: 0.3, max: 0.5 } });
  const song = makeSong({ energy: 0.65, emotional_vector: [0.5, 0.5, 0.65, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 1, "0.15 gap should survive the 0.2 floor even though bounds half-width is only 0.1");
});

test("energy tolerance widens with energyBounds beyond the 0.2 floor", () => {
  // half-width = (0.9-0.1)/2 = 0.4 -> a 0.35 energy gap should survive
  const req = makeRequest({ energyBounds: { min: 0.1, max: 0.9 } });
  const song = makeSong({ energy: 0.85, emotional_vector: [0.5, 0.5, 0.85, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 1);
});

test("contextFit rewards story_context_tags overlap with sceneContextTags", () => {
  const withTag = makeSong({ id: "a", story_context_tags: ["night drive"] });
  const withoutTag = makeSong({ id: "b", story_context_tags: [] });
  const req = makeRequest({ sceneContextTags: ["night drive"] });
  const { results } = rec.buildRecommendations(req, [withTag, withoutTag]);
  const a = results.find((r) => r.id === "a");
  const b = results.find((r) => r.id === "b");
  assert.ok(a.scoreComponents.contextFit > b.scoreComponents.contextFit);
  assert.ok(a.scoreComponents.finalScore > b.scoreComponents.finalScore);
});

test("vibeAestheticFit rewards combined modern_aesthetic_tags/mood_tags overlap", () => {
  const withTags = makeSong({ id: "a", modern_aesthetic_tags: ["quiet luxury"], mood_tags: ["melancholic"] });
  const withoutTags = makeSong({ id: "b", modern_aesthetic_tags: [], mood_tags: [] });
  const req = makeRequest({ aestheticTags: ["quiet luxury"], moodTags: ["melancholic"] });
  const { results } = rec.buildRecommendations(req, [withTags, withoutTags]);
  const a = results.find((r) => r.id === "a");
  const b = results.find((r) => r.id === "b");
  assert.ok(a.scoreComponents.vibeAestheticFit > b.scoreComponents.vibeAestheticFit);
});

test("contextFit and vibeAestheticFit scale down with lower photoConfidence", () => {
  const song = makeSong({ story_context_tags: ["night drive"], modern_aesthetic_tags: ["quiet luxury"] });
  const highConf = rec.buildRecommendations(
    makeRequest({ sceneContextTags: ["night drive"], aestheticTags: ["quiet luxury"], photoConfidence: 1.0 }),
    [song]
  ).results[0];
  const lowConf = rec.buildRecommendations(
    makeRequest({ sceneContextTags: ["night drive"], aestheticTags: ["quiet luxury"], photoConfidence: 0.0 }),
    [{ ...song }]
  ).results[0];
  assert.ok(lowConf.scoreComponents.contextFit < highConf.scoreComponents.contextFit);
  assert.ok(lowConf.scoreComponents.vibeAestheticFit < highConf.scoreComponents.vibeAestheticFit);
  // never fully zeroed even at confidence 0 (floor is 0.5x)
  assert.ok(lowConf.scoreComponents.contextFit > 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/recommend.test.mjs`
Expected: FAIL — `scoreComponents.contextFit`/`vibeAestheticFit` are `undefined`; the energy-tolerance tests fail because the current code still uses a fixed `0.5` tolerance.

- [ ] **Step 3: Implement in `lib/recommend.ts`**

Update the `RecommendRequest` interface:

```ts
export interface RecommendRequest {
  queryVector: number[];           // 10 dimensions, already blended
  languages: string[];
  languageOpenness: "strict" | "flexible" | "open";
  discoveryStyle: "hidden-gems" | "niche" | "balanced" | "popular-ok";
  blockedSongs: string[];
  blockedArtists: string[];
  recentlyShownSongIds: string[];  // freshness — don't repeat last 5 sessions
  genreScores: Record<string, number>;
  likedArtists: string[];
  storyIntentTags: string[];       // from photo matchSignals + (future) requested vibe
  antiTags: string[];              // from photo matchSignals (confidence-gated) + requested vibe + onboarding avoid-list
  photoConfidence: number;         // gates contextFit/vibeAestheticFit/storyFit contributions
  sceneContextTags: string[];      // from photo matchSignals.scene_context_tags
  aestheticTags: string[];         // from photo matchSignals.modern_aesthetic_tags
  moodTags: string[];              // from photo matchSignals.mood_tags
  energyBounds: { min: number; max: number };
}

export interface ScoreComponents {
  photoFit: number;
  tasteFit: number;
  storyFit: number;
  contextFit: number;
  vibeAestheticFit: number;
  noveltyFit: number;
  qualityBonus: number;
  languagePenalty: number;
  freshnessPenalty: number;
  mainstreamPenalty: number;
  needsReviewPenalty: number;
  finalScore: number;
}
```

Update the top of `buildRecommendations` (replace the single `queryEnergy` line):

```ts
  const queryEnergy = req.queryVector[2]; // energy is index 2 in VECTOR_KEYS order
  const energyTolerance = Math.max(0.2, (req.energyBounds.max - req.energyBounds.min) / 2);
  const confFactor = 0.5 + Math.max(0, Math.min(1, req.photoConfidence)) * 0.5;
```

Replace rule 4 (energy compatibility gap):

```ts
    // 4. Energy compatibility gap — tolerance derives from the photo's own
    // energy_bounds, floored at 0.2 so an overly narrow GPT read can't
    // over-filter (see docs/superpowers/specs/2026-07-02-retrieval-v2-design.md)
    if (Math.abs(song.energy - queryEnergy) > energyTolerance) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "energy_gap",
      });
      continue;
    }
```

In the Scoring Layer section, update `storyFit` and add the two new components (replace the existing `storyFit`/`noveltyFit` block):

```ts
    const storyTagMatches = req.storyIntentTags.filter((t) =>
      song.story_intent_tags.map((s) => s.toLowerCase()).includes(t.toLowerCase())
    ).length;
    const storyFit = Math.min(3, storyTagMatches) * 7 * confFactor;

    const contextTagMatches = song.story_context_tags.filter((t) =>
      req.sceneContextTags.map((s) => s.toLowerCase()).includes(t.toLowerCase())
    ).length;
    const contextFit = Math.min(2, contextTagMatches) * 6 * confFactor;

    const photoAestheticOrMood = [...req.aestheticTags, ...req.moodTags].map((t) => t.toLowerCase());
    const songAestheticOrMood = [...song.modern_aesthetic_tags, ...song.mood_tags].map((t) => t.toLowerCase());
    const aestheticOrMoodMatches = songAestheticOrMood.filter((t) => photoAestheticOrMood.includes(t)).length;
    const vibeAestheticFit = Math.min(2, aestheticOrMoodMatches) * 5 * confFactor;

    const noveltyFit = discoveryScore(song.popularity_tier, req.discoveryStyle) * 10;
    const qualityBonus = song.quality_score * 5;
```

Update the `raw` sum and the `components` object:

```ts
    const raw = photoFit + tasteFit + storyFit + contextFit + vibeAestheticFit + noveltyFit + qualityBonus;
    const finalScore = Math.max(
      0,
      Math.min(100, raw + languagePenalty + freshnessPenalty + mainstreamPenalty + needsReviewPenalty)
    );

    const components: ScoreComponents = {
      photoFit: Math.round(photoFit * 10) / 10,
      tasteFit: Math.round(tasteFit * 10) / 10,
      storyFit: Math.round(storyFit * 10) / 10,
      contextFit: Math.round(contextFit * 10) / 10,
      vibeAestheticFit: Math.round(vibeAestheticFit * 10) / 10,
      noveltyFit: Math.round(noveltyFit * 10) / 10,
      qualityBonus: Math.round(qualityBonus * 10) / 10,
      languagePenalty,
      freshnessPenalty,
      mainstreamPenalty,
      needsReviewPenalty,
      finalScore: Math.round(finalScore * 10) / 10,
    };
```

(`storyFit` is now rounded like the other components since it's no longer always a clean multiple of 7 once `confFactor` is applied — this changes its existing test only in that it's now a float rather than an exact multiple of 7, which the existing "story intent tag match boosts score" test doesn't assert on, only relative comparison, so it still passes.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/recommend.test.mjs`
Expected: PASS — all original tests plus the 5 new ones green.

- [ ] **Step 5: Commit**

```bash
git add lib/recommend.ts tests/recommend.test.mjs
git commit -m "feat: add contextFit/vibeAestheticFit scoring and photo-aware energy tolerance"
```

---

### Task 9: Wire the four-pool hybrid retrieval into `/api/recommend`

**Files:**
- Modify: `app/api/recommend/route.ts`

**Interfaces:**
- Consumes: `searchCatalogByTags`, `searchCatalogByTaste` (Task 7); `confidenceFactor`, `gateAntiTags`, `gateEnergyBounds`, `mergeGenreScores`, `mergeLikedArtists` (Task 3); updated `blendQueryVector` (Task 4); updated `RecommendRequest` (Task 8).
- Produces: `/api/recommend` response gains `poolStats`.

- [ ] **Step 1: Replace `app/api/recommend/route.ts` in full**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getUserTaste, getEmotionalVector } from "../../../lib/db/userTaste";
import { getFeedback } from "../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile } from "../../../lib/tasteProfile";
import { searchCatalog, searchCatalogByTags, searchCatalogByTaste, type CatalogSong } from "../../../lib/db/songs";
import { blendQueryVector } from "../../../lib/vectorMath";
import { buildRecommendations } from "../../../lib/recommend";
import { normalizeTaste } from "../../../lib/matching";
import {
  gateAntiTags,
  gateEnergyBounds,
  mergeGenreScores,
  mergeLikedArtists,
  type EnergyBounds,
} from "../../../lib/matchSignals";
import type { EmotionalVector } from "../../../lib/emotionalVector";
import { VECTOR_KEYS, ZERO_VECTOR } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

function resolveEnergyBounds(input: unknown): EnergyBounds {
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const min = obj.min;
    const max = obj.max;
    if (
      typeof min === "number" && typeof max === "number" &&
      Number.isFinite(min) && Number.isFinite(max) &&
      min >= 0 && max <= 1 && min <= max
    ) {
      return { min, max };
    }
  }
  return { min: 0, max: 1 };
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const photoVectorArray: number[] = body.photoVectorArray;
    const vibeBoosts: Partial<Record<keyof EmotionalVector, number>> = body.vibeBoosts ?? {};
    const storyIntentTags: string[] = body.storyIntentTags ?? [];
    const antiTags: string[] = body.antiTags ?? [];
    const photoConfidence: number =
      typeof body.photoConfidence === "number" ? Math.max(0, Math.min(1, body.photoConfidence)) : 0.5;
    const sceneContextTags: string[] = body.sceneContextTags ?? [];
    const aestheticTags: string[] = body.aestheticTags ?? [];
    const moodTags: string[] = body.moodTags ?? [];
    const photoAntiTags: string[] = body.photoAntiTags ?? [];
    const musicDirection: { genres: string[]; references: string[]; avoid: string[] } =
      body.musicDirection ?? { genres: [], references: [], avoid: [] };

    if (!photoVectorArray || photoVectorArray.length !== 10) {
      return NextResponse.json({ error: "photoVectorArray (10 numbers) required" }, { status: 400 });
    }

    // Load user taste profile — all with .catch() fallbacks
    const [storedTaste, storedVector, savedFeedback, skippedFeedback] = await Promise.all([
      getUserTaste(user.id).catch(() => null),
      getEmotionalVector(user.id).catch(() => null),
      getFeedback(user.id, "saved", 200).catch(() => []),
      getFeedback(user.id, "skipped", 200).catch(() => []),
    ]);

    const taste = normalizeTaste(storedTaste ?? null);
    const aggregate = buildAggregateTasteProfile(savedFeedback, skippedFeedback);

    // Real stored taste vector (from onboarding artists/story-songs/swipes + feedback),
    // falling back to neutral 0.5 for a cold-start user with no signal yet.
    const tasteVector = storedVector ?? ZERO_VECTOR;
    const tasteArr: number[] = VECTOR_KEYS.map((k) => (storedVector ? tasteVector[k] : 0.5));

    // Build optional vibe vector from boosts
    const hasVibe = Object.keys(vibeBoosts).length > 0 || storyIntentTags.length > 0;
    const vibeArr = hasVibe
      ? VECTOR_KEYS.map((k, i) => {
          const boost = vibeBoosts[k as keyof EmotionalVector] ?? 0;
          const photoDim = photoVectorArray[i];
          return Math.max(photoDim - 0.25, Math.min(photoDim + 0.35, photoDim + boost));
        })
      : null;

    // Build final query vector (confidence-aware 2-signal blend when no vibe)
    const queryVector = blendQueryVector(photoVectorArray, tasteArr, vibeArr, vibeBoosts, photoConfidence);

    // Confidence-gated photo signals
    const gatedPhotoAntiTags = gateAntiTags(photoAntiTags, photoConfidence);
    const energyBounds = gateEnergyBounds(
      resolveEnergyBounds(body.energyBounds),
      photoVectorArray[2],
      photoConfidence
    );
    const mergedGenreScores = mergeGenreScores(
      taste.genreScores,
      musicDirection.genres,
      musicDirection.avoid,
      photoConfidence
    );
    const mergedLikedArtists = mergeLikedArtists(taste.favoriteArtists, musicDirection.references);

    const artistPatterns = mergedLikedArtists.map((a) => `%${a}%`);
    const positiveGenres = Object.entries(mergedGenreScores)
      .filter(([, score]) => score > 0.3)
      .map(([genre]) => genre);

    // Hybrid retrieval — four independent candidate pools, merged and deduped by id
    const [vectorPool, storyPool, contextPool, tastePool] = await Promise.all([
      searchCatalog(queryVector, 25),
      searchCatalogByTags({ intentTags: storyIntentTags, aestheticTags, moodTags }, 25),
      searchCatalogByTags({ contextTags: sceneContextTags }, 20),
      searchCatalogByTaste({ artistPatterns, positiveGenres }, 20),
    ]);

    const poolMap = new Map<string, CatalogSong>();
    for (const song of [...vectorPool, ...storyPool, ...contextPool, ...tastePool]) {
      if (!poolMap.has(song.id)) poolMap.set(song.id, song);
    }
    const candidates = Array.from(poolMap.values());

    // Map hidden-gems to niche for scoring
    const discoveryStyle =
      taste.discoveryStyle === "hidden-gems" ? "niche" : taste.discoveryStyle;

    // Score and rank
    const { results: recommendations, debugLog } = buildRecommendations(
      {
        queryVector,
        languages: taste.languages,
        languageOpenness: taste.languageOpenness,
        discoveryStyle,
        blockedSongs: [],
        blockedArtists: aggregate.avoidArtists,
        recentlyShownSongIds: [],
        genreScores: mergedGenreScores,
        likedArtists: mergedLikedArtists,
        storyIntentTags,
        antiTags: [...antiTags, ...gatedPhotoAntiTags, ...taste.avoidedStoryTags],
        photoConfidence,
        sceneContextTags,
        aestheticTags,
        moodTags,
        energyBounds,
      },
      candidates
    );

    const poolStats = {
      vectorPoolCount: vectorPool.length,
      storyPoolCount: storyPool.length,
      contextPoolCount: contextPool.length,
      tastePoolCount: tastePool.length,
      mergedCandidateCount: candidates.length,
      removedByRulesCount: debugLog.filter((e) => e.rulesRemoved).length,
    };
    console.log("[recommend] pool stats:", JSON.stringify(poolStats));

    return NextResponse.json({
      songs: recommendations.slice(0, 12),
      totalCandidates: candidates.length,
      debugLog,
      poolStats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/recommend error:", message);
    return NextResponse.json({ error: "Recommendation failed", detail: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors. (This route makes live Supabase/DB calls and has no existing unit-test harness — same situation as `app/api/analyze/route.ts` in Task 5. Its correctness is covered by Task 7's mocked `lib/db/songs.ts` tests, Task 8's `lib/recommend.ts` tests, and Task 11's manual end-to-end verification.)

- [ ] **Step 3: Commit**

```bash
git add app/api/recommend/route.ts
git commit -m "feat: wire four-pool hybrid retrieval into /api/recommend"
```

---

### Task 10: Forward `matchSignals`/`photoConfidence` from the client

**Files:**
- Modify: `app/app/page.tsx:136-146`

- [ ] **Step 1: Update the `/api/recommend` request body**

Replace:

```ts
        // Call recommendation engine with the photo vector
        const recommendRes = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoVectorArray: vibeData.photoVectorArray,
            vibeBoosts: {},
            storyIntentTags: [],
            antiTags: [],
          }),
        });
```

with:

```ts
        // Call recommendation engine with the photo vector + matchSignals
        const matchSignals = vibeData.matchSignals ?? {};
        const musicDirection = matchSignals.music_direction ?? { genres: [], references: [], avoid: [] };
        const recommendRes = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoVectorArray: vibeData.photoVectorArray,
            photoConfidence: vibeData.photoConfidence,
            vibeBoosts: {},
            storyIntentTags: matchSignals.story_intent_tags ?? [],
            antiTags: [],
            photoAntiTags: matchSignals.anti_tags ?? [],
            sceneContextTags: matchSignals.scene_context_tags ?? [],
            aestheticTags: matchSignals.modern_aesthetic_tags ?? [],
            moodTags: matchSignals.mood_tags ?? [],
            musicDirection,
            energyBounds: matchSignals.energy_bounds,
          }),
        });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat: forward photo matchSignals and confidence to /api/recommend"
```

---

### Task 11: Manual end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass (Tasks 1-8's test files plus the pre-existing suite).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Upload the two contrasting photos from the original audit**

Upload a photo of the "girl on a beach at sunset" type and, separately, a "girl alone in a car at night" type (or the closest available equivalents). For each, open the terminal running `npm run dev` and find the `[recommend] pool stats:` and `[recommend] debug log:` lines.

- [ ] **Step 4: Confirm hybrid retrieval is contributing**

Check that `storyPoolCount` and `contextPoolCount` in the pool stats are non-zero for at least one of the two photos, and that `sum(vectorPoolCount + storyPoolCount + contextPoolCount + tastePoolCount) - mergedCandidateCount` is a meaningfully positive number less than the sum (i.e. pools are not 100% redundant with each other, nor 100% disjoint duplicates of the same set).

- [ ] **Step 5: Confirm the two photos now surface different songs**

Compare the top-8 songs returned for the two photos. Per the spec's exit condition, they should visibly differ — check that at least a few songs differ between the two result sets where, before this change, their near-identical emotional vectors would have made the two sets nearly the same.

- [ ] **Step 6: Confirm the new scoring fields appear in the debug log**

In the `[recommend] debug log:` output, confirm at least one non-rules-removed entry has non-zero `contextFit` or `vibeAestheticFit`.

No commit for this task — it's verification only. If any check fails, return to the relevant earlier task and fix before proceeding.

---

### Task 12: Catalog backfill for the 327 songs missing `story_context_tags`

**Files:**
- Create: `scripts/backfill-story-context-tags.mjs`

This task is parallel/non-blocking per the spec — it can run any time after Task 6 (needs the extended `update_song` RPC) and Task 7 (not strictly required, since this script talks to Supabase directly, but should run after Task 6's migration is applied).

- [ ] **Step 1: Write `scripts/backfill-story-context-tags.mjs`**

```js
/**
 * Backfills story_context_tags/vibe_summary on catalog songs tagged before
 * those columns existed (~327 of 600 as of 2026-07-02). Re-runs the existing
 * autoTagSong() pipeline and writes the result via the extended update_song
 * RPC (Task 6/7) — does not touch song IDs or any other existing data.
 *
 * Run: node scripts/backfill-story-context-tags.mjs
 */
import dns from "node:dns";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

dns.setDefaultResultOrder("ipv4first");

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnvLocal();
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const supabase = createClient(env.SUPABASE_CATALOG_URL, env.SUPABASE_CATALOG_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { autoTagSong } = await import("../lib/autoTag.ts");

let all = [];
let offset = 0;
while (true) {
  const { data, error } = await supabase.rpc("list_catalog", { p_limit: 500, p_offset: offset });
  if (error) {
    console.error("list_catalog failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  all = all.concat(data);
  offset += 500;
  if (data.length < 500) break;
}

const missing = all.filter((s) => (s.story_context_tags ?? []).length === 0);
console.log(`${missing.length} of ${all.length} songs missing story_context_tags — backfilling...`);

let done = 0;
for (const song of missing) {
  try {
    const tagged = await autoTagSong(song.title, song.artist);
    const { error } = await supabase.rpc("update_song", {
      p_id: song.id,
      p_story_context_tags: tagged.story_context_tags,
      p_vibe_summary: tagged.vibe_summary,
    });
    if (error) throw new Error(error.message);
    done++;
    console.log(`[${done}/${missing.length}] ${song.title} — ${song.artist}: ${tagged.story_context_tags.join(", ") || "(none)"}`);
  } catch (err) {
    console.error(`FAILED: ${song.title} — ${song.artist}:`, err instanceof Error ? err.message : err);
  }
  // Respect rate limits, matching the existing seed scripts' 2s delay convention.
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log(`Backfill complete: ${done}/${missing.length} updated.`);
```

- [ ] **Step 2: Run the backfill**

Run: `node scripts/backfill-story-context-tags.mjs`
Expected: Progress lines for each of the ~327 songs, ending with `Backfill complete: N/327 updated.` (some may fail individually on transient API errors — that's logged per-song and doesn't stop the run).

- [ ] **Step 3: Verify coverage improved**

Run the same catalog-stats query used during the original audit (paginate `list_catalog`, count non-empty `story_context_tags`) and confirm coverage rose from 45.5% toward 100% (minus any songs that failed in Step 2, which can be re-run — the script is idempotent, re-running only affects songs still missing tags... note: songs that failed will still show empty story_context_tags and get retried on a re-run without needing to filter differently, since `missing` is recomputed from live data each time the script runs).

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-story-context-tags.mjs
git commit -m "feat: add catalog backfill script for story_context_tags/vibe_summary"
```

---

## Self-Review Notes

**Spec coverage:** Layer 1 (Task 5), Layer 2 (Task 1), Layer 3 four pools + pool debug log (Tasks 6, 7, 9), Layer 4 rules changes (Task 8), Layer 5 scoring changes (Task 8), Query Vector confidence blend (Task 4), Schema/API changes (Tasks 6, 7, 8, 9, 10), Catalog Backfill (Task 12), Explicit Invariants (references-never-bypass-scoring is structural — Task 9's Taste Pool candidates flow through the same `buildRecommendations` call as every other pool; confidence gating on anti-tags — Task 3/9; vocabulary validation — Task 2). All spec sections have a corresponding task.

**Type consistency check:** `MatchSignals`/`EnergyBounds`/`MusicDirection` (Task 2) are used with identical field names in Task 5 (analyze route), Task 8 (`RecommendRequest.energyBounds`), and Task 9 (recommend route) — verified `energy_bounds`/`energyBounds` naming split matches the established snake_case-in-GPT-JSON vs. camelCase-in-API convention throughout. `searchCatalogByTags`/`searchCatalogByTaste` (Task 7) parameter shapes (`TagPoolArgs`/`TastePoolArgs`) match exactly how Task 9 calls them.

**Deviation from spec worth flagging to the user:** the spec's Schema section said `/api/recommend` request body would have "antiTags (already exists, now also populated from the photo)" — implying one shared field. Task 9 instead uses two fields, `antiTags` (reserved for future requested-vibe parsing) and `photoAntiTags` (from the photo, confidence-gated before merging into the Rules Layer's anti-tag list). This was necessary because the confidence gate (§B of the spec, "anti_tags only apply... above photoConfidence >= 0.4") can only be applied correctly if photo-sourced anti-tags are distinguishable from other sources — a single merged field would gate everything or nothing.
