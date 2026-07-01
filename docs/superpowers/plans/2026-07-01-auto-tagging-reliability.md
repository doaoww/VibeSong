# Auto-Tagging Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make catalog auto-tagging trustworthy enough for future requested-vibe matching — closed canonical tag vocabularies, a two-signal confidence score, and a `needs_review` flag that soft-penalizes (never hard-hides) uncertain songs.

**Architecture:** `lib/autoTag.ts` is extended so GPT-4o can only choose tags from four closed vocabularies exported by a new `lib/tagTaxonomy.ts`, plus a categorical self-assessment (`confidence_level`) that gets mapped to a number in code rather than trusted as a raw GPT self-rating. That numeric score is combined with a deterministic `source_confidence` (based on which evidence — iTunes match quality, Last.fm tags, complete metadata — was actually available) into `final_confidence`. Songs below the trust threshold are flagged `needs_review` (soft scoring penalty in `lib/recommend.ts`, not removed from the catalog) unless confidence is extremely low. A `LyricsProvider` interface seam is added but not wired to any real provider.

**Tech Stack:** Next.js 16.2.9 App Router, TypeScript, Supabase (pgvector extension), GPT-4o, iTunes Search API, Last.fm API, `node:test` for tests.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-07-01-auto-tagging-reliability-design.md`
- Runtime: `nodejs` on all API routes (no new routes added by this plan; existing ones untouched)
- Canonical tag validation happens in application code (`lib/tagTaxonomy.ts`), never a DB constraint — the taxonomy must stay cheap to expand
- `needs_review` is a soft signal: `-12` scoring penalty only. A song is fully removed from recommendations only when `final_confidence < 0.35` (`removedReason: "confidence_too_low"`)
- Lyrics availability must NOT factor into `source_confidence` in this pass — `NullLyricsProvider` is a no-op seam only, wired but never contributing to the score
- `aesthetic_tags` is legacy/open-ended and out of scope — do not touch its validation
- The four canonical matching categories are exactly: `story_intent_tags`, `modern_aesthetic_tags`, `mood_tags`, `story_context_tags`
- `tagging_version` defaults to `'v1'` for every song tagged by this pipeline
- Tests run via `node --test tests/*.test.mjs`. Match whichever TS-loading pattern the target file already uses: `tests/autoTag.test.mjs` uses direct `await import("../lib/foo.ts")` (Node's built-in type stripping); `tests/recommend.test.mjs` uses the `vm` + `ts.transpileModule`-based `loadTsModule` helper (needed because `lib/recommend.ts` imports `./vectorMath`, which the helper stubs)
- No new npm packages

---

## File Map

**New files:**
- `lib/tagTaxonomy.ts` — the four canonical tag arrays/sets + `splitByCanonical` validator
- `tests/tagTaxonomy.test.mjs` — unit tests for the taxonomy module
- `lib/lyrics.ts` — `LyricsProvider` interface + `NullLyricsProvider` no-op implementation
- `tests/lyrics.test.mjs` — unit test for `NullLyricsProvider`

**Modified files:**
- `supabase/songs-schema.sql` — new columns on `public.songs`, updated `match_songs` RPC
- `supabase/songs-rpc.sql` — updated `list_catalog` and `create_song` RPCs
- `lib/autoTag.ts` — prompt covers 4 canonical categories + `vibe_summary` + `confidence_level`/`confidence_reason`; response parsing validates/discards tags; new `computeSourceConfidence` and `mapConfidenceLevel`; `autoTagSong` wires it all together
- `tests/autoTag.test.mjs` — new test cases for validation, discarding, and confidence
- `lib/db/songs.ts` — `CatalogSong` interface gains the new fields; `insertSong` passes them to `create_song`
- `lib/recommend.ts` — new `confidence_too_low` hard guard and `needsReviewPenalty` soft penalty
- `tests/recommend.test.mjs` — fixes a pre-existing bug (tests call `buildRecommendations` as if it returns an array, but it returns `{ results, debugLog }` — currently 5 of 7 tests fail) and adds new tests for the two new rules
- `app/admin/page.tsx` — confidence badge, "needs review" filter/sort, `vibe_summary`/`discarded_tags` display

---

## Task 1: Canonical Tag Taxonomy

**Files:**
- Create: `lib/tagTaxonomy.ts`
- Test: `tests/tagTaxonomy.test.mjs`

**Interfaces:**
- Produces:
  - `STORY_INTENT_TAGS: readonly string[]`, `STORY_INTENT_TAGS_SET: Set<string>`
  - `MODERN_AESTHETIC_TAGS: readonly string[]`, `MODERN_AESTHETIC_TAGS_SET: Set<string>`
  - `MOOD_TAGS: readonly string[]`, `MOOD_TAGS_SET: Set<string>`
  - `STORY_CONTEXT_TAGS: readonly string[]`, `STORY_CONTEXT_TAGS_SET: Set<string>`
  - `splitByCanonical(proposed: string[], canonical: Set<string>): { accepted: string[]; rejected: string[] }`
- Consumed by: Task 4 (`lib/autoTag.ts`)

- [ ] **Step 1: Write the failing test**

Create `tests/tagTaxonomy.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/tagTaxonomy.test.mjs`
Expected: FAIL — `Cannot find module '../lib/tagTaxonomy.ts'` (or similar `ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Implement `lib/tagTaxonomy.ts`**

Create `lib/tagTaxonomy.ts`:

```typescript
// Canonical tag vocabularies for song catalog matching categories.
// GPT may only select from these lists — never invent new values.
// Expanding a list here is cheap; letting GPT free-form tags is not.

export const STORY_INTENT_TAGS = [
  "post-breakup confidence",
  "expensive sadness",
  "soft revenge",
  "she'll regret losing you",
  "cold Russian melancholy",
  "toxic but iconic",
  "quiet luxury",
  "main character walk",
  "private story energy",
  "clean girl morning",
  "lonely but pretty",
  "night-luxe",
  "cinematic soft flex",
  "modern romantic",
  "not basic TikTok",
  "Slavic sad girl",
  "hot girl summer",
  "dark feminine",
  "cool girl car selfie",
  "dark academia moment",
  "healing era",
  "confident comeback",
  "bittersweet nostalgia",
  "chaotic but cute",
] as const;

export const MODERN_AESTHETIC_TAGS = [
  "quiet luxury",
  "coquette",
  "indie sleaze",
  "dark academia",
  "slavic underground",
  "clean girl",
  "old money",
  "soft grunge",
  "bedroom pop",
  "dark feminine",
  "night luxe",
  "mob wife",
  "pinterest girl",
  "russian indie",
  "alt girl",
] as const;

export const MOOD_TAGS = [
  "melancholic",
  "euphoric",
  "chaotic",
  "cozy",
  "nostalgic",
  "dreamy",
] as const;

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
] as const;

export const STORY_INTENT_TAGS_SET: Set<string> = new Set(STORY_INTENT_TAGS);
export const MODERN_AESTHETIC_TAGS_SET: Set<string> = new Set(MODERN_AESTHETIC_TAGS);
export const MOOD_TAGS_SET: Set<string> = new Set(MOOD_TAGS);
export const STORY_CONTEXT_TAGS_SET: Set<string> = new Set(STORY_CONTEXT_TAGS);

export interface CanonicalSplit {
  accepted: string[];
  rejected: string[];
}

/** Splits GPT's proposed tags into those present in the canonical set and those that aren't. */
export function splitByCanonical(proposed: string[], canonical: Set<string>): CanonicalSplit {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const tag of proposed) {
    if (canonical.has(tag)) accepted.push(tag);
    else rejected.push(tag);
  }
  return { accepted, rejected };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/tagTaxonomy.test.mjs`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tagTaxonomy.ts tests/tagTaxonomy.test.mjs
git commit -m "feat: add canonical tag taxonomy for story/aesthetic/mood/context tags"
```

---

## Task 2: LyricsProvider Seam

**Files:**
- Create: `lib/lyrics.ts`
- Test: `tests/lyrics.test.mjs`

**Interfaces:**
- Produces: `LyricsProvider` interface (`fetchLyrics(title, artist): Promise<string | null>`), `NullLyricsProvider` class implementing it
- Consumed by: Task 4 (`lib/autoTag.ts`)

- [ ] **Step 1: Write the failing test**

Create `tests/lyrics.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";

const { NullLyricsProvider } = await import("../lib/lyrics.ts");

test("NullLyricsProvider.fetchLyrics always resolves to null", async () => {
  const provider = new NullLyricsProvider();
  const result = await provider.fetchLyrics("Any Song", "Any Artist");
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/lyrics.test.mjs`
Expected: FAIL — `Cannot find module '../lib/lyrics.ts'`.

- [ ] **Step 3: Implement `lib/lyrics.ts`**

Create `lib/lyrics.ts`:

```typescript
// Seam for a future lyrics signal. No real provider is wired up yet —
// lyrics availability must not affect source_confidence until one is.
export interface LyricsProvider {
  fetchLyrics(title: string, artist: string): Promise<string | null>;
}

export class NullLyricsProvider implements LyricsProvider {
  async fetchLyrics(_title: string, _artist: string): Promise<string | null> {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/lyrics.test.mjs`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add lib/lyrics.ts tests/lyrics.test.mjs
git commit -m "feat: add LyricsProvider seam for future lyrics-based confidence"
```

---

## Task 3: Schema + RPC Changes

**Files:**
- Modify: `supabase/songs-schema.sql`
- Modify: `supabase/songs-rpc.sql`

**Interfaces:**
- Produces: new columns on `public.songs`; updated `match_songs`, `list_catalog`, `create_song` RPCs
- Consumed by: Task 5 (`lib/db/songs.ts`)

This task is manual SQL applied directly in the Supabase SQL editor (Dashboard → SQL Editor) — these files document the schema but are not auto-applied, matching the existing convention for this project.

- [ ] **Step 1: Add new columns to the `songs` table**

Edit `supabase/songs-schema.sql` — in the `CREATE TABLE IF NOT EXISTS public.songs (...)` block, insert these lines right after the `modern_aesthetic_tags` line (inside the "Tag arrays" group):

```sql
  story_context_tags   text[] NOT NULL DEFAULT '{}',

  -- Auto-tagging reliability metadata
  discarded_tags       text[] NOT NULL DEFAULT '{}',
  confidence_level     text,
  confidence_reason    text,
  gpt_confidence       float,
  source_confidence    float,
  final_confidence     float,
  needs_review         boolean NOT NULL DEFAULT false,
  evidence_sources     text[] NOT NULL DEFAULT '{}',
  tagging_version      text NOT NULL DEFAULT 'v1',
  vibe_summary         text,
```

Then, in Supabase → SQL Editor, run this against the already-existing live table (idempotent — safe to run even though the table already has data):

```sql
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS story_context_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discarded_tags     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confidence_level    text,
  ADD COLUMN IF NOT EXISTS confidence_reason   text,
  ADD COLUMN IF NOT EXISTS gpt_confidence      float,
  ADD COLUMN IF NOT EXISTS source_confidence   float,
  ADD COLUMN IF NOT EXISTS final_confidence    float,
  ADD COLUMN IF NOT EXISTS needs_review        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence_sources    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tagging_version     text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS vibe_summary        text;
```

Also add this same `ALTER TABLE` block to `supabase/songs-schema.sql`, right after the `CREATE TABLE` block, so the file stays the single source of truth for both fresh installs and the live database.

- [ ] **Step 2: Update `match_songs` to return the new scoring-relevant fields**

In `supabase/songs-schema.sql`, replace the existing `match_songs` function with:

```sql
CREATE OR REPLACE FUNCTION public.match_songs(
  query_vector  vector(10),
  match_count   int DEFAULT 50
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
    s.id,
    s.title,
    s.artist,
    s.language,
    s.energy,
    s.popularity_tier,
    s.emotional_vector,
    s.genre_tags,
    s.aesthetic_tags,
    s.mood_tags,
    s.story_intent_tags,
    s.modern_aesthetic_tags,
    s.story_context_tags,
    s.final_confidence,
    s.needs_review,
    s.itunes_preview_url,
    s.artwork_url,
    s.apple_music_url,
    s.youtube_id,
    s.quality_score,
    (s.emotional_vector <=> query_vector)::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
  ORDER BY s.emotional_vector <=> query_vector
  LIMIT match_count;
END;
$$;
```

Run this `CREATE OR REPLACE FUNCTION` statement in Supabase → SQL Editor.

- [ ] **Step 3: Update `list_catalog` and `create_song` in `supabase/songs-rpc.sql`**

Replace the existing `list_catalog` function with:

```sql
CREATE OR REPLACE FUNCTION public.list_catalog(
  p_limit  int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  title                 text,
  artist                text,
  language              text,
  energy                float8,
  popularity_tier       int4,
  genre_tags            text[],
  aesthetic_tags        text[],
  mood_tags             text[],
  story_intent_tags     text[],
  modern_aesthetic_tags text[],
  story_context_tags    text[],
  discarded_tags        text[],
  confidence_level      text,
  confidence_reason     text,
  gpt_confidence        float8,
  source_confidence     float8,
  final_confidence      float8,
  needs_review          boolean,
  evidence_sources      text[],
  tagging_version       text,
  vibe_summary          text,
  save_count            int4,
  skip_count            int4,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float8,
  created_at            timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, title, artist, language, energy, popularity_tier,
    genre_tags, aesthetic_tags, mood_tags, story_intent_tags, modern_aesthetic_tags,
    story_context_tags, discarded_tags, confidence_level, confidence_reason,
    gpt_confidence, source_confidence, final_confidence, needs_review, evidence_sources,
    tagging_version, vibe_summary, save_count, skip_count,
    itunes_preview_url, artwork_url, apple_music_url, youtube_id, quality_score, created_at
  FROM public.songs
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
```

Replace the existing `create_song` function with:

```sql
CREATE OR REPLACE FUNCTION public.create_song(
  p_title                 text,
  p_artist                text,
  p_album                 text,
  p_year                  int,
  p_duration_seconds      int,
  p_language              text,
  p_popularity_tier       int,
  p_emotional_vector      text,
  p_energy                float8,
  p_genre_tags            text[],
  p_aesthetic_tags        text[],
  p_mood_tags             text[],
  p_story_intent_tags     text[],
  p_modern_aesthetic_tags text[],
  p_itunes_preview_url    text,
  p_artwork_url           text,
  p_apple_music_url       text,
  p_youtube_id            text,
  p_story_context_tags    text[]  DEFAULT '{}',
  p_discarded_tags        text[]  DEFAULT '{}',
  p_confidence_level      text    DEFAULT NULL,
  p_confidence_reason     text    DEFAULT NULL,
  p_gpt_confidence        float8  DEFAULT NULL,
  p_source_confidence     float8  DEFAULT NULL,
  p_final_confidence      float8  DEFAULT NULL,
  p_needs_review          boolean DEFAULT false,
  p_evidence_sources      text[]  DEFAULT '{}',
  p_tagging_version       text    DEFAULT 'v1',
  p_vibe_summary          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.songs (
    title, artist, album, year, duration_seconds, language, popularity_tier,
    emotional_vector, energy, genre_tags, aesthetic_tags, mood_tags,
    story_intent_tags, modern_aesthetic_tags, itunes_preview_url, artwork_url,
    apple_music_url, youtube_id,
    story_context_tags, discarded_tags, confidence_level, confidence_reason,
    gpt_confidence, source_confidence, final_confidence, needs_review,
    evidence_sources, tagging_version, vibe_summary, updated_at
  ) VALUES (
    p_title, p_artist, p_album, p_year, p_duration_seconds, p_language, p_popularity_tier,
    p_emotional_vector::vector(10), p_energy,
    p_genre_tags, p_aesthetic_tags, p_mood_tags,
    p_story_intent_tags, p_modern_aesthetic_tags, p_itunes_preview_url, p_artwork_url,
    p_apple_music_url, p_youtube_id,
    p_story_context_tags, p_discarded_tags, p_confidence_level, p_confidence_reason,
    p_gpt_confidence, p_source_confidence, p_final_confidence, p_needs_review,
    p_evidence_sources, p_tagging_version, p_vibe_summary, now()
  ) RETURNING id;
$$;
```

Run both `CREATE OR REPLACE FUNCTION` statements in Supabase → SQL Editor. `update_song` and `delete_song` are unchanged.

- [ ] **Step 4: Verify in Supabase dashboard**

Table Editor → `songs` should show the 11 new columns. Database → Functions → `match_songs`, `list_catalog`, `create_song` should show updated signatures (check the "Arguments" column for each).

- [ ] **Step 5: Commit**

```bash
git add supabase/songs-schema.sql supabase/songs-rpc.sql
git commit -m "feat: add auto-tagging reliability columns and update songs RPCs"
```

---

## Task 4: Auto-Tag Pipeline — Canonical Validation + Confidence

**Files:**
- Modify: `lib/autoTag.ts`
- Modify: `tests/autoTag.test.mjs`

**Interfaces:**
- Consumes: `STORY_INTENT_TAGS_SET`, `MODERN_AESTHETIC_TAGS_SET`, `MOOD_TAGS_SET`, `STORY_CONTEXT_TAGS_SET`, `splitByCanonical` from Task 1; `NullLyricsProvider` from Task 2
- Produces:
  - `AutoTagResult` (extended with `story_context_tags`, `discarded_tags`, `confidence_level`, `confidence_reason`, `gpt_confidence`, `source_confidence`, `final_confidence`, `needs_review`, `evidence_sources`, `tagging_version`, `vibe_summary`)
  - `mapConfidenceLevel(level: string): number`
  - `computeSourceConfidence(matchType: "exact" | "fallback" | "none", lastfmTags: string[], durationSeconds: number | null, year: number | null): { score: number; evidenceSources: string[] }`
- Consumed by: Task 5 (`lib/db/songs.ts`)

- [ ] **Step 1: Write the failing tests**

Replace `tests/autoTag.test.mjs` entirely with:

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";

test("buildGptTagPrompt includes title, artist and lastfm tags in output", async () => {
  const { buildGptTagPrompt } = await import("../lib/autoTag.ts");
  const prompt = buildGptTagPrompt("Хочешь?", "Земфира", ["sad", "russian indie", "90s"]);
  assert.ok(prompt.includes("Хочешь?"));
  assert.ok(prompt.includes("Земфира"));
  assert.ok(prompt.includes("russian indie"));
});

test("buildGptTagPrompt enumerates all four canonical categories and asks for vibe_summary/confidence", async () => {
  const { buildGptTagPrompt } = await import("../lib/autoTag.ts");
  const prompt = buildGptTagPrompt("Song", "Artist", []);
  assert.ok(prompt.includes("healing era"), "should list STORY_INTENT_TAGS options");
  assert.ok(prompt.includes("old money"), "should list expanded MODERN_AESTHETIC_TAGS options");
  assert.ok(prompt.includes("nostalgic"), "should list MOOD_TAGS options");
  assert.ok(prompt.includes("mirror selfie"), "should list STORY_CONTEXT_TAGS options");
  assert.ok(prompt.includes("vibe_summary"));
  assert.ok(prompt.includes("confidence_level"));
  assert.ok(prompt.includes("confidence_reason"));
});

test("parseGptTagResponse extracts emotional_vector and story_intent_tags", async () => {
  const { parseGptTagResponse } = await import("../lib/autoTag.ts");
  const raw = JSON.stringify({
    language: "Russian",
    emotional_vector: { dreamy: 0.3, nostalgia: 0.8, energy: 0.2, cinematic: 0.6, darkness: 0.4, confidence: 0.3, intimacy: 0.7, danceability: 0.1, electronic: 0.2, acoustic: 0.8 },
    genre_tags: ["Russian indie", "alternative"],
    aesthetic_tags: ["raw", "nostalgic"],
    mood_tags: ["melancholic"],
    story_intent_tags: ["cold Russian melancholy", "bittersweet nostalgia"],
    modern_aesthetic_tags: ["russian indie"],
    story_context_tags: ["night drive"],
    vibe_summary: "A cold, wistful track about letting go.",
    confidence_level: "known_track",
    confidence_reason: "Recognized this exact track from training data.",
    popularity_tier: 2,
  });

  const result = parseGptTagResponse(raw);
  assert.equal(result.language, "Russian");
  assert.ok(result.story_intent_tags.includes("cold Russian melancholy"));
  assert.equal(result.emotional_vector.nostalgia, 0.8);
  assert.equal(result.vibe_summary, "A cold, wistful track about letting go.");
  assert.equal(result.confidence_level, "known_track");
  assert.equal(result.confidence_reason, "Recognized this exact track from training data.");
  assert.deepEqual(result.discarded_tags, []);
});

test("parseGptTagResponse discards non-canonical tags into discarded_tags instead of silently dropping them", async () => {
  const { parseGptTagResponse } = await import("../lib/autoTag.ts");
  const raw = JSON.stringify({
    language: "English",
    emotional_vector: {},
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: ["dreamy", "invented-mood"],
    story_intent_tags: ["healing era", "totally-made-up-intent"],
    modern_aesthetic_tags: ["mob wife", "unlisted-aesthetic"],
    story_context_tags: ["sunset", "unlisted-context"],
    vibe_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
    popularity_tier: 3,
  });

  const result = parseGptTagResponse(raw);
  assert.deepEqual(result.mood_tags, ["dreamy"]);
  assert.deepEqual(result.story_intent_tags, ["healing era"]);
  assert.deepEqual(result.modern_aesthetic_tags, ["mob wife"]);
  assert.deepEqual(result.story_context_tags, ["sunset"]);
  assert.deepEqual(
    result.discarded_tags.sort(),
    ["invented-mood", "totally-made-up-intent", "unlisted-aesthetic", "unlisted-context"].sort()
  );
});

test("parseGptTagResponse falls back to 'uncertain' for an unrecognized confidence_level", async () => {
  const { parseGptTagResponse } = await import("../lib/autoTag.ts");
  const raw = JSON.stringify({
    language: "English",
    emotional_vector: {},
    genre_tags: [], aesthetic_tags: [], mood_tags: [], story_intent_tags: [],
    modern_aesthetic_tags: [], story_context_tags: [],
    vibe_summary: "",
    confidence_level: "super-duper-sure",
    confidence_reason: "",
    popularity_tier: 3,
  });
  const result = parseGptTagResponse(raw);
  assert.equal(result.confidence_level, "uncertain");
});

test("parseGptTagResponse falls back to defaults on malformed JSON", async () => {
  const { parseGptTagResponse } = await import("../lib/autoTag.ts");
  const result = parseGptTagResponse("this is not json");
  assert.equal(result.language, "Unknown");
  assert.deepEqual(result.story_intent_tags, []);
  assert.deepEqual(result.discarded_tags, []);
  assert.equal(result.confidence_level, "uncertain");
});

test("mapConfidenceLevel maps each known level to its fixed score", async () => {
  const { mapConfidenceLevel } = await import("../lib/autoTag.ts");
  assert.equal(mapConfidenceLevel("known_track"), 0.9);
  assert.equal(mapConfidenceLevel("known_artist_only"), 0.6);
  assert.equal(mapConfidenceLevel("metadata_inference"), 0.4);
  assert.equal(mapConfidenceLevel("uncertain"), 0.25);
});

test("mapConfidenceLevel falls back to the uncertain score for an unrecognized level", async () => {
  const { mapConfidenceLevel } = await import("../lib/autoTag.ts");
  assert.equal(mapConfidenceLevel("something-else"), 0.25);
});

test("computeSourceConfidence combines evidence into a score and evidenceSources list", async () => {
  const { computeSourceConfidence } = await import("../lib/autoTag.ts");

  const full = computeSourceConfidence("exact", ["russian indie"], 210, 2011);
  assert.ok(Math.abs(full.score - 0.85) < 0.001);
  assert.deepEqual(full.evidenceSources.sort(), ["itunes_exact", "lastfm_tags", "metadata_complete"].sort());

  const nothing = computeSourceConfidence("none", [], null, null);
  assert.equal(nothing.score, 0);
  assert.deepEqual(nothing.evidenceSources, []);

  const fallbackOnly = computeSourceConfidence("fallback", [], null, null);
  assert.ok(Math.abs(fallbackOnly.score - 0.2) < 0.001);
  assert.deepEqual(fallbackOnly.evidenceSources, ["itunes_fallback"]);
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `node --test tests/autoTag.test.mjs`
Expected: the new tests fail (`buildGptTagPrompt` doesn't yet include the new categories; `parseGptTagResponse` doesn't yet return `discarded_tags`/`confidence_level`/`vibe_summary`; `mapConfidenceLevel` and `computeSourceConfidence` are not exported).

- [ ] **Step 3: Replace `lib/autoTag.ts`**

Replace the full contents of `lib/autoTag.ts` with:

```typescript
import openai from "./openai";
import type { EmotionalVector } from "./emotionalVector";
import { ZERO_VECTOR } from "./emotionalVector";
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
} from "./tagTaxonomy";
import { NullLyricsProvider } from "./lyrics";

export type ConfidenceLevel = "known_track" | "known_artist_only" | "metadata_inference" | "uncertain";

const CONFIDENCE_LEVEL_SCORES: Record<ConfidenceLevel, number> = {
  known_track: 0.9,
  known_artist_only: 0.6,
  metadata_inference: 0.4,
  uncertain: 0.25,
};

/** Maps GPT's categorical self-assessment to a fixed numeric score — never trusts a raw self-reported number. */
export function mapConfidenceLevel(level: string): number {
  return CONFIDENCE_LEVEL_SCORES[level as ConfidenceLevel] ?? CONFIDENCE_LEVEL_SCORES.uncertain;
}

export interface SourceConfidenceResult {
  score: number;
  evidenceSources: string[];
}

/**
 * Deterministic confidence from what evidence was actually available.
 * Lyrics deliberately do not contribute yet — NullLyricsProvider is a no-op seam.
 */
export function computeSourceConfidence(
  matchType: "exact" | "fallback" | "none",
  lastfmTags: string[],
  durationSeconds: number | null,
  year: number | null
): SourceConfidenceResult {
  let score = 0;
  const evidenceSources: string[] = [];

  if (matchType === "exact") {
    score += 0.4;
    evidenceSources.push("itunes_exact");
  } else if (matchType === "fallback") {
    score += 0.2;
    evidenceSources.push("itunes_fallback");
  }

  if (lastfmTags.length > 0) {
    score += 0.3;
    evidenceSources.push("lastfm_tags");
  }

  if (durationSeconds !== null && year !== null) {
    score += 0.15;
    evidenceSources.push("metadata_complete");
  }

  return { score: Math.max(0, Math.min(1, score)), evidenceSources };
}

export interface AutoTagResult {
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  duration_seconds: number | null;
  language: string;
  popularity_tier: number;
  emotional_vector: EmotionalVector;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  story_context_tags: string[];
  discarded_tags: string[];
  vibe_summary: string;
  confidence_level: ConfidenceLevel;
  confidence_reason: string;
  gpt_confidence: number;
  source_confidence: number;
  final_confidence: number;
  needs_review: boolean;
  evidence_sources: string[];
  tagging_version: string;
  itunes_preview_url: string | null;
  artwork_url: string | null;
  apple_music_url: string | null;
  energy: number;
}

interface ItunesTrack {
  trackName: string;
  artistName: string;
  collectionName: string;
  releaseDate: string;
  trackTimeMillis: number;
  previewUrl: string;
  artworkUrl100: string;
  trackViewUrl: string;
}

interface ItunesLookupResult {
  track: ItunesTrack | null;
  matchType: "exact" | "fallback" | "none";
}

async function fetchItunesMeta(title: string, artist: string): Promise<ItunesLookupResult> {
  const q = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=5`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { track: null, matchType: "none" };
    const data = await res.json();
    const results: ItunesTrack[] = data?.results ?? [];
    const exact = results.find(
      (r) =>
        r.trackName?.toLowerCase().includes(title.toLowerCase()) ||
        r.artistName?.toLowerCase().includes(artist.toLowerCase())
    );
    if (exact) return { track: exact, matchType: "exact" };
    if (results[0]) return { track: results[0], matchType: "fallback" };
    return { track: null, matchType: "none" };
  } catch {
    return { track: null, matchType: "none" };
  }
}

async function fetchLastfmTags(title: string, artist: string): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "track.getTopTags");
  url.searchParams.set("track", title);
  url.searchParams.set("artist", artist);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const tags = data?.toptags?.tag ?? [];
    return tags
      .slice(0, 8)
      .map((t: { name: string }) => t.name)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function buildGptTagPrompt(title: string, artist: string, lastfmTags: string[]): string {
  return `You are a music analyst building a structured profile for a song database.

Song: "${title}" by ${artist}
Last.fm community tags: ${lastfmTags.length > 0 ? lastfmTags.join(", ") : "none"}

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "language": "the actual vocal language (e.g. Russian, English, Korean) or Instrumental",
  "popularity_tier": 1-5 where 1=underground/niche, 3=moderate, 5=mainstream/globally known,
  "emotional_vector": {
    "dreamy": 0.0-1.0,
    "nostalgia": 0.0-1.0,
    "energy": 0.0-1.0,
    "cinematic": 0.0-1.0,
    "darkness": 0.0-1.0,
    "confidence": 0.0-1.0,
    "intimacy": 0.0-1.0,
    "danceability": 0.0-1.0,
    "electronic": 0.0-1.0,
    "acoustic": 0.0-1.0
  },
  "genre_tags": ["1-3 specific genre strings for this exact song"],
  "aesthetic_tags": ["2-4 aesthetic words: dark, dreamy, raw, euphoric, nostalgic, etc."],
  "mood_tags": ["2-4 tags, ONLY from this list: ${MOOD_TAGS.join(", ")}"],
  "story_intent_tags": ["2-5 tags, ONLY from this list: ${STORY_INTENT_TAGS.join(", ")}"],
  "modern_aesthetic_tags": ["2-5 tags, ONLY from this list: ${MODERN_AESTHETIC_TAGS.join(", ")}"],
  "story_context_tags": ["2-5 tags, ONLY from this list: ${STORY_CONTEXT_TAGS.join(", ")}"],
  "vibe_summary": "1-2 short sentences in natural language describing this song's feeling/story",
  "confidence_level": "one of: known_track, known_artist_only, metadata_inference, uncertain — how well do you actually know THIS SPECIFIC SONG, not just the artist's general style",
  "confidence_reason": "one short sentence justifying the confidence_level"
}

Be precise. Every value matters for song matching quality. Never invent tags outside the given lists — pick the closest canonical option instead.`;
}

export interface ParsedTagResponse {
  language: string;
  popularity_tier: number;
  emotional_vector: EmotionalVector;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  story_context_tags: string[];
  discarded_tags: string[];
  vibe_summary: string;
  confidence_level: ConfidenceLevel;
  confidence_reason: string;
}

const VALID_CONFIDENCE_LEVELS = new Set<string>(["known_track", "known_artist_only", "metadata_inference", "uncertain"]);

export function parseGptTagResponse(raw: string): ParsedTagResponse {
  const fallback: ParsedTagResponse = {
    language: "Unknown",
    popularity_tier: 3,
    emotional_vector: { ...ZERO_VECTOR },
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: [],
    story_intent_tags: [],
    modern_aesthetic_tags: [],
    story_context_tags: [],
    discarded_tags: [],
    vibe_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
  };

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) return fallback;
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

    const ev = parsed.emotional_vector ?? {};
    const emotional_vector: EmotionalVector = {
      dreamy: Number(ev.dreamy ?? 0),
      nostalgia: Number(ev.nostalgia ?? 0),
      energy: Number(ev.energy ?? 0),
      cinematic: Number(ev.cinematic ?? 0),
      darkness: Number(ev.darkness ?? 0),
      confidence: Number(ev.confidence ?? 0),
      intimacy: Number(ev.intimacy ?? 0),
      danceability: Number(ev.danceability ?? 0),
      electronic: Number(ev.electronic ?? 0),
      acoustic: Number(ev.acoustic ?? 0),
    };

    const proposedMood = Array.isArray(parsed.mood_tags) ? parsed.mood_tags.filter(Boolean) : [];
    const proposedStoryIntent = Array.isArray(parsed.story_intent_tags) ? parsed.story_intent_tags.filter(Boolean) : [];
    const proposedModernAesthetic = Array.isArray(parsed.modern_aesthetic_tags) ? parsed.modern_aesthetic_tags.filter(Boolean) : [];
    const proposedStoryContext = Array.isArray(parsed.story_context_tags) ? parsed.story_context_tags.filter(Boolean) : [];

    const moodSplit = splitByCanonical(proposedMood, MOOD_TAGS_SET);
    const storyIntentSplit = splitByCanonical(proposedStoryIntent, STORY_INTENT_TAGS_SET);
    const modernAestheticSplit = splitByCanonical(proposedModernAesthetic, MODERN_AESTHETIC_TAGS_SET);
    const storyContextSplit = splitByCanonical(proposedStoryContext, STORY_CONTEXT_TAGS_SET);

    const confidenceLevelRaw = typeof parsed.confidence_level === "string" ? parsed.confidence_level : "uncertain";
    const confidence_level: ConfidenceLevel = VALID_CONFIDENCE_LEVELS.has(confidenceLevelRaw)
      ? (confidenceLevelRaw as ConfidenceLevel)
      : "uncertain";

    return {
      language: typeof parsed.language === "string" ? parsed.language : "Unknown",
      popularity_tier:
        typeof parsed.popularity_tier === "number" ? Math.round(parsed.popularity_tier) : 3,
      emotional_vector,
      genre_tags: Array.isArray(parsed.genre_tags) ? parsed.genre_tags.filter(Boolean) : [],
      aesthetic_tags: Array.isArray(parsed.aesthetic_tags) ? parsed.aesthetic_tags.filter(Boolean) : [],
      mood_tags: moodSplit.accepted,
      story_intent_tags: storyIntentSplit.accepted,
      modern_aesthetic_tags: modernAestheticSplit.accepted,
      story_context_tags: storyContextSplit.accepted,
      discarded_tags: [
        ...moodSplit.rejected,
        ...storyIntentSplit.rejected,
        ...modernAestheticSplit.rejected,
        ...storyContextSplit.rejected,
      ],
      vibe_summary: typeof parsed.vibe_summary === "string" ? parsed.vibe_summary : "",
      confidence_level,
      confidence_reason: typeof parsed.confidence_reason === "string" ? parsed.confidence_reason : "",
    };
  } catch {
    return fallback;
  }
}

export async function autoTagSong(title: string, artist: string): Promise<AutoTagResult> {
  const [itunesLookup, lastfmTags] = await Promise.all([
    fetchItunesMeta(title, artist),
    fetchLastfmTags(title, artist),
  ]);
  const itunesMeta = itunesLookup.track;

  const prompt = buildGptTagPrompt(title, artist, lastfmTags);
  let rawGpt = "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
      temperature: 0,
    });
    rawGpt = res.choices[0].message.content ?? "";
  } catch (err) {
    console.error("[autoTag] GPT failed:", err);
  }

  const gptData = parseGptTagResponse(rawGpt);

  const durationSeconds = itunesMeta?.trackTimeMillis
    ? Math.round(itunesMeta.trackTimeMillis / 1000)
    : null;
  const year = itunesMeta?.releaseDate ? new Date(itunesMeta.releaseDate).getFullYear() : null;

  // Reserved seam — always null today, does not affect source_confidence.
  const lyricsProvider = new NullLyricsProvider();
  await lyricsProvider.fetchLyrics(title, artist);

  const { score: source_confidence, evidenceSources: evidence_sources } = computeSourceConfidence(
    itunesLookup.matchType,
    lastfmTags,
    durationSeconds,
    year
  );
  const gpt_confidence = mapConfidenceLevel(gptData.confidence_level);
  const final_confidence = Math.min(gpt_confidence, source_confidence);

  return {
    title: itunesMeta?.trackName ?? title,
    artist: itunesMeta?.artistName ?? artist,
    album: itunesMeta?.collectionName ?? null,
    year,
    duration_seconds: durationSeconds,
    language: gptData.language,
    popularity_tier: gptData.popularity_tier,
    emotional_vector: gptData.emotional_vector,
    genre_tags: gptData.genre_tags,
    aesthetic_tags: gptData.aesthetic_tags,
    mood_tags: gptData.mood_tags,
    story_intent_tags: gptData.story_intent_tags,
    modern_aesthetic_tags: gptData.modern_aesthetic_tags,
    story_context_tags: gptData.story_context_tags,
    discarded_tags: gptData.discarded_tags,
    vibe_summary: gptData.vibe_summary,
    confidence_level: gptData.confidence_level,
    confidence_reason: gptData.confidence_reason,
    gpt_confidence,
    source_confidence,
    final_confidence,
    needs_review: final_confidence < 0.6,
    evidence_sources,
    tagging_version: "v1",
    itunes_preview_url: itunesMeta?.previewUrl ?? null,
    artwork_url: itunesMeta?.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
    apple_music_url: itunesMeta?.trackViewUrl ?? null,
    energy: gptData.emotional_vector.energy,
  };
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test tests/autoTag.test.mjs`
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/autoTag.ts tests/autoTag.test.mjs
git commit -m "feat: validate GPT tags against canonical taxonomy, add confidence scoring"
```

---

## Task 5: Song Catalog DB Layer

**Files:**
- Modify: `lib/db/songs.ts`

**Interfaces:**
- Consumes: `AutoTagResult` from Task 4
- Produces: `CatalogSong` (extended), `insertSong` (passes new fields to `create_song`)
- Consumed by: Task 6 (`lib/recommend.ts`), Task 7 (admin UI)

- [ ] **Step 1: Update `CatalogSong` and `insertSong` in `lib/db/songs.ts`**

Replace the `CatalogSong` interface and `insertSong` function in `lib/db/songs.ts` with:

```typescript
export interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  language: string;
  energy: number;
  popularity_tier: number;
  emotional_vector: number[] | null;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  story_context_tags: string[];
  discarded_tags?: string[];
  confidence_level?: string | null;
  confidence_reason?: string | null;
  gpt_confidence?: number | null;
  source_confidence?: number | null;
  final_confidence: number | null;
  needs_review: boolean;
  evidence_sources?: string[];
  tagging_version?: string;
  vibe_summary?: string | null;
  save_count?: number;
  skip_count?: number;
  itunes_preview_url: string | null;
  artwork_url: string | null;
  apple_music_url: string | null;
  youtube_id: string | null;
  quality_score: number;
  distance?: number;
}
```

(Leave `SongPatch` unchanged — manual admin edits still only touch the existing tag fields.)

Replace `insertSong`:

```typescript
export async function insertSong(data: AutoTagResult): Promise<{ id: string }> {
  const vectorArray = vectorToArray(data.emotional_vector);
  const vectorString = `[${vectorArray.join(",")}]`;

  const { data: id, error } = await supabase.rpc("create_song", {
    p_title:                 data.title,
    p_artist:                data.artist,
    p_album:                 data.album ?? null,
    p_year:                  data.year ?? null,
    p_duration_seconds:      data.duration_seconds ?? null,
    p_language:              data.language,
    p_popularity_tier:       data.popularity_tier,
    p_emotional_vector:      vectorString,
    p_energy:                data.energy,
    p_genre_tags:            data.genre_tags,
    p_aesthetic_tags:        data.aesthetic_tags,
    p_mood_tags:             data.mood_tags,
    p_story_intent_tags:     data.story_intent_tags,
    p_modern_aesthetic_tags: data.modern_aesthetic_tags,
    p_itunes_preview_url:    data.itunes_preview_url ?? null,
    p_artwork_url:           data.artwork_url ?? null,
    p_apple_music_url:       data.apple_music_url ?? null,
    p_youtube_id:            data.youtube_id ?? null,
    p_story_context_tags:    data.story_context_tags,
    p_discarded_tags:        data.discarded_tags,
    p_confidence_level:      data.confidence_level,
    p_confidence_reason:     data.confidence_reason,
    p_gpt_confidence:        data.gpt_confidence,
    p_source_confidence:     data.source_confidence,
    p_final_confidence:      data.final_confidence,
    p_needs_review:          data.needs_review,
    p_evidence_sources:      data.evidence_sources,
    p_tagging_version:       data.tagging_version,
    p_vibe_summary:          data.vibe_summary,
  });

  if (error) throw new Error(`insertSong failed: ${error.message}`);
  return { id: id as string };
}
```

`listSongs` and `searchCatalog` need no code changes — they already cast the RPC response to `CatalogSong[]`, so the new columns returned by the updated `list_catalog`/`match_songs` RPCs (Task 3) flow through automatically.

- [ ] **Step 2: Manual verification**

Start the dev server (`npm run dev`), open `/admin`, add a song, and confirm no runtime error occurs and the request succeeds (check the Network tab — `POST /api/admin/songs` should return `200` with a `song` object containing `final_confidence`, `needs_review`, `vibe_summary`).

- [ ] **Step 3: Commit**

```bash
git add lib/db/songs.ts
git commit -m "feat: wire auto-tagging reliability fields through the catalog DB layer"
```

---

## Task 6: Recommendation Scoring — Confidence Guard + Penalty

**Files:**
- Modify: `lib/recommend.ts`
- Modify: `tests/recommend.test.mjs`

**Interfaces:**
- Consumes: `CatalogSong.final_confidence`, `CatalogSong.needs_review` from Task 5
- Produces: `ScoreComponents` gains `needsReviewPenalty: number`; new `removedReason: "confidence_too_low"`

- [ ] **Step 1: Fix the pre-existing test bug and add failing tests**

`tests/recommend.test.mjs` currently calls `rec.buildRecommendations(...)` as if it returns an array, but the function returns `{ results, debugLog }` — 5 of its 7 tests are currently failing for this reason (confirmed by running `node --test tests/recommend.test.mjs` before this task). Replace the full contents of `tests/recommend.test.mjs` with:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(path, extraContext = {}) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const stubRequire = (mod) => {
    if (mod.includes("supabase") || mod.includes("openai")) return {};
    if (mod.includes("vectorMath")) {
      const vmSource = readFileSync("lib/vectorMath.ts", "utf8");
      const vmOutput = ts.transpileModule(vmSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      }).outputText;
      const vmMod = { exports: {} };
      const vmCtx = vm.createContext({ exports: vmMod.exports, module: vmMod, require: stubRequire, console, process, Array });
      vm.runInContext(vmOutput, vmCtx);
      return vmMod.exports;
    }
    if (mod.includes("emotionalVector")) return { ZERO_VECTOR: { dreamy:0,nostalgia:0,energy:0,cinematic:0,darkness:0,confidence:0,intimacy:0,danceability:0,electronic:0,acoustic:0 }, VECTOR_KEYS: ["dreamy","nostalgia","energy","cinematic","darkness","confidence","intimacy","danceability","electronic","acoustic"] };
    if (mod.includes("db/songs")) return {};
    try { return require(mod); } catch { return {}; }
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process, URLSearchParams, Array, ...extraContext });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const rec = loadTsModule("lib/recommend.ts");

function makeSong(overrides = {}) {
  return {
    id: "test-id",
    title: "Test Song",
    artist: "Test Artist",
    language: "English",
    energy: 0.5,
    popularity_tier: 3,
    emotional_vector: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    genre_tags: ["indie pop"],
    aesthetic_tags: ["dreamy"],
    mood_tags: ["melancholic"],
    story_intent_tags: ["main character walk"],
    modern_aesthetic_tags: ["quiet luxury"],
    story_context_tags: [],
    final_confidence: 0.8,
    needs_review: false,
    itunes_preview_url: "https://example.com/preview.m4a",
    artwork_url: "https://example.com/art.jpg",
    apple_music_url: null,
    youtube_id: null,
    quality_score: 0.7,
    distance: 0.2,
    ...overrides,
  };
}

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
    ...overrides,
  };
}

test("strict language filter removes songs not in language list", () => {
  const candidates = [
    makeSong({ id: "1", language: "English" }),
    makeSong({ id: "2", language: "Russian" }),
  ];
  const { results } = rec.buildRecommendations(makeRequest({ languages: ["English"], languageOpenness: "strict" }), candidates);
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("1"), "English song should be kept");
  assert.ok(!ids.includes("2"), "Russian song should be removed with strict filter");
});

test("blocked song is removed from results", () => {
  const candidates = [makeSong({ id: "blocked-id" })];
  const { results } = rec.buildRecommendations(makeRequest({ blockedSongs: ["blocked-id"] }), candidates);
  assert.equal(results.length, 0);
});

test("blocked artist is removed from results", () => {
  const candidates = [makeSong({ id: "1", artist: "Bad Artist" })];
  const { results } = rec.buildRecommendations(makeRequest({ blockedArtists: ["Bad Artist"] }), candidates);
  assert.equal(results.length, 0);
});

test("freshness penalty applied to recently shown songs", () => {
  const song = makeSong({ id: "recent-id" });
  const { results } = rec.buildRecommendations(makeRequest({ recentlyShownSongIds: ["recent-id"] }), [song]);
  assert.equal(results[0].scoreComponents.freshnessPenalty, -20);
});

test("story intent tag match boosts score", () => {
  const withTag = makeSong({ id: "a", story_intent_tags: ["main character walk"] });
  const withoutTag = makeSong({ id: "b", story_intent_tags: [] });
  const req = makeRequest({ storyIntentTags: ["main character walk"] });
  const { results } = rec.buildRecommendations(req, [withTag, withoutTag]);
  const a = results.find((r) => r.id === "a");
  const b = results.find((r) => r.id === "b");
  assert.ok(a.scoreComponents.storyFit > b.scoreComponents.storyFit);
  assert.ok(a.scoreComponents.finalScore > b.scoreComponents.finalScore);
});

test("energy compatibility filter removes songs with energy too far from query", () => {
  const calmQuery = makeRequest({ queryVector: [0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const aggressiveSong = makeSong({ energy: 0.9, emotional_vector: [0.5, 0.5, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const { results } = rec.buildRecommendations(calmQuery, [aggressiveSong]);
  assert.equal(results.length, 0, "Song with energy 0.9 should be removed when query energy is 0.1");
});

test("results are sorted by finalScore descending", () => {
  const high = makeSong({ id: "high", emotional_vector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9] });
  const low  = makeSong({ id: "low",  emotional_vector: [0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] });
  const query = makeRequest({ queryVector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9] });
  const { results } = rec.buildRecommendations(query, [low, high]);
  assert.equal(results[0].id, "high");
});

test("song with final_confidence below 0.35 is hard-removed with confidence_too_low", () => {
  const song = makeSong({ id: "unreliable", final_confidence: 0.2 });
  const { results, debugLog } = rec.buildRecommendations(makeRequest(), [song]);
  assert.equal(results.length, 0);
  const entry = debugLog.find((e) => e.id === "unreliable");
  assert.equal(entry.removedReason, "confidence_too_low");
});

test("song with final_confidence null (not yet tagged by this pipeline) is not hard-removed", () => {
  const song = makeSong({ id: "legacy", final_confidence: null });
  const { results } = rec.buildRecommendations(makeRequest(), [song]);
  assert.equal(results.length, 1);
});

test("needs_review song still appears but with a scoring penalty, not full hiding", () => {
  const flagged = makeSong({ id: "flagged", final_confidence: 0.5, needs_review: true });
  const clean = makeSong({ id: "clean", final_confidence: 0.9, needs_review: false });
  const { results } = rec.buildRecommendations(makeRequest(), [flagged, clean]);
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("flagged"), "needs_review song should still be recommendable");
  const flaggedResult = results.find((r) => r.id === "flagged");
  assert.equal(flaggedResult.scoreComponents.needsReviewPenalty, -12);
  const cleanResult = results.find((r) => r.id === "clean");
  assert.equal(cleanResult.scoreComponents.needsReviewPenalty, 0);
});
```

- [ ] **Step 2: Run the tests to confirm the new ones fail**

Run: `node --test tests/recommend.test.mjs`
Expected: the 7 pre-existing tests now pass (destructuring fixed); the 3 new tests (`confidence_too_low`, `final_confidence null`, `needs_review` penalty) fail because `lib/recommend.ts` doesn't implement them yet.

- [ ] **Step 3: Add the confidence guard and penalty to `lib/recommend.ts`**

In `lib/recommend.ts`, update the `ScoreComponents` interface:

```typescript
export interface ScoreComponents {
  photoFit: number;
  tasteFit: number;
  storyFit: number;
  noveltyFit: number;
  qualityBonus: number;
  languagePenalty: number;
  freshnessPenalty: number;
  mainstreamPenalty: number;
  needsReviewPenalty: number;
  finalScore: number;
}
```

Insert a new hard-guard check right after the existing "Guard: skip songs without emotional_vector" block (the block that pushes `removedReason: "no_emotional_vector"`):

```typescript
    // 0.5. Guard: confidence too low to trust these tags
    if (song.final_confidence !== null && song.final_confidence !== undefined && song.final_confidence < 0.35) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "confidence_too_low",
      });
      continue;
    }
```

In the scoring section, add the penalty next to the existing penalties (`languagePenalty`, `freshnessPenalty`, `mainstreamPenalty`):

```typescript
    const needsReviewPenalty = song.needs_review ? -12 : 0;
```

Update the `raw`/`finalScore` computation to include it:

```typescript
    const raw = photoFit + tasteFit + storyFit + noveltyFit + qualityBonus;
    const finalScore = Math.max(
      0,
      Math.min(100, raw + languagePenalty + freshnessPenalty + mainstreamPenalty + needsReviewPenalty)
    );
```

And add it to the `components` object:

```typescript
    const components: ScoreComponents = {
      photoFit: Math.round(photoFit * 10) / 10,
      tasteFit: Math.round(tasteFit * 10) / 10,
      storyFit,
      noveltyFit: Math.round(noveltyFit * 10) / 10,
      qualityBonus: Math.round(qualityBonus * 10) / 10,
      languagePenalty,
      freshnessPenalty,
      mainstreamPenalty,
      needsReviewPenalty,
      finalScore: Math.round(finalScore * 10) / 10,
    };
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `node --test tests/recommend.test.mjs`
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/recommend.ts tests/recommend.test.mjs
git commit -m "fix: correct buildRecommendations test destructuring; add confidence guard and needs_review penalty"
```

---

## Task 7: Admin UI — Confidence Badge + Review Queue

**Files:**
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `CatalogSong` fields from Task 5 (`final_confidence`, `needs_review`, `confidence_level`, `confidence_reason`, `discarded_tags`, `vibe_summary`, `save_count`, `skip_count`)

- [ ] **Step 1: Update the `Song` interface and add confidence/review helpers**

In `app/admin/page.tsx`, replace the `Song` interface with:

```typescript
interface Song {
  id: string;
  title: string;
  artist: string;
  language: string;
  popularity_tier: number;
  story_intent_tags: string[];
  quality_score: number;
  final_confidence: number | null;
  needs_review: boolean;
  confidence_level?: string | null;
  confidence_reason?: string | null;
  discarded_tags?: string[];
  vibe_summary?: string | null;
  save_count?: number;
  skip_count?: number;
}
```

Add these helper functions above the `AdminPage` component:

```typescript
function confidenceColor(score: number | null | undefined): string {
  if (score == null) return "#666";
  if (score >= 0.6) return "#22c55e";
  if (score >= 0.35) return "#eab308";
  return "#ef4444";
}

function sortForReviewQueue(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => {
    if (a.needs_review !== b.needs_review) return a.needs_review ? -1 : 1;
    const confA = a.final_confidence ?? 1;
    const confB = b.final_confidence ?? 1;
    if (confA !== confB) return confA - confB;
    const usageA = (a.save_count ?? 0) + (a.skip_count ?? 0);
    const usageB = (b.save_count ?? 0) + (b.skip_count ?? 0);
    return usageB - usageA;
  });
}
```

- [ ] **Step 2: Add the "needs review" filter state and apply it to the rendered list**

Inside `AdminPage`, add state next to the existing `useState` calls:

```typescript
  const [reviewOnly, setReviewOnly] = useState(false);
```

Right before the `return (`, compute the songs to render:

```typescript
  const visibleSongs = reviewOnly
    ? sortForReviewQueue(songs.filter((s) => s.needs_review))
    : songs;
```

- [ ] **Step 3: Add the filter checkbox and confidence/vibe_summary/discarded_tags columns to the table**

Replace the block from `{status && ...}` through the closing `</table>` with:

```tsx
      {status && <p style={{ color: "#A855F7", marginBottom: 16 }}>{status}</p>}

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#888", fontSize: 13 }}>
        <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
        Show only needs review
      </label>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333", color: "#888" }}>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Title</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Artist</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Lang</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Tier</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Confidence</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Story Tags</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Vibe Summary</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Discarded</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleSongs.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={{ padding: "6px 8px", color: "#fff" }}>{s.title}</td>
              <td style={{ padding: "6px 8px", color: "#aaa" }}>{s.artist}</td>
              <td style={{ padding: "6px 8px", color: "#888" }}>{s.language}</td>
              <td style={{ padding: "6px 8px", color: "#888" }}>{s.popularity_tier}</td>
              <td style={{ padding: "6px 8px" }}>
                <span
                  title={s.confidence_reason || ""}
                  style={{ color: confidenceColor(s.final_confidence), fontWeight: 600 }}
                >
                  {s.final_confidence != null ? s.final_confidence.toFixed(2) : "—"}
                  {s.confidence_level ? ` (${s.confidence_level})` : ""}
                </span>
              </td>
              <td style={{ padding: "6px 8px" }}>
                {editId === s.id ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={editTags} onChange={(e) => setEditTags(e.target.value)} style={{ flex: 1, padding: "4px 8px", background: "#1a1a1a", border: "1px solid #444", borderRadius: 4, color: "#fff", fontSize: 12 }} />
                    <button onClick={() => saveEdit(s.id)} style={{ padding: "4px 8px", background: "#22c55e", color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Save</button>
                    <button onClick={() => setEditId(null)} style={{ padding: "4px 8px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Cancel</button>
                  </div>
                ) : (
                  <span style={{ color: "#A855F7", fontSize: 11 }}>{s.story_intent_tags?.join(", ") || "—"}</span>
                )}
              </td>
              <td style={{ padding: "6px 8px", color: "#888", fontSize: 11, maxWidth: 220 }}>{s.vibe_summary || "—"}</td>
              <td style={{ padding: "6px 8px", color: "#666", fontSize: 11 }}>{s.discarded_tags?.join(", ") || "—"}</td>
              <td style={{ padding: "6px 8px", display: "flex", gap: 6 }}>
                <button onClick={() => { setEditId(s.id); setEditTags(s.story_intent_tags?.join(", ") ?? ""); }} style={{ padding: "3px 8px", background: "#1a1a1a", color: "#888", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Edit tags</button>
                <button onClick={() => remove(s.id)} style={{ padding: "3px 8px", background: "#1a1a1a", color: "#ef4444", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
```

- [ ] **Step 4: Manual verification**

Start the dev server (`npm run dev`), open `/admin`:
- Confirm the Confidence column shows a colored score for each song (or `—` for songs tagged before this change, which will have `final_confidence: null`).
- Add a new song and confirm its confidence badge renders green/yellow/red appropriately (check `confidence_reason` shows on hover).
- Toggle "Show only needs review" and confirm the list filters down and re-sorts (lowest confidence first, then by `save_count + skip_count`).

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: show confidence badge and needs-review queue in admin catalog UI"
```

---

## Post-Plan Verification

- [ ] Run the full suite: `node --test tests/*.test.mjs` — all tests across all files should pass (note: `tests/vectorMath.test.mjs` has a pre-existing, unrelated `MODULE_NOT_FOUND` failure from before this plan; it is out of scope here and should not regress further).
- [ ] Confirm `docs/superpowers/specs/2026-07-01-auto-tagging-reliability-design.md` Goals are each satisfied: canonical taxonomy ✓, discarded-tag tracking ✓, two-signal confidence ✓, `needs_review` soft-penalty ✓, `tagging_version` ✓, `vibe_summary` ✓, `LyricsProvider` seam ✓.
