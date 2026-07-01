# VibeSong Adaptive Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current onboarding (dead `TasteSetup.tsx` form + `SongSwipeOnboarding`'s built-in single-language prefs screen) with the 5-step adaptive flow from `docs/superpowers/specs/2026-06-30-vibesong-architecture-redesign.md` (Layer 5), and wire the resulting taste signal into `/api/recommend`, which currently ignores stored taste entirely.

**Architecture:** Small, single-purpose step components under `components/onboarding/` orchestrated by a new `OnboardingFlow.tsx`, which hands off to a slimmed-down `SongSwipeOnboarding` for the swipe step. Backend: extend `user_taste` schema, extend `lib/matching.ts`/`lib/db/userTaste.ts` to match, add two new endpoints (`/api/song-search`, `/api/taste/story-songs`), rewrite `/api/seed-tracks` to pull from the real catalog instead of a hardcoded pool, and rewire `/api/recommend` to actually consume the stored taste vector and scores instead of a hardcoded neutral placeholder.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (two projects: main project for auth/taste/feedback, separate catalog project for `songs`), Framer Motion, `node:test`.

## Global Constraints

- `favorite_story_songs` holds catalog UUIDs from a *different* Supabase project than `user_taste` lives in — no real FK is possible across projects. Reads must tolerate an id that no longer resolves and skip it, not throw.
- Do not touch `next_auth` schema further (already commented as legacy/kept for history) or any auth flow — auth is out of scope.
- Do not touch `defaultMood`, `energyPreference`, `aestheticTags` on `UserTaste` — confirmed unused elsewhere, out of scope for this plan.
- All new/modified API routes: `export const runtime = "nodejs"`.
- Follow existing chip-button Tailwind classes/patterns already used in the codebase (see `components/TasteSetup.tsx` before it's deleted in Task 15, and `components/SongSwipeOnboarding.tsx`) for visual consistency — dark background (`bg-[#080808]`), hot-pink active state (`bg-hot-pink`).

---

### Task 1: Database migration for new `user_taste` columns

**Files:**
- Create: `supabase/onboarding-v2-migration.sql`

**Interfaces:**
- Produces: five new columns on `public.user_taste` (`languages text[]`, `language_openness text`, `genre_scores jsonb`, `avoided_story_tags text[]`, `favorite_story_songs uuid[]`); three columns dropped (`language_preference`, `genres`, `dislikes`).

- [ ] **Step 1: Write the migration file**

```sql
-- Onboarding v2 migration — adaptive onboarding (languages+openness, avoid-list,
-- recently-posted story songs, filtered swipes). Run in the MAIN Supabase
-- project's SQL Editor (not the catalog project).

ALTER TABLE public.user_taste
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS language_openness text NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS genre_scores jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoided_story_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_story_songs uuid[] NOT NULL DEFAULT '{}';

-- Old singular/unscored fields, fully superseded by the columns above.
ALTER TABLE public.user_taste
  DROP COLUMN IF EXISTS language_preference,
  DROP COLUMN IF EXISTS genres,
  DROP COLUMN IF EXISTS dislikes;
```

- [ ] **Step 2: Run it in the main project's SQL Editor**

Paste the file contents into SQL Editor for project `htlpzluwmbwfzgwphzyq` and run. Expected: `ALTER TABLE` success messages, no errors.

- [ ] **Step 3: Verify the new shape**

Run in the same SQL Editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_taste'
ORDER BY ordinal_position;
```
Expected: `languages`, `language_openness`, `genre_scores`, `avoided_story_tags`, `favorite_story_songs` present; `language_preference`, `genres`, `dislikes` absent.

- [ ] **Step 4: Commit**

```bash
git add supabase/onboarding-v2-migration.sql
git commit -m "feat: add onboarding v2 columns to user_taste, drop superseded fields"
```

---

### Task 2: Extend `UserTaste` type and `normalizeTaste`

**Files:**
- Modify: `lib/matching.ts:1-111`
- Test: `tests/matching.test.mjs` (new)

**Interfaces:**
- Consumes: nothing new (pure module).
- Produces: `UserTaste` with fields `favoriteArtists: string[]`, `defaultMood: string`, `discoveryStyle: DiscoveryStyle`, `languages: string[]`, `languageOpenness: "strict" | "flexible" | "open"`, `energyPreference: EnergyPreference`, `aestheticTags: string[]`, `genreScores: Record<string, number>`, `avoidedStoryTags: string[]`, `favoriteStorySongs: string[]`, `setupComplete: boolean`. `normalizeTaste(input: unknown): UserTaste` (same signature, new shape).

- [ ] **Step 1: Write the failing test**

Create `tests/matching.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTaste } from "../lib/matching.ts";

test("normalizeTaste fills defaults for empty input", () => {
  const taste = normalizeTaste({});
  assert.deepEqual(taste.languages, []);
  assert.equal(taste.languageOpenness, "flexible");
  assert.deepEqual(taste.genreScores, {});
  assert.deepEqual(taste.avoidedStoryTags, []);
  assert.deepEqual(taste.favoriteStorySongs, []);
});

test("normalizeTaste keeps valid languageOpenness and drops invalid genreScores entries", () => {
  const taste = normalizeTaste({
    languages: ["Russian", "English"],
    languageOpenness: "strict",
    genreScores: { "hip-hop": 0.8, "not-a-number": "oops", edm: -1 },
    avoidedStoryTags: ["expensive sadness", 42],
    favoriteStorySongs: ["a-uuid", 7],
  });
  assert.deepEqual(taste.languages, ["Russian", "English"]);
  assert.equal(taste.languageOpenness, "strict");
  assert.deepEqual(taste.genreScores, { "hip-hop": 0.8, edm: -1 });
  assert.deepEqual(taste.avoidedStoryTags, ["expensive sadness"]);
  assert.deepEqual(taste.favoriteStorySongs, ["a-uuid"]);
});

test("normalizeTaste rejects invalid languageOpenness", () => {
  const taste = normalizeTaste({ languageOpenness: "sometimes" });
  assert.equal(taste.languageOpenness, "flexible");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/matching.test.mjs`
Expected: FAIL — `normalizeTaste` doesn't recognize `languages`/`languageOpenness`/`genreScores`/`avoidedStoryTags`/`favoriteStorySongs` yet (fields come back as defaults from the old shape, so the "keeps valid" assertions fail).

- [ ] **Step 3: Rewrite `lib/matching.ts` lines 1-111**

```ts
export type DiscoveryStyle = "hidden-gems" | "niche" | "balanced" | "popular-ok";
export type EnergyPreference = "calm" | "medium" | "high" | "depends";
export type LanguageOpenness = "strict" | "flexible" | "open";

export interface UserTaste {
  favoriteArtists: string[];
  defaultMood: string;
  discoveryStyle: DiscoveryStyle;
  languages: string[];
  languageOpenness: LanguageOpenness;
  energyPreference: EnergyPreference;
  aestheticTags: string[];
  genreScores: Record<string, number>;
  avoidedStoryTags: string[];
  favoriteStorySongs: string[];
  setupComplete: boolean;
}

export interface CandidateTrack {
  title: string;
  artist: string;
  reason: string;
  genres?: string[];
  language?: string;
  matchScore?: number;
  viralMomentSeconds?: number;
  photoFitScore?: number;
  tasteFitScore?: number;
  discoveryFitScore?: number;
  obviousnessPenalty?: number;
  finalScore?: number;
}

export interface ResolvedTrack extends CandidateTrack {
  matchScore: number;
  finalScore: number;
  previewUrl?: string;
  previewProvider?: "itunes" | "youtube";
  artwork?: string;
  appleMusicUrl?: string;
  youtubeId?: string;
  youtubeUrl?: string;
  thumbnail: string;
}

const DEFAULT_TASTE: UserTaste = {
  favoriteArtists: [],
  defaultMood: "",
  discoveryStyle: "balanced",
  languages: [],
  languageOpenness: "flexible",
  energyPreference: "depends",
  aestheticTags: [],
  genreScores: {},
  avoidedStoryTags: [],
  favoriteStorySongs: [],
  setupComplete: true,
};

const DISCOVERY_STYLES: DiscoveryStyle[] = [
  "hidden-gems",
  "niche",
  "balanced",
  "popular-ok",
];

const ENERGY_PREFERENCES: EnergyPreference[] = ["calm", "medium", "high", "depends"];
const LANGUAGE_OPENNESS: LanguageOpenness[] = ["strict", "flexible", "open"];

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function cleanScoreMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && !Number.isNaN(raw)) result[key] = raw;
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function isDiscoveryStyle(value: unknown): value is DiscoveryStyle {
  return typeof value === "string" && DISCOVERY_STYLES.includes(value as DiscoveryStyle);
}

function isEnergyPreference(value: unknown): value is EnergyPreference {
  return typeof value === "string" && ENERGY_PREFERENCES.includes(value as EnergyPreference);
}

function isLanguageOpenness(value: unknown): value is LanguageOpenness {
  return typeof value === "string" && LANGUAGE_OPENNESS.includes(value as LanguageOpenness);
}

export function normalizeTaste(input: unknown): UserTaste {
  if (!input || typeof input !== "object") return DEFAULT_TASTE;
  const raw = input as Record<string, unknown>;

  return {
    favoriteArtists: cleanArray(raw.favoriteArtists),
    defaultMood: cleanString(raw.defaultMood),
    discoveryStyle: isDiscoveryStyle(raw.discoveryStyle)
      ? raw.discoveryStyle
      : DEFAULT_TASTE.discoveryStyle,
    languages: cleanArray(raw.languages),
    languageOpenness: isLanguageOpenness(raw.languageOpenness)
      ? raw.languageOpenness
      : DEFAULT_TASTE.languageOpenness,
    energyPreference: isEnergyPreference(raw.energyPreference)
      ? raw.energyPreference
      : DEFAULT_TASTE.energyPreference,
    aestheticTags: cleanArray(raw.aestheticTags),
    genreScores: cleanScoreMap(raw.genreScores),
    avoidedStoryTags: cleanArray(raw.avoidedStoryTags),
    favoriteStorySongs: cleanArray(raw.favoriteStorySongs),
    setupComplete:
      typeof raw.setupComplete === "boolean" ? raw.setupComplete : DEFAULT_TASTE.setupComplete,
  };
}
```

Leave everything below line 111 (`getDiscoveryInstructions` through `scoreResolvedTrack`) unchanged — those functions belong to the legacy `/api/search-tracks` route, out of scope here.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/matching.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/matching.ts tests/matching.test.mjs
git commit -m "feat: extend UserTaste with languages/openness/genreScores/avoid/story-songs"
```

---

### Task 3: Extend `lib/db/userTaste.ts` for the new columns

**Files:**
- Modify: `lib/db/userTaste.ts:14-68`

**Interfaces:**
- Consumes: `UserTaste`, `normalizeTaste` from Task 2 (`lib/matching.ts`).
- Produces: `getUserTaste(userId): Promise<UserTaste | null>`, `upsertUserTaste(userId, taste): Promise<void>` (same signatures, new column mapping). `getEmotionalVector`/`upsertEmotionalVector`/context-vector functions (lines 70-151) unchanged.

- [ ] **Step 1: Rewrite lines 14-68**

```ts
interface UserTasteRow {
  favorite_artists: string[];
  default_mood: string;
  discovery_style: string;
  languages: string[];
  language_openness: string;
  energy_preference: string;
  aesthetic_tags: string[];
  genre_scores: Record<string, number> | null;
  avoided_story_tags: string[];
  favorite_story_songs: string[];
  setup_complete: boolean;
}

const TASTE_COLUMNS =
  "favorite_artists, default_mood, discovery_style, languages, language_openness, " +
  "energy_preference, aesthetic_tags, genre_scores, avoided_story_tags, " +
  "favorite_story_songs, setup_complete";

export async function getUserTaste(userId: string): Promise<UserTaste | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select(TASTE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as UserTasteRow;
  return normalizeTaste({
    favoriteArtists: row.favorite_artists,
    defaultMood: row.default_mood,
    discoveryStyle: row.discovery_style,
    languages: row.languages,
    languageOpenness: row.language_openness,
    energyPreference: row.energy_preference,
    aestheticTags: row.aesthetic_tags ?? [],
    genreScores: row.genre_scores ?? {},
    avoidedStoryTags: row.avoided_story_tags ?? [],
    favoriteStorySongs: row.favorite_story_songs ?? [],
    setupComplete: row.setup_complete,
  });
}

export async function upsertUserTaste(userId: string, taste: UserTaste): Promise<void> {
  const normalized = normalizeTaste(taste);
  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    favorite_artists: normalized.favoriteArtists,
    default_mood: normalized.defaultMood,
    discovery_style: normalized.discoveryStyle,
    languages: normalized.languages,
    language_openness: normalized.languageOpenness,
    energy_preference: normalized.energyPreference,
    aesthetic_tags: normalized.aestheticTags,
    genre_scores: normalized.genreScores,
    avoided_story_tags: normalized.avoidedStoryTags,
    favorite_story_songs: normalized.favoriteStorySongs,
    setup_complete: normalized.setupComplete,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Manual verification**

Start dev server (`npm run dev`), then in another terminal (replace `<cookie>` with a real logged-in session cookie from the browser dev tools, or run this from the browser console while signed in):
```js
fetch("/api/taste", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ languages: ["Russian"], languageOpenness: "strict", genreScores: { "indie pop": 0.8 } }),
}).then(r => r.json()).then(console.log);
```
Expected: `200` response echoing back `{ languages: ["Russian"], languageOpenness: "strict", genreScores: { "indie pop": 0.8 }, ... }`. Then `GET /api/taste` should return the same values.

- [ ] **Step 3: Commit**

```bash
git add lib/db/userTaste.ts
git commit -m "feat: map new user_taste columns in getUserTaste/upsertUserTaste"
```

---

### Task 4: Wire real taste profile into `/api/recommend`

**Files:**
- Modify: `app/api/recommend/route.ts:42-91`

**Interfaces:**
- Consumes: `getEmotionalVector(userId)` (already exists, `lib/db/userTaste.ts`), `taste.languages`/`taste.languageOpenness`/`taste.genreScores`/`taste.avoidedStoryTags` from Task 2/3.
- Produces: same route contract (`POST /api/recommend` → `{ songs, totalCandidates, debugLog }`), now actually influenced by stored taste instead of a hardcoded neutral vector.

**Why:** today `tasteArr` is hardcoded to `VECTOR_KEYS.map(() => 0.5)` with a comment saying this exact task will fix it, and `genreScores`/`languages` are derived from fields being removed in Task 2. Skipping this task means Tasks 1-11 store real signal that never affects a single recommendation.

- [ ] **Step 1: Rewrite lines 1-11 (imports) and 32-91 (body)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getUserTaste, getEmotionalVector } from "../../../lib/db/userTaste";
import { getFeedback } from "../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile } from "../../../lib/tasteProfile";
import { searchCatalog } from "../../../lib/db/songs";
import { blendQueryVector } from "../../../lib/vectorMath";
import { buildRecommendations } from "../../../lib/recommend";
import { normalizeTaste } from "../../../lib/matching";
import type { EmotionalVector } from "../../../lib/emotionalVector";
import { VECTOR_KEYS, ZERO_VECTOR } from "../../../lib/emotionalVector";

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

    // Build final query vector
    const queryVector = blendQueryVector(photoVectorArray, tasteArr, vibeArr, vibeBoosts);

    // pgvector similarity search — 50 candidates
    const candidates = await searchCatalog(queryVector, 50);

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
        genreScores: taste.genreScores,
        likedArtists: taste.favoriteArtists,
        storyIntentTags,
        antiTags: [...antiTags, ...taste.avoidedStoryTags],
      },
      candidates
    );

    return NextResponse.json({
      songs: recommendations.slice(0, 12),
      totalCandidates: candidates.length,
      debugLog,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/recommend error:", message);
    return NextResponse.json({ error: "Recommendation failed", detail: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

With dev server running and signed in with a taste profile that has `languages: ["Russian"]`, `languageOpenness: "strict"` set (from Task 3's verification), upload a photo through the UI and check the terminal log for `[recommend] debug log:` — confirm every returned song's `language` is Russian or `Instrumental`, and none were removed with `removedReason: "language_mismatch"` for a Russian song.

- [ ] **Step 3: Commit**

```bash
git add app/api/recommend/route.ts
git commit -m "fix: wire stored taste vector and scores into /api/recommend instead of neutral placeholder"
```

---

### Task 5: Catalog text search (RPC + lib + API route)

**Files:**
- Modify: `supabase/songs-rpc.sql` (append)
- Modify: `lib/db/songs.ts` (append)
- Create: `app/api/song-search/route.ts`

**Interfaces:**
- Produces: `searchCatalogByText(query: string, limit?: number): Promise<SongSearchResult[]>` where `SongSearchResult = { id: string; title: string; artist: string }`. `GET /api/song-search?q=<text>` → `{ songs: SongSearchResult[] }`.

- [ ] **Step 1: Append the RPC to `supabase/songs-rpc.sql`**

```sql
-- Lightweight text search for onboarding's "recently posted story songs" autocomplete.
CREATE OR REPLACE FUNCTION public.search_catalog(
  p_query text,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id     uuid,
  title  text,
  artist text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, title, artist
  FROM public.songs
  WHERE title ILIKE '%' || p_query || '%' OR artist ILIKE '%' || p_query || '%'
  ORDER BY popularity_tier DESC, created_at DESC
  LIMIT p_limit;
$$;
```

- [ ] **Step 2: Run it in the catalog project's SQL Editor**

Paste and run in project `fmmpqmyzjmnzfbsgnegw` (the catalog project, not the main one). Expected: `CREATE FUNCTION` success.

- [ ] **Step 3: Append to `lib/db/songs.ts`**

```ts
export interface SongSearchResult {
  id: string;
  title: string;
  artist: string;
}

export async function searchCatalogByText(query: string, limit = 8): Promise<SongSearchResult[]> {
  const { data, error } = await supabase.rpc("search_catalog", {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw new Error(`searchCatalogByText failed: ${error.message}`);
  return (data ?? []) as SongSearchResult[];
}
```

- [ ] **Step 4: Create `app/api/song-search/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { searchCatalogByText } from "../../../lib/db/songs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ songs: [] });
  try {
    const songs = await searchCatalogByText(query, 8);
    return NextResponse.json({ songs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Manual verification**

With dev server running:
```bash
curl "http://localhost:3001/api/song-search?q=slowdive"
```
Expected: `200` with `{ "songs": [{ "id": "...", "title": "Sugar for the Pill", "artist": "Slowdive" }] }` (from the catalog seeded earlier this session).

- [ ] **Step 6: Commit**

```bash
git add supabase/songs-rpc.sql lib/db/songs.ts app/api/song-search/route.ts
git commit -m "feat: add catalog text search for onboarding song autocomplete"
```

---

### Task 6: `/api/taste/story-songs` — resolve "recently posted" songs

**Files:**
- Create: `app/api/taste/story-songs/route.ts`

**Interfaces:**
- Consumes: `autoTagSong` (`lib/autoTag.ts`), `insertSong` (`lib/db/songs.ts`), `getUserTaste`/`upsertUserTaste` (`lib/db/userTaste.ts`), `getEmotionalVector`/`upsertEmotionalVector` (`lib/db/userTaste.ts`), `addVectors`/`normalizeVector` (`lib/emotionalVector.ts`).
- Produces: `POST /api/taste/story-songs` — body `{ songs: Array<{ title: string; artist: string }> }` (max 3, extras ignored) → `{ resolved: Array<{ id: string; title: string; artist: string; artworkUrl: string | null }> }`.

**UX note (addresses the "3-10s blocking" concern raised earlier):** all songs are tagged in parallel via `Promise.all`, not sequentially — total time is roughly one GPT+iTunes+Last.fm round trip (~3-5s), not 3x that. The client (Task 11) must show an explicit loading state during this call, not a silent hang.

- [ ] **Step 1: Create the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { autoTagSong } from "../../../../lib/autoTag";
import { insertSong } from "../../../../lib/db/songs";
import { getUserTaste, upsertUserTaste, getEmotionalVector, upsertEmotionalVector } from "../../../../lib/db/userTaste";
import { addVectors, normalizeVector, ZERO_VECTOR } from "../../../../lib/emotionalVector";

export const runtime = "nodejs";

interface StorySongInput {
  title: string;
  artist: string;
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawSongs: StorySongInput[] = Array.isArray(body.songs) ? body.songs.slice(0, 3) : [];
  const songs = rawSongs.filter((s) => s?.title?.trim() && s?.artist?.trim());
  if (songs.length === 0) {
    return NextResponse.json({ resolved: [] });
  }

  // Resolve in parallel — do not make the user wait 3x a single tagging call.
  const settled = await Promise.allSettled(
    songs.map(async (song) => {
      const tagged = await autoTagSong(song.title, song.artist);
      const { id } = await insertSong(tagged);
      return { id, tagged };
    })
  );

  const resolved = settled
    .filter((r): r is PromiseFulfilledResult<{ id: string; tagged: Awaited<ReturnType<typeof autoTagSong>> }> => r.status === "fulfilled")
    .map((r) => r.value);

  if (resolved.length === 0) {
    return NextResponse.json({ resolved: [] });
  }

  // Fold resolved songs into the taste profile: strong weight (0.8 per song,
  // same magnitude as a "Perfect" feedback rating), positive genre scores.
  const [existingTaste, existingVector] = await Promise.all([
    getUserTaste(user.id).catch(() => null),
    getEmotionalVector(user.id).catch(() => null),
  ]);

  let vector = existingVector ?? { ...ZERO_VECTOR };
  const genreScores: Record<string, number> = { ...(existingTaste?.genreScores ?? {}) };
  const favoriteStorySongs = [...(existingTaste?.favoriteStorySongs ?? [])];

  for (const { id, tagged } of resolved) {
    vector = addVectors(vector, tagged.emotional_vector, 0.8);
    for (const genre of tagged.genre_tags) {
      genreScores[genre] = Math.min(1, (genreScores[genre] ?? 0) + 0.6);
    }
    if (!favoriteStorySongs.includes(id)) favoriteStorySongs.push(id);
  }

  await Promise.all([
    upsertEmotionalVector(user.id, normalizeVector(vector)),
    upsertUserTaste(user.id, {
      ...(existingTaste ?? {
        favoriteArtists: [], defaultMood: "", discoveryStyle: "balanced",
        languages: [], languageOpenness: "flexible", energyPreference: "depends",
        aestheticTags: [], avoidedStoryTags: [], setupComplete: false,
      }),
      genreScores,
      favoriteStorySongs,
    } as Parameters<typeof upsertUserTaste>[1]),
  ]);

  return NextResponse.json({
    resolved: resolved.map(({ id, tagged }) => ({
      id,
      title: tagged.title,
      artist: tagged.artist,
      artworkUrl: tagged.artwork_url,
    })),
  });
}
```

- [ ] **Step 2: Manual verification**

With dev server running and signed in:
```bash
curl -X POST http://localhost:3001/api/taste/story-songs \
  -H "Content-Type: application/json" \
  -b "<your session cookie>" \
  -d '{"songs":[{"title":"Sugar for the Pill","artist":"Slowdive"},{"title":"Apple","artist":"Charli xcx"}]}'
```
Expected: `200`, `{ "resolved": [{ "id": "...", "title": "Sugar for the Pill", ... }, { "id": "...", "title": "Apple", ... }] }`, response time under ~6 seconds (parallel, not ~10-12s serial). Then `GET /api/taste` should show `favoriteStorySongs` containing both new ids and non-empty `genreScores`.

- [ ] **Step 3: Commit**

```bash
git add app/api/taste/story-songs/route.ts
git commit -m "feat: resolve recently-posted story songs into catalog + taste profile"
```

---

### Task 7: Rewrite `/api/seed-tracks` to source from the real catalog

**Files:**
- Modify: `app/api/seed-tracks/route.ts` (full rewrite)

**Interfaces:**
- Consumes: `listSongs` (`lib/db/songs.ts`, catalog project).
- Produces: same route contract (`GET`/`POST` → `SeedSong[]` with `{ title, artist, genres, previewUrl, artwork, emotionalVector }`), now backed by the real ~283-song catalog instead of the hardcoded 60-track `SEED_POOL`, filtered by language and biased toward liked artists / recently-posted story songs when provided.

**Why:** the spec requires Step 5 swipe cards to come from "the catalog," filtered by language and biased toward artists/story songs — the current route is a disconnected hardcoded pool that shares no data with the actual recommendation catalog.

- [ ] **Step 1: Rewrite the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { listSongs } from "../../../lib/db/songs";
import type { EmotionalVector } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  previewUrl: string | null;
  artwork: string | null;
  emotionalVector?: EmotionalVector;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function resolveSongs(
  excludeTitles: string[],
  languages: string[],
  likedArtists: string[]
): Promise<SeedSong[]> {
  const excludeSet = new Set(excludeTitles.map((t) => t.toLowerCase()));
  const catalog = await listSongs(200, 0);
  const withPreview = catalog.filter(
    (s) => s.itunes_preview_url && !excludeSet.has(s.title.toLowerCase())
  );

  const normalizedLangs = languages.map((l) => l.toLowerCase());
  const matchesLanguage = (lang: string) =>
    normalizedLangs.length === 0 ||
    lang.toLowerCase() === "instrumental" ||
    normalizedLangs.some((l) => lang.toLowerCase().includes(l) || l.includes(lang.toLowerCase()));

  const preferred = withPreview.filter((s) => matchesLanguage(s.language));
  const rest = withPreview.filter((s) => !matchesLanguage(s.language));

  const isLikedArtist = (artist: string) =>
    likedArtists.some((a) => a.toLowerCase() === artist.toLowerCase());

  // Liked-artist songs first (within the language-filtered set), then the
  // rest of the language-filtered pool, then out-of-language fallback so
  // there's always something to show.
  const byArtist = [...preferred].sort(
    (a, b) => Number(isLikedArtist(b.artist)) - Number(isLikedArtist(a.artist))
  );
  const likedGroup = byArtist.filter((s) => isLikedArtist(s.artist));
  const restOfPreferred = shuffle(byArtist.filter((s) => !isLikedArtist(s.artist)));

  const ordered = [...likedGroup, ...restOfPreferred, ...shuffle(rest)];

  return ordered.slice(0, 10).map((s) => ({
    title: s.title,
    artist: s.artist,
    genres: s.genre_tags,
    previewUrl: s.itunes_preview_url,
    artwork: s.artwork_url,
    emotionalVector: s.emotional_vector ?? undefined,
  }));
}

export async function GET(req: NextRequest) {
  const language = req.nextUrl.searchParams.get("language") ?? "";
  const final = await resolveSongs([], language ? [language] : [], []);
  return NextResponse.json(final);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : [];
  const languages: string[] = Array.isArray(body.languages)
    ? body.languages
    : typeof body.language === "string" && body.language
    ? [body.language]
    : [];
  const likedArtists: string[] = Array.isArray(body.likedArtists) ? body.likedArtists : [];
  const final = await resolveSongs(exclude, languages, likedArtists);
  return NextResponse.json(final);
}
```

- [ ] **Step 2: Manual verification**

```bash
curl -X POST http://localhost:3001/api/seed-tracks \
  -H "Content-Type: application/json" \
  -d '{"exclude":[],"languages":["Russian"],"likedArtists":["Земфира"]}'
```
Expected: `200`, an array of up to 10 songs, with any Земфира tracks (already in the catalog from this session's seeding) appearing first, followed by other Russian-tagged catalog songs.

- [ ] **Step 3: Commit**

```bash
git add app/api/seed-tracks/route.ts
git commit -m "feat: source onboarding swipe pool from the real catalog, biased by language and liked artists"
```

---

### Task 8: `components/onboarding/LanguageStep.tsx` (Step 1)

**Files:**
- Create: `components/onboarding/LanguageStep.tsx`

**Interfaces:**
- Produces: `LanguageStep` component, props `{ languages: string[]; openness: "strict" | "flexible" | "open"; onChange: (languages: string[], openness: "strict" | "flexible" | "open") => void; onNext: () => void }`.

- [ ] **Step 1: Create the component**

```tsx
"use client";

const LANGUAGES = [
  "Russian", "English", "Korean", "Spanish", "Arabic", "French",
  "Turkish", "Uzbek", "Hindi", "Japanese",
];

const OPENNESS_OPTIONS: Array<{ value: "strict" | "flexible" | "open"; label: string }> = [
  { value: "strict", label: "Only what I selected" },
  { value: "flexible", label: "Mostly mine, sometimes others" },
  { value: "open", label: "Open to anything if the vibe fits" },
];

interface Props {
  languages: string[];
  openness: "strict" | "flexible" | "open";
  onChange: (languages: string[], openness: "strict" | "flexible" | "open") => void;
  onNext: () => void;
}

export default function LanguageStep({ languages, openness, onChange, onNext }: Props) {
  const toggleLanguage = (lang: string) => {
    const next = languages.includes(lang)
      ? languages.filter((l) => l !== lang)
      : [...languages, lang];
    onChange(next, openness);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">
          Which languages do you actually post/listen to in your stories?
        </h2>
        <p className="text-white/40 text-sm">Pick at least one.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => toggleLanguage(lang)}
            className={`px-3 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              languages.includes(lang)
                ? "bg-hot-pink border-hot-pink text-white"
                : "border-white/15 text-white/50 hover:border-white/30"
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      <div>
        <p className="text-white/60 text-sm font-semibold mb-3">How open are you to other languages?</p>
        <div className="space-y-2">
          {OPENNESS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(languages, opt.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                openness === opt.value
                  ? "bg-hot-pink/10 border-hot-pink text-white"
                  : "border-white/15 text-white/60 hover:border-white/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={languages.length === 0}
        className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
      >
        Next
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 12 (orchestrator) — this component has no standalone route to load yet.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/LanguageStep.tsx
git commit -m "feat: add onboarding LanguageStep component"
```

---

### Task 9: `components/onboarding/ArtistStep.tsx` (Step 2 + Quick Start)

**Files:**
- Create: `components/onboarding/ArtistStep.tsx`

**Interfaces:**
- Consumes: `GET /api/artist-search?q=` (existing route).
- Produces: `ArtistStep` component, props `{ selectedArtists: string[]; onChange: (artists: string[]) => void; onQuickStart: () => void; onContinue: () => void }`.

- [ ] **Step 1: Create the component**

```tsx
"use client";
import { useEffect, useState } from "react";

interface Props {
  selectedArtists: string[];
  onChange: (artists: string[]) => void;
  onQuickStart: () => void;
  onContinue: () => void;
}

export default function ArtistStep({ selectedArtists, onChange, onQuickStart, onContinue }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) { setSuggestions([]); return; }
      fetch(`/api/artist-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { artists: [] }))
        .then((d) => setSuggestions(d.artists ?? []))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addArtist = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selectedArtists.includes(trimmed)) return;
    onChange([...selectedArtists, trimmed]);
    setQuery("");
    setSuggestions([]);
  };

  const removeArtist = (name: string) => onChange(selectedArtists.filter((a) => a !== name));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">Artists you love</h2>
        <p className="text-white/40 text-sm">Name 2-3 — the more you add, the better we match.</p>
      </div>

      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedArtists.map((a) => (
            <button
              key={a}
              onClick={() => removeArtist(a)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-hot-pink text-white active:scale-95 transition-transform"
            >
              {a}
              <span className="text-white/70">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArtist(query); } }}
          placeholder="e.g. Земфира"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
          autoFocus
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#151515] border border-white/15 rounded-xl overflow-hidden shadow-lg z-10">
            {suggestions.map((a) => (
              <button
                key={a}
                onClick={() => addArtist(a)}
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-hot-pink/10 transition-colors"
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-white/30 text-xs">Can&apos;t find them? Type the name and press Enter.</p>

      <div className="space-y-3 pt-2">
        <button
          onClick={onContinue}
          disabled={selectedArtists.length === 0}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          Keep improving my matches →
        </button>
        <button
          onClick={onQuickStart}
          className="w-full py-3.5 rounded-xl border border-white/15 text-white/70 font-display font-bold text-base active:scale-95 transition-all"
        >
          Skip to upload →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 12.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/ArtistStep.tsx
git commit -m "feat: add onboarding ArtistStep component with Quick Start branch"
```

---

### Task 10: `components/onboarding/AvoidListStep.tsx` (Step 3)

**Files:**
- Create: `components/onboarding/AvoidListStep.tsx`

**Interfaces:**
- Produces: `AvoidListStep` component, props `{ selected: string[]; onChange: (selectedLabels: string[], genreScores: Record<string, number>, avoidedStoryTags: string[], discoveryStyle: "hidden-gems" | "niche" | "balanced" | "popular-ok" | null) => void; onNext: () => void; onBack: () => void }`. Exports `AVOID_OPTIONS` for reuse/testing.

- [ ] **Step 1: Create the component**

```tsx
"use client";

type AvoidTarget =
  | { type: "genre"; key: string }
  | { type: "storyTag"; tag: string }
  | { type: "discovery"; value: "niche" | "popular-ok" };

export const AVOID_OPTIONS: Array<{ label: string; target: AvoidTarget }> = [
  { label: "EDM", target: { type: "genre", key: "electronic" } },
  { label: "Rap", target: { type: "genre", key: "hip-hop" } },
  { label: "Mainstream pop", target: { type: "genre", key: "pop" } },
  { label: "Sad acoustic", target: { type: "storyTag", tag: "expensive sadness" } },
  { label: "Too dramatic", target: { type: "storyTag", tag: "cinematic soft flex" } },
  { label: "Too niche", target: { type: "discovery", value: "popular-ok" } },
  { label: "Too mainstream", target: { type: "discovery", value: "niche" } },
];

interface Props {
  selected: string[];
  onChange: (
    selectedLabels: string[],
    genreScores: Record<string, number>,
    avoidedStoryTags: string[],
    discoveryStyle: "niche" | "popular-ok" | null
  ) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function AvoidListStep({ selected, onChange, onNext, onBack }: Props) {
  const toggle = (label: string) => {
    const nextLabels = selected.includes(label)
      ? selected.filter((l) => l !== label)
      : [...selected, label];

    const genreScores: Record<string, number> = {};
    const avoidedStoryTags: string[] = [];
    let discoveryStyle: "niche" | "popular-ok" | null = null;

    for (const l of nextLabels) {
      const opt = AVOID_OPTIONS.find((o) => o.label === l);
      if (!opt) continue;
      if (opt.target.type === "genre") genreScores[opt.target.key] = -1;
      if (opt.target.type === "storyTag") avoidedStoryTags.push(opt.target.tag);
      if (opt.target.type === "discovery") discoveryStyle = opt.target.value;
    }

    onChange(nextLabels, genreScores, avoidedStoryTags, discoveryStyle);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">Anything to avoid?</h2>
        <p className="text-white/40 text-sm">Optional — no wrong answers.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {AVOID_OPTIONS.map(({ label }) => (
          <button
            key={label}
            onClick={() => toggle(label)}
            className={`px-3 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              selected.includes(label)
                ? "bg-white/15 border-white/40 text-white"
                : "border-white/15 text-white/50 hover:border-white/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3.5 rounded-xl border border-white/15 text-white/60 font-semibold text-sm">
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 12.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/AvoidListStep.tsx
git commit -m "feat: add onboarding AvoidListStep component"
```

---

### Task 11: `components/onboarding/StorySongsStep.tsx` (Step 4)

**Files:**
- Create: `components/onboarding/StorySongsStep.tsx`

**Interfaces:**
- Consumes: `GET /api/song-search?q=` (Task 5), `POST /api/taste/story-songs` (Task 6).
- Produces: `StorySongsStep` component, props `{ onNext: () => void; onBack: () => void; onSkip: () => void }`. Manages its own resolve-in-flight state; calls `onNext` once resolution completes (or immediately if skipped).

- [ ] **Step 1: Create the component**

```tsx
"use client";
import { useEffect, useState } from "react";

interface SongSuggestion {
  id: string;
  title: string;
  artist: string;
}

interface PickedSong {
  title: string;
  artist: string;
}

interface Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function StorySongsStep({ onNext, onBack, onSkip }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SongSuggestion[]>([]);
  const [picked, setPicked] = useState<PickedSong[]>([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) { setSuggestions([]); return; }
      fetch(`/api/song-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { songs: [] }))
        .then((d) => setSuggestions(d.songs ?? []))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addSong = (song: PickedSong) => {
    if (picked.length >= 3) return;
    if (picked.some((p) => p.title === song.title && p.artist === song.artist)) return;
    setPicked((prev) => [...prev, song]);
    setQuery("");
    setSuggestions([]);
  };

  const removeSong = (song: PickedSong) =>
    setPicked((prev) => prev.filter((p) => !(p.title === song.title && p.artist === song.artist)));

  const handleContinue = async () => {
    if (picked.length === 0) { onSkip(); return; }
    setResolving(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/story-songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: picked }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      onNext();
    } catch {
      setError("Couldn't save those songs — you can still continue.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">
          Which songs have you recently posted?
        </h2>
        <p className="text-white/40 text-sm">
          Add up to 3 songs you&apos;ve recently used in your Instagram or TikTok stories.
        </p>
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((s) => (
            <button
              key={`${s.title}-${s.artist}`}
              onClick={() => removeSong(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-hot-pink text-white active:scale-95 transition-transform"
            >
              {s.title} — {s.artist}
              <span className="text-white/70">×</span>
            </button>
          ))}
        </div>
      )}

      {picked.length < 3 && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a song..."
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#151515] border border-white/15 rounded-xl overflow-hidden shadow-lg z-10">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addSong({ title: s.title, artist: s.artist })}
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-hot-pink/10 transition-colors"
                >
                  {s.title} — {s.artist}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={resolving} className="px-6 py-3.5 rounded-xl border border-white/15 text-white/60 font-semibold text-sm disabled:opacity-40">
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={resolving}
          className="flex-1 py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-60"
        >
          {resolving ? "Finding these songs…" : picked.length > 0 ? "Continue" : "Skip"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 12.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/StorySongsStep.tsx
git commit -m "feat: add onboarding StorySongsStep with parallel resolution and loading state"
```

---

### Task 12: `components/OnboardingFlow.tsx` orchestrator

**Files:**
- Create: `components/OnboardingFlow.tsx`

**Interfaces:**
- Consumes: `LanguageStep`, `ArtistStep`, `AvoidListStep`, `StorySongsStep` (Tasks 8-11), `POST /api/taste` (existing route), `SongSwipeOnboarding` (Task 13's updated props).
- Produces: `OnboardingFlow` component, props `{ onComplete: (completed: boolean) => void }` — this is what `app/app/page.tsx` (Task 14) renders instead of `SongSwipeOnboarding` directly.

- [ ] **Step 1: Create the component**

```tsx
"use client";
import { useState } from "react";
import LanguageStep from "./onboarding/LanguageStep";
import ArtistStep from "./onboarding/ArtistStep";
import AvoidListStep from "./onboarding/AvoidListStep";
import StorySongsStep from "./onboarding/StorySongsStep";
import SongSwipeOnboarding from "./SongSwipeOnboarding";

type Step = "language" | "artists" | "avoid" | "story-songs" | "swipe" | "done";

interface Props {
  onComplete: (completed: boolean) => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("language");
  const [languages, setLanguages] = useState<string[]>([]);
  const [openness, setOpenness] = useState<"strict" | "flexible" | "open">("flexible");
  const [artists, setArtists] = useState<string[]>([]);
  const [avoidLabels, setAvoidLabels] = useState<string[]>([]);
  const [avoidGenreScores, setAvoidGenreScores] = useState<Record<string, number>>({});
  const [avoidedStoryTags, setAvoidedStoryTags] = useState<string[]>([]);
  const [avoidDiscoveryStyle, setAvoidDiscoveryStyle] = useState<
    "niche" | "popular-ok" | null
  >(null);

  // /api/taste and /api/taste/story-songs both do a full-row upsert (not a
  // merge) — Task 6's story-songs call may have already written genreScores/
  // favoriteStorySongs before this runs. Fetch current state first so this
  // write layers avoid-list scores on top instead of clobbering them.
  const persistTaste = async (setupComplete: boolean) => {
    const current = await fetch("/api/taste")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    await fetch("/api/taste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languages,
        languageOpenness: openness,
        favoriteArtists: artists,
        genreScores: { ...(current?.genreScores ?? {}), ...avoidGenreScores },
        avoidedStoryTags,
        favoriteStorySongs: current?.favoriteStorySongs ?? [],
        discoveryStyle: avoidDiscoveryStyle ?? "balanced",
        setupComplete,
      }),
    }).catch(() => {});
  };

  const handleQuickStart = async () => {
    await persistTaste(true);
    onComplete(true);
  };

  const finishToSwipe = async () => {
    await persistTaste(false);
    setStep("swipe");
  };

  if (step === "language") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Setup · 1 of 4</p>
        <LanguageStep
          languages={languages}
          openness={openness}
          onChange={(l, o) => { setLanguages(l); setOpenness(o); }}
          onNext={() => setStep("artists")}
        />
      </div>
    );
  }

  if (step === "artists") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Setup · 2 of 4</p>
        <ArtistStep
          selectedArtists={artists}
          onChange={setArtists}
          onQuickStart={handleQuickStart}
          onContinue={() => setStep("avoid")}
        />
      </div>
    );
  }

  if (step === "avoid") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Setup · 3 of 4</p>
        <AvoidListStep
          selected={avoidLabels}
          onChange={(labels, genreScores, storyTags, discoveryStyle) => {
            setAvoidLabels(labels);
            setAvoidGenreScores(genreScores);
            setAvoidedStoryTags(storyTags);
            setAvoidDiscoveryStyle(discoveryStyle);
          }}
          onNext={() => setStep("story-songs")}
          onBack={() => setStep("artists")}
        />
      </div>
    );
  }

  if (step === "story-songs") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">Setup · 4 of 4</p>
        <StorySongsStep
          onNext={finishToSwipe}
          onBack={() => setStep("avoid")}
          onSkip={finishToSwipe}
        />
      </div>
    );
  }

  // step === "swipe"
  return (
    <SongSwipeOnboarding
      languages={languages}
      likedArtists={artists}
      onComplete={(completed) => onComplete(completed)}
    />
  );
}
```

- [ ] **Step 2: Manual verification**

Deferred to Task 14 (once wired into `app/app/page.tsx`), which includes an explicit check that `favorite_story_songs`/`genre_scores` survive the later `finishToSwipe` write instead of being clobbered.

- [ ] **Step 3: Commit**

```bash
git add components/OnboardingFlow.tsx
git commit -m "feat: add OnboardingFlow orchestrator for the 5-step adaptive onboarding"
```

---

### Task 13: Slim down `components/SongSwipeOnboarding.tsx` to swipe-only

**Files:**
- Modify: `components/SongSwipeOnboarding.tsx`

**Interfaces:**
- Consumes: `POST /api/seed-tracks` with `{ exclude, languages, likedArtists }` (Task 7's new shape).
- Produces: `SongSwipeOnboarding` props change from `{ onComplete: (saved, skipped, prefs, completed) => void }` to `{ languages: string[]; likedArtists: string[]; onComplete: (completed: boolean) => void }` — prefs are no longer collected here, they arrive from `OnboardingFlow`.

- [ ] **Step 1: Remove the `"prefs"` phase and prefs state**

In `components/SongSwipeOnboarding.tsx`:
- Delete the `LANGUAGES`, `DISLIKES_OPTIONS` constants (lines 26-48) and the `OnboardingPrefs` interface (lines 17-20) — no longer owned here.
- Change the `Props` interface to:
```ts
interface Props {
  languages: string[];
  likedArtists: string[];
  onComplete: (completed: boolean) => void;
}
```
- Change the component signature and remove `prefs`/`setPrefs`/`toggleDislike`:
```ts
export default function SongSwipeOnboarding({ languages, likedArtists, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("swipe");
  // ...(songs, loading, index, saved, skipped, isPlaying, swiping, dnaVector, loadingMore, audioRef, swipingRef, x, rotate, likeOpacity, nopeOpacity unchanged)
```
- Update `type Phase` to drop `"prefs"`: `type Phase = "swipe" | "progress" | "dna";`
- Delete the entire `if (phase === "prefs") { ... }` block (lines 184-264 in the original).
- Add a `useEffect` that fires the initial fetch on mount (replacing the button-triggered fetch that used to live in the prefs screen):
```ts
useEffect(() => {
  setLoading(true);
  fetch("/api/seed-tracks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exclude: [], languages, likedArtists }),
  })
    .then((r) => r.json())
    .then((data) => {
      const loaded: SeedSong[] = Array.isArray(data) ? data : [];
      if (loaded.length === 0) {
        setDnaVector(buildTasteVector([], []));
        setPhase("dna");
      } else {
        setSongs(loaded);
      }
    })
    .catch(() => {
      setDnaVector(buildTasteVector([], []));
      setPhase("dna");
    })
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
- Update `loadMoreSongs` to pass `languages`/`likedArtists` instead of `prefs.languagePreference`:
```ts
const loadMoreSongs = useCallback(async () => {
  setLoadingMore(true);
  try {
    const exclude = songs.map((s) => s.title);
    const res = await fetch("/api/seed-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude, languages, likedArtists }),
    });
    const data: SeedSong[] = await res.json();
    const fresh = Array.isArray(data) ? data : [];
    if (fresh.length > 0) {
      setSongs((prev) => [...prev, ...fresh]);
      setPhase("swipe");
    } else {
      setPhase("dna");
    }
  } catch {
    setPhase("dna");
  } finally {
    setLoadingMore(false);
  }
}, [songs, languages, likedArtists]);
```
- Find the `"dna"` phase screen's final call-to-action button (the one that used to call the outer `onComplete(savedSeeds, skippedSeeds, prefs, true)`); change every `onComplete(saved, skipped, prefs, true/false)` call in the file to `onComplete(true)` (finished) or `onComplete(false)` (abandoned/no songs case), since prefs and swipe data are no longer bundled into this callback — swipe feedback persistence moves to Task 14's `handleAction` wiring... **actually keep `handleAction`'s `saved`/`skipped` local state exactly as-is** (still needed to build `dnaVector` via `buildTasteVector` and to POST to `/api/seed-feedback` before completing). Just drop `prefs` from the `/api/seed-feedback` POST body — that route (unchanged in this plan) already treats `prefs` as optional (`body.prefs ?? {}`), so omitting it is safe; the language/dislikes fields it used to set on `user_taste` are now already set by `OnboardingFlow` via `/api/taste`. Update the seed-feedback POST calls in the file to send `{ saved: savedSeeds, skipped: skippedSeeds }` without `prefs`, and update the final `onComplete` calls to the new one-argument signature.

- [ ] **Step 2: Manual verification**

Deferred to Task 14 (needs `OnboardingFlow` wired in to actually reach the swipe phase).

- [ ] **Step 3: Commit**

```bash
git add components/SongSwipeOnboarding.tsx
git commit -m "refactor: slim SongSwipeOnboarding to swipe-only, prefs now owned by OnboardingFlow"
```

---

### Task 14: Wire `OnboardingFlow` into `app/app/page.tsx`

**Files:**
- Modify: `app/app/page.tsx:1-501` (import line + the `SongSwipeOnboarding` usage block at lines 479-501)

**Interfaces:**
- Consumes: `OnboardingFlow` (Task 12).

- [ ] **Step 1: Replace the import**

Find:
```ts
import SongSwipeOnboarding, { SeedSong, OnboardingPrefs } from "../../components/SongSwipeOnboarding";
```
Replace with:
```ts
import OnboardingFlow from "../../components/OnboardingFlow";
```

- [ ] **Step 2: Replace the render block (lines 479-501)**

Find:
```tsx
{effectiveShowOnboarding && (
  <SongSwipeOnboarding
    onComplete={(savedSeeds: SeedSong[], skippedSeeds: SeedSong[], prefs: OnboardingPrefs, completed: boolean) => {
      setShowOnboarding(false);
      if (!completed) return; // skipped — show again next visit
      setCompletedThisSession(true); // prevent tasteComplete===false from re-showing
      localStorage.setItem("onboardingDone", "1");
      setLikedSeedTracks(savedSeeds.map((s) => ({ title: s.title, artist: s.artist })));
      setOnboardingPrefs(prefs);
      const payload = { saved: savedSeeds, skipped: skippedSeeds, prefs };
      localStorage.setItem("seedFeedback", JSON.stringify(payload));
      if (user?.id) {
        fetch("/api/seed-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(() => localStorage.removeItem("seedFeedback"))
          .catch(() => {});
      }
    }}
  />
)}
```
Replace with:
```tsx
{effectiveShowOnboarding && (
  <OnboardingFlow
    onComplete={(completed: boolean) => {
      setShowOnboarding(false);
      if (!completed) return; // abandoned — show again next visit
      setCompletedThisSession(true); // prevent tasteComplete===false from re-showing
      localStorage.setItem("onboardingDone", "1");
    }}
  />
)}
```

Note: `setLikedSeedTracks`/`setOnboardingPrefs` calls are removed here because the swipe phase (inside `SongSwipeOnboarding`, per Task 13) already POSTs its own saved/skipped feedback directly to `/api/seed-feedback`, and Step 1-4 taste already persisted via `OnboardingFlow`'s own `/api/taste` call — nothing left for the page component to relay. If `setLikedSeedTracks`/`setOnboardingPrefs` state setters become unused elsewhere in `page.tsx` after this change, leave their declarations in place (out of scope for this task) unless the TypeScript build reports them as errors (unused state setters don't error by default; unused imports do — remove the `SeedSong`/`OnboardingPrefs` type import as shown in Step 1).

- [ ] **Step 2: Manual verification (full flow)**

1. Clear `localStorage` (`localStorage.clear()` in browser console) and reload `/app` while signed in.
2. Confirm Step 1 (languages) shows, cannot proceed without selecting a language.
3. Pick a language, proceed to Step 2 (artists), add one artist, click "Skip to upload →".
4. Confirm onboarding closes and you land on the upload screen.
5. Run `curl http://localhost:3001/api/taste -H "Cookie: <session>"` (or check via browser fetch while signed in) — confirm `languages`/`languageOpenness`/`favoriteArtists` match what was picked, `setupComplete: true`.
6. Clear `localStorage` again, repeat, but this time click "Keep improving my matches →" through Steps 3 and 4 (add at least one story song), and confirm the swipe screen appears afterward with cards, and finishing swipes closes onboarding.
7. **Merge check (the Task 12 bug fix):** after step 6, `GET /api/taste` and confirm `favoriteStorySongs` still contains the id resolved by Step 4 AND `genreScores` contains both the story song's positive genre entries (from Task 6) and the avoid-list's negative entries (from Step 3) — neither write should have clobbered the other.

- [ ] **Step 3: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat: wire OnboardingFlow into app page, replacing direct SongSwipeOnboarding usage"
```

---

### Task 15: Delete confirmed dead code

**Files:**
- Delete: `components/TasteSetup.tsx`
- Delete: `components/SessionProvider.tsx`

**Interfaces:** none — both files have zero live importers (verified via repo-wide grep during planning; `TasteSetup` only appeared in docs and itself, `SessionProvider` only in the unused `app/layout.tsx`-absent import).

- [ ] **Step 1: Re-verify no importers before deleting (safety check against drift since planning)**

```bash
grep -rln "TasteSetup\|from.*SessionProvider\|from.*\"\./SessionProvider\"" --include="*.ts" --include="*.tsx" app components lib store 2>/dev/null
```
Expected: no output (or only the files being deleted themselves, if grep matches their own filenames).

- [ ] **Step 2: Delete both files**

```bash
git rm components/TasteSetup.tsx components/SessionProvider.tsx
```

- [ ] **Step 3: Build check**

```bash
npm run build
```
Expected: build succeeds with no "Module not found" errors referencing either deleted file.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove dead TasteSetup and SessionProvider components"
```

---

## Post-Plan Spec Coverage Check

- Step 1 (languages+openness, mandatory): Task 8, 12, 4 (consumed in recommend).
- Step 2 (artists + Quick Start): Task 9, 12.
- Step 3 (avoid-list → genre_scores/avoided_story_tags): Task 10, 2, 3, 4.
- Step 4 (recently-posted story songs → favorite_story_songs, resolved via autoTagSong): Task 6, 11.
- Step 5 (filtered swipes, catalog-sourced, biased): Task 7, 13.
- `user_taste` schema fields (`favorite_story_songs`, `avoided_story_tags`, `genre_scores` signed): Task 1, 2, 3.
- Stored taste vector actually affecting `/api/recommend`: Task 4.
- Feedback loop (4-tier + reason picker): **not covered by this plan** — the approved spec's Feedback Loop section (per-recommendation ❤️/👍/👎/✕ + reason picker) is a separate, independent piece of UI (lives on the results/swipe screen, not onboarding) with its own DB/scoring implications. Flagging as a follow-up plan, not silently included here to avoid scope creep beyond what was walked through in this conversation.
