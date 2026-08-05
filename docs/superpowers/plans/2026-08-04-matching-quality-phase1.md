# Matching Quality — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three root causes of poor song matching identified by a full-pipeline audit — a feminine-skewed tag taxonomy, no gender/POV signal anywhere in the system (causing wrong-gendered matches), and thin portrait-reading guidance in the vision prompt — without touching the 10-dim emotional vector schema or the catalog-growth/semantic-search work tracked separately.

**Architecture:** Two independent, additive tracks that meet at scoring time. Track A (taxonomy + portrait prompt) is a pure prompt/const change with zero schema impact. Track B (gender/POV signal) adds one nullable `lyrical_address` column to the `songs` table, an ephemeral (never-persisted) `presentationRead` field threaded through the existing `/api/analyze` → `/api/recommend` request chain exactly like `photoVectorArray` already is, and a new heavy-but-not-exclusionary scoring penalty in `lib/recommend.ts`.

**Tech Stack:** Next.js App Router API routes, Supabase Postgres (pgvector) via RPC functions, OpenAI `gpt-4o`/`gpt-4o-mini`, `node --test` for the test suite.

## Global Constraints

- Never call OpenAI from client components; all AI routes use `export const runtime = "nodejs"` (existing project rule, unaffected by this plan — no new client-side AI calls).
- Any new GPT-filled enum field must default to a safe, no-op value ("unclear"/"neutral") when GPT omits it or returns an invalid value — never throw, never block a request.
- `presentationRead` (the photo-side signal) must never be persisted to any table or shown in any UI — computed fresh per request, forwarded once, discarded.
- Schema changes to `public.songs` go in the `SUPABASE_CATALOG_URL` project via a new idempotent `DROP FUNCTION IF EXISTS` + `CREATE OR REPLACE FUNCTION` migration file, following the exact pattern already used in `supabase/retrieval-v3-migration.sql` — this file must be applied manually via the Supabase SQL editor; it is not run automatically by any script or deploy.
- Run `npm test` (`node --test tests/*.test.mjs`) after every task; all tests must stay green.

---

### Task 1: Expand the tag taxonomy and add the shared POV enum

**Files:**
- Modify: `lib/tagTaxonomy.ts`
- Test: `tests/tagTaxonomy.test.mjs`

**Interfaces:**
- Produces: `STORY_INTENT_TAGS` (32 entries, was 24), `MODERN_AESTHETIC_TAGS` (20 entries, was 15), `STORY_CONTEXT_TAGS` (15 entries, was 12) — all still `as const string[]`, all existing consumers (`splitByCanonical`, `*_SET`, `ANTI_TAG_CANDIDATES_SET`) work unchanged since they're generic over array contents.
- Produces: `export type PovSignal = "male" | "female" | "neutral" | "unclear";`, `export const POV_SIGNALS: readonly PovSignal[]`, `export function coercePovSignal(value: unknown): PovSignal` — consumed by Task 2 (`app/api/analyze/route.ts`) and Task 5 (`lib/autoTag.ts`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/tagTaxonomy.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/tagTaxonomy.test.mjs` (or `node --test tests/tagTaxonomy.test.mjs`)
Expected: FAIL — `taxonomy.coercePovSignal is not a function`, and the length assertions fail against the current 24/15/12 counts.

- [ ] **Step 3: Add the new tags and the POV enum to `lib/tagTaxonomy.ts`**

Edit the three arrays (append entries, keep everything else — including the existing feminine-coded entries — unchanged):

```ts
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
  "gym flex",
  "night drive alone",
  "hustle grind",
  "rap swagger",
  "rock grit",
  "stoic heartbreak",
  "streetwear energy",
  "game day",
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
  "French chic",
  "Scandi minimal",
  "Latin heat",
  "Japanese minimalist",
  "K-pop glossy",
] as const;

export const MOOD_TAGS = [
  "melancholic",
  "euphoric",
  "chaotic",
  "cozy",
  "nostalgic",
  "dreamy",
  "calm",
  "serene",
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
  "travel",
  "group photo",
  "workout",
  "sports",
  "study grind",
] as const;
```

Then add the POV enum near the bottom of the file, after `normalizeStringArray`:

```ts
/**
 * Internal-only gender/POV signal — used to softly deprioritize (never
 * exclude) a song whose lyrical address clearly conflicts with a photo's
 * subject. "male"/"female" describe who the song's lyrics are written
 * from/addressed to on the song side, and how a photo's subject reads on
 * the photo side — the same four values on both sides keeps the mismatch
 * check a plain equality comparison. Always safe to default to "unclear":
 * that value never triggers a penalty.
 */
export type PovSignal = "male" | "female" | "neutral" | "unclear";

export const POV_SIGNALS: readonly PovSignal[] = ["male", "female", "neutral", "unclear"];

const POV_SIGNALS_SET: Set<string> = new Set(POV_SIGNALS);

/** Coerces any GPT output to a valid PovSignal, defaulting to the safe no-op value. */
export function coercePovSignal(value: unknown): PovSignal {
  return typeof value === "string" && POV_SIGNALS_SET.has(value) ? (value as PovSignal) : "unclear";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/tagTaxonomy.test.mjs`
Expected: PASS, all tests including the pre-existing ones (their counts/values are untouched).

- [ ] **Step 5: Commit**

```bash
git add lib/tagTaxonomy.ts tests/tagTaxonomy.test.mjs
git commit -m "Expand tag taxonomy with masculine/cultural tags, add shared POV enum"
```

---

### Task 2: Portrait/face reading guidance + `presentationRead` in the vision prompt

**Files:**
- Modify: `app/api/analyze/route.ts:41-131` (prompt), `:328-377` (response handling)

**Interfaces:**
- Consumes: `coercePovSignal` from `lib/tagTaxonomy.ts` (Task 1).
- Produces: `/api/analyze`'s JSON response gains a top-level `presentationRead: PovSignal` field, alongside the existing `photoConfidence`/`matchSignals`/etc. Consumed by Task 7.

- [ ] **Step 1: Add the import**

In `app/api/analyze/route.ts`, extend the existing `tagTaxonomy` import:

```ts
import {
  STORY_CONTEXT_TAGS,
  STORY_INTENT_TAGS,
  MODERN_AESTHETIC_TAGS,
  MOOD_TAGS,
  coercePovSignal,
} from "../../../lib/tagTaxonomy";
```

- [ ] **Step 2: Add portrait-reading examples to `BASE_SYSTEM_PROMPT`**

In the `PHOTO ANALYSIS — READ THE MOMENT:` block (`app/api/analyze/route.ts:41-49`), replace the single generic mirror-selfie line with worked examples matching the style of the existing scene examples:

```ts
const BASE_SYSTEM_PROMPT = `You are a photo vibe analyst. Your job is to understand the emotional and aesthetic character of a photo so that songs can be matched to it from a database.

ABSOLUTE RULE: Analyze ANY image. Abstract images, memes, dark photos, screenshots — everything has visual energy. Never refuse. Only return JSON.

PHOTO ANALYSIS — READ THE MOMENT:
Understand WHAT IS HAPPENING and HOW THE PERSON FEELS, not just aesthetics.

- A broken nail / chaos → frustration, high energy, LOW valence
- A gym selfie → confidence, hustle, HIGH energy
- A sunset / nature → nostalgic, peaceful, LOW energy
- Reading faces/portraits: a guarded or neutral expression with hard/flat lighting → grit or edge, not sadness. Relaxed shoulders with a soft, easy smile → warmth, not necessarily romance. Direct eye contact with minimal expression → confidence or coolness, not aloofness. A tense jaw or crossed arms → guarded/defensive energy, not automatically anger. Read posture and expression as carefully as you would read a scene's setting.
- Memes, screenshots → read the emotional energy, not the content
- HUMOR & IRONY: If this would be posted with 😭💀💅 "send help" "not me" — that IS the energy. High energy, chaotic, NOT serene.
...
```

(Keep every other line of `BASE_SYSTEM_PROMPT` — including the rest of the JSON schema and the `NUMBER RULES` section below it — exactly as-is; this step only replaces the one `"A mirror selfie → read face + body language carefully"` line with the expanded guidance shown above, in place.)

- [ ] **Step 3: Add `presentationRead` to the JSON schema block**

In the same prompt, immediately after the `"photoConfidence": 0.0,` line (`app/api/analyze/route.ts:95`), add a new top-level field:

```ts
  "photoConfidence": 0.0,
  "presentationRead": "male | female | neutral | unclear — INTERNAL-ONLY signal, never shown to any user, estimating whether this photo's main subject presents as more masculine or feminine. Its only purpose is to softly deprioritize (never exclude) songs whose lyrics are clearly written from/addressed to the opposite gender. Use 'neutral' for group photos, photos with no visible people, or a genuinely androgynous/ambiguous presentation. Use 'unclear' only if you cannot make any reasonable read at all. When uncertain, default toward 'neutral' or 'unclear' — a wrong confident guess is worse than admitting uncertainty, since this signal is low-stakes (soft penalty, not a hard filter) but still real.",
  "photoVector": {
```

- [ ] **Step 4: Extract and coerce `presentationRead` in the response handler**

Near the other `result.*` extractions (`app/api/analyze/route.ts:328-341`), add:

```ts
    const presentationRead = coercePovSignal(result.presentationRead);
```

Then include it in the returned JSON (`app/api/analyze/route.ts:369-377`), overwriting the raw/unvalidated value the same way `photoConfidence` already shadows `result.photoConfidence`:

```ts
    return NextResponse.json({
      ...result,
      photoVectorArray,
      photoConfidence,
      matchSignals,
      musicBrief,
      whyThisPhotoNeedsMusic,
      photoBriefEmbedding,
      presentationRead,
    });
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "Add portrait-reading guidance and presentationRead signal to vision prompt"
```

---

### Task 3: POV mismatch penalty in the recommendation scorer

**Files:**
- Modify: `lib/recommend.ts`
- Test: `tests/recommend.test.mjs`

**Interfaces:**
- Produces: `export type PovSignal` (local to this file — see rationale in the code comment below), `export function computePovPenalty(presentationRead: PovSignal, lyricalAddress: string, confFactor: number): number`, `RecommendRequest.presentationRead: PovSignal`, `ScoreComponents.povPenalty: number`.
- Consumes (added to `CatalogSong` by Task 6): `song.lyrical_address: string | null`, read here as a plain string — never re-imports `PovSignal` from `lib/tagTaxonomy.ts` (see rationale below).

- [ ] **Step 1: Write the failing tests**

Append to `tests/recommend.test.mjs`:

```js
test("computePovPenalty applies the full penalty for a confident opposite-POV pair", () => {
  assert.equal(rec.computePovPenalty("male", "female", 1.0), -25);
  assert.equal(rec.computePovPenalty("female", "male", 1.0), -25);
});

test("computePovPenalty scales with confFactor", () => {
  assert.equal(rec.computePovPenalty("male", "female", 0.5), -12.5);
});

test("computePovPenalty is zero when either side is neutral or unclear", () => {
  assert.equal(rec.computePovPenalty("male", "neutral", 1.0), 0);
  assert.equal(rec.computePovPenalty("male", "unclear", 1.0), 0);
  assert.equal(rec.computePovPenalty("neutral", "female", 1.0), 0);
  assert.equal(rec.computePovPenalty("unclear", "unclear", 1.0), 0);
});

test("computePovPenalty is zero for matching POV", () => {
  assert.equal(rec.computePovPenalty("male", "male", 1.0), 0);
  assert.equal(rec.computePovPenalty("female", "female", 1.0), 0);
});

test("buildRecommendations applies povPenalty to finalScore for an opposite-POV song", () => {
  const req = makeRequest({ presentationRead: "male" });
  const song = makeSong({ lyrical_address: "female" });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results.length, 1);
  assert.ok(results[0].scoreComponents.povPenalty < 0, "povPenalty should be negative");
  assert.equal(results[0].scoreComponents.povPenalty, -25 * (0.5 + req.photoConfidence * 0.5));
});

test("buildRecommendations applies no povPenalty when song lyrical_address is null", () => {
  const req = makeRequest({ presentationRead: "male" });
  const song = makeSong({ lyrical_address: null });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.povPenalty, 0);
});
```

Also update `makeRequest`'s defaults (`tests/recommend.test.mjs:67-90`) to include the new required field, and `makeSong`'s defaults to include `lyrical_address`:

```js
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
    brief_embedding: null,
    lyrical_address: null,
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
    favoriteSongIds: [],
    storyIntentTags: [],
    hardAntiTags: [],
    softAntiTags: [],
    photoConfidence: 1.0,
    sceneContextTags: [],
    aestheticTags: [],
    moodTags: [],
    energyBounds: { min: 0, max: 1 },
    photoBriefEmbedding: null,
    presentationRead: "unclear",
    ...overrides,
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/recommend.test.mjs`
Expected: FAIL — `rec.computePovPenalty is not a function`, and `results[0].scoreComponents.povPenalty` is `undefined`.

- [ ] **Step 3: Add the type, the pure penalty function, and wire it into scoring**

At the top of `lib/recommend.ts`, after the existing imports:

```ts
import { cosine } from "./vectorMath";
import type { CatalogSong } from "./db/songs";

// Duplicated from lib/tagTaxonomy.ts's PovSignal on purpose: this file is
// loaded standalone by tests/recommend.test.mjs's custom TS-in-vm harness,
// which stubs out every cross-file import except vectorMath/db-songs — a
// real runtime import of tagTaxonomy here would silently resolve to {}
// under that harness. The type is a trivial 4-value union; duplication is
// cheaper than fighting the test infra.
export type PovSignal = "male" | "female" | "neutral" | "unclear";
```

Add `presentationRead: PovSignal;` to `RecommendRequest` (after `photoBriefEmbedding`):

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
  favoriteSongIds: string[];       // taste.favoriteStorySongs — user's own picked/imported songs
  storyIntentTags: string[];       // from photo matchSignals + (future) requested vibe
  hardAntiTags: string[];          // requested vibe + onboarding avoid-list — always excludes, never confidence-gated
  softAntiTags: string[];          // from photo matchSignals — confidence-scaled penalty, not a hard block
  photoConfidence: number;         // gates contextFit/vibeAestheticFit/storyFit contributions
  sceneContextTags: string[];      // from photo matchSignals.scene_context_tags
  aestheticTags: string[];         // from photo matchSignals.modern_aesthetic_tags
  moodTags: string[];              // from photo matchSignals.mood_tags
  energyBounds: { min: number; max: number };
  photoBriefEmbedding: number[] | null;  // null when ENABLE_BRIEF_POOL is off or the photo has no brief text
  presentationRead: PovSignal;     // photo-side gender/POV read — "unclear" default, never blocks a request
}
```

Add `povPenalty: number;` to `ScoreComponents` (after `softAntiTagPenalty`):

```ts
export interface ScoreComponents {
  photoFit: number;
  tasteFit: number;
  storyFit: number;
  contextFit: number;
  vibeAestheticFit: number;
  noveltyFit: number;
  qualityBonus: number;
  favoriteSongBonus: number;
  briefFit: number;
  briefSimilarity: number;
  languagePenalty: number;
  freshnessPenalty: number;
  mainstreamPenalty: number;
  needsReviewPenalty: number;
  softAntiTagPenalty: number;
  povPenalty: number;
  finalScore: number;
}
```

Add the pure penalty function near the other scoring helpers (after `discoveryScore`, before `feedbackKey`):

```ts
// Heavy but not exclusionary: a hard filter here risks zero/near-zero results
// for thin catalog segments (e.g. a niche-language, high-energy pocket of the
// catalog that happens to be entirely one lyrical POV). -25 sits above
// softAntiTagPenalty's per-match -15 and freshnessPenalty's -20, near the
// steepest mainstreamPenalty tier, so a mismatched song loses its slot in
// virtually every real case without the request ever coming up empty.
// confFactor-gated like storyFit/contextFit/vibeAestheticFit since
// presentationRead is just as much a GPT-confidence-sensitive read as those.
export function computePovPenalty(
  presentationRead: PovSignal,
  lyricalAddress: string,
  confFactor: number
): number {
  const opposite =
    (presentationRead === "male" && lyricalAddress === "female") ||
    (presentationRead === "female" && lyricalAddress === "male");
  return opposite ? -25 * confFactor : 0;
}
```

Wire it into the scoring loop — in the "Penalties" section (`lib/recommend.ts:437-474`), after `softAntiTagPenalty`:

```ts
    const softAntiTagPenalty = -Math.min(2, softAntiTagMatches) * 15 * confFactor;
    const povPenalty = computePovPenalty(req.presentationRead, song.lyrical_address ?? "unclear", confFactor);
```

Add it to both sum expressions:

```ts
    const raw =
      photoFit + tasteFit + storyFit + contextFit + vibeAestheticFit + briefFit + noveltyFit + qualityBonus + favoriteSongBonus;
    const finalScore = Math.max(
      0,
      Math.min(
        100,
        raw + languagePenalty + freshnessPenalty + mainstreamPenalty + needsReviewPenalty + softAntiTagPenalty + povPenalty
      )
    );
```

And to the `components` object:

```ts
    const components: ScoreComponents = {
      photoFit: Math.round(photoFit * 10) / 10,
      tasteFit: Math.round(tasteFit * 10) / 10,
      storyFit: Math.round(storyFit * 10) / 10,
      contextFit: Math.round(contextFit * 10) / 10,
      vibeAestheticFit: Math.round(vibeAestheticFit * 10) / 10,
      noveltyFit: Math.round(noveltyFit * 10) / 10,
      qualityBonus: Math.round(qualityBonus * 10) / 10,
      favoriteSongBonus: Math.round(favoriteSongBonus * 10) / 10,
      briefFit: Math.round(briefFit * 10) / 10,
      briefSimilarity: Math.round(briefSimilarity * 1000) / 1000,
      languagePenalty,
      freshnessPenalty,
      mainstreamPenalty,
      needsReviewPenalty,
      softAntiTagPenalty: Math.round(softAntiTagPenalty * 10) / 10,
      povPenalty: Math.round(povPenalty * 10) / 10,
      finalScore: Math.round(finalScore * 10) / 10,
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all of `tests/recommend.test.mjs` including the new tests, and the full suite stays green (this file's exports don't affect other test files).

- [ ] **Step 5: Commit**

```bash
git add lib/recommend.ts tests/recommend.test.mjs
git commit -m "Add POV mismatch penalty to the recommendation scorer"
```

---

### Task 4: Database migration — `lyrical_address` column and RPC updates

**Files:**
- Create: `supabase/pov-signal-migration.sql`

**Interfaces:**
- Produces: `public.songs.lyrical_address` (nullable `text`, no default — `NULL` means "not yet classified," distinct from an explicit `'unclear'` GPT read; the backfill script in Task 8 relies on this distinction). Six read RPCs (`match_songs`, `match_songs_by_tags`, `match_songs_by_taste`, `match_songs_by_language`, `match_songs_by_brief`, `get_songs_by_ids`) and two write RPCs (`create_song`, `update_song`) all gain a `lyrical_address` column/parameter. Consumed by Task 5.

This migration is **not run by any script** — it must be applied manually against the `SUPABASE_CATALOG_URL` project via the Supabase SQL editor, exactly like every other file in `supabase/`. It's idempotent (safe to re-run).

- [ ] **Step 1: Write the migration file**

```sql
-- POV signal: adds a nullable lyrical_address column to songs (NULL = not
-- yet classified, distinct from an explicit 'unclear' GPT read — the
-- backfill script queries WHERE lyrical_address IS NULL) and threads it
-- through every RPC that returns song rows to application scoring code,
-- plus the two write RPCs. No CHECK constraint: validation happens
-- application-side via lib/tagTaxonomy.ts's coercePovSignal, matching this
-- codebase's existing convention for other enum-like text columns
-- (confidence_level, tag_source) which also have no DB-level CHECK.
--
-- Apply this against the SUPABASE_CATALOG_URL project (not the main auth
-- project) via the Supabase SQL editor. Idempotent — safe to re-run.

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrical_address text;

-- 1. match_songs (vector-nearest pool)
DROP FUNCTION IF EXISTS public.match_songs(vector, integer);

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
  tag_source            text,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float,
  lyrical_address        text,
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
    s.final_confidence, s.needs_review, s.tag_source, s.itunes_preview_url,
    s.artwork_url, s.apple_music_url, s.youtube_id, s.quality_score,
    s.lyrical_address,
    (s.emotional_vector <=> query_vector)::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
  ORDER BY s.emotional_vector <=> query_vector
  LIMIT match_count;
END;
$$;

-- 2. match_songs_by_tags (tag pool)
DROP FUNCTION IF EXISTS public.match_songs_by_tags(text[], text[], text[], text[], int);

CREATE OR REPLACE FUNCTION public.match_songs_by_tags(
  p_context_tags   text[] DEFAULT '{}',
  p_intent_tags    text[] DEFAULT '{}',
  p_aesthetic_tags text[] DEFAULT '{}',
  p_mood_tags      text[] DEFAULT '{}',
  p_match_count    int DEFAULT 25
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
  lyrical_address        text,
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
    s.apple_music_url, s.youtube_id, s.quality_score, s.lyrical_address,
    NULL::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
    AND (
      (cardinality(p_context_tags)   > 0 AND s.story_context_tags    && p_context_tags)
      OR (cardinality(p_intent_tags)    > 0 AND s.story_intent_tags    && p_intent_tags)
      OR (cardinality(p_aesthetic_tags) > 0 AND s.modern_aesthetic_tags && p_aesthetic_tags)
      OR (cardinality(p_mood_tags)      > 0 AND s.mood_tags            && p_mood_tags)
    )
  ORDER BY
    (
      cardinality(ARRAY(SELECT unnest(s.story_context_tags) INTERSECT SELECT unnest(p_context_tags)))
      + cardinality(ARRAY(SELECT unnest(s.story_intent_tags) INTERSECT SELECT unnest(p_intent_tags)))
      + cardinality(ARRAY(SELECT unnest(s.modern_aesthetic_tags) INTERSECT SELECT unnest(p_aesthetic_tags)))
      + cardinality(ARRAY(SELECT unnest(s.mood_tags) INTERSECT SELECT unnest(p_mood_tags)))
    ) DESC,
    s.quality_score DESC,
    s.id
  LIMIT p_match_count;
END;
$$;

-- 3. match_songs_by_taste (artist/genre pool)
DROP FUNCTION IF EXISTS public.match_songs_by_taste(text[], text[], int);

CREATE OR REPLACE FUNCTION public.match_songs_by_taste(
  p_artist_patterns  text[] DEFAULT '{}',
  p_positive_genres  text[] DEFAULT '{}',
  p_match_count      int DEFAULT 20
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
  lyrical_address        text,
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
    s.apple_music_url, s.youtube_id, s.quality_score, s.lyrical_address,
    NULL::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
    AND (
      (cardinality(p_artist_patterns) > 0 AND s.artist ILIKE ANY (p_artist_patterns))
      OR (cardinality(p_positive_genres) > 0 AND s.genre_tags && p_positive_genres)
    )
  ORDER BY
    (
      (CASE WHEN cardinality(p_artist_patterns) > 0 AND s.artist ILIKE ANY (p_artist_patterns) THEN 2 ELSE 0 END)
      + cardinality(ARRAY(SELECT unnest(s.genre_tags) INTERSECT SELECT unnest(p_positive_genres)))
    ) DESC,
    s.quality_score DESC,
    s.id
  LIMIT p_match_count;
END;
$$;

-- 4. match_songs_by_language (language pool)
DROP FUNCTION IF EXISTS public.match_songs_by_language(text[], vector, integer);

CREATE OR REPLACE FUNCTION public.match_songs_by_language(
  p_languages   text[],
  query_vector  vector(10),
  p_match_count int DEFAULT 25
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
  tag_source            text,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float,
  lyrical_address        text,
  distance              float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS MATERIALIZED (
    SELECT s.*
    FROM public.songs s
    WHERE s.emotional_vector IS NOT NULL
      AND s.language ILIKE ANY (p_languages)
  )
  SELECT
    f.id, f.title, f.artist, f.language, f.energy, f.popularity_tier,
    f.emotional_vector, f.genre_tags, f.aesthetic_tags, f.mood_tags,
    f.story_intent_tags, f.modern_aesthetic_tags, f.story_context_tags,
    f.final_confidence, f.needs_review, f.tag_source, f.itunes_preview_url,
    f.artwork_url, f.apple_music_url, f.youtube_id, f.quality_score,
    f.lyrical_address,
    (f.emotional_vector <=> query_vector)::float AS distance
  FROM filtered f
  ORDER BY f.emotional_vector <=> query_vector
  LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_songs_by_language(text[], vector, integer) TO service_role;

-- 5. match_songs_by_brief (semantic brief pool)
DROP FUNCTION IF EXISTS public.match_songs_by_brief(vector(1536), int);

CREATE OR REPLACE FUNCTION public.match_songs_by_brief(
  p_brief_vector vector(1536),
  p_match_count  int DEFAULT 25
)
RETURNS TABLE (
  id uuid, title text, artist text, language text, energy float,
  popularity_tier int, emotional_vector vector(10), genre_tags text[],
  aesthetic_tags text[], mood_tags text[], story_intent_tags text[],
  modern_aesthetic_tags text[], story_context_tags text[],
  final_confidence float, needs_review boolean, itunes_preview_url text,
  artwork_url text, apple_music_url text, youtube_id text,
  quality_score float, lyrical_address text, brief_embedding vector(1536), distance float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score, s.lyrical_address,
    s.brief_embedding,
    (s.brief_embedding <=> p_brief_vector) AS distance
  FROM public.songs s
  WHERE s.brief_embedding IS NOT NULL
  ORDER BY s.brief_embedding <=> p_brief_vector
  LIMIT p_match_count;
END;
$$;

-- 6. get_songs_by_ids (favorites/pinned pool)
DROP FUNCTION IF EXISTS public.get_songs_by_ids(uuid[]);

CREATE OR REPLACE FUNCTION public.get_songs_by_ids(
  p_song_ids uuid[]
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
  tag_source            text,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float,
  lyrical_address        text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.tag_source, s.itunes_preview_url,
    s.artwork_url, s.apple_music_url, s.youtube_id, s.quality_score,
    s.lyrical_address
  FROM public.songs s
  WHERE s.id = ANY(p_song_ids);
END;
$$;

-- 7. create_song (write path — new songs from autoTagSong)
DROP FUNCTION IF EXISTS public.create_song(
  text, text, text, int, int, text, int, text, float8, text[], text[], text[],
  text[], text[], text, text, text, text, text[], text[], text, text, float8,
  float8, float8, boolean, text[], text, text, text
);

CREATE OR REPLACE FUNCTION public.create_song(
  p_title                    text,
  p_artist                   text,
  p_album                    text,
  p_year                     int,
  p_duration_seconds         int,
  p_language                 text,
  p_popularity_tier          int,
  p_emotional_vector         text,
  p_energy                   float8,
  p_genre_tags               text[],
  p_aesthetic_tags           text[],
  p_mood_tags                text[],
  p_story_intent_tags        text[],
  p_modern_aesthetic_tags    text[],
  p_itunes_preview_url       text,
  p_artwork_url              text,
  p_apple_music_url          text,
  p_youtube_id               text,
  p_story_context_tags       text[]  DEFAULT '{}',
  p_discarded_tags           text[]  DEFAULT '{}',
  p_confidence_level         text    DEFAULT NULL,
  p_confidence_reason        text    DEFAULT NULL,
  p_gpt_confidence           float8  DEFAULT NULL,
  p_source_confidence        float8  DEFAULT NULL,
  p_final_confidence         float8  DEFAULT NULL,
  p_needs_review             boolean DEFAULT false,
  p_evidence_sources         text[]  DEFAULT '{}',
  p_tagging_version          text    DEFAULT 'v1',
  p_vibe_summary             text    DEFAULT NULL,
  p_music_supervisor_summary text    DEFAULT NULL,
  p_brief_embedding          text    DEFAULT NULL,
  p_lyrical_address          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.songs (
    title, artist, album, year, duration_seconds, language, popularity_tier,
    emotional_vector, energy, genre_tags, aesthetic_tags, mood_tags,
    story_intent_tags, modern_aesthetic_tags, itunes_preview_url, artwork_url,
    apple_music_url, youtube_id,
    story_context_tags, discarded_tags, confidence_level, confidence_reason,
    gpt_confidence, source_confidence, final_confidence, needs_review,
    evidence_sources, tagging_version, vibe_summary,
    music_supervisor_summary, brief_embedding, lyrical_address, updated_at
  ) VALUES (
    p_title, p_artist, p_album, p_year, p_duration_seconds, p_language, p_popularity_tier,
    p_emotional_vector::vector(10), p_energy,
    p_genre_tags, p_aesthetic_tags, p_mood_tags,
    p_story_intent_tags, p_modern_aesthetic_tags, p_itunes_preview_url, p_artwork_url,
    p_apple_music_url, p_youtube_id,
    p_story_context_tags, p_discarded_tags, p_confidence_level, p_confidence_reason,
    p_gpt_confidence, p_source_confidence, p_final_confidence, p_needs_review,
    p_evidence_sources, p_tagging_version, p_vibe_summary,
    p_music_supervisor_summary, p_brief_embedding::vector(1536), p_lyrical_address, now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 8. update_song (write path — admin edits + backfill script)
DROP FUNCTION IF EXISTS public.update_song(uuid, text, int, text[], text[], text[], text[], text[], text[], text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.update_song(
  p_id                       uuid,
  p_language                 text    DEFAULT NULL,
  p_popularity_tier          int     DEFAULT NULL,
  p_genre_tags               text[]  DEFAULT NULL,
  p_aesthetic_tags           text[]  DEFAULT NULL,
  p_mood_tags                text[]  DEFAULT NULL,
  p_story_intent_tags        text[]  DEFAULT NULL,
  p_modern_aesthetic_tags    text[]  DEFAULT NULL,
  p_story_context_tags       text[]  DEFAULT NULL,
  p_vibe_summary             text    DEFAULT NULL,
  p_approve                  boolean DEFAULT false,
  p_music_supervisor_summary text    DEFAULT NULL,
  p_brief_embedding          text    DEFAULT NULL,
  p_lyrical_address          text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs SET
    language                 = COALESCE(p_language,                 language),
    popularity_tier          = COALESCE(p_popularity_tier,          popularity_tier),
    genre_tags               = COALESCE(p_genre_tags,               genre_tags),
    aesthetic_tags           = COALESCE(p_aesthetic_tags,           aesthetic_tags),
    mood_tags                = COALESCE(p_mood_tags,                mood_tags),
    story_intent_tags        = COALESCE(p_story_intent_tags,        story_intent_tags),
    modern_aesthetic_tags    = COALESCE(p_modern_aesthetic_tags,    modern_aesthetic_tags),
    story_context_tags       = COALESCE(p_story_context_tags,       story_context_tags),
    vibe_summary             = COALESCE(p_vibe_summary,             vibe_summary),
    music_supervisor_summary = COALESCE(p_music_supervisor_summary, music_supervisor_summary),
    brief_embedding          = COALESCE(p_brief_embedding::vector(1536), brief_embedding),
    lyrical_address           = COALESCE(p_lyrical_address,          lyrical_address),
    needs_review             = CASE WHEN p_approve THEN false ELSE needs_review END,
    tag_source               = CASE WHEN p_approve THEN 'auto_plus_manual' ELSE tag_source END,
    manual_reviewed_at       = CASE WHEN p_approve THEN now() ELSE manual_reviewed_at END,
    updated_at               = now()
  WHERE id = p_id;
END;
$$;
```

- [ ] **Step 2: Apply the migration manually**

This step is a manual action outside the codebase — tell the user the file is ready and ask them to run it via the Supabase SQL editor against the `SUPABASE_CATALOG_URL` project before Task 5's tests that hit real infra (none of Task 5's tests do — they mock the RPC client — but Tasks 8/9's manual smoke test does need this applied). Do not attempt to run it yourself via any script.

- [ ] **Step 3: Commit**

```bash
git add supabase/pov-signal-migration.sql
git commit -m "Add lyrical_address migration for songs table and catalog RPCs"
```

---

### Task 5: Auto-tagging — `lyrical_address` at tag time + backfill-only classifier

**Files:**
- Modify: `lib/autoTag.ts`
- Test: `tests/autoTag.test.mjs`

**Interfaces:**
- Consumes: `coercePovSignal`, `PovSignal` from `lib/tagTaxonomy.ts` (Task 1).
- Produces: `AutoTagResult.lyrical_address: PovSignal` (every newly tagged song gets this automatically going forward), `export async function classifyLyricalAddress(title: string, artist: string): Promise<PovSignal>` — a narrow, backfill-only GPT call in the same style as the existing `generateMusicSupervisorBrief`, consumed by Task 8's backfill script. Also consumed by Task 6 (`lib/db/songs.ts`'s `insertSong` reads `data.lyrical_address` off `AutoTagResult`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/autoTag.test.mjs`:

```js
test("buildGptTagPrompt asks for lyrical_address", () => {
  const { buildGptTagPrompt } = autoTag;
  const prompt = buildGptTagPrompt("Song", "Artist", []);
  assert.ok(prompt.includes("lyrical_address"));
});

test("parseGptTagResponse extracts and coerces lyrical_address", () => {
  const { parseGptTagResponse } = autoTag;
  const raw = JSON.stringify({
    language: "English",
    emotional_vector: {},
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: [],
    story_intent_tags: [],
    modern_aesthetic_tags: [],
    story_context_tags: [],
    vibe_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
    popularity_tier: 3,
    lyrical_address: "female",
  });
  const result = parseGptTagResponse(raw);
  assert.equal(result.lyrical_address, "female");
});

test("parseGptTagResponse coerces an invalid lyrical_address to unclear", () => {
  const { parseGptTagResponse } = autoTag;
  const raw = JSON.stringify({
    language: "English",
    emotional_vector: {},
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: [],
    story_intent_tags: [],
    modern_aesthetic_tags: [],
    story_context_tags: [],
    vibe_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
    popularity_tier: 3,
    lyrical_address: "not-a-real-value",
  });
  const result = parseGptTagResponse(raw);
  assert.equal(result.lyrical_address, "unclear");
});

test("classifyLyricalAddress returns the coerced GPT classification", async () => {
  stubState.openaiContent = JSON.stringify({ lyrical_address: "male" });
  const { classifyLyricalAddress } = autoTag;
  const result = await classifyLyricalAddress("Song", "Artist");
  assert.equal(result, "male");
});

test("classifyLyricalAddress defaults to unclear on malformed GPT output", async () => {
  stubState.openaiContent = "not json at all";
  const { classifyLyricalAddress } = autoTag;
  const result = await classifyLyricalAddress("Song", "Artist");
  assert.equal(result, "unclear");
});
```

(If `tests/autoTag.test.mjs` doesn't already call `resetHarness()`/reset `stubState.openaiContent` between tests, add `stubState.openaiContent = "";` at the top of each new test that doesn't set it, to avoid leaking state from a prior test — check the existing file for a `beforeEach`/reset pattern first and follow it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/autoTag.test.mjs`
Expected: FAIL — `buildGptTagPrompt` output doesn't include `"lyrical_address"`, `parseGptTagResponse(...).lyrical_address` is `undefined`, `autoTag.classifyLyricalAddress is not a function`.

- [ ] **Step 3: Add `lyrical_address` to the main tagging schema**

In `lib/autoTag.ts`, extend the `tagTaxonomy` import:

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
  coercePovSignal,
  type PovSignal,
} from "./tagTaxonomy";
```

Add `lyrical_address: PovSignal;` to `AutoTagResult` (after `story_context_tags: string[];`):

```ts
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
  lyrical_address: PovSignal;
  discarded_tags: string[];
  ...
```

(keep every other field as-is)

Add the field to the GPT prompt's JSON schema in `buildGptTagPrompt`, right after `"story_context_tags"`:

```ts
  "story_context_tags": ["2-5 tags, ONLY from this list: ${STORY_CONTEXT_TAGS.join(", ")}"],
  "lyrical_address": "male | female | neutral | unclear — who this song's lyrics are written from/addressed to. Use 'neutral' for lyrics with no clear gendered narrator/addressee (instrumental, abstract, or genuinely either-way). Use 'unclear' only if you don't know this song's lyrics well enough to judge at all. This is used only to avoid pairing a song with a photo of the opposite gender it clearly addresses — be honest, don't default to 'neutral' just to play it safe if the lyrics ARE clearly gendered.",
  "vibe_summary": "1-2 short sentences in natural language describing this song's feeling/story",
```

Add `lyrical_address: PovSignal;` to `ParsedTagResponse` (after `story_context_tags: string[];`), extract it in `parseGptTagResponse` (after the `storyContextSplit` block, alongside the other parsed fields), and include it in the returned object:

```ts
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
  lyrical_address: PovSignal;
  discarded_tags: string[];
  vibe_summary: string;
  music_supervisor_summary: string;
  confidence_level: ConfidenceLevel;
  confidence_reason: string;
}
```

In `parseGptTagResponse`, add to the `fallback` object:

```ts
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
    lyrical_address: "unclear",
    discarded_tags: [],
    vibe_summary: "",
    music_supervisor_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
  };
```

And in the successful-parse return object, add `lyrical_address: coercePovSignal(parsed.lyrical_address),` right after `story_context_tags: storyContextSplit.accepted,`.

Finally, add `lyrical_address: gptData.lyrical_address,` to `autoTagSong`'s return object (after `story_context_tags: gptData.story_context_tags,`).

- [ ] **Step 4: Add the backfill-only classifier function**

Add this near `generateMusicSupervisorBrief`, following the same "narrow, backfill-only GPT call" pattern:

```ts
export function buildLyricalAddressPrompt(title: string, artist: string): string {
  return `For the song "${title}" by ${artist}, classify who its lyrics are written from/addressed to.

Return ONLY valid JSON (no markdown): { "lyrical_address": "male | female | neutral | unclear" }

Use "neutral" for lyrics with no clear gendered narrator/addressee. Use "unclear" only if you don't know this song's lyrics well enough to judge. Be honest — don't default to "neutral" just to play it safe if the lyrics ARE clearly gendered.`;
}

/** Narrow, backfill-only GPT call for songs tagged before lyrical_address existed — see scripts/backfill-lyrical-address.mjs. */
export async function classifyLyricalAddress(title: string, artist: string): Promise<PovSignal> {
  const prompt = buildLyricalAddressPrompt(title, artist);
  let raw = "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 60,
      temperature: 0,
    });
    raw = res.choices[0].message.content ?? "";
  } catch (err) {
    console.error("[classifyLyricalAddress] GPT failed:", err);
  }

  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  try {
    if (firstBrace === -1 || lastBrace <= firstBrace) return "unclear";
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    return coercePovSignal(parsed.lyrical_address);
  } catch {
    return "unclear";
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/autoTag.test.mjs`
Expected: PASS.

- [ ] **Step 6: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit -p .`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add lib/autoTag.ts tests/autoTag.test.mjs
git commit -m "Classify lyrical_address at tag time; add backfill-only classifier"
```

---

### Task 6: Catalog DB layer — `CatalogSong`/`SongPatch` + `insertSong`/`updateSong`

**Files:**
- Modify: `lib/db/songs.ts`
- Test: `tests/songs.test.mjs`

**Interfaces:**
- Consumes: `lyrical_address` RPC columns/params added by Task 4's migration, `AutoTagResult.lyrical_address` from Task 5.
- Produces: `CatalogSong.lyrical_address: string | null`, `SongPatch.lyrical_address?: string`, both `insertSong`/`updateSong` forward the field as `p_lyrical_address`. Consumed by Task 3 (already wired against `CatalogSong`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/songs.test.mjs`:

```js
test("updateSong forwards lyrical_address to update_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { lyrical_address: "male" });
  assert.equal(captured.name, "update_song");
  assert.equal(captured.args.p_lyrical_address, "male");
});

test("updateSong passes null for lyrical_address when not provided", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { language: "English" });
  assert.equal(captured.args.p_lyrical_address, null);
});

test("insertSong forwards lyrical_address to create_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: "new-id", error: null }; };
  await songsLib.insertSong({
    title: "Song",
    artist: "Artist",
    album: null,
    year: null,
    duration_seconds: null,
    language: "English",
    popularity_tier: 3,
    emotional_vector: { dreamy: 0, nostalgia: 0, energy: 0, cinematic: 0, darkness: 0, confidence: 0, intimacy: 0, danceability: 0, electronic: 0, acoustic: 0 },
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: [],
    story_intent_tags: [],
    modern_aesthetic_tags: [],
    story_context_tags: [],
    discarded_tags: [],
    vibe_summary: "",
    music_supervisor_summary: "",
    brief_embedding: [],
    confidence_level: "uncertain",
    confidence_reason: "",
    gpt_confidence: 0.25,
    source_confidence: 0,
    final_confidence: 0,
    needs_review: true,
    evidence_sources: [],
    tagging_version: "v1",
    itunes_preview_url: null,
    artwork_url: null,
    apple_music_url: null,
    youtube_id: null,
    energy: 0.5,
    lyrical_address: "neutral",
  });
  assert.equal(captured.name, "create_song");
  assert.equal(captured.args.p_lyrical_address, "neutral");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/songs.test.mjs`
Expected: FAIL — `captured.args.p_lyrical_address` is `undefined`, and `insertSong` throws a TS-shape error under the `vectorToArray` stub (harmless — real failure is the missing field).

- [ ] **Step 3: Add the field to `CatalogSong`, `SongPatch`, and the RPC calls**

In `lib/db/songs.ts`, add to `CatalogSong` (after `tag_source?: string;`):

```ts
  tag_source?: string;
  lyrical_address?: string | null;
```

Add to `SongPatch` (after `story_context_tags?: string[];`):

```ts
  story_context_tags?: string[];
  lyrical_address?: string;
```

In `insertSong`, add the param to the `create_song` RPC call (after `p_brief_embedding`):

```ts
    p_brief_embedding:          briefEmbeddingString,
    p_lyrical_address:          data.lyrical_address ?? null,
  });
```

In `updateSong`, add the param to the `update_song` RPC call (after `p_brief_embedding`):

```ts
    p_brief_embedding:          briefEmbeddingString,
    p_lyrical_address:          patch.lyrical_address ?? null,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/songs.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit -p .`
Expected: all green — `AutoTagResult.lyrical_address` already exists from Task 5, so `insertSong`'s reference to `data.lyrical_address` typechecks cleanly.

- [ ] **Step 6: Commit**

```bash
git add lib/db/songs.ts tests/songs.test.mjs
git commit -m "Thread lyrical_address through CatalogSong/SongPatch and the song RPCs"
```

---

### Task 7: Wire `presentationRead` end-to-end through `/api/recommend` and the client

**Files:**
- Modify: `app/api/recommend/route.ts:1-20,42-60,188-207`
- Modify: `app/app/page.tsx:191-209`

**Interfaces:**
- Consumes: `coercePovSignal` from `lib/tagTaxonomy.ts` (Task 1), `RecommendRequest.presentationRead` (Task 3), `vibeData.presentationRead` from `/api/analyze`'s response (Task 2).

- [ ] **Step 1: Read and coerce `presentationRead` in `/api/recommend`**

In `app/api/recommend/route.ts`, add to the imports:

```ts
import { coercePovSignal } from "../../../lib/tagTaxonomy";
```

In the request-body parsing block (after `const photoBriefEmbeddingRaw` block, before the `photoVectorArray` validation), add:

```ts
    const presentationRead = coercePovSignal(body.presentationRead);
```

Add `presentationRead,` to `baseRecommendReq` (`app/api/recommend/route.ts:188-207`), after `photoBriefEmbedding,`:

```ts
    const baseRecommendReq = {
      queryVector,
      languages: taste.languages,
      languageOpenness: taste.languageOpenness,
      discoveryStyle,
      blockedArtists: aggregate.avoidArtists,
      recentlyShownSongIds,
      genreScores: mergedGenreScores,
      likedArtists: mergedLikedArtists,
      favoriteSongIds: eligibleFavoriteSongIds,
      storyIntentTags,
      hardAntiTags: [...antiTags, ...taste.avoidedStoryTags],
      softAntiTags: gatedPhotoAntiTags,
      photoConfidence,
      sceneContextTags,
      aestheticTags,
      moodTags,
      energyBounds,
      photoBriefEmbedding,
      presentationRead,
    };
```

- [ ] **Step 2: Forward `presentationRead` from the client**

In `app/app/page.tsx`, add `presentationRead: vibeData.presentationRead,` to the `/api/recommend` request body (`app/app/page.tsx:194-208`), after `photoConfidence: vibeData.photoConfidence,`:

```ts
          body: JSON.stringify({
            photoVectorArray: vibeData.photoVectorArray,
            photoConfidence: vibeData.photoConfidence,
            presentationRead: vibeData.presentationRead,
            vibeBoosts: {},
            storyIntentTags: matchSignals.story_intent_tags ?? [],
            antiTags: [],
            photoAntiTags: matchSignals.anti_tags ?? [],
            sceneContextTags: matchSignals.scene_context_tags ?? [],
            aestheticTags: matchSignals.modern_aesthetic_tags ?? [],
            moodTags: matchSignals.mood_tags ?? [],
            musicDirection,
            energyBounds: matchSignals.energy_bounds,
            photoBriefEmbedding: vibeData.photoBriefEmbedding ?? null,
            clientSeenSongIds: getRecentlyShownSongIds(),
          }),
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: all green — no existing test in `tests/*` constructs a raw `/api/recommend` body literal that would need updating (the route reads `body.presentationRead` defensively with `coercePovSignal`, so a missing field just defaults to `"unclear"`, matching how every other optional body field already degrades).

- [ ] **Step 5: Commit**

```bash
git add app/api/recommend/route.ts app/app/page.tsx
git commit -m "Wire presentationRead from analyze through recommend end-to-end"
```

---

### Task 8: Backfill script + admin listing pagination

**Files:**
- Modify: `app/api/admin/songs/route.ts` (GET handler — add `limit`/`offset` query params)
- Create: `scripts/backfill-lyrical-address.mjs`

**Interfaces:**
- Consumes: `GET /api/admin/songs` (now paginated), `PATCH /api/admin/songs/:id` (already generic — accepts any `SongPatch` field, so it needs zero changes to support `{ lyrical_address }` once Task 6 lands).

- [ ] **Step 1: Add pagination to the admin listing endpoint**

In `app/api/admin/songs/route.ts`, change the `GET` handler to read optional `limit`/`offset` query params, defaulting to today's behavior:

```ts
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit")) || 200;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const songs = await listSongs(limit, offset);
    return NextResponse.json({ songs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors (`listSongs(limit = 200, offset = 0)` already accepts both params — this just stops hardcoding the call with none).

- [ ] **Step 3: Write the backfill script**

```js
/**
 * Backfills lyrical_address for every catalog song tagged before this field
 * existed (lyrical_address IS NULL — distinct from an explicit 'unclear' GPT
 * read, see supabase/pov-signal-migration.sql). Safe to re-run: only touches
 * songs where lyrical_address is still NULL.
 *
 * Requires supabase/pov-signal-migration.sql to already be applied.
 * Run against a live dev server:
 *   npm run dev                                    (terminal 1)
 *   node scripts/backfill-lyrical-address.mjs       (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "vibesong-admin-2026";
const PAGE_SIZE = 200;

async function fetchAllSongs() {
  const all = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${BASE_URL}/api/admin/songs?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!res.ok) throw new Error(`GET /api/admin/songs failed: ${res.status}`);
    const { songs } = await res.json();
    all.push(...songs);
    if (songs.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

async function classify(title, artist) {
  const res = await fetch(`${BASE_URL}/api/admin/songs/classify-lyrical-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ title, artist }),
  });
  if (!res.ok) throw new Error(`classify failed for "${title}" by ${artist}: ${res.status}`);
  const { lyrical_address } = await res.json();
  return lyrical_address;
}

async function patchSong(id, lyrical_address) {
  const res = await fetch(`${BASE_URL}/api/admin/songs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ lyrical_address }),
  });
  if (!res.ok) throw new Error(`PATCH failed for song ${id}: ${res.status}`);
}

async function main() {
  const songs = await fetchAllSongs();
  const pending = songs.filter((s) => s.lyrical_address === null || s.lyrical_address === undefined);
  console.log(`${songs.length} total songs, ${pending.length} need lyrical_address backfill.`);

  let done = 0;
  for (const song of pending) {
    try {
      const value = await classify(song.title, song.artist);
      await patchSong(song.id, value);
      done++;
      console.log(`[${done}/${pending.length}] "${song.title}" by ${song.artist} -> ${value}`);
    } catch (err) {
      console.error(`Skipping "${song.title}" by ${song.artist}:`, err.message);
    }
  }
  console.log(`Backfill complete: ${done}/${pending.length} songs classified.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Add the classify-only admin route the script calls**

Create `app/api/admin/songs/classify-lyrical-address/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { classifyLyricalAddress } from "../../../../../lib/autoTag";

export const runtime = "nodejs";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { title, artist } = await req.json();
  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist required" }, { status: 400 });
  }
  const lyrical_address = await classifyLyricalAddress(title, artist);
  return NextResponse.json({ lyrical_address });
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/songs/route.ts app/api/admin/songs/classify-lyrical-address/route.ts scripts/backfill-lyrical-address.mjs
git commit -m "Add lyrical_address backfill script and its classify-only admin route"
```

---

### Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: every test file passes, including all new tests added in Tasks 1, 3, 5, 6 (taxonomy, scorer, autoTag, songs.ts).

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Confirm the Supabase migration has been applied**

Ask the user to confirm `supabase/pov-signal-migration.sql` (Task 4) has been run against the `SUPABASE_CATALOG_URL` project's SQL editor. This is a hard deploy prerequisite, not an optional follow-up: reads degrade safely (every new column read defaults via `?? "unclear"`/`?? null`), but writes do not. `lib/db/songs.ts`'s `insertSong`/`updateSong` unconditionally send a `p_lyrical_address` parameter to the `create_song`/`update_song` RPCs, and PostgREST will fail to resolve those calls against a database where the migration hasn't been applied (the RPC's parameter list won't match anything in the schema cache). Until the migration runs, every song-write path breaks — onboarding's playlist-import and story-songs flows, the catalog curator cron job, and admin song creation all fail outright, not just silently lose the POV signal.

- [ ] **Step 4: Manual smoke test with the dev server**

Run: `npm run dev`, then in the browser:
1. Upload a photo of a man → confirm in the terminal logs (`[recommend] debug log:`) that `povPenalty` appears as a field on scored songs, and that no song with an opposite-POV `lyrical_address` lands in the top few results (once the backfill has classified at least some of the catalog).
2. Upload a portrait/face photo → sanity-check the logged `whyThisPhotoNeedsMusic` and `matchSignals.story_intent_tags` reflect one of the new masculine/edge-coded or cultural tags where appropriate, not exclusively feminine-coded ones.
3. Confirm no request throws/500s — every new field degrades safely by design, this just confirms the wiring didn't break the happy path.

Report results back to the user before considering Phase 1 complete, per this project's rule of testing each piece before moving on.
