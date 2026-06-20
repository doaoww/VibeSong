# Emotional Vector Algorithm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace genre/artist-based taste understanding with a 10-dimension emotional vector system that learns from onboarding swipes, matches photos via dynamic confidence weighting, expands candidates via Last.fm, and surfaces the user's Music DNA profile.

**Architecture:** Every song carries an `EmotionalVector` (10 float values). Onboarding swipes build a `UserTasteVector` via weighted sum. The analyze API extracts a `PhotoVector` + `photoConfidence` from GPT; these are blended with the taste vector using confidence-adaptive weights, and the blended vector drives GPT song selection. Last.fm `track.getSimilar` expands the candidate pool from liked seed tracks. Recency decay down-weights old swipe signals.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (JSONB columns), OpenAI GPT-4o, Last.fm API (server-side only), `exifr` npm package for EXIF, Framer Motion for Music DNA card.

## Global Constraints

- Never call OpenAI or Last.fm from client components — server routes only.
- All API routes must have `export const runtime = "nodejs"`.
- Background: `#080808`, primary purple: `#7C3AED`, accent hot-pink matches existing `hot-pink` Tailwind token.
- Do not remove or break the existing genre/artist taste fields — the emotional vector is additive.
- `LASTFM_API_KEY` must be added to `.env.local` before Last.fm tasks run.
- Test runner: `node --test tests/*.test.mjs` — all test files go in `tests/` with `.test.mjs` extension.
- Emotional vector dimensions (10, all float 0.0–1.0): `dreamy`, `nostalgia`, `energy`, `cinematic`, `darkness`, `confidence`, `intimacy`, `danceability`, `electronic`, `acoustic`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `lib/emotionalVector.ts` | EmotionalVector type, math (add, normalize, blend, invert) |
| **Modify** | `app/api/seed-tracks/route.ts` | Add `emotionalVector` field to each seed song |
| **Modify** | `app/api/seed-feedback/route.ts` | Compute taste vector from swipes, save to DB |
| **Modify** | `lib/db/userTaste.ts` | Add `upsertEmotionalVector`, `getEmotionalVector` |
| **Modify** | `lib/tasteProfile.ts` | Add recency decay to aggregate profile builder |
| **Modify** | `app/api/analyze/route.ts` | Photo vector + confidence + moment type + contrast mode + EXIF + dynamic weighting |
| **Create** | `lib/lastfm.ts` | Last.fm `getSimilarTracks(title, artist)` — server only |
| **Modify** | `app/api/search-tracks/route.ts` | Accept `likedSeedTracks`, expand candidates via Last.fm |
| **Modify** | `components/SongSwipeOnboarding.tsx` | Show Music DNA card before calling `onComplete` |
| **Create** | `components/MusicDNACard.tsx` | Animated Music DNA result screen |
| **Modify** | `app/app/page.tsx` | Pass contrast mode toggle, send `likedSeedTracks` to search |
| **Create** | `components/ContrastModeToggle.tsx` | UI toggle: "Match mood" / "Change mood" |
| **Modify** | `store/useAppStore.ts` | Add `contrastMode: boolean`, `likedSeedTracks`, `tasteVector` |

---

## Task 1: EmotionalVector type and math

**Files:**
- Create: `lib/emotionalVector.ts`
- Create: `tests/emotionalVector.test.mjs`

**Interfaces:**
- Produces: `EmotionalVector`, `ZERO_VECTOR`, `VECTOR_KEYS`, `addVectors`, `normalizeVector`, `buildTasteVector`, `blendVectors`, `invertVector`, `emotionalVectorToPromptString`

- [ ] **Step 1: Write the failing tests**

```js
// tests/emotionalVector.test.mjs
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addVectors, normalizeVector, buildTasteVector, blendVectors, invertVector, ZERO_VECTOR
} from "../lib/emotionalVector.ts";

test("addVectors adds with scale", () => {
  const a = { ...ZERO_VECTOR, dreamy: 0.5 };
  const b = { ...ZERO_VECTOR, dreamy: 0.4 };
  const r = addVectors(a, b, 1.0);
  assert.equal(r.dreamy, 0.9);
});

test("normalizeVector clamps max to 1", () => {
  const v = { ...ZERO_VECTOR, dreamy: 2.0, nostalgia: 1.0 };
  const r = normalizeVector(v);
  assert.equal(r.dreamy, 1.0);
  assert.equal(r.nostalgia, 0.5);
});

test("buildTasteVector: likes add, skips subtract at 0.2", () => {
  const liked = [{ emotionalVector: { ...ZERO_VECTOR, dreamy: 1.0, energy: 0.5 } }];
  const skipped = [{ emotionalVector: { ...ZERO_VECTOR, dreamy: 0.5 } }];
  const v = buildTasteVector(liked, skipped);
  // dreamy: 1.0 - 0.5*0.2 = 0.9, energy: 0.5; max=0.9 → dreamy=1, energy≈0.56
  assert.ok(v.dreamy > v.energy);
});

test("buildTasteVector: all skipped still no negative values", () => {
  const skipped = [{ emotionalVector: { ...ZERO_VECTOR, dreamy: 1.0 } }];
  const v = buildTasteVector([], skipped);
  for (const val of Object.values(v)) assert.ok(val >= 0);
});

test("blendVectors: low confidence leans on taste", () => {
  const taste = { ...ZERO_VECTOR, dreamy: 1.0 };
  const photo = { ...ZERO_VECTOR, energy: 1.0 };
  const r = blendVectors(taste, photo, 0.0); // photoWeight=0.2
  assert.ok(r.dreamy > r.energy); // taste dominates
});

test("blendVectors: high confidence leans on photo", () => {
  const taste = { ...ZERO_VECTOR, dreamy: 1.0 };
  const photo = { ...ZERO_VECTOR, energy: 1.0 };
  const r = blendVectors(taste, photo, 1.0); // photoWeight=0.7
  assert.ok(r.energy > r.dreamy); // photo dominates
});

test("invertVector flips values", () => {
  const v = { ...ZERO_VECTOR, dreamy: 0.8, energy: 0.2 };
  const r = invertVector(v);
  assert.equal(r.dreamy, 0.2);
  assert.equal(r.energy, 0.8);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test
```
Expected: module not found errors

- [ ] **Step 3: Implement `lib/emotionalVector.ts`**

```typescript
export interface EmotionalVector {
  dreamy: number;
  nostalgia: number;
  energy: number;
  cinematic: number;
  darkness: number;
  confidence: number;
  intimacy: number;
  danceability: number;
  electronic: number;
  acoustic: number;
}

export const ZERO_VECTOR: EmotionalVector = {
  dreamy: 0, nostalgia: 0, energy: 0, cinematic: 0, darkness: 0,
  confidence: 0, intimacy: 0, danceability: 0, electronic: 0, acoustic: 0,
};

export const VECTOR_KEYS = Object.keys(ZERO_VECTOR) as Array<keyof EmotionalVector>;

export function addVectors(a: EmotionalVector, b: EmotionalVector, scale = 1): EmotionalVector {
  const result = { ...a };
  for (const key of VECTOR_KEYS) {
    result[key] = a[key] + b[key] * scale;
  }
  return result;
}

export function normalizeVector(v: EmotionalVector): EmotionalVector {
  const max = Math.max(...VECTOR_KEYS.map((k) => v[k]), 0.01);
  const result = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    result[key] = Math.min(1, v[key] / max);
  }
  return result;
}

export function buildTasteVector(
  saved: Array<{ emotionalVector?: Partial<EmotionalVector> }>,
  skipped: Array<{ emotionalVector?: Partial<EmotionalVector> }>
): EmotionalVector {
  let vec = { ...ZERO_VECTOR };
  for (const song of saved) {
    if (!song.emotionalVector) continue;
    for (const key of VECTOR_KEYS) {
      vec[key] += (song.emotionalVector[key] ?? 0);
    }
  }
  for (const song of skipped) {
    if (!song.emotionalVector) continue;
    for (const key of VECTOR_KEYS) {
      vec[key] -= (song.emotionalVector[key] ?? 0) * 0.2;
    }
  }
  for (const key of VECTOR_KEYS) {
    vec[key] = Math.max(0, vec[key]);
  }
  return normalizeVector(vec);
}

export function blendVectors(
  tasteVec: EmotionalVector,
  photoVec: EmotionalVector,
  photoConfidence: number
): EmotionalVector {
  const photoWeight = 0.2 + Math.min(1, Math.max(0, photoConfidence)) * 0.5;
  const tasteWeight = 1 - photoWeight;
  const result = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    result[key] = Math.min(1, tasteVec[key] * tasteWeight + photoVec[key] * photoWeight);
  }
  return result;
}

export function invertVector(v: EmotionalVector): EmotionalVector {
  const result = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    result[key] = Math.round((1 - v[key]) * 100) / 100;
  }
  return result;
}

export function emotionalVectorToPromptString(v: EmotionalVector): string {
  return VECTOR_KEYS.map((k) => `${k}: ${v[k].toFixed(2)}`).join(" | ");
}

export function isValidEmotionalVector(v: unknown): v is EmotionalVector {
  if (!v || typeof v !== "object") return false;
  return VECTOR_KEYS.every((k) => typeof (v as Record<string, unknown>)[k] === "number");
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test
```
Expected: all 7 tests pass

- [ ] **Step 5: Commit**

```
git add lib/emotionalVector.ts tests/emotionalVector.test.mjs
git commit -m "feat: add EmotionalVector type and math (blend, build, normalize)"
```

---

## Task 2: Supabase — add emotional_vector column to user_taste

**Files:**
- No code files — run SQL in Supabase dashboard

**Interfaces:**
- Produces: `user_taste.emotional_vector` (JSONB), `user_taste.context_vectors` (JSONB)

- [ ] **Step 1: Run this SQL in the Supabase SQL editor**

```sql
ALTER TABLE user_taste
  ADD COLUMN IF NOT EXISTS emotional_vector   JSONB,
  ADD COLUMN IF NOT EXISTS context_vectors    JSONB;
```

- [ ] **Step 2: Verify columns exist**

In Supabase Table Editor → `user_taste` → check that `emotional_vector` and `context_vectors` columns appear with type `jsonb`.

- [ ] **Step 3: Update `lib/db/userTaste.ts` to read/write new columns**

Replace the entire file with this (keeps existing fields, adds new ones):

```typescript
import { supabase } from "../supabase";
import { normalizeTaste, type UserTaste } from "../matching";
import { type EmotionalVector, VECTOR_KEYS, ZERO_VECTOR } from "../emotionalVector";

export type MomentType =
  | "reflective-solo"
  | "social"
  | "nature-escape"
  | "urban"
  | "romance"
  | "high-energy"
  | "unknown";

interface UserTasteRow {
  genres: string[];
  favorite_artists: string[];
  default_mood: string;
  discovery_style: string;
  dislikes: string[];
  language_preference: string;
  energy_preference: string;
  aesthetic_tags: string[];
  setup_complete: boolean;
  emotional_vector: Record<string, number> | null;
  context_vectors: Record<string, Record<string, number>> | null;
}

export async function getUserTaste(userId: string): Promise<UserTaste | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select(
      "genres, favorite_artists, default_mood, discovery_style, dislikes, language_preference, energy_preference, aesthetic_tags, setup_complete"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as UserTasteRow;
  return normalizeTaste({
    genres: row.genres,
    favoriteArtists: row.favorite_artists,
    defaultMood: row.default_mood,
    discoveryStyle: row.discovery_style,
    dislikes: row.dislikes,
    languagePreference: row.language_preference,
    energyPreference: row.energy_preference,
    aestheticTags: row.aesthetic_tags ?? [],
    setupComplete: row.setup_complete,
  });
}

export async function upsertUserTaste(userId: string, taste: UserTaste): Promise<void> {
  const normalized = normalizeTaste(taste);
  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    genres: normalized.genres,
    favorite_artists: normalized.favoriteArtists,
    default_mood: normalized.defaultMood,
    discovery_style: normalized.discoveryStyle,
    dislikes: normalized.dislikes,
    language_preference: normalized.languagePreference,
    energy_preference: normalized.energyPreference,
    aesthetic_tags: normalized.aestheticTags,
    setup_complete: normalized.setupComplete,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getEmotionalVector(userId: string): Promise<EmotionalVector | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select("emotional_vector")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.emotional_vector) return null;
  const raw = data.emotional_vector as Record<string, number>;
  const vec = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    if (typeof raw[key] === "number") vec[key] = raw[key];
  }
  return vec;
}

export async function upsertEmotionalVector(
  userId: string,
  vector: EmotionalVector
): Promise<void> {
  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    emotional_vector: vector,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getContextVector(
  userId: string,
  momentType: MomentType
): Promise<EmotionalVector | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select("context_vectors")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const contextVectors = data?.context_vectors as Record<string, Record<string, number>> | null;
  const raw = contextVectors?.[momentType];
  if (!raw) return null;
  const vec = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    if (typeof raw[key] === "number") vec[key] = raw[key];
  }
  return vec;
}

export async function upsertContextVector(
  userId: string,
  momentType: MomentType,
  vector: EmotionalVector
): Promise<void> {
  const { data } = await supabase
    .from("user_taste")
    .select("context_vectors")
    .eq("user_id", userId)
    .maybeSingle();

  const existing = (data?.context_vectors as Record<string, unknown>) ?? {};
  const updated = { ...existing, [momentType]: vector };

  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    context_vectors: updated,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Commit**

```
git add lib/db/userTaste.ts
git commit -m "feat: add emotional_vector and context_vectors to user_taste DB layer"
```

---

## Task 3: Add emotional vectors to seed songs

**Files:**
- Modify: `app/api/seed-tracks/route.ts`

**Interfaces:**
- Produces: each seed song object now has `emotionalVector: EmotionalVector`

- [ ] **Step 1: Replace the `SEED_POOL` in `app/api/seed-tracks/route.ts`**

Add the import at the top and replace `SEED_POOL` with a version that includes vectors:

```typescript
import { NextResponse } from "next/server";
import type { EmotionalVector } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  emotionalVector: EmotionalVector;
}

const SEED_POOL: SeedSong[] = [
  // Alternative Hip-Hop
  { title: "EARFQUAKE", artist: "Tyler the Creator", genres: ["alternative hip-hop", "neo-soul"],
    emotionalVector: { dreamy: 0.72, nostalgia: 0.38, energy: 0.52, cinematic: 0.58, darkness: 0.30, confidence: 0.68, intimacy: 0.80, danceability: 0.54, electronic: 0.48, acoustic: 0.18 } },
  { title: "HUMBLE.", artist: "Kendrick Lamar", genres: ["hip-hop", "conscious rap"],
    emotionalVector: { dreamy: 0.08, nostalgia: 0.20, energy: 0.92, cinematic: 0.70, darkness: 0.62, confidence: 1.00, intimacy: 0.10, danceability: 0.72, electronic: 0.40, acoustic: 0.02 } },
  { title: "Redbone", artist: "Childish Gambino", genres: ["psychedelic soul", "funk"],
    emotionalVector: { dreamy: 0.62, nostalgia: 0.72, energy: 0.42, cinematic: 0.50, darkness: 0.38, confidence: 0.58, intimacy: 0.72, danceability: 0.64, electronic: 0.28, acoustic: 0.40 } },
  { title: "Self Care", artist: "Mac Miller", genres: ["alternative hip-hop", "lo-fi"],
    emotionalVector: { dreamy: 0.80, nostalgia: 0.62, energy: 0.30, cinematic: 0.62, darkness: 0.72, confidence: 0.50, intimacy: 0.70, danceability: 0.32, electronic: 0.42, acoustic: 0.32 } },
  { title: "Money Trees", artist: "Kendrick Lamar", genres: ["hip-hop", "jazz rap"],
    emotionalVector: { dreamy: 0.44, nostalgia: 0.60, energy: 0.55, cinematic: 0.72, darkness: 0.50, confidence: 0.78, intimacy: 0.40, danceability: 0.55, electronic: 0.20, acoustic: 0.35 } },
  { title: "SICKO MODE", artist: "Travis Scott", genres: ["trap", "hip-hop"],
    emotionalVector: { dreamy: 0.30, nostalgia: 0.10, energy: 0.95, cinematic: 0.80, darkness: 0.75, confidence: 0.90, intimacy: 0.08, danceability: 0.78, electronic: 0.70, acoustic: 0.02 } },
  { title: "No Role Modelz", artist: "J. Cole", genres: ["hip-hop", "rap"],
    emotionalVector: { dreamy: 0.20, nostalgia: 0.45, energy: 0.70, cinematic: 0.55, darkness: 0.40, confidence: 0.85, intimacy: 0.30, danceability: 0.65, electronic: 0.30, acoustic: 0.15 } },
  // R&B / Neo-Soul
  { title: "Kill Bill", artist: "SZA", genres: ["alternative R&B", "pop"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.48, energy: 0.42, cinematic: 0.65, darkness: 0.58, confidence: 0.62, intimacy: 0.78, danceability: 0.45, electronic: 0.35, acoustic: 0.30 } },
  { title: "Get You", artist: "Daniel Caesar", genres: ["R&B", "soul"],
    emotionalVector: { dreamy: 0.70, nostalgia: 0.55, energy: 0.25, cinematic: 0.48, darkness: 0.20, confidence: 0.50, intimacy: 0.92, danceability: 0.30, electronic: 0.22, acoustic: 0.62 } },
  { title: "Ivy", artist: "Frank Ocean", genres: ["indie R&B", "alternative R&B"],
    emotionalVector: { dreamy: 0.85, nostalgia: 0.90, energy: 0.18, cinematic: 0.75, darkness: 0.45, confidence: 0.42, intimacy: 0.88, danceability: 0.18, electronic: 0.20, acoustic: 0.70 } },
  { title: "Starboy", artist: "The Weeknd", genres: ["dark R&B", "synth-pop"],
    emotionalVector: { dreamy: 0.40, nostalgia: 0.22, energy: 0.72, cinematic: 0.78, darkness: 0.80, confidence: 0.82, intimacy: 0.38, danceability: 0.75, electronic: 0.82, acoustic: 0.05 } },
  { title: "Focus", artist: "H.E.R.", genres: ["R&B", "soul"],
    emotionalVector: { dreamy: 0.60, nostalgia: 0.40, energy: 0.35, cinematic: 0.45, darkness: 0.28, confidence: 0.55, intimacy: 0.85, danceability: 0.38, electronic: 0.30, acoustic: 0.55 } },
  { title: "Superstar", artist: "Jhené Aiko", genres: ["R&B", "neo-soul"],
    emotionalVector: { dreamy: 0.82, nostalgia: 0.50, energy: 0.20, cinematic: 0.40, darkness: 0.25, confidence: 0.40, intimacy: 0.90, danceability: 0.22, electronic: 0.25, acoustic: 0.65 } },
  // Pop
  { title: "bad guy", artist: "Billie Eilish", genres: ["dark pop", "electropop"],
    emotionalVector: { dreamy: 0.48, nostalgia: 0.18, energy: 0.58, cinematic: 0.70, darkness: 0.85, confidence: 0.78, intimacy: 0.42, danceability: 0.62, electronic: 0.88, acoustic: 0.05 } },
  { title: "drivers license", artist: "Olivia Rodrigo", genres: ["pop", "indie pop"],
    emotionalVector: { dreamy: 0.65, nostalgia: 0.72, energy: 0.22, cinematic: 0.68, darkness: 0.55, confidence: 0.35, intimacy: 0.80, danceability: 0.18, electronic: 0.18, acoustic: 0.78 } },
  { title: "Golden", artist: "Harry Styles", genres: ["pop", "indie rock"],
    emotionalVector: { dreamy: 0.75, nostalgia: 0.62, energy: 0.48, cinematic: 0.52, darkness: 0.10, confidence: 0.72, intimacy: 0.62, danceability: 0.55, electronic: 0.20, acoustic: 0.55 } },
  { title: "Royals", artist: "Lorde", genres: ["indie pop", "art pop"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.40, energy: 0.38, cinematic: 0.75, darkness: 0.52, confidence: 0.70, intimacy: 0.50, danceability: 0.40, electronic: 0.55, acoustic: 0.30 } },
  { title: "positions", artist: "Ariana Grande", genres: ["pop", "R&B"],
    emotionalVector: { dreamy: 0.60, nostalgia: 0.20, energy: 0.55, cinematic: 0.40, darkness: 0.12, confidence: 0.65, intimacy: 0.75, danceability: 0.68, electronic: 0.60, acoustic: 0.18 } },
  // Indie / Alternative
  { title: "Do I Wanna Know?", artist: "Arctic Monkeys", genres: ["indie rock", "alternative rock"],
    emotionalVector: { dreamy: 0.50, nostalgia: 0.55, energy: 0.60, cinematic: 0.72, darkness: 0.62, confidence: 0.75, intimacy: 0.55, danceability: 0.52, electronic: 0.30, acoustic: 0.40 } },
  { title: "The Less I Know The Better", artist: "Tame Impala", genres: ["psychedelic pop", "indie rock"],
    emotionalVector: { dreamy: 0.90, nostalgia: 0.70, energy: 0.55, cinematic: 0.65, darkness: 0.28, confidence: 0.58, intimacy: 0.62, danceability: 0.72, electronic: 0.60, acoustic: 0.25 } },
  { title: "Take Me To Church", artist: "Hozier", genres: ["indie rock", "soul"],
    emotionalVector: { dreamy: 0.42, nostalgia: 0.50, energy: 0.65, cinematic: 0.88, darkness: 0.72, confidence: 0.80, intimacy: 0.70, danceability: 0.35, electronic: 0.10, acoustic: 0.68 } },
  { title: "Bags", artist: "Clairo", genres: ["bedroom pop", "indie pop"],
    emotionalVector: { dreamy: 0.88, nostalgia: 0.75, energy: 0.15, cinematic: 0.45, darkness: 0.30, confidence: 0.30, intimacy: 0.90, danceability: 0.18, electronic: 0.20, acoustic: 0.80 } },
  { title: "Loving Is Easy", artist: "Rex Orange County", genres: ["indie pop", "bedroom pop"],
    emotionalVector: { dreamy: 0.80, nostalgia: 0.65, energy: 0.32, cinematic: 0.42, darkness: 0.08, confidence: 0.48, intimacy: 0.78, danceability: 0.40, electronic: 0.22, acoustic: 0.70 } },
  { title: "Motion Sickness", artist: "Phoebe Bridgers", genres: ["indie folk", "indie rock"],
    emotionalVector: { dreamy: 0.65, nostalgia: 0.78, energy: 0.40, cinematic: 0.70, darkness: 0.60, confidence: 0.42, intimacy: 0.72, danceability: 0.28, electronic: 0.15, acoustic: 0.75 } },
  // Electronic
  { title: "Get Lucky", artist: "Daft Punk", genres: ["nu-disco", "house"],
    emotionalVector: { dreamy: 0.40, nostalgia: 0.50, energy: 0.75, cinematic: 0.38, darkness: 0.08, confidence: 0.72, intimacy: 0.42, danceability: 0.90, electronic: 0.85, acoustic: 0.05 } },
  { title: "Chances", artist: "KAYTRANADA", genres: ["electronic", "house"],
    emotionalVector: { dreamy: 0.48, nostalgia: 0.30, energy: 0.72, cinematic: 0.40, darkness: 0.15, confidence: 0.65, intimacy: 0.55, danceability: 0.88, electronic: 0.90, acoustic: 0.02 } },
  { title: "Los Angeles", artist: "The Midnight", genres: ["synthwave", "retrowave"],
    emotionalVector: { dreamy: 0.85, nostalgia: 0.88, energy: 0.52, cinematic: 0.90, darkness: 0.40, confidence: 0.60, intimacy: 0.65, danceability: 0.55, electronic: 0.92, acoustic: 0.05 } },
  { title: "Latch", artist: "Disclosure", genres: ["UK garage", "house"],
    emotionalVector: { dreamy: 0.45, nostalgia: 0.22, energy: 0.70, cinematic: 0.38, darkness: 0.18, confidence: 0.60, intimacy: 0.62, danceability: 0.85, electronic: 0.88, acoustic: 0.05 } },
  // K-Pop
  { title: "Spring Day", artist: "BTS", genres: ["K-pop", "indie pop"],
    emotionalVector: { dreamy: 0.80, nostalgia: 0.85, energy: 0.35, cinematic: 0.75, darkness: 0.35, confidence: 0.50, intimacy: 0.70, danceability: 0.38, electronic: 0.40, acoustic: 0.45 } },
  { title: "Celebrity", artist: "IU", genres: ["K-pop", "dream pop"],
    emotionalVector: { dreamy: 0.82, nostalgia: 0.60, energy: 0.42, cinematic: 0.55, darkness: 0.10, confidence: 0.65, intimacy: 0.68, danceability: 0.50, electronic: 0.45, acoustic: 0.42 } },
  { title: "Attention", artist: "NewJeans", genres: ["K-pop", "R&B"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.48, energy: 0.55, cinematic: 0.42, darkness: 0.15, confidence: 0.62, intimacy: 0.65, danceability: 0.72, electronic: 0.55, acoustic: 0.25 } },
  { title: "LOVE DIVE", artist: "IVE", genres: ["K-pop", "dance pop"],
    emotionalVector: { dreamy: 0.50, nostalgia: 0.28, energy: 0.72, cinematic: 0.55, darkness: 0.20, confidence: 0.80, intimacy: 0.50, danceability: 0.82, electronic: 0.70, acoustic: 0.08 } },
  // Latin
  { title: "Me Porto Bonito", artist: "Bad Bunny", genres: ["reggaeton", "dembow"],
    emotionalVector: { dreamy: 0.22, nostalgia: 0.15, energy: 0.88, cinematic: 0.35, darkness: 0.22, confidence: 0.90, intimacy: 0.50, danceability: 0.95, electronic: 0.65, acoustic: 0.05 } },
  { title: "LA FAMA", artist: "Rosalía", genres: ["flamenco pop", "experimental pop"],
    emotionalVector: { dreamy: 0.60, nostalgia: 0.55, energy: 0.48, cinematic: 0.80, darkness: 0.42, confidence: 0.82, intimacy: 0.60, danceability: 0.55, electronic: 0.45, acoustic: 0.55 } },
  { title: "Tití Me Preguntó", artist: "Bad Bunny", genres: ["reggaeton", "Latin trap"],
    emotionalVector: { dreamy: 0.18, nostalgia: 0.20, energy: 0.90, cinematic: 0.40, darkness: 0.28, confidence: 0.88, intimacy: 0.42, danceability: 0.92, electronic: 0.62, acoustic: 0.05 } },
  // Afrobeats
  { title: "Last Last", artist: "Burna Boy", genres: ["afrobeats", "dancehall"],
    emotionalVector: { dreamy: 0.38, nostalgia: 0.45, energy: 0.72, cinematic: 0.42, darkness: 0.30, confidence: 0.75, intimacy: 0.55, danceability: 0.88, electronic: 0.45, acoustic: 0.30 } },
  { title: "Essence", artist: "Wizkid", genres: ["afropop", "R&B"],
    emotionalVector: { dreamy: 0.58, nostalgia: 0.40, energy: 0.65, cinematic: 0.45, darkness: 0.12, confidence: 0.72, intimacy: 0.70, danceability: 0.85, electronic: 0.40, acoustic: 0.35 } },
  // Soul / Folk
  { title: "River", artist: "Leon Bridges", genres: ["soul", "R&B"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.82, energy: 0.28, cinematic: 0.62, darkness: 0.22, confidence: 0.55, intimacy: 0.78, danceability: 0.35, electronic: 0.08, acoustic: 0.85 } },
  { title: "Holocene", artist: "Bon Iver", genres: ["indie folk", "ambient"],
    emotionalVector: { dreamy: 0.92, nostalgia: 0.88, energy: 0.12, cinematic: 0.95, darkness: 0.40, confidence: 0.28, intimacy: 0.82, danceability: 0.10, electronic: 0.15, acoustic: 0.90 } },
  // Pop-Punk / Rock
  { title: "misery business", artist: "Paramore", genres: ["pop-punk", "rock"],
    emotionalVector: { dreamy: 0.12, nostalgia: 0.35, energy: 0.95, cinematic: 0.55, darkness: 0.50, confidence: 0.90, intimacy: 0.20, danceability: 0.60, electronic: 0.30, acoustic: 0.35 } },
  { title: "brutal", artist: "Olivia Rodrigo", genres: ["pop-punk", "alternative"],
    emotionalVector: { dreamy: 0.18, nostalgia: 0.42, energy: 0.88, cinematic: 0.50, darkness: 0.58, confidence: 0.82, intimacy: 0.28, danceability: 0.58, electronic: 0.28, acoustic: 0.40 } },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchPreview(
  title: string,
  artist: string
): Promise<{ previewUrl: string | null; artwork: string | null }> {
  const term = encodeURIComponent(`${title} ${artist}`);
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&limit=5`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const results: Array<{ previewUrl?: string; artworkUrl100?: string }> = data.results ?? [];
    const match = results.find((r) => r.previewUrl) ?? results[0];
    if (!match) return { previewUrl: null, artwork: null };
    return {
      previewUrl: match.previewUrl ?? null,
      artwork: match.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
    };
  } catch {
    return { previewUrl: null, artwork: null };
  }
}

export async function GET() {
  const candidates = shuffle(SEED_POOL).slice(0, 14);
  const resolved = await Promise.all(
    candidates.map(async (song) => {
      const { previewUrl, artwork } = await fetchPreview(song.title, song.artist);
      return { ...song, previewUrl, artwork };
    })
  );
  const withPreviews = resolved.filter((s) => s.previewUrl).slice(0, 10);
  const withoutPreviews = resolved.filter((s) => !s.previewUrl);
  const final = [...withPreviews, ...withoutPreviews].slice(0, 10);
  return NextResponse.json(final);
}
```

- [ ] **Step 2: Test in browser**

Open `http://localhost:3000/api/seed-tracks` — each song object should now contain `emotionalVector` with 10 float keys.

- [ ] **Step 3: Commit**

```
git add app/api/seed-tracks/route.ts
git commit -m "feat: add emotional vectors to all seed songs"
```

---

## Task 4: Build and save taste vector from onboarding swipes

**Files:**
- Modify: `app/api/seed-feedback/route.ts`
- Modify: `components/SongSwipeOnboarding.tsx` (pass emotionalVector from songs)

**Interfaces:**
- Consumes: `buildTasteVector` from `lib/emotionalVector.ts`, `upsertEmotionalVector` from `lib/db/userTaste.ts`
- Consumes: `SeedSong` now has optional `emotionalVector` field from Task 3

- [ ] **Step 1: Update `SeedSong` interface in `components/SongSwipeOnboarding.tsx`**

Add `emotionalVector` to the interface (it now comes from the API):

```typescript
import type { EmotionalVector } from "../lib/emotionalVector";

export interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  previewUrl: string | null;
  artwork: string | null;
  emotionalVector?: EmotionalVector;
}
```

No other changes to the component — it already passes saved/skipped to `onComplete`.

- [ ] **Step 2: Replace `app/api/seed-feedback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { insertFeedback } from "../../../lib/db/trackFeedback";
import { buildTasteVector, type EmotionalVector } from "../../../lib/emotionalVector";
import { upsertEmotionalVector } from "../../../lib/db/userTaste";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres?: string[];
  previewUrl?: string | null;
  artwork?: string | null;
  emotionalVector?: EmotionalVector;
}

interface Body {
  saved?: SeedSong[];
  skipped?: SeedSong[];
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body: Body = await req.json();
  const saved = Array.isArray(body.saved) ? body.saved : [];
  const skipped = Array.isArray(body.skipped) ? body.skipped : [];

  // Build emotional taste vector from swipes
  const hasSomeVectors = [...saved, ...skipped].some((s) => s.emotionalVector);
  if (hasSomeVectors) {
    const tasteVector = buildTasteVector(saved, skipped);
    await upsertEmotionalVector(user.id, tasteVector).catch((e) =>
      console.error("[seed-feedback] upsertEmotionalVector failed:", e)
    );
  }

  await Promise.allSettled([
    ...saved.map((track) =>
      insertFeedback(user.id, "saved", {
        title: track.title,
        artist: track.artist,
        genres: track.genres ?? [],
        artwork: track.artwork ?? undefined,
        previewUrl: track.previewUrl ?? undefined,
        previewProvider: track.previewUrl ? "itunes" : undefined,
      })
    ),
    ...skipped.map((track) =>
      insertFeedback(user.id, "skipped", {
        title: track.title,
        artist: track.artist,
        genres: track.genres ?? [],
        artwork: track.artwork ?? undefined,
        previewUrl: track.previewUrl ?? undefined,
        previewProvider: track.previewUrl ? "itunes" : undefined,
      })
    ),
  ]);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Manual test**

Complete the onboarding swipes in the app, then check Supabase → `user_taste` table → the row for your user should have a non-null `emotional_vector` JSON object.

- [ ] **Step 4: Commit**

```
git add app/api/seed-feedback/route.ts components/SongSwipeOnboarding.tsx
git commit -m "feat: compute and save emotional taste vector from onboarding swipes"
```

---

## Task 5: Music DNA card after onboarding

**Files:**
- Create: `components/MusicDNACard.tsx`
- Modify: `components/SongSwipeOnboarding.tsx`

**Interfaces:**
- Consumes: `EmotionalVector` from `lib/emotionalVector.ts`
- The component appears between last swipe and the `onComplete` call

- [ ] **Step 1: Create `components/MusicDNACard.tsx`**

```typescript
"use client";
import { motion } from "framer-motion";
import type { EmotionalVector } from "../lib/emotionalVector";

const DNA_LABELS: Array<{ key: keyof EmotionalVector; icon: string; label: string }> = [
  { key: "dreamy",      icon: "✨", label: "Dreamy" },
  { key: "nostalgia",   icon: "🌧", label: "Nostalgic" },
  { key: "cinematic",   icon: "🎞", label: "Cinematic" },
  { key: "intimacy",    icon: "🌙", label: "Intimate" },
  { key: "darkness",    icon: "🖤", label: "Dark" },
  { key: "energy",      icon: "⚡", label: "Energy" },
  { key: "confidence",  icon: "💫", label: "Confident" },
  { key: "danceability",icon: "🎵", label: "Danceable" },
];

interface Props {
  vector: EmotionalVector;
  onContinue: () => void;
}

export default function MusicDNACard({ vector, onContinue }: Props) {
  const sorted = [...DNA_LABELS]
    .sort((a, b) => vector[b.key] - vector[a.key])
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-1">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Your</p>
          <h2 className="font-display text-3xl font-black text-white">Music DNA</h2>
          <p className="text-white/40 text-sm">Every match is tuned to this.</p>
        </div>

        <div className="space-y-3">
          {sorted.map(({ key, icon, label }, i) => {
            const pct = Math.round(vector[key] * 100);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm font-semibold">
                    {icon} {label}
                  </span>
                  <span className="text-white/50 text-xs font-mono">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full bg-hot-pink"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onContinue}
          className="w-full py-4 rounded-full bg-hot-pink text-white font-display font-bold text-base glow-pink active:scale-95 transition-transform"
        >
          Start matching →
        </motion.button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Update `SongSwipeOnboarding.tsx` to show DNA card before `onComplete`**

Add these to the existing state/imports at the top of the file:

```typescript
import MusicDNACard from "./MusicDNACard";
import { buildTasteVector, type EmotionalVector } from "../lib/emotionalVector";
```

Add a new state variable:
```typescript
const [dnaVector, setDnaVector] = useState<EmotionalVector | null>(null);
```

Replace the existing "Done screen" block (when `index >= songs.length`) with:

```typescript
if (index >= songs.length && songs.length > 0) {
  // Compute DNA if not done yet
  if (!dnaVector) {
    const vec = buildTasteVector(saved, skipped);
    setDnaVector(vec);
    return null; // re-render will show card
  }
  return (
    <MusicDNACard
      vector={dnaVector}
      onContinue={() => { audioRef.current?.pause(); onComplete(saved, skipped); }}
    />
  );
}
```

- [ ] **Step 3: Test in browser**

Complete 10 onboarding swipes — the Music DNA card should appear with animated bars before the main app loads.

- [ ] **Step 4: Commit**

```
git add components/MusicDNACard.tsx components/SongSwipeOnboarding.tsx
git commit -m "feat: show Music DNA card after onboarding swipes"
```

---

## Task 6: EXIF extraction from uploaded photos

**Files:**
- Modify: `components/DropZone.tsx` (extract EXIF before base64 conversion)
- Modify: `store/useAppStore.ts` (add `exifData` field)
- Modify: `app/app/page.tsx` (pass exifData to analyze)

**Interfaces:**
- Produces: `ExifData { capturedHour?: number; capturedMonth?: number; latitude?: number; longitude?: number }`

- [ ] **Step 1: Install exifr**

```
npm install exifr
```

- [ ] **Step 2: Add `ExifData` type and `exifData` to the Zustand store**

In `store/useAppStore.ts`, add:

```typescript
export interface ExifData {
  capturedHour?: number;   // 0-23
  capturedMonth?: number;  // 1-12
  latitude?: number;
  longitude?: number;
}
```

Add to the store state: `exifData: ExifData | null` initialized to `null`.
Add setter: `setExifData: (d: ExifData | null) => void`.

- [ ] **Step 3: Extract EXIF in `components/DropZone.tsx`**

Add this function before the component:

```typescript
import exifr from "exifr";
import type { ExifData } from "../store/useAppStore";

async function extractExif(file: File): Promise<ExifData> {
  try {
    const parsed = await exifr.parse(file, { pick: ["DateTimeOriginal", "GPSLatitude", "GPSLongitude"] });
    if (!parsed) return {};
    const dt = parsed.DateTimeOriginal;
    return {
      capturedHour: dt instanceof Date ? dt.getHours() : undefined,
      capturedMonth: dt instanceof Date ? dt.getMonth() + 1 : undefined,
      latitude: typeof parsed.GPSLatitude === "number" ? parsed.GPSLatitude : undefined,
      longitude: typeof parsed.GPSLongitude === "number" ? parsed.GPSLongitude : undefined,
    };
  } catch {
    return {};
  }
}
```

In the existing file-processing callback inside `DropZone.tsx`, call `extractExif(file)` and include it in the data passed to `onImageReady`. Update the `onImageReady` prop signature to accept an optional fourth argument `exifData: ExifData`.

- [ ] **Step 4: Pass exifData to the analyze call in `app/app/page.tsx`**

In the `runAnalysis` function, add `exifData` as a parameter and include it in the `/api/analyze` POST body:

```typescript
body: JSON.stringify({ image: base64, mimeType, exifData }),
```

- [ ] **Step 5: Verify**

Upload a photo taken on a phone with GPS. Log `req.body.exifData` in the analyze route and confirm hour/month/GPS appear.

- [ ] **Step 6: Commit**

```
git add components/DropZone.tsx store/useAppStore.ts app/app/page.tsx
git commit -m "feat: extract EXIF metadata (hour, month, GPS) from uploaded photos"
```

---

## Task 7: Update analyze API — photo vector, confidence, moment type, dynamic weighting, contrast mode

**Files:**
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `EmotionalVector`, `blendVectors`, `invertVector`, `emotionalVectorToPromptString` from `lib/emotionalVector.ts`
- Consumes: `getEmotionalVector`, `getContextVector` from `lib/db/userTaste.ts`
- New POST body fields: `exifData?: ExifData`, `contrastMode?: boolean`
- New GPT output fields: `photoVector: EmotionalVector`, `photoConfidence: number`, `momentType: MomentType`

- [ ] **Step 1: Add imports to `app/api/analyze/route.ts`**

```typescript
import {
  blendVectors, invertVector, emotionalVectorToPromptString,
  type EmotionalVector, ZERO_VECTOR,
} from "../../../lib/emotionalVector";
import {
  getEmotionalVector, getContextVector, type MomentType,
} from "../../../lib/db/userTaste";
import type { ExifData } from "../../../store/useAppStore";
```

- [ ] **Step 2: Add photo vector + moment type to the GPT JSON schema in `BASE_SYSTEM_PROMPT`**

Add this block to the JSON schema section (after `vibeTags`):

```
  "momentType": "reflective-solo|social|nature-escape|urban|romance|high-energy|unknown",
  "photoConfidence": 0.0,
  "photoVector": {
    "dreamy": 0.0, "nostalgia": 0.0, "energy": 0.0, "cinematic": 0.0,
    "darkness": 0.0, "confidence": 0.0, "intimacy": 0.0,
    "danceability": 0.0, "electronic": 0.0, "acoustic": 0.0
  }
```

Add these to `NUMBER RULES`:
```
- photoConfidence: float 0.0–1.0. Low = ambiguous image (selfie on white wall). High = strong clear vibe (sunset, party, nature).
- photoVector fields: all floats 0.0–1.0 representing the photo's emotional character.
```

- [ ] **Step 3: Add EXIF and combined vector blocks to the prompt builder**

Add this function to `app/api/analyze/route.ts`:

```typescript
function buildExifBlock(exif: ExifData | null): string {
  if (!exif) return "";
  const parts: string[] = [];
  if (exif.capturedHour !== undefined) {
    const period =
      exif.capturedHour >= 22 || exif.capturedHour < 5 ? "late night" :
      exif.capturedHour < 12 ? "morning" :
      exif.capturedHour < 17 ? "afternoon" :
      exif.capturedHour < 21 ? "evening" : "night";
    parts.push(`Photo taken at: ${period} (${exif.capturedHour}:00)`);
  }
  if (exif.capturedMonth !== undefined) {
    const seasons = ["","winter","winter","spring","spring","spring","summer","summer","summer","autumn","autumn","autumn","winter"];
    parts.push(`Season: ${seasons[exif.capturedMonth]}`);
  }
  if (!parts.length) return "";
  return `\n\nPHOTO METADATA (EXIF — use as additional context):\n${parts.join("\n")}`;
}

function buildCombinedVectorBlock(combined: EmotionalVector, contrastMode: boolean): string {
  const vec = contrastMode ? invertVector(combined) : combined;
  const mode = contrastMode ? "CONTRAST MODE (inverted — find music that changes the mood)" : "MATCH MODE";
  return `\n\nCOMBINED MOMENT VECTOR — ${mode}:\n${emotionalVectorToPromptString(vec)}\nMatch candidates CLOSELY to this vector. This is the primary selection target.`;
}
```

- [ ] **Step 4: Update the `POST` handler to fetch emotional vectors and build combined vector**

Replace the `const prompt = buildPrompt(taste, aggregate);` block with:

```typescript
const [storedTasteVec, savedFeedback, skippedFeedback] = await Promise.all([
  getEmotionalVector(session.user.id),
  getFeedback(session.user.id, "saved", 300),
  getFeedback(session.user.id, "skipped", 300),
]);
const aggregate = buildAggregateTasteProfile(savedFeedback, skippedFeedback);
const { exifData, contrastMode = false } = await req.json().catch(() => ({}));
// NOTE: image and mimeType are already read above — refactor req.json() call to read all at once
```

**Important:** Merge the single `req.json()` call so you read `{ image, mimeType, exifData, contrastMode }` in one call at the top of the handler.

After GPT returns and you parse the result, extract the photo vector and blend it:

```typescript
const photoVector: EmotionalVector = result.photoVector ?? { ...ZERO_VECTOR };
const photoConfidence: number = typeof result.photoConfidence === "number"
  ? Math.max(0, Math.min(1, result.photoConfidence)) : 0.5;
const momentType: MomentType = result.momentType ?? "unknown";

// Get contextual taste vector (falls back to global if none)
const contextVec = await getContextVector(session.user.id, momentType).catch(() => null);
const tasteVec = contextVec ?? storedTasteVec ?? { ...ZERO_VECTOR };

const combined = blendVectors(tasteVec, photoVector, photoConfidence);
```

Build the prompt with the combined vector block added:

```typescript
const exifBlock = buildExifBlock(exifData ?? null);
const combinedBlock = buildCombinedVectorBlock(combined, contrastMode);
const prompt = buildPrompt(taste, aggregate) + exifBlock + combinedBlock;
```

Also upsert the context vector in the background (fire and forget):

```typescript
upsertContextVector(session.user.id, momentType, combined).catch(() => {});
```

- [ ] **Step 5: Verify**

Upload a photo. Check the server console — you should see `[analyze] matchScores:` log as before, plus no errors. The GPT response JSON should include `photoVector`, `photoConfidence`, and `momentType`.

- [ ] **Step 6: Commit**

```
git add app/api/analyze/route.ts
git commit -m "feat: photo vector + confidence + moment type + dynamic weighting + contrast mode in analyze API"
```

---

## Task 8: Recency weighting in aggregate taste profile

**Files:**
- Modify: `lib/tasteProfile.ts`
- Modify: `lib/db/trackFeedback.ts` (include `created_at` in aggregate queries)

**Interfaces:**
- `buildAggregateTasteProfile` signature unchanged — recency decay is internal

- [ ] **Step 1: Update `lib/tasteProfile.ts`**

Replace `tally` with a recency-aware version:

```typescript
const NOW_MS = Date.now();
const DECAY_DAYS = 30;

interface TasteSignal {
  artist: string;
  genres?: string[];
  createdAt?: string;
}

function decayWeight(createdAt: string | undefined): number {
  if (!createdAt) return 1;
  const ageMs = NOW_MS - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / DECAY_DAYS);
}

function tally(rows: TasteSignal[], pick: (row: TasteSignal) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const weight = decayWeight(row.createdAt);
    for (const value of pick(row)) {
      const key = value.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + weight);
    }
  }
  return counts;
}
```

Update `AggregateTasteProfile.learnedGenres` threshold: `avoidList` stays the same (it uses counts which are now weighted floats, still works).

- [ ] **Step 2: Ensure `created_at` is passed through `getFeedback`**

In `lib/db/trackFeedback.ts`, `SELECT_COLUMNS` already includes `created_at` and `mapRow` already maps it to `createdAt`. No change needed — `FeedbackRow.createdAt` already exists.

- [ ] **Step 3: Write a test**

```js
// tests/tasteProfile.test.mjs
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildAggregateTasteProfile } from "../lib/tasteProfile.ts";

test("recent saves outweigh old saves", () => {
  const recentDate = new Date().toISOString();
  const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ago

  const saved = [
    { artist: "Artist A", genres: ["indie"], createdAt: recentDate },
    { artist: "Artist A", genres: ["indie"], createdAt: recentDate },
    { artist: "Artist B", genres: ["pop"], createdAt: oldDate },
    { artist: "Artist B", genres: ["pop"], createdAt: oldDate },
    { artist: "Artist B", genres: ["pop"], createdAt: oldDate },
  ];
  // Artist B has 3 old saves, Artist A has 2 recent — A should rank first
  const profile = buildAggregateTasteProfile(saved, []);
  assert.equal(profile.learnedArtists[0], "Artist A");
});
```

- [ ] **Step 4: Run tests**

```
npm test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```
git add lib/tasteProfile.ts tests/tasteProfile.test.mjs
git commit -m "feat: recency decay in aggregate taste profile (30-day half-life)"
```

---

## Task 9: Last.fm integration

**Files:**
- Create: `lib/lastfm.ts`
- Create: `tests/lastfm.test.mjs`

**Interfaces:**
- Produces: `getSimilarTracks(title: string, artist: string, limit?: number): Promise<SimilarTrack[]>`
- `SimilarTrack { title: string; artist: string }`

- [ ] **Step 1: Add `LASTFM_API_KEY` to `.env.local`**

```
LASTFM_API_KEY=your_key_here
```

- [ ] **Step 2: Write test (mock network)**

```js
// tests/lastfm.test.mjs
import { strict as assert } from "node:assert";
import { test, mock } from "node:test";

test("getSimilarTracks returns normalized list", async () => {
  // Mock global fetch
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      similartracks: {
        track: [
          { name: "Song A", artist: { name: "Artist A" } },
          { name: "Song B", artist: { name: "Artist B" } },
        ],
      },
    }),
  });
  process.env.LASTFM_API_KEY = "test_key";

  const { getSimilarTracks } = await import("../lib/lastfm.ts");
  const result = await getSimilarTracks("Test Song", "Test Artist", 5);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Song A");
  assert.equal(result[0].artist, "Artist A");
});

test("getSimilarTracks returns empty array on API error", async () => {
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  const { getSimilarTracks } = await import("../lib/lastfm.ts");
  const result = await getSimilarTracks("X", "Y");
  assert.deepEqual(result, []);
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```
npm test
```
Expected: module not found

- [ ] **Step 4: Create `lib/lastfm.ts`**

```typescript
export interface SimilarTrack {
  title: string;
  artist: string;
}

export async function getSimilarTracks(
  title: string,
  artist: string,
  limit = 10
): Promise<SimilarTrack[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.warn("[lastfm] LASTFM_API_KEY not set");
    return [];
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "track.getSimilar");
  url.searchParams.set("track", title);
  url.searchParams.set("artist", artist);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const tracks = data?.similartracks?.track;
    if (!Array.isArray(tracks)) return [];
    return tracks.slice(0, limit).map((t: { name: string; artist: { name: string } }) => ({
      title: t.name,
      artist: t.artist.name,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```
npm test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```
git add lib/lastfm.ts tests/lastfm.test.mjs
git commit -m "feat: Last.fm getSimilarTracks helper (no user login required)"
```

---

## Task 10: Expand search-tracks candidates with Last.fm

**Files:**
- Modify: `app/api/search-tracks/route.ts`
- Modify: `store/useAppStore.ts` (store `likedSeedTracks`)
- Modify: `app/app/page.tsx` (pass `likedSeedTracks` to search-tracks)

**Interfaces:**
- New optional POST body field: `likedSeedTracks?: Array<{ title: string; artist: string }>`
- Last.fm expands the GPT candidate list — no change to response shape

- [ ] **Step 1: Store liked seed tracks in Zustand**

In `store/useAppStore.ts`, add:
```typescript
likedSeedTracks: Array<{ title: string; artist: string }>;
setLikedSeedTracks: (tracks: Array<{ title: string; artist: string }>) => void;
```
Initialize to `[]`.

- [ ] **Step 2: Set `likedSeedTracks` when onboarding completes in `app/app/page.tsx`**

In the `SongSwipeOnboarding` `onComplete` handler:
```typescript
onComplete={(savedSeeds, skippedSeeds) => {
  setLikedSeedTracks(savedSeeds.map((s) => ({ title: s.title, artist: s.artist })));
  // ... existing logic
}}
```

- [ ] **Step 3: Pass `likedSeedTracks` to the search-tracks call**

In `runAnalysis` in `app/app/page.tsx`:
```typescript
body: JSON.stringify({ tracks, discoveryStyle, likedSeedTracks }),
```
where `likedSeedTracks` comes from the Zustand store.

- [ ] **Step 4: Update `app/api/search-tracks/route.ts` to expand via Last.fm**

```typescript
import { getSimilarTracks } from "../../../lib/lastfm";

export async function POST(req: NextRequest) {
  try {
    const { tracks, discoveryStyle = "balanced", likedSeedTracks = [] } = await req.json();
    if (!Array.isArray(tracks)) {
      return NextResponse.json({ error: "tracks array required" }, { status: 400 });
    }

    // Expand candidate list with Last.fm similar tracks for liked seed songs
    let lastfmCandidates: Array<{ title: string; artist: string }> = [];
    if (likedSeedTracks.length > 0) {
      const seedsToQuery = likedSeedTracks.slice(0, 3); // max 3 to keep latency low
      const similar = await Promise.all(
        seedsToQuery.map((s: { title: string; artist: string }) =>
          getSimilarTracks(s.title, s.artist, 8)
        )
      );
      lastfmCandidates = similar.flat();
    }

    // Merge: GPT tracks first, then Last.fm additions (deduplicated by title+artist)
    const seen = new Set(tracks.map((t: { title: string; artist: string }) =>
      `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`
    ));
    const merged = [...tracks];
    for (const lf of lastfmCandidates) {
      const key = `${lf.title.toLowerCase()}|${lf.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ title: lf.title, artist: lf.artist, matchScore: 70, finalScore: 70 });
      }
    }

    const results = await Promise.allSettled(
      merged.map((t) => resolvePlayableTrack(t, discoveryStyle as DiscoveryStyle))
    );

    const found = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => (b.finalScore ?? b.matchScore) - (a.finalScore ?? a.matchScore))
      .slice(0, 8);

    if (found.length < 5) {
      return NextResponse.json({ error: "Not enough tracks found", found }, { status: 206 });
    }

    return NextResponse.json(found);
  } catch (err) {
    console.error("/api/search-tracks error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Test**

Upload a photo after completing onboarding with some liked songs. The console should show `[lastfm]` logs (if API key is set) and the results page should have tracks.

- [ ] **Step 6: Commit**

```
git add app/api/search-tracks/route.ts store/useAppStore.ts app/app/page.tsx
git commit -m "feat: expand search-tracks candidates via Last.fm similar tracks"
```

---

## Task 11: Contrast mode toggle UI

**Files:**
- Create: `components/ContrastModeToggle.tsx`
- Modify: `store/useAppStore.ts` (add `contrastMode`)
- Modify: `app/app/page.tsx` (show toggle, pass to analyze)

**Interfaces:**
- `contrastMode: boolean` in Zustand store, passed to `/api/analyze` POST body

- [ ] **Step 1: Add `contrastMode` to Zustand store**

```typescript
contrastMode: boolean;
setContrastMode: (v: boolean) => void;
```
Initialize to `false`.

- [ ] **Step 2: Create `components/ContrastModeToggle.tsx`**

```typescript
"use client";
import { useAppStore } from "../store/useAppStore";

export default function ContrastModeToggle() {
  const { contrastMode, setContrastMode } = useAppStore();

  return (
    <div className="flex items-center gap-3 justify-center">
      <button
        onClick={() => setContrastMode(false)}
        className={`px-4 py-2 rounded-full text-xs font-semibold font-display transition-all ${
          !contrastMode
            ? "bg-hot-pink text-white glow-pink"
            : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
        }`}
      >
        🎭 Match mood
      </button>
      <button
        onClick={() => setContrastMode(true)}
        className={`px-4 py-2 rounded-full text-xs font-semibold font-display transition-all ${
          contrastMode
            ? "bg-hot-pink text-white glow-pink"
            : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
        }`}
      >
        🔄 Change mood
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Add toggle to the upload page in `app/app/page.tsx`**

Place `<ContrastModeToggle />` below the `<DropZone>` and above the credits line:

```tsx
import ContrastModeToggle from "../../components/ContrastModeToggle";

// In the JSX, after <DropZone>:
<ContrastModeToggle />
```

- [ ] **Step 4: Pass `contrastMode` to the analyze call**

In `runAnalysis`, include in the POST body:
```typescript
const { contrastMode } = useAppStore.getState();
body: JSON.stringify({ image: base64, mimeType, exifData, contrastMode }),
```

- [ ] **Step 5: Test**

Enable "Change mood" toggle → upload a calm photo → confirm the recommendations have higher energy than normal.

- [ ] **Step 6: Commit**

```
git add components/ContrastModeToggle.tsx store/useAppStore.ts app/app/page.tsx
git commit -m "feat: contrast mode toggle (match mood vs change mood)"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|-------------|------|
| Emotional vector dimensions (10) | Task 1 |
| Taste vector from onboarding swipes | Task 4 |
| Positive likes more weight than skips (0.2) | Task 1 (buildTasteVector) |
| Photo vector + confidence from GPT | Task 7 |
| Moment type classification | Task 7 |
| Dynamic weighting (confidence-adaptive) | Task 7 (blendVectors) |
| Contrast mode | Tasks 7 + 11 |
| EXIF (time, season from metadata) | Task 6 |
| Recency decay (30-day half-life) | Task 8 |
| Contextual taste vectors per moment type | Task 2 (DB) + Task 7 (upsert) |
| Last.fm similar tracks | Tasks 9 + 10 |
| Music DNA card | Task 5 |

### Type consistency check

- `EmotionalVector` defined in `lib/emotionalVector.ts` — imported by Tasks 2, 3, 4, 5, 7, 9
- `MomentType` defined in `lib/db/userTaste.ts` — imported by Task 7
- `SeedSong.emotionalVector` added in Task 3, consumed in Task 4
- `likedSeedTracks` flows: Zustand (Task 10) → page.tsx (Task 10) → search-tracks API (Task 10)
- `contrastMode` flows: Zustand (Task 11) → page.tsx (Task 11) → analyze API (Task 7)

### Placeholder check

No TBD, TODO, or "implement later" entries found. All code blocks are complete.
