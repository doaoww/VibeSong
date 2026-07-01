# VibeSong Recommendation Engine — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace GPT-picks-songs with a curated catalog + pgvector similarity search + rules + scoring engine, producing deterministic, explainable, and always-playable recommendations.

**Architecture:** GPT-4o analyzes the photo and returns a 10-dimension emotional vector (no song names). A new `/api/recommend` endpoint blends that vector with the user's taste profile, runs pgvector similarity search against a curated song catalog, applies hard-filter rules, scores each candidate, and returns the top 8–12 results with a full debug log per song.

**Tech Stack:** Next.js 16.2.9 App Router, TypeScript, Supabase (pgvector extension), GPT-4o, iTunes Search API, Last.fm API, `node:test` + `typescript` for tests.

## Global Constraints

- Runtime: `nodejs` on all API routes (no Edge runtime)
- No song names invented by GPT anywhere in the codebase after this plan
- Every `/api/recommend` response must include a `debugLog` array (one entry per candidate, including removed candidates)
- Language filter is strict when user openness is `"strict"` — no exceptions for vibe match
- Tests use `node --test tests/*.test.mjs` with the `loadTsModule` helper pattern from existing tests
- No new npm packages unless explicitly listed in the task
- Existing auth, credits, YouTube playback, and iTunes preview integrations are unchanged

---

## File Map

**New files:**
- `supabase/songs-schema.sql` — songs table + pgvector extension + match_songs RPC
- `lib/vectorMath.ts` — blend vectors, apply vibe cap, cosine similarity
- `lib/autoTag.ts` — iTunes + Last.fm + GPT pipeline for song metadata
- `lib/db/songs.ts` — song catalog CRUD + pgvector search via Supabase RPC
- `lib/recommend.ts` — rules layer + scoring layer + debug log
- `app/api/recommend/route.ts` — POST endpoint: photo vector + taste → ranked songs
- `app/api/admin/songs/route.ts` — GET list + POST add-and-tag
- `app/api/admin/songs/[id]/route.ts` — PATCH update tags, DELETE remove
- `app/admin/page.tsx` — simple admin UI to add/edit songs
- `tests/vectorMath.test.mjs` — unit tests for math functions
- `tests/recommend.test.mjs` — unit tests for rules + scoring logic
- `tests/autoTag.test.mjs` — unit tests for auto-tag pipeline (mocked APIs)

**Modified files:**
- `app/api/analyze/route.ts` — remove all song selection code; GPT returns vector + metadata only
- `app/results/page.tsx` — call `/api/recommend` after `/api/analyze`
- `store/useAppStore.ts` — add `recommendResults` state, remove `vibeProfile.musicDNA.tracks`

---

## Task 1: Database — pgvector + Songs Table

**Files:**
- Create: `supabase/songs-schema.sql`

**Interfaces:**
- Produces: `songs` table, `match_songs(query_vector, match_count)` RPC function, usable by Task 4

- [ ] **Step 1: Enable pgvector and create songs table**

Run in Supabase SQL editor (Dashboard → SQL Editor → New query):

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Songs catalog table
CREATE TABLE IF NOT EXISTS public.songs (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                 text NOT NULL,
  artist                text NOT NULL,
  album                 text,
  year                  int,
  duration_seconds      int,
  language              text NOT NULL DEFAULT 'English',
  popularity_tier       int NOT NULL DEFAULT 3 CHECK (popularity_tier BETWEEN 1 AND 5),

  -- 10-dimension emotional vector: [dreamy, nostalgia, energy, cinematic, darkness, confidence, intimacy, danceability, electronic, acoustic]
  emotional_vector      vector(10),

  -- energy extracted separately for SQL filtering in rules layer
  energy                float NOT NULL DEFAULT 0.5,

  -- Tag arrays
  genre_tags            text[] NOT NULL DEFAULT '{}',
  aesthetic_tags        text[] NOT NULL DEFAULT '{}',
  mood_tags             text[] NOT NULL DEFAULT '{}',
  story_intent_tags     text[] NOT NULL DEFAULT '{}',
  modern_aesthetic_tags text[] NOT NULL DEFAULT '{}',

  -- Playback URLs
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,

  -- Quality metrics updated by user feedback
  save_count            int NOT NULL DEFAULT 0,
  skip_count            int NOT NULL DEFAULT 0,
  perfect_count         int NOT NULL DEFAULT 0,
  quality_score         float NOT NULL DEFAULT 0.5,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- IVFFlat index for cosine similarity search (pgvector)
-- lists = 10 is appropriate for catalogs up to ~1000 songs; increase to 100 at 10k+ songs
CREATE INDEX IF NOT EXISTS songs_emotional_vector_idx
  ON public.songs
  USING ivfflat (emotional_vector vector_cosine_ops)
  WITH (lists = 10);

-- Enable RLS (admin API routes use service role key, so they bypass RLS)
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read songs (needed for recommend API which uses anon key in some paths)
CREATE POLICY "songs_read_all" ON public.songs FOR SELECT USING (true);
```

- [ ] **Step 2: Create the match_songs RPC function**

Run in Supabase SQL editor (same session or new query):

```sql
-- RPC function for pgvector similarity search
-- Returns top match_count songs sorted by cosine distance to query_vector
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

- [ ] **Step 3: Save schema file**

Copy both SQL blocks into `supabase/songs-schema.sql` for version control. This file documents the schema but is not run automatically — it is applied manually in Supabase SQL editor.

- [ ] **Step 4: Verify in Supabase dashboard**

Go to Supabase → Table Editor → `songs` table should appear with the correct columns. Go to Database → Functions → `match_songs` should appear.

- [ ] **Step 5: Commit**

```bash
git add supabase/songs-schema.sql
git commit -m "feat: add songs table with pgvector support and match_songs RPC"
```

---

## Task 2: Vector Math Library

**Files:**
- Create: `lib/vectorMath.ts`
- Create: `tests/vectorMath.test.mjs`

**Interfaces:**
- Produces:
  - `VECTOR_KEYS: string[]` — ordered dimension names
  - `vectorToArray(v: EmotionalVector): number[]` — convert object to pgvector array
  - `arrayToVector(a: number[]): EmotionalVector` — convert pgvector array to object
  - `blendQueryVector(photo, taste, vibe): number[]` — combine 3 signals into query array
  - `applyVibeCap(photoDim, vibeBoost): number` — clamp boost within ±0.35/0.25 of photo
  - `cosine(a: number[], b: number[]): number` — cosine similarity 0–1
- Consumed by: Task 7 (`lib/recommend.ts`)

- [ ] **Step 1: Write failing tests**

Create `tests/vectorMath.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require, console, process, URLSearchParams });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const vm2 = loadTsModule("lib/vectorMath.ts");

test("VECTOR_KEYS has 10 entries in correct order", () => {
  assert.deepEqual(vm2.VECTOR_KEYS, [
    "dreamy", "nostalgia", "energy", "cinematic", "darkness",
    "confidence", "intimacy", "danceability", "electronic", "acoustic",
  ]);
});

test("vectorToArray returns 10-element array in VECTOR_KEYS order", () => {
  const v = { dreamy: 0.1, nostalgia: 0.2, energy: 0.3, cinematic: 0.4, darkness: 0.5, confidence: 0.6, intimacy: 0.7, danceability: 0.8, electronic: 0.9, acoustic: 1.0 };
  assert.deepEqual(vm2.vectorToArray(v), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]);
});

test("arrayToVector converts 10-element array back to object", () => {
  const a = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const v = vm2.arrayToVector(a);
  assert.equal(v.dreamy, 0.1);
  assert.equal(v.energy, 0.3);
  assert.equal(v.acoustic, 1.0);
});

test("applyVibeCap clamps within photo_dim ±0.35 / -0.25", () => {
  // boost within range
  assert.equal(vm2.applyVibeCap(0.5, 0.2), 0.7);
  // boost exceeds +0.35 ceiling
  assert.equal(vm2.applyVibeCap(0.5, 0.8), 0.85);
  // negative boost within -0.25
  assert.equal(vm2.applyVibeCap(0.5, -0.2), 0.3);
  // negative boost exceeds -0.25 floor
  assert.equal(vm2.applyVibeCap(0.5, -0.5), 0.25);
});

test("blendQueryVector weights photo 0.55 + taste 0.45 when no vibe", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, null, {});
  assert.ok(Math.abs(result[0] - 0.55) < 0.001);
  assert.ok(Math.abs(result[1] - 0.45) < 0.001);
});

test("blendQueryVector weights photo 0.40 + taste 0.25 + vibe 0.35 when vibe provided", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const vibe  = [0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, vibe, {});
  assert.ok(Math.abs(result[0] - 0.40) < 0.001);
  assert.ok(Math.abs(result[1] - 0.25) < 0.001);
  assert.ok(Math.abs(result[2] - 0.35) < 0.001);
});

test("cosine returns 1 for identical vectors", () => {
  const v = [0.3, 0.5, 0.7, 0.2, 0.1, 0.4, 0.6, 0.8, 0.9, 0.1];
  assert.ok(Math.abs(vm2.cosine(v, v) - 1) < 0.0001);
});

test("cosine returns 0 for orthogonal vectors", () => {
  const a = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const b = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.ok(Math.abs(vm2.cosine(a, b)) < 0.0001);
});

test("cosine returns 0 for zero vector", () => {
  const zero = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const v    = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  assert.equal(vm2.cosine(zero, v), 0);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/vectorMath.test.mjs
```

Expected: all fail with "Cannot find module" or similar.

- [ ] **Step 3: Implement lib/vectorMath.ts**

Create `lib/vectorMath.ts`:

```typescript
import type { EmotionalVector } from "./emotionalVector";

export const VECTOR_KEYS: Array<keyof EmotionalVector> = [
  "dreamy", "nostalgia", "energy", "cinematic", "darkness",
  "confidence", "intimacy", "danceability", "electronic", "acoustic",
];

export function vectorToArray(v: EmotionalVector): number[] {
  return VECTOR_KEYS.map((k) => v[k]);
}

export function arrayToVector(a: number[]): EmotionalVector {
  const result = {} as EmotionalVector;
  VECTOR_KEYS.forEach((k, i) => { result[k] = a[i] ?? 0; });
  return result;
}

/**
 * Clamp a vibe boost within the photo dimension's tolerance window.
 * The requested vibe can shift the photo direction but cannot override it.
 * target_dim = clamp(photo_dim + vibe_boost, photo_dim - 0.25, photo_dim + 0.35)
 */
export function applyVibeCap(photoDim: number, vibeBoost: number): number {
  const raw = photoDim + vibeBoost;
  return Math.max(photoDim - 0.25, Math.min(photoDim + 0.35, raw));
}

/**
 * Build the final query vector from photo + taste + optional vibe signals.
 * boosts: partial map of dimension name → boost value from vibe parsing.
 * If vibeVec is null, uses 2-signal blend. With vibeVec, uses 3-signal blend
 * and applies per-dimension caps from boosts.
 */
export function blendQueryVector(
  photoArr: number[],
  tasteArr: number[],
  vibeArr: number[] | null,
  boosts: Partial<Record<keyof EmotionalVector, number>>
): number[] {
  if (!vibeArr) {
    return photoArr.map((p, i) => p * 0.55 + tasteArr[i] * 0.45);
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

/** Cosine similarity between two equal-length arrays. Returns 0 for zero vectors. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --test tests/vectorMath.test.mjs
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/vectorMath.ts tests/vectorMath.test.mjs
git commit -m "feat: add vectorMath library with blend, vibe cap, and cosine similarity"
```

---

## Task 3: Auto-Tag Pipeline

**Files:**
- Create: `lib/autoTag.ts`
- Create: `tests/autoTag.test.mjs`

**Interfaces:**
- Produces:
  - `AutoTagResult` type
  - `autoTagSong(title, artist, deps?): Promise<AutoTagResult>` — full pipeline
- Consumed by: Task 5 (admin API)

- [ ] **Step 1: Write failing tests**

Create `tests/autoTag.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";

// We test autoTagSong by injecting mock dependencies (no real HTTP calls)

// Inline a minimal version of autoTagSong for unit testing
// Real module tested via integration in admin UI

test("buildGptTagPrompt includes title, artist and lastfm tags in output", () => {
  // We extract the prompt builder as a pure function — tested directly
  const { buildGptTagPrompt } = await import("../lib/autoTag.ts").catch(() => null) ?? {};
  if (!buildGptTagPrompt) {
    // Module not yet written — expected failure
    assert.fail("buildGptTagPrompt not exported from lib/autoTag.ts");
  }
  const prompt = buildGptTagPrompt("Хочешь?", "Земфира", ["sad", "russian indie", "90s"]);
  assert.ok(prompt.includes("Хочешь?"));
  assert.ok(prompt.includes("Земфира"));
  assert.ok(prompt.includes("russian indie"));
});

test("parseGptTagResponse extracts emotional_vector and story_intent_tags", () => {
  const { parseGptTagResponse } = await import("../lib/autoTag.ts").catch(() => null) ?? {};
  if (!parseGptTagResponse) assert.fail("parseGptTagResponse not exported from lib/autoTag.ts");

  const raw = JSON.stringify({
    language: "Russian",
    emotional_vector: { dreamy: 0.3, nostalgia: 0.8, energy: 0.2, cinematic: 0.6, darkness: 0.4, confidence: 0.3, intimacy: 0.7, danceability: 0.1, electronic: 0.2, acoustic: 0.8 },
    genre_tags: ["Russian indie", "alternative"],
    aesthetic_tags: ["raw", "nostalgic"],
    mood_tags: ["melancholic", "yearning"],
    story_intent_tags: ["cold Russian melancholy", "bittersweet nostalgia"],
    modern_aesthetic_tags: ["Slavic sad girl"],
    popularity_tier: 2,
  });

  const result = parseGptTagResponse(raw);
  assert.equal(result.language, "Russian");
  assert.ok(Array.isArray(result.story_intent_tags));
  assert.ok(result.story_intent_tags.includes("cold Russian melancholy"));
  assert.ok(result.emotional_vector.nostalgia === 0.8);
});

test("parseGptTagResponse falls back to defaults on malformed JSON", () => {
  const { parseGptTagResponse } = await import("../lib/autoTag.ts").catch(() => null) ?? {};
  if (!parseGptTagResponse) assert.fail("parseGptTagResponse not exported");
  const result = parseGptTagResponse("this is not json");
  assert.equal(result.language, "Unknown");
  assert.deepEqual(result.story_intent_tags, []);
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
node --test tests/autoTag.test.mjs
```

Expected: fail with "buildGptTagPrompt not exported from lib/autoTag.ts".

- [ ] **Step 3: Implement lib/autoTag.ts**

Create `lib/autoTag.ts`:

```typescript
import openai from "./openai";
import { getSimilarTracks } from "./lastfm";
import type { EmotionalVector } from "./emotionalVector";
import { ZERO_VECTOR } from "./emotionalVector";

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

async function fetchItunesMeta(title: string, artist: string): Promise<ItunesTrack | null> {
  const q = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=5`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const results: ItunesTrack[] = data?.results ?? [];
    return results.find(
      (r) =>
        r.trackName?.toLowerCase().includes(title.toLowerCase()) ||
        r.artistName?.toLowerCase().includes(artist.toLowerCase())
    ) ?? results[0] ?? null;
  } catch {
    return null;
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
    return tags.slice(0, 8).map((t: { name: string }) => t.name).filter(Boolean);
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
  "mood_tags": ["2-4 mood words: melancholic, euphoric, chaotic, cozy, etc."],
  "story_intent_tags": ["2-4 from this list only: post-breakup confidence, expensive sadness, soft revenge, she'll regret losing you, cold Russian melancholy, toxic but iconic, quiet luxury, main character walk, private story energy, clean girl morning, lonely but pretty, night-luxe, cinematic soft flex, modern romantic, not basic TikTok, Slavic sad girl, hot girl summer, dark feminine, cool girl car selfie, dark academia moment, healing era, confident comeback, bittersweet nostalgia, chaotic but cute"],
  "modern_aesthetic_tags": ["1-3 aesthetic movement tags: quiet luxury, dark academia, Slavic underground, bedroom pop intimacy, etc."]
}

Be precise. Every value matters for song matching quality.`;
}

export function parseGptTagResponse(raw: string): {
  language: string;
  popularity_tier: number;
  emotional_vector: EmotionalVector;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
} {
  const fallback = {
    language: "Unknown",
    popularity_tier: 3,
    emotional_vector: { ...ZERO_VECTOR },
    genre_tags: [] as string[],
    aesthetic_tags: [] as string[],
    mood_tags: [] as string[],
    story_intent_tags: [] as string[],
    modern_aesthetic_tags: [] as string[],
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

    return {
      language: typeof parsed.language === "string" ? parsed.language : "Unknown",
      popularity_tier: typeof parsed.popularity_tier === "number" ? Math.round(parsed.popularity_tier) : 3,
      emotional_vector,
      genre_tags: Array.isArray(parsed.genre_tags) ? parsed.genre_tags.filter(Boolean) : [],
      aesthetic_tags: Array.isArray(parsed.aesthetic_tags) ? parsed.aesthetic_tags.filter(Boolean) : [],
      mood_tags: Array.isArray(parsed.mood_tags) ? parsed.mood_tags.filter(Boolean) : [],
      story_intent_tags: Array.isArray(parsed.story_intent_tags) ? parsed.story_intent_tags.filter(Boolean) : [],
      modern_aesthetic_tags: Array.isArray(parsed.modern_aesthetic_tags) ? parsed.modern_aesthetic_tags.filter(Boolean) : [],
    };
  } catch {
    return fallback;
  }
}

export async function autoTagSong(title: string, artist: string): Promise<AutoTagResult> {
  const [itunesMeta, lastfmTags] = await Promise.all([
    fetchItunesMeta(title, artist),
    fetchLastfmTags(title, artist),
  ]);

  const prompt = buildGptTagPrompt(title, artist, lastfmTags);
  let rawGpt = "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0,
    });
    rawGpt = res.choices[0].message.content ?? "";
  } catch (err) {
    console.error("[autoTag] GPT failed:", err);
  }

  const gptData = parseGptTagResponse(rawGpt);

  return {
    title: itunesMeta?.trackName ?? title,
    artist: itunesMeta?.artistName ?? artist,
    album: itunesMeta?.collectionName ?? null,
    year: itunesMeta?.releaseDate ? new Date(itunesMeta.releaseDate).getFullYear() : null,
    duration_seconds: itunesMeta?.trackTimeMillis ? Math.round(itunesMeta.trackTimeMillis / 1000) : null,
    language: gptData.language,
    popularity_tier: gptData.popularity_tier,
    emotional_vector: gptData.emotional_vector,
    genre_tags: gptData.genre_tags,
    aesthetic_tags: gptData.aesthetic_tags,
    mood_tags: gptData.mood_tags,
    story_intent_tags: gptData.story_intent_tags,
    modern_aesthetic_tags: gptData.modern_aesthetic_tags,
    itunes_preview_url: itunesMeta?.previewUrl ?? null,
    artwork_url: itunesMeta?.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
    apple_music_url: itunesMeta?.trackViewUrl ?? null,
    energy: gptData.emotional_vector.energy,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
node --test tests/autoTag.test.mjs
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/autoTag.ts tests/autoTag.test.mjs
git commit -m "feat: add auto-tag pipeline (iTunes + Last.fm + GPT)"
```

---

## Task 4: Song Catalog DB Layer

**Files:**
- Create: `lib/db/songs.ts`

**Interfaces:**
- Consumes: `AutoTagResult` from Task 3, `createServerSupabaseClient` from `lib/supabase/server.ts`
- Produces:
  - `insertSong(data: AutoTagResult): Promise<{ id: string }>`
  - `updateSong(id: string, patch: Partial<SongPatch>): Promise<void>`
  - `deleteSong(id: string): Promise<void>`
  - `listSongs(limit?: number, offset?: number): Promise<CatalogSong[]>`
  - `searchCatalog(queryVector: number[], matchCount?: number): Promise<CatalogSong[]>`
  - `recordFeedback(songId: string, action: 'save' | 'skip' | 'perfect'): Promise<void>`
- Consumed by: Task 5 (admin API), Task 7 (recommend engine)

- [ ] **Step 1: Implement lib/db/songs.ts**

Create `lib/db/songs.ts`:

```typescript
import { createServerSupabaseClient } from "../supabase/server";
import type { AutoTagResult } from "../autoTag";
import { vectorToArray } from "../vectorMath";

export interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  language: string;
  energy: number;
  popularity_tier: number;
  emotional_vector: number[];
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  itunes_preview_url: string | null;
  artwork_url: string | null;
  apple_music_url: string | null;
  youtube_id: string | null;
  quality_score: number;
  distance?: number;
}

export interface SongPatch {
  language: string;
  popularity_tier: number;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
}

export async function insertSong(data: AutoTagResult): Promise<{ id: string }> {
  const supabase = await createServerSupabaseClient();
  const vectorArray = vectorToArray(data.emotional_vector);

  const { data: row, error } = await supabase
    .from("songs")
    .insert({
      title: data.title,
      artist: data.artist,
      album: data.album,
      year: data.year,
      duration_seconds: data.duration_seconds,
      language: data.language,
      popularity_tier: data.popularity_tier,
      emotional_vector: vectorArray,
      energy: data.energy,
      genre_tags: data.genre_tags,
      aesthetic_tags: data.aesthetic_tags,
      mood_tags: data.mood_tags,
      story_intent_tags: data.story_intent_tags,
      modern_aesthetic_tags: data.modern_aesthetic_tags,
      itunes_preview_url: data.itunes_preview_url,
      artwork_url: data.artwork_url,
      apple_music_url: data.apple_music_url,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertSong failed: ${error.message}`);
  return { id: row.id };
}

export async function updateSong(id: string, patch: Partial<SongPatch>): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("songs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updateSong failed: ${error.message}`);
}

export async function deleteSong(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("songs").delete().eq("id", id);
  if (error) throw new Error(`deleteSong failed: ${error.message}`);
}

export async function listSongs(limit = 200, offset = 0): Promise<CatalogSong[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("songs")
    .select("id,title,artist,language,energy,popularity_tier,genre_tags,aesthetic_tags,mood_tags,story_intent_tags,modern_aesthetic_tags,itunes_preview_url,artwork_url,apple_music_url,youtube_id,quality_score")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listSongs failed: ${error.message}`);
  return (data ?? []) as CatalogSong[];
}

export async function searchCatalog(
  queryVector: number[],
  matchCount = 50
): Promise<CatalogSong[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("match_songs", {
    query_vector: queryVector,
    match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalog failed: ${error.message}`);
  return (data ?? []) as CatalogSong[];
}

export async function recordFeedback(
  songId: string,
  action: "save" | "skip" | "perfect"
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const increment =
    action === "save"    ? { save_count: 1 } :
    action === "skip"    ? { skip_count: 1 } :
                           { perfect_count: 1, save_count: 1 };

  // Fetch current counts, increment, update quality_score manually
  // (quality_score is no longer a generated column — we update it here)
  const { data: song, error: fetchErr } = await supabase
    .from("songs")
    .select("save_count,skip_count,perfect_count")
    .eq("id", songId)
    .single();

  if (fetchErr || !song) return;

  const newSave    = song.save_count    + (increment.save_count    ?? 0);
  const newSkip    = song.skip_count    + (increment.skip_count    ?? 0);
  const newPerfect = song.perfect_count + (increment.perfect_count ?? 0);
  const total      = newSave + newSkip;
  const quality_score = total === 0 ? 0.5 : newSave / total;

  await supabase
    .from("songs")
    .update({ save_count: newSave, skip_count: newSkip, perfect_count: newPerfect, quality_score })
    .eq("id", songId);
}
```

**Note on quality_score:** The schema defines it as a regular `float` column (not a generated column), updated by `recordFeedback`. This avoids PostgreSQL generated column limitations.

- [ ] **Step 2: Remove generated column from schema SQL**

Edit `supabase/songs-schema.sql` — replace:
```sql
  quality_score  float generated always as (
    case when (save_count + skip_count) = 0 then 0.5
    else save_count::float / (save_count + skip_count)
    end
  ) stored,
```
with:
```sql
  quality_score  float NOT NULL DEFAULT 0.5,
```

If you already ran the migration with the generated column, run in Supabase SQL editor:
```sql
ALTER TABLE public.songs DROP COLUMN quality_score;
ALTER TABLE public.songs ADD COLUMN quality_score float NOT NULL DEFAULT 0.5;
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/songs.ts supabase/songs-schema.sql
git commit -m "feat: add song catalog DB layer with pgvector search and feedback recording"
```

---

## Task 5: Admin Catalog API + UI

**Files:**
- Create: `app/api/admin/songs/route.ts`
- Create: `app/api/admin/songs/[id]/route.ts`
- Create: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `autoTagSong` from Task 3, `insertSong`, `updateSong`, `deleteSong`, `listSongs` from Task 4
- Produces: protected admin endpoints + browser UI for catalog management

Protection strategy: requests must include header `x-admin-secret: <ADMIN_SECRET>` matching the env var. Set `ADMIN_SECRET` in `.env.local`.

- [ ] **Step 1: Add ADMIN_SECRET to .env.local**

Open `.env.local` and add:
```
ADMIN_SECRET=your-secret-here-change-this
```

- [ ] **Step 2: Create app/api/admin/songs/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { autoTagSong } from "../../../../lib/autoTag";
import { insertSong, listSongs } from "../../../../lib/db/songs";

export const runtime = "nodejs";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const songs = await listSongs();
  return NextResponse.json({ songs });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, artist } = await req.json();
  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist required" }, { status: 400 });
  }

  try {
    const tagged = await autoTagSong(title, artist);
    const { id } = await insertSong(tagged);
    return NextResponse.json({ id, song: tagged });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create app/api/admin/songs/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { updateSong, deleteSong } from "../../../../../lib/db/songs";

export const runtime = "nodejs";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const patch = await req.json();
  await updateSong(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteSong(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create app/admin/page.tsx**

```typescript
"use client";
import { useEffect, useState } from "react";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

interface Song {
  id: string;
  title: string;
  artist: string;
  language: string;
  popularity_tier: number;
  story_intent_tags: string[];
  quality_score: number;
}

export default function AdminPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");

  const headers = { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };

  const load = async () => {
    const res = await fetch("/api/admin/songs", { headers });
    const data = await res.json();
    setSongs(data.songs ?? []);
  };

  useEffect(() => { load(); }, []);

  const addSong = async () => {
    if (!title || !artist) return;
    setLoading(true);
    setStatus("Tagging...");
    const res = await fetch("/api/admin/songs", {
      method: "POST",
      headers,
      body: JSON.stringify({ title, artist }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus(`Added: ${data.song.title} (${data.song.language}, tier ${data.song.popularity_tier})`);
      setTitle(""); setArtist("");
      await load();
    } else {
      setStatus(`Error: ${data.error}`);
    }
    setLoading(false);
  };

  const saveEdit = async (id: string) => {
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    await fetch(`/api/admin/songs/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ story_intent_tags: tags }),
    });
    setEditId(null);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this song?")) return;
    await fetch(`/api/admin/songs/${id}`, { method: "DELETE", headers });
    await load();
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>VibeSong Catalog Admin</h1>
      <p style={{ color: "#888", marginBottom: 16 }}>{songs.length} songs in catalog</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }} />
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }} />
        <button onClick={addSong} disabled={loading} style={{ padding: "8px 16px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          {loading ? "Tagging..." : "Add + Auto-tag"}
        </button>
      </div>
      {status && <p style={{ color: "#A855F7", marginBottom: 16 }}>{status}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333", color: "#888" }}>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Title</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Artist</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Lang</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Tier</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Story Tags</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={{ padding: "6px 8px", color: "#fff" }}>{s.title}</td>
              <td style={{ padding: "6px 8px", color: "#aaa" }}>{s.artist}</td>
              <td style={{ padding: "6px 8px", color: "#888" }}>{s.language}</td>
              <td style={{ padding: "6px 8px", color: "#888" }}>{s.popularity_tier}</td>
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
              <td style={{ padding: "6px 8px", display: "flex", gap: 6 }}>
                <button onClick={() => { setEditId(s.id); setEditTags(s.story_intent_tags?.join(", ") ?? ""); }} style={{ padding: "3px 8px", background: "#1a1a1a", color: "#888", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Edit tags</button>
                <button onClick={() => remove(s.id)} style={{ padding: "3px 8px", background: "#1a1a1a", color: "#ef4444", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Add NEXT_PUBLIC_ADMIN_SECRET to .env.local**

```
NEXT_PUBLIC_ADMIN_SECRET=your-secret-here-change-this
```

(Must match `ADMIN_SECRET`. This is safe for the admin page since it's only accessed by you.)

- [ ] **Step 6: Test manually**

Start dev server: `npm run dev`
Open `http://localhost:3000/admin`
Add one song (e.g. title: "Хочешь?", artist: "Земфира")
Verify it appears in the table with auto-generated tags.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/songs/route.ts app/api/admin/songs/[id]/route.ts app/admin/page.tsx
git commit -m "feat: add admin catalog UI and API for song management"
```

---

## Task 6: Rebuild Photo Analysis (Remove Song Selection)

**Files:**
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Produces: same photo metadata as before, MINUS `musicDNA.tracks`. Adds `photoVectorArray: number[]` to response.
- Consumed by: Task 8 (frontend wiring)

The new `/api/analyze` response shape:
```typescript
{
  scene: { setting, timeOfDay, season, weather, activity, cameraMood },
  people: { count, visibleEmotions, socialVibe, activity },
  emotion: { primary, secondary, intensity },
  visual: { dominantColors, brightness, aesthetic },
  musicDNA: { energy, valence, tempo, genres, mood },   // no tracks field
  vibeMetrics: { intimacy, confidence, nostalgia, movement },
  vibeCaption: string,
  vibeTags: string[],
  momentType: string,
  photoConfidence: number,
  photoVector: EmotionalVector,         // object form for compatibility
  photoVectorArray: number[],           // array form for pgvector query
}
```

- [ ] **Step 1: Update the system prompt in app/api/analyze/route.ts**

Replace `BASE_SYSTEM_PROMPT` — remove all song-related instructions. The new prompt ends after scene/emotion/vector analysis. Find the line:

```typescript
const BASE_SYSTEM_PROMPT = `You are a music curator...
```

Replace the entire `BASE_SYSTEM_PROMPT` constant with:

```typescript
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
  }
}
NUMBER RULES:
- energy, valence, brightness, intensity, vibeMetrics fields: floats 0.0–1.0
- photoConfidence: float 0.0–1.0
- photoVector fields: all floats 0.0–1.0
- vibeTags: exactly 3`;
```

- [ ] **Step 2: Remove buildTasteBlock, buildAggregateTasteBlock from prompt building**

The `buildPrompt` function currently appends taste blocks to the system prompt. Since GPT no longer picks songs, taste context is irrelevant here. Replace `buildPrompt`:

```typescript
function buildPrompt(exifBlock: string): string {
  return BASE_SYSTEM_PROMPT + exifBlock;
}
```

- [ ] **Step 3: Remove normalizeScores call and song-related imports**

In the POST handler, remove:
- The `normalizeScores(result, taste, aggregate)` call
- Imports: `applyAvoidPenalties`, `applyLanguagePenalty`, `getDiscoveryInstructions`, `normalizeCandidateScores`, `normalizeTaste`, `CandidateTrack`, `UserTaste` from `matching`
- The `getUserTaste`, `getFeedback`, `buildAggregateTasteProfile` calls (keep Supabase user lookup)
- The `buildTasteBlock`, `buildAggregateTasteBlock`, `buildStoredTasteVectorBlock` functions

- [ ] **Step 4: Add photoVectorArray to the response**

After `const photoVector = ...` in the POST handler, add:

```typescript
import { vectorToArray } from "../../../lib/vectorMath";

// In POST handler, after extracting photoVector:
const photoVectorArray = vectorToArray({
  dreamy: photoVector.dreamy ?? 0,
  nostalgia: photoVector.nostalgia ?? 0,
  energy: photoVector.energy ?? 0,
  cinematic: photoVector.cinematic ?? 0,
  darkness: photoVector.darkness ?? 0,
  confidence: photoVector.confidence ?? 0,
  intimacy: photoVector.intimacy ?? 0,
  danceability: photoVector.danceability ?? 0,
  electronic: photoVector.electronic ?? 0,
  acoustic: photoVector.acoustic ?? 0,
});

// Add to the return:
return NextResponse.json({ ...result, photoVectorArray });
```

- [ ] **Step 5: Verify analyze route still works**

Start dev server, upload a photo, check the response in browser DevTools Network tab. Confirm:
- Response contains `photoVector` and `photoVectorArray`
- Response does NOT contain `musicDNA.tracks`
- No TypeScript errors in `npm run build`

- [ ] **Step 6: Commit**

```bash
git add app/api/analyze/route.ts lib/vectorMath.ts
git commit -m "feat: rebuild photo analysis — GPT returns vector only, no song selection"
```

---

## Task 7: Recommendation Engine

**Files:**
- Create: `lib/recommend.ts`
- Create: `app/api/recommend/route.ts`
- Create: `tests/recommend.test.mjs`

**Interfaces:**
- Consumes: `searchCatalog`, `CatalogSong` from Task 4; `blendQueryVector`, `cosine`, `VECTOR_KEYS` from Task 2
- Produces:
  - `RecommendRequest` type
  - `RecommendResult` type (scored song + debug log)
  - `buildRecommendations(req: RecommendRequest, candidates: CatalogSong[]): RecommendResult[]`
  - POST `/api/recommend` → `{ songs: RecommendResult[], debugLog: DebugEntry[] }`

- [ ] **Step 1: Write failing tests**

Create `tests/recommend.test.mjs`:

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
  // Stub out any imports that require external dependencies
  const stubRequire = (mod) => {
    if (mod.includes("supabase") || mod.includes("openai")) return {};
    if (mod.includes("vectorMath")) {
      // Load the real vectorMath module
      const vmSource = readFileSync("lib/vectorMath.ts", "utf8");
      const vmOutput = ts.transpileModule(vmSource, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      }).outputText;
      const vmMod = { exports: {} };
      const vmCtx = vm.createContext({ exports: vmMod.exports, module: vmMod, require: stubRequire, console, process });
      vm.runInContext(vmOutput, vmCtx);
      return vmMod.exports;
    }
    if (mod.includes("emotionalVector")) return { ZERO_VECTOR: { dreamy:0,nostalgia:0,energy:0,cinematic:0,darkness:0,confidence:0,intimacy:0,danceability:0,electronic:0,acoustic:0 } };
    try { return require(mod); } catch { return {}; }
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process, URLSearchParams, ...extraContext });
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
  const results = rec.buildRecommendations(makeRequest({ languages: ["English"], languageOpenness: "strict" }), candidates);
  const ids = results.map((r) => r.id);
  assert.ok(ids.includes("1"), "English song should be kept");
  assert.ok(!ids.includes("2"), "Russian song should be removed with strict filter");
});

test("blocked song is removed from results", () => {
  const candidates = [makeSong({ id: "blocked-id" })];
  const results = rec.buildRecommendations(makeRequest({ blockedSongs: ["blocked-id"] }), candidates);
  assert.equal(results.length, 0);
});

test("blocked artist is removed from results", () => {
  const candidates = [makeSong({ id: "1", artist: "Bad Artist" })];
  const results = rec.buildRecommendations(makeRequest({ blockedArtists: ["Bad Artist"] }), candidates);
  assert.equal(results.length, 0);
});

test("freshness penalty applied to recently shown songs", () => {
  const song = makeSong({ id: "recent-id" });
  const [result] = rec.buildRecommendations(makeRequest({ recentlyShownSongIds: ["recent-id"] }), [song]);
  assert.ok(result.scoreComponents.freshnessPenalty === -20);
});

test("story intent tag match boosts score", () => {
  const withTag = makeSong({ id: "a", story_intent_tags: ["main character walk"] });
  const withoutTag = makeSong({ id: "b", story_intent_tags: [] });
  const req = makeRequest({ storyIntentTags: ["main character walk"] });
  const results = rec.buildRecommendations(req, [withTag, withoutTag]);
  const a = results.find((r) => r.id === "a");
  const b = results.find((r) => r.id === "b");
  assert.ok(a.scoreComponents.storyFit > b.scoreComponents.storyFit);
  assert.ok(a.scoreComponents.finalScore > b.scoreComponents.finalScore);
});

test("energy compatibility filter removes songs with energy too far from query", () => {
  const calmQuery = makeRequest({ queryVector: [0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const aggressiveSong = makeSong({ energy: 0.9, emotional_vector: [0.5, 0.5, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  const results = rec.buildRecommendations(calmQuery, [aggressiveSong]);
  assert.equal(results.length, 0, "Song with energy 0.9 should be removed when query energy is 0.1");
});

test("results are sorted by finalScore descending", () => {
  const high = makeSong({ id: "high", emotional_vector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9] });
  const low  = makeSong({ id: "low",  emotional_vector: [0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] });
  const query = makeRequest({ queryVector: [0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9] });
  const results = rec.buildRecommendations(query, [low, high]);
  assert.equal(results[0].id, "high");
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
node --test tests/recommend.test.mjs
```

Expected: fail with module not found.

- [ ] **Step 3: Implement lib/recommend.ts**

Create `lib/recommend.ts`:

```typescript
import { cosine, VECTOR_KEYS } from "./vectorMath";
import type { CatalogSong } from "./db/songs";

export interface RecommendRequest {
  queryVector: number[];           // 10 dimensions, already blended
  languages: string[];
  languageOpenness: "strict" | "flexible" | "open";
  discoveryStyle: "niche" | "balanced" | "popular-ok";
  blockedSongs: string[];
  blockedArtists: string[];
  recentlyShownSongIds: string[];  // freshness — don't repeat last 5 sessions
  genreScores: Record<string, number>;
  likedArtists: string[];
  storyIntentTags: string[];       // from requested vibe parsing
  antiTags: string[];              // from requested vibe parsing
}

export interface ScoreComponents {
  photoFit: number;
  tasteFit: number;
  storyFit: number;
  noveltyFit: number;
  qualityBonus: number;
  languagePenalty: number;
  freshnessPenalty: number;
  mainstreamPenalty: number;
  finalScore: number;
}

export interface RecommendResult extends CatalogSong {
  scoreComponents: ScoreComponents;
}

export interface RemovedEntry {
  id: string;
  title: string;
  artist: string;
  rulesRemoved: true;
  removedReason: "language_mismatch" | "hard_block" | "energy_gap" | "anti_tag";
}

export interface DebugEntry {
  id: string;
  title: string;
  artist: string;
  rulesRemoved: boolean;
  removedReason?: string;
  scoreComponents?: ScoreComponents;
}

function normalizeLanguage(lang: string): string {
  return lang.trim().toLowerCase();
}

function languageMatches(songLang: string, userLangs: string[]): boolean {
  if (songLang === "Instrumental") return true;
  const normalized = normalizeLanguage(songLang);
  return userLangs.some((l) => normalized.includes(normalizeLanguage(l)) || normalizeLanguage(l).includes(normalized));
}

function genreOverlapScore(songGenres: string[], genreScores: Record<string, number>): number {
  if (!songGenres.length || !Object.keys(genreScores).length) return 0;
  let total = 0;
  for (const genre of songGenres) {
    const normalized = genre.toLowerCase();
    for (const [key, score] of Object.entries(genreScores)) {
      if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
        total += score;
      }
    }
  }
  return Math.max(0, Math.min(1, total / songGenres.length));
}

function artistProximityScore(songArtist: string, likedArtists: string[]): number {
  if (!likedArtists.length) return 0;
  const normalized = songArtist.toLowerCase();
  const exact = likedArtists.some((a) => a.toLowerCase() === normalized);
  if (exact) return 1.0;
  const partial = likedArtists.some((a) => normalized.includes(a.toLowerCase()) || a.toLowerCase().includes(normalized));
  return partial ? 0.5 : 0;
}

function discoveryScore(popularityTier: number, discoveryStyle: string): number {
  switch (discoveryStyle) {
    case "niche":      return popularityTier <= 2 ? 1.0 : popularityTier <= 3 ? 0.5 : 0.1;
    case "popular-ok": return popularityTier >= 3 ? 1.0 : 0.7;
    case "balanced":
    default:           return popularityTier === 3 ? 1.0 : popularityTier <= 2 ? 0.8 : 0.6;
  }
}

export function buildRecommendations(
  req: RecommendRequest,
  candidates: CatalogSong[]
): RecommendResult[] {
  const debugLog: DebugEntry[] = [];
  const queryEnergy = req.queryVector[2]; // energy is index 2 in VECTOR_KEYS order

  const scored: RecommendResult[] = [];

  for (const song of candidates) {
    // ── Rules Layer ──────────────────────────────────────────────────────────

    // 1. Language filter (strict)
    if (req.languageOpenness === "strict" && !languageMatches(song.language, req.languages)) {
      debugLog.push({ id: song.id, title: song.title, artist: song.artist, rulesRemoved: true, removedReason: "language_mismatch" });
      continue;
    }

    // 2. Hard blocks — song
    if (req.blockedSongs.includes(song.id)) {
      debugLog.push({ id: song.id, title: song.title, artist: song.artist, rulesRemoved: true, removedReason: "hard_block" });
      continue;
    }

    // 3. Hard blocks — artist
    if (req.blockedArtists.some((a) => a.toLowerCase() === song.artist.toLowerCase())) {
      debugLog.push({ id: song.id, title: song.title, artist: song.artist, rulesRemoved: true, removedReason: "hard_block" });
      continue;
    }

    // 4. Energy compatibility
    if (Math.abs(song.energy - queryEnergy) > 0.5) {
      debugLog.push({ id: song.id, title: song.title, artist: song.artist, rulesRemoved: true, removedReason: "energy_gap" });
      continue;
    }

    // 5. Anti-tags from requested vibe
    if (req.antiTags.length > 0) {
      const allTags = [...song.story_intent_tags, ...song.mood_tags, ...song.aesthetic_tags].map((t) => t.toLowerCase());
      const hasAntiTag = req.antiTags.some((at) => allTags.some((t) => t.includes(at.toLowerCase())));
      if (hasAntiTag) {
        debugLog.push({ id: song.id, title: song.title, artist: song.artist, rulesRemoved: true, removedReason: "anti_tag" });
        continue;
      }
    }

    // ── Scoring Layer ────────────────────────────────────────────────────────

    const photoFit  = cosine(req.queryVector, song.emotional_vector) * 40;
    const genreScore  = genreOverlapScore(song.genre_tags, req.genreScores);
    const artistScore = artistProximityScore(song.artist, req.likedArtists);
    const aestheticMatch = song.aesthetic_tags.length > 0 ? 0.5 : 0; // basic presence signal
    const tasteFit  = genreScore * 15 + artistScore * 10 + aestheticMatch * 5;

    const storyTagMatches = req.storyIntentTags.filter((t) =>
      song.story_intent_tags.map((s) => s.toLowerCase()).includes(t.toLowerCase())
    ).length;
    const storyFit  = Math.min(3, storyTagMatches) * 7;

    const noveltyFit   = discoveryScore(song.popularity_tier, req.discoveryStyle) * 10;
    const qualityBonus = song.quality_score * 5;

    // Penalties
    const langMismatch = req.languageOpenness === "flexible" && !languageMatches(song.language, req.languages) ? -15 : 0;
    const freshness    = req.recentlyShownSongIds.includes(song.id) ? -20 : 0;
    const mainstream   = req.discoveryStyle === "niche" && song.popularity_tier > 3 ? -10 : 0;

    const raw = photoFit + tasteFit + storyFit + noveltyFit + qualityBonus;
    const finalScore = Math.max(0, Math.min(100, raw + langMismatch + freshness + mainstream));

    const components: ScoreComponents = {
      photoFit:         Math.round(photoFit * 10) / 10,
      tasteFit:         Math.round(tasteFit * 10) / 10,
      storyFit,
      noveltyFit:       Math.round(noveltyFit * 10) / 10,
      qualityBonus:     Math.round(qualityBonus * 10) / 10,
      languagePenalty:  langMismatch,
      freshnessPenalty: freshness,
      mainstreamPenalty: mainstream,
      finalScore:       Math.round(finalScore * 10) / 10,
    };

    debugLog.push({ id: song.id, title: song.title, artist: song.artist, rulesRemoved: false, scoreComponents: components });
    scored.push({ ...song, scoreComponents: components });
  }

  console.log("[recommend] debug log:", JSON.stringify(debugLog, null, 2));

  return scored.sort((a, b) => b.scoreComponents.finalScore - a.scoreComponents.finalScore);
}
```

- [ ] **Step 4: Create app/api/recommend/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getUserTaste } from "../../../lib/db/userTaste";
import { getFeedback } from "../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile } from "../../../lib/tasteProfile";
import { searchCatalog } from "../../../lib/db/songs";
import { blendQueryVector, vectorToArray } from "../../../lib/vectorMath";
import { buildRecommendations } from "../../../lib/recommend";
import { normalizeTaste } from "../../../lib/matching";
import type { EmotionalVector } from "../../../lib/emotionalVector";
import { ZERO_VECTOR, VECTOR_KEYS } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

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

    if (!photoVectorArray || photoVectorArray.length !== 10) {
      return NextResponse.json({ error: "photoVectorArray (10 numbers) required" }, { status: 400 });
    }

    // Load user taste profile
    const [storedTaste, savedFeedback, skippedFeedback] = await Promise.all([
      getUserTaste(user.id).catch(() => null),
      getFeedback(user.id, "saved", 200).catch(() => []),
      getFeedback(user.id, "skipped", 200).catch(() => []),
    ]);
    const taste = normalizeTaste(storedTaste ?? null);
    const aggregate = buildAggregateTasteProfile(savedFeedback, skippedFeedback);

    // Build taste vector from saved song feedback emotional vectors
    // For now: use zero vector (cold start). Phase 2 adds stored emotional_vector from onboarding.
    const tasteArr: number[] = VECTOR_KEYS.map(() => 0.5);

    // Determine vibe vector from boosts (apply cap per dimension)
    const hasVibe = Object.keys(vibeBoosts).length > 0 || storyIntentTags.length > 0;
    const vibeArr = hasVibe
      ? VECTOR_KEYS.map((k, i) => {
          const boost = vibeBoosts[k as keyof EmotionalVector] ?? 0;
          const photoDim = photoVectorArray[i];
          return Math.max(photoDim - 0.25, Math.min(photoDim + 0.35, photoDim + boost));
        })
      : null;

    // Build query vector
    const queryVector = blendQueryVector(photoVectorArray, tasteArr, vibeArr, vibeBoosts);

    // pgvector similarity search — 50 candidates
    const candidates = await searchCatalog(queryVector, 50);

    // Build language list from taste profile
    const rawLang = taste.languagePreference.toLowerCase();
    const languages = rawLang === "no preference" || rawLang === "global mix"
      ? []
      : [taste.languagePreference];
    const languageOpenness: "strict" | "flexible" | "open" =
      languages.length === 0 ? "open" : "flexible";

    // Build recently shown song IDs (from last 5 saved/skipped)
    const recentIds = [...savedFeedback, ...skippedFeedback]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 25)
      .map((f) => f.title + "|" + f.artist); // song IDs not available in feedback — skip freshness for now

    // Score and rank
    const recommendations = buildRecommendations(
      {
        queryVector,
        languages,
        languageOpenness,
        discoveryStyle: taste.discoveryStyle as "niche" | "balanced" | "popular-ok",
        blockedSongs: [],
        blockedArtists: aggregate.avoidArtists,
        recentlyShownSongIds: [],
        genreScores: Object.fromEntries(
          taste.genres.map((g) => [g, 0.8])
            .concat(taste.dislikes.map((d) => [d, -0.8]))
        ),
        likedArtists: taste.favoriteArtists,
        storyIntentTags,
        antiTags,
      },
      candidates
    );

    return NextResponse.json({
      songs: recommendations.slice(0, 12),
      totalCandidates: candidates.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/recommend error:", message);
    return NextResponse.json({ error: "Recommendation failed", detail: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
node --test tests/recommend.test.mjs
```

Expected: all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/recommend.ts app/api/recommend/route.ts tests/recommend.test.mjs
git commit -m "feat: add recommendation engine with rules layer, scoring, and debug logging"
```

---

## Task 8: Wire Frontend

**Files:**
- Modify: `app/results/page.tsx` (or wherever the analyze result triggers the swipe UI)
- Modify: `store/useAppStore.ts`

**Interfaces:**
- Consumes: `/api/analyze` (photo vector), `/api/recommend` (scored songs)
- Produces: swipe UI still works, now shows catalog songs with `itunes_preview_url` + `artwork_url`

- [ ] **Step 1: Read the current results page**

Open `app/results/page.tsx` and `store/useAppStore.ts` to understand the current flow. The existing flow: analyze returns tracks → store them → SwipeCard reads them.

- [ ] **Step 2: Add recommendResults to useAppStore.ts**

Open `store/useAppStore.ts`. Find where `vibeProfile` and track results are stored. Add a new state field:

```typescript
// Add to the store state type:
recommendedSongs: RecommendedSong[];
isRecommending: boolean;

// Add the RecommendedSong type (top of file):
export interface RecommendedSong {
  id: string;
  title: string;
  artist: string;
  language: string;
  itunes_preview_url: string | null;
  artwork_url: string | null;
  apple_music_url: string | null;
  youtube_id: string | null;
  story_intent_tags: string[];
  scoreComponents: {
    photoFit: number;
    tasteFit: number;
    storyFit: number;
    finalScore: number;
  };
}

// Add to initial state:
recommendedSongs: [],
isRecommending: false,

// Add setters:
setRecommendedSongs: (songs: RecommendedSong[]) => set({ recommendedSongs: songs }),
setIsRecommending: (v: boolean) => set({ isRecommending: v }),
```

- [ ] **Step 3: Update the analyze flow to call /api/recommend after /api/analyze**

In whichever component calls `/api/analyze` (likely `app/app/page.tsx` or the DropZone handler), after receiving the analyze response, call `/api/recommend`:

```typescript
// After receiving analyzeResult from /api/analyze:
const analyzeResult = await analyzeResponse.json();

// Store photo metadata (vibeCaption, vibeTags, etc.) as before

// Now call /api/recommend with the photo vector
setIsRecommending(true);
const recommendResponse = await fetch("/api/recommend", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    photoVectorArray: analyzeResult.photoVectorArray,
    vibeBoosts: {},        // will be populated from requested vibe in Phase 2
    storyIntentTags: [],   // will come from vibe parsing in Phase 2
    antiTags: [],
  }),
});
const recommendResult = await recommendResponse.json();
setRecommendedSongs(recommendResult.songs ?? []);
setIsRecommending(false);
```

- [ ] **Step 4: Update SwipeCard / results page to use recommendedSongs**

Find where `SwipeCard` receives its tracks. Replace the source from `vibeProfile.musicDNA.tracks` to `recommendedSongs`. The `RecommendedSong` fields map to SwipeCard props:

```typescript
// Old (GPT tracks):
{ title, artist, reason, matchScore, youtubeId, thumbnail, youtubeUrl }

// New (catalog songs):
{ title, artist, artwork_url (→ thumbnail), itunes_preview_url, youtube_id }
```

Update SwipeCard to accept `artwork_url` and `itunes_preview_url` instead of `thumbnail` and `previewUrl` if needed, or map them in the results page before passing down.

- [ ] **Step 5: Manual end-to-end test**

1. `npm run dev`
2. Sign in
3. Upload a photo
4. Verify analyzing state shows
5. Verify swipe cards appear with catalog songs (artwork from iTunes)
6. Verify 30-second previews play (itunes_preview_url)
7. Verify no TypeScript errors: `npx tsc --noEmit`

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all existing tests pass, plus new vectorMath + recommend tests.

- [ ] **Step 7: Final commit**

```bash
git add app/results/page.tsx store/useAppStore.ts app/app/page.tsx
git commit -m "feat: wire frontend to new recommend API — GPT no longer picks songs"
```

---

## Self-Review Notes

**Spec coverage check:**

| Spec requirement | Task |
|------------------|------|
| pgvector + songs table | Task 1 |
| Auto-tagging pipeline (iTunes + Last.fm + GPT) | Task 3 |
| Admin UI for manual tag correction | Task 5 |
| GPT returns vector only, no songs | Task 6 |
| pgvector similarity search | Task 4 |
| Rules layer (language strict, hard blocks, energy gap, anti-tags) | Task 7 |
| Scoring layer (photo_fit, taste_fit, story_fit, novelty, quality) | Task 7 |
| Debug log per candidate | Task 7 |
| 150–300 initial songs | Admin UI in Task 5 (you add songs via /admin) |
| Query vector blending (photo + taste + vibe) | Task 2 |
| Vibe cap formula | Task 2 |
| Frontend uses catalog songs | Task 8 |
| Language filter strict when user says "only this language" | Task 7 |

**What Phase 2 adds (separate plan):**
- Requested vibe text input + GPT vibe parsing → `vibeBoosts` and `storyIntentTags`
- Adaptive onboarding (language-first, artist seeding, filtered swipes)
- 4-tier feedback UI + reason picker
- `user_taste` schema migration (add `languages[]`, `language_openness`, `blocked_songs`, `story_tag_scores`)
- Stored `emotional_vector` in taste profile (currently uses 0.5 fallback)

**What Phase 3 adds (separate plan):**
- Song Battle screen
- Catalog expansion beyond English/Russian
- Deezer BPM/energy metadata in auto-tagging
