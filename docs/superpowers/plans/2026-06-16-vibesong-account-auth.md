# VibeSong Account Auth & Taste Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require Google or email sign-in right after the taste quiz, move credits/taste/save-skip history from localStorage into Supabase, and feed an aggregate taste profile (learned from full save/skip history) into the GPT matching prompt.

**Architecture:** Extend the existing NextAuth v5 setup with Google and Email (magic-link) providers alongside the existing Spotify provider, switch from JWT to database sessions backed by `@auth/supabase-adapter`, and add three Supabase tables (`profiles`, `user_taste`, `track_feedback`) accessed only from server-side API routes via the Supabase service role key.

**Tech Stack:** Next.js App Router, TypeScript, NextAuth v5 (beta), `@auth/supabase-adapter`, `@supabase/supabase-js`, Resend (magic-link email), Zustand, OpenAI GPT-4o.

**Spec:** `docs/superpowers/specs/2026-06-16-vibesong-account-auth-design.md`

---

## Files

- Create: `supabase/schema.sql` — full DB schema (next_auth adapter tables + profiles/user_taste/track_feedback).
- Create: `lib/supabase.ts` — server-only Supabase client (service role key).
- Create: `lib/email.ts` — Resend-backed magic-link sender for the Email provider.
- Create: `lib/db/profiles.ts` — credits + migration-flag CRUD.
- Create: `lib/db/userTaste.ts` — taste quiz CRUD.
- Create: `lib/db/trackFeedback.ts` — save/skip event CRUD.
- Create: `lib/tasteProfile.ts` — pure aggregate taste profile calculation (unit tested).
- Create: `lib/useCredits.ts` — client hook wrapping the credits API.
- Create: `lib/useAccountSync.ts` — client hook that runs migration + taste/feedback sync after sign-in.
- Create: `components/AuthGate.tsx` — Google/email sign-in screen shown after the quiz.
- Create: `app/api/credits/route.ts`, `app/api/credits/deduct/route.ts`, `app/api/credits/add/route.ts`.
- Create: `app/api/taste/route.ts`.
- Create: `app/api/feedback/route.ts`.
- Create: `app/api/migrate-local/route.ts`.
- Create: `tests/tasteProfile.test.mjs`.
- Modify: `auth.ts` — add Google/Email providers, Supabase adapter, database sessions, `spotifyConnected` flag.
- Modify: `app/api/analyze/route.ts` — require session, load taste/feedback from Supabase, use aggregate taste profile.
- Modify: `app/api/enhance/route.ts` — look up the Spotify access token server-side instead of trusting the client.
- Modify: `store/useAppStore.ts` — persist save/skip to `/api/feedback`, replace `loadSavedSongs` with `loadFeedback`.
- Modify: `components/PricingModal.tsx` — call an injected `onAddCredits` instead of `lib/credits.ts`.
- Modify: `app/app/page.tsx` — wire quiz → AuthGate → sync → upload flow, switch credits to the new hook.
- Modify: `app/profile/page.tsx` — generic sign-in CTA, conditional Spotify badge, credits hook.
- Modify: `app/library/page.tsx` — gate the Spotify export button on `spotifyConnected`, not just `session`.
- Modify: `package.json` — add `@supabase/supabase-js`, `@auth/supabase-adapter`.
- Modify: `.env.local` — add new provider/database env var keys (no values filled in).
- Delete: `lib/credits.ts` — fully replaced by server-side credits.

---

## Task 1: Database Setup

**Files:**
- Create: `supabase/schema.sql`
- Modify: `.env.local`
- Modify: `package.json`

- [ ] **Step 1: Install the new dependencies**

Run: `npm install @supabase/supabase-js @auth/supabase-adapter`
Expected: both packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Write the schema file**

Create `supabase/schema.sql`:

```sql
-- Auth.js Supabase adapter schema
-- Source: https://authjs.dev/getting-started/adapters/supabase
create extension if not exists "uuid-ossp";

CREATE SCHEMA next_auth;
GRANT USAGE ON SCHEMA next_auth TO service_role;
GRANT ALL ON SCHEMA next_auth TO postgres;

CREATE TABLE IF NOT EXISTS next_auth.users
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS next_auth.sessions
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessionToken_unique UNIQUE ("sessionToken"),
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS next_auth.accounts
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid,
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS next_auth.verification_tokens
(
    identifier text,
    token text,
    expires timestamp with time zone NOT NULL,
    CONSTRAINT verification_tokens_pkey PRIMARY KEY (token),
    CONSTRAINT token_unique UNIQUE (token),
    CONSTRAINT token_identifier_unique UNIQUE (token, identifier)
);

CREATE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $$;

GRANT ALL ON TABLE next_auth.users TO postgres;
GRANT ALL ON TABLE next_auth.users TO service_role;
GRANT ALL ON TABLE next_auth.sessions TO postgres;
GRANT ALL ON TABLE next_auth.sessions TO service_role;
GRANT ALL ON TABLE next_auth.accounts TO postgres;
GRANT ALL ON TABLE next_auth.accounts TO service_role;
GRANT ALL ON TABLE next_auth.verification_tokens TO postgres;
GRANT ALL ON TABLE next_auth.verification_tokens TO service_role;

-- App tables

create table public.profiles (
  user_id uuid primary key references next_auth.users(id) on delete cascade,
  credits int not null default 3,
  migrated_local_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_taste (
  user_id uuid primary key references next_auth.users(id) on delete cascade,
  genres text[] not null default '{}',
  favorite_artists text[] not null default '{}',
  default_mood text not null default '',
  discovery_style text not null default 'balanced',
  dislikes text[] not null default '{}',
  language_preference text not null default 'No preference',
  energy_preference text not null default 'depends',
  setup_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.track_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references next_auth.users(id) on delete cascade,
  action text not null check (action in ('saved', 'skipped')),
  title text not null,
  artist text not null,
  reason text,
  match_score int,
  genres text[] not null default '{}',
  artwork text,
  thumbnail text,
  apple_music_url text,
  youtube_url text,
  youtube_id text,
  preview_url text,
  preview_provider text check (preview_provider is null or preview_provider in ('itunes', 'youtube')),
  source_image text,
  created_at timestamptz not null default now()
);

create index track_feedback_user_action_idx
  on public.track_feedback (user_id, action, created_at desc);

alter table public.profiles enable row level security;
alter table public.user_taste enable row level security;
alter table public.track_feedback enable row level security;
```

- [ ] **Step 3: Run the schema in Supabase (manual action)**

Open the Supabase dashboard for your project → SQL Editor → paste the full contents of `supabase/schema.sql` → Run. Confirm no errors and that `next_auth.users`, `next_auth.sessions`, `next_auth.accounts`, `next_auth.verification_tokens`, `public.profiles`, `public.user_taste`, and `public.track_feedback` all appear in the Table Editor.

- [ ] **Step 4: Add new env var keys to `.env.local`**

Read the current `.env.local`, then append these new (empty) keys without touching any existing line:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Tell the user to fill these in: `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from Supabase project settings → API; `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` from a Google Cloud Console OAuth client (set the authorized redirect URI to `http://localhost:3000/api/auth/callback/google` for local dev); `RESEND_API_KEY` from a Resend account; `EMAIL_FROM` to a verified sender address (e.g. `VibeSong <login@yourdomain.com>`).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql package.json package-lock.json
git commit -m "Add Supabase schema and auth/db dependencies"
```

(`.env.local` is gitignored — do not add it.)

---

## Task 2: Server-Only Supabase Client

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Write the client**

```ts
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("lib/supabase.ts must only be imported in server-side code");
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "Add server-only Supabase client"
```

---

## Task 3: Profiles (Credits) DB Helpers

**Files:**
- Create: `lib/db/profiles.ts`

- [ ] **Step 1: Write the module**

```ts
import { supabase } from "../supabase";

const DEFAULT_CREDITS = 3;

export interface Profile {
  userId: string;
  credits: number;
  migratedLocalData: boolean;
}

interface ProfileRow {
  user_id: string;
  credits: number;
  migrated_local_data: boolean;
}

function mapRow(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    credits: row.credits,
    migratedLocalData: row.migrated_local_data,
  };
}

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("user_id, credits, migrated_local_data")
    .eq("user_id", userId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return mapRow(existing);

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ user_id: userId, credits: DEFAULT_CREDITS })
    .select("user_id, credits, migrated_local_data")
    .single();
  if (insertError) throw insertError;
  return mapRow(created);
}

export async function deductCredit(
  userId: string
): Promise<{ ok: boolean; credits: number }> {
  const profile = await getOrCreateProfile(userId);
  if (profile.credits <= 0) return { ok: false, credits: profile.credits };

  const { data, error } = await supabase
    .from("profiles")
    .update({ credits: profile.credits - 1 })
    .eq("user_id", userId)
    .eq("credits", profile.credits)
    .select("credits")
    .single();
  if (error || !data) return { ok: false, credits: profile.credits };
  return { ok: true, credits: data.credits };
}

export async function addCredits(userId: string, amount: number): Promise<number> {
  const profile = await getOrCreateProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ credits: profile.credits + amount })
    .eq("user_id", userId)
    .select("credits")
    .single();
  if (error) throw error;
  return data.credits;
}

export async function markMigrated(userId: string, credits: number | null): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  const { error } = await supabase
    .from("profiles")
    .update({
      migrated_local_data: true,
      credits: credits ?? profile.credits,
    })
    .eq("user_id", userId);
  if (error) throw error;
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/profiles.ts
git commit -m "Add Supabase-backed profile and credits helpers"
```

---

## Task 4: User Taste DB Helpers

**Files:**
- Create: `lib/db/userTaste.ts`

- [ ] **Step 1: Write the module**

```ts
import { supabase } from "../supabase";
import { normalizeTaste, type UserTaste } from "../matching";

interface UserTasteRow {
  genres: string[];
  favorite_artists: string[];
  default_mood: string;
  discovery_style: string;
  dislikes: string[];
  language_preference: string;
  energy_preference: string;
  setup_complete: boolean;
}

export async function getUserTaste(userId: string): Promise<UserTaste | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select(
      "genres, favorite_artists, default_mood, discovery_style, dislikes, language_preference, energy_preference, setup_complete"
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
    setup_complete: normalized.setupComplete,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/userTaste.ts
git commit -m "Add Supabase-backed user taste helpers"
```

---

## Task 5: Track Feedback DB Helpers

**Files:**
- Create: `lib/db/trackFeedback.ts`

- [ ] **Step 1: Write the module**

```ts
import { supabase } from "../supabase";

export type FeedbackAction = "saved" | "skipped";

export interface FeedbackTrack {
  title: string;
  artist: string;
  reason?: string;
  matchScore?: number;
  genres?: string[];
  artwork?: string;
  thumbnail?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
  youtubeId?: string;
  previewUrl?: string;
  previewProvider?: "itunes" | "youtube";
  sourceImage?: string;
}

export interface FeedbackRow extends FeedbackTrack {
  createdAt: string;
}

interface FeedbackRowRaw {
  title: string;
  artist: string;
  reason: string | null;
  match_score: number | null;
  genres: string[] | null;
  artwork: string | null;
  thumbnail: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  preview_url: string | null;
  preview_provider: "itunes" | "youtube" | null;
  source_image: string | null;
  created_at: string;
}

function mapRow(row: FeedbackRowRaw): FeedbackRow {
  return {
    title: row.title,
    artist: row.artist,
    reason: row.reason ?? undefined,
    matchScore: row.match_score ?? undefined,
    genres: row.genres ?? [],
    artwork: row.artwork ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    youtubeId: row.youtube_id ?? undefined,
    previewUrl: row.preview_url ?? undefined,
    previewProvider: row.preview_provider ?? undefined,
    sourceImage: row.source_image ?? undefined,
    createdAt: row.created_at,
  };
}

export async function insertFeedback(
  userId: string,
  action: FeedbackAction,
  track: FeedbackTrack
): Promise<void> {
  const { error } = await supabase.from("track_feedback").insert({
    user_id: userId,
    action,
    title: track.title,
    artist: track.artist,
    reason: track.reason ?? null,
    match_score: track.matchScore ?? null,
    genres: track.genres ?? [],
    artwork: track.artwork ?? null,
    thumbnail: track.thumbnail ?? null,
    apple_music_url: track.appleMusicUrl ?? null,
    youtube_url: track.youtubeUrl ?? null,
    youtube_id: track.youtubeId ?? null,
    preview_url: track.previewUrl ?? null,
    preview_provider: track.previewProvider ?? null,
    source_image: track.sourceImage ?? null,
  });
  if (error) throw error;
}

const SELECT_COLUMNS =
  "title, artist, reason, match_score, genres, artwork, thumbnail, apple_music_url, youtube_url, youtube_id, preview_url, preview_provider, source_image, created_at";

export async function getFeedback(
  userId: string,
  action: FeedbackAction,
  limit = 200
): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from("track_feedback")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as FeedbackRowRaw[]).map(mapRow);
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/trackFeedback.ts
git commit -m "Add Supabase-backed track feedback helpers"
```

---

## Task 6: Aggregate Taste Profile (TDD)

**Files:**
- Create: `lib/tasteProfile.ts`
- Test: `tests/tasteProfile.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/tasteProfile.test.mjs`:

```js
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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require,
    console,
    process,
    URLSearchParams,
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const tasteProfile = loadTsModule("lib/tasteProfile.ts");

function row(artist, genres = []) {
  return { artist, genres, title: "x", createdAt: "2026-01-01" };
}

test("buildAggregateTasteProfile ranks saved genres and artists by frequency", () => {
  const saved = [
    row("Frank Ocean", ["dream pop"]),
    row("Frank Ocean", ["dream pop"]),
    row("SZA", ["neo soul"]),
  ];
  const profile = tasteProfile.buildAggregateTasteProfile(saved, []);

  assert.deepEqual(profile.learnedArtists.slice(0, 1), ["Frank Ocean"]);
  assert.ok(profile.learnedGenres.includes("dream pop"));
  assert.deepEqual(profile.avoidGenres, []);
  assert.deepEqual(profile.avoidArtists, []);
});

test("buildAggregateTasteProfile flags a genre as avoid only past the threshold", () => {
  const skippedBelowThreshold = [row("A", ["edm"]), row("B", ["edm"])];
  const belowProfile = tasteProfile.buildAggregateTasteProfile([], skippedBelowThreshold);
  assert.deepEqual(belowProfile.avoidGenres, []);

  const skippedAboveThreshold = [
    row("A", ["edm"]),
    row("B", ["edm"]),
    row("C", ["edm"]),
  ];
  const aboveProfile = tasteProfile.buildAggregateTasteProfile([], skippedAboveThreshold);
  assert.deepEqual(aboveProfile.avoidGenres, ["edm"]);
});

test("buildAggregateTasteProfile does not avoid a genre that is also frequently saved", () => {
  const saved = [row("A", ["pop"]), row("B", ["pop"])];
  const skipped = [row("C", ["pop"]), row("D", ["pop"]), row("E", ["pop"])];
  const profile = tasteProfile.buildAggregateTasteProfile(saved, skipped);

  assert.deepEqual(profile.avoidGenres, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `lib/tasteProfile.ts` does not exist yet (`ENOENT` or `Cannot find module`).

- [ ] **Step 3: Write the implementation**

Create `lib/tasteProfile.ts`:

```ts
interface TasteSignal {
  artist: string;
  genres?: string[];
}

export interface AggregateTasteProfile {
  learnedGenres: string[];
  avoidGenres: string[];
  learnedArtists: string[];
  avoidArtists: string[];
}

function tally(rows: TasteSignal[], pick: (row: TasteSignal) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const value of pick(row)) {
      const key = value.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function topKeys(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function avoidList(saved: Map<string, number>, skipped: Map<string, number>): string[] {
  return [...skipped.entries()]
    .filter(([key, skipCount]) => skipCount >= 3 && skipCount > (saved.get(key) ?? 0) * 2)
    .map(([key]) => key);
}

export function buildAggregateTasteProfile(
  saved: TasteSignal[],
  skipped: TasteSignal[]
): AggregateTasteProfile {
  const savedGenres = tally(saved, (r) => r.genres ?? []);
  const skippedGenres = tally(skipped, (r) => r.genres ?? []);
  const savedArtists = tally(saved, (r) => [r.artist]);
  const skippedArtists = tally(skipped, (r) => [r.artist]);

  return {
    learnedGenres: topKeys(savedGenres, 5),
    avoidGenres: avoidList(savedGenres, skippedGenres),
    learnedArtists: topKeys(savedArtists, 5),
    avoidArtists: avoidList(savedArtists, skippedArtists),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: all `tasteProfile.test.mjs` tests PASS, existing `matching.test.mjs`/`itunes.test.mjs` still PASS.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/tasteProfile.ts tests/tasteProfile.test.mjs
git commit -m "Add aggregate taste profile calculation with tests"
```

---

## Task 7: Magic-Link Email Sender

**Files:**
- Create: `lib/email.ts`

- [ ] **Step 1: Write the module**

```ts
interface SendVerificationRequestParams {
  identifier: string;
  url: string;
  provider: { from?: string };
}

export async function sendVerificationRequest({
  identifier: email,
  url,
  provider,
}: SendVerificationRequestParams): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: provider.from,
      to: email,
      subject: "Sign in to VibeSong",
      html: `<p>Click below to sign in to VibeSong:</p><p><a href="${url}">Sign in</a></p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error: ${res.status} ${text}`);
  }
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts
git commit -m "Add Resend-backed magic-link email sender"
```

---

## Task 8: Auth Configuration (Google, Email, Database Sessions)

**Files:**
- Modify: `auth.ts`

- [ ] **Step 1: Replace the file contents**

Replace all of `auth.ts` with:

```ts
import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Spotify from "next-auth/providers/spotify";
import Google from "next-auth/providers/google";
import Email from "next-auth/providers/email";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { supabase } from "./lib/supabase";
import { sendVerificationRequest } from "./lib/email";

const SPOTIFY_SCOPES =
  "user-top-read user-read-email playlist-modify-public";

export async function getSpotifyAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .schema("next_auth")
    .from("accounts")
    .select("access_token")
    .eq("userId", userId)
    .eq("provider", "spotify")
    .maybeSingle();
  return data?.access_token ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: { scope: SPOTIFY_SCOPES },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Email({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.spotifyConnected = Boolean(await getSpotifyAccessToken(user.id));
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      spotifyConnected: boolean;
    } & DefaultSession["user"];
  }
}
```

This removes the old JWT-only `jwt`/`session` callbacks and the `session.accessToken` field — sessions are now database-backed, and any code needing the Spotify token must call `getSpotifyAccessToken(userId)` directly (Task 9 does this for `/api/enhance`).

- [ ] **Step 2: Run lint and build**

Run: `npm run lint && npm run build`
Expected: both pass. (The build will fail with a clear error if any required env var is missing at build time — that's expected until Task 1's env vars are filled in; for now confirm there are no TypeScript/lint errors in the code itself.)

- [ ] **Step 3: Commit**

```bash
git add auth.ts
git commit -m "Add Google and Email providers, switch to database sessions"
```

---

## Task 9: Update Spotify Enhance Route for Database Sessions

**Files:**
- Modify: `app/api/enhance/route.ts`

- [ ] **Step 1: Replace the file contents**

Replace all of `app/api/enhance/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";
import { getSpotifyTopData } from "../../../lib/spotify";
import { auth, getSpotifyAccessToken } from "../../../auth";

export const runtime = "nodejs";

function parseGPTJson(raw: string) {
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const accessToken = await getSpotifyAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Spotify not connected" }, { status: 400 });
    }

    const { vibeProfile } = await req.json();

    const { topArtists, topTracks } = await getSpotifyTopData(accessToken);

    const prompt = `Original photo analysis:
${JSON.stringify(vibeProfile, null, 2)}

User's favorite artists: ${topArtists.join(", ")}
User's favorite tracks: ${topTracks.slice(0, 10).join(", ")}

Refine the track recommendations to match BOTH the photo vibe AND the user's personal taste. Prioritize artists similar to their favorites. Keep the same JSON format.
Return ONLY the updated tracks array as JSON (array of objects with title, artist, reason, matchScore).`;

    let tracks;
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      });
      tracks = parseGPTJson(res.choices[0].message.content || "");
    } catch {
      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      });
      tracks = parseGPTJson(retry.choices[0].message.content || "");
    }

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("/api/enhance error:", err);
    return NextResponse.json({ error: "Enhancement failed" }, { status: 500 });
  }
}
```

Note the import path: `app/api/enhance/route.ts` is 3 directories below the project root (`app/api/enhance/`), so the root `auth.ts` is `../../../auth`, not 4 levels — double-check this against `app/api/analyze/route.ts`'s existing `../../../lib/openai` import, which is the same depth.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/enhance/route.ts
git commit -m "Look up Spotify access token server-side in enhance route"
```

---

## Task 10: Credits API Routes

**Files:**
- Create: `app/api/credits/route.ts`
- Create: `app/api/credits/deduct/route.ts`
- Create: `app/api/credits/add/route.ts`

- [ ] **Step 1: Write `app/api/credits/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getOrCreateProfile } from "../../../lib/db/profiles";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const profile = await getOrCreateProfile(session.user.id);
  return NextResponse.json({ credits: profile.credits });
}
```

- [ ] **Step 2: Write `app/api/credits/deduct/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { deductCredit } from "../../../../lib/db/profiles";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const result = await deductCredit(session.user.id);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Write `app/api/credits/add/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { addCredits } from "../../../../lib/db/profiles";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { amount } = await req.json();
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 }
    );
  }
  const credits = await addCredits(session.user.id, amount);
  return NextResponse.json({ credits });
}
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/credits
git commit -m "Add server-side credits API routes"
```

---

## Task 11: Taste API Route

**Files:**
- Create: `app/api/taste/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getUserTaste, upsertUserTaste } from "../../../lib/db/userTaste";
import { normalizeTaste } from "../../../lib/matching";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const taste = await getUserTaste(session.user.id);
  return NextResponse.json(taste);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = await req.json();
  const taste = normalizeTaste(body);
  await upsertUserTaste(session.user.id, taste);
  return NextResponse.json(taste);
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/taste
git commit -m "Add server-side taste API route"
```

---

## Task 12: Feedback API Route and Store Wiring

**Files:**
- Create: `app/api/feedback/route.ts`
- Modify: `store/useAppStore.ts`
- Modify: `app/app/page.tsx` (only the `loadSavedSongs` call site, full rewrite happens in Task 16)
- Modify: `app/library/page.tsx` (only the `loadSavedSongs` call site)
- Modify: `app/profile/page.tsx` (only the `loadSavedSongs` call site)

- [ ] **Step 1: Write `app/api/feedback/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getFeedback, insertFeedback, type FeedbackAction } from "../../../lib/db/trackFeedback";
import type { Track } from "../../../store/useAppStore";

export const runtime = "nodejs";

function isFeedbackAction(value: unknown): value is FeedbackAction {
  return value === "saved" || value === "skipped";
}

function toTrack(
  row: Awaited<ReturnType<typeof getFeedback>>[number],
  action: FeedbackAction
): Track {
  const timestamp = new Date(row.createdAt).getTime();
  return {
    title: row.title,
    artist: row.artist,
    reason: row.reason ?? "",
    matchScore: row.matchScore ?? 0,
    thumbnail: row.thumbnail ?? "",
    artwork: row.artwork,
    appleMusicUrl: row.appleMusicUrl,
    youtubeUrl: row.youtubeUrl,
    youtubeId: row.youtubeId,
    previewUrl: row.previewUrl,
    previewProvider: row.previewProvider,
    sourceImage: row.sourceImage,
    savedAt: action === "saved" ? timestamp : undefined,
    skippedAt: action === "skipped" ? timestamp : undefined,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const [savedRows, skippedRows] = await Promise.all([
    getFeedback(session.user.id, "saved", 200),
    getFeedback(session.user.id, "skipped", 200),
  ]);
  return NextResponse.json({
    saved: savedRows.map((row) => toTrack(row, "saved")),
    skipped: skippedRows.map((row) => toTrack(row, "skipped")),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json();
  if (!isFeedbackAction(body.action) || !body.track?.title || !body.track?.artist) {
    return NextResponse.json(
      { error: "action and track.title/artist required" },
      { status: 400 }
    );
  }

  await insertFeedback(session.user.id, body.action, {
    title: body.track.title,
    artist: body.track.artist,
    reason: body.track.reason,
    matchScore: body.track.matchScore,
    genres: Array.isArray(body.genres) ? body.genres : [],
    artwork: body.track.artwork,
    thumbnail: body.track.thumbnail,
    appleMusicUrl: body.track.appleMusicUrl,
    youtubeUrl: body.track.youtubeUrl,
    youtubeId: body.track.youtubeId,
    previewUrl: body.track.previewUrl,
    previewProvider: body.track.previewProvider,
    sourceImage: body.sourceImage,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Update `store/useAppStore.ts`**

Replace the `saveTrack`, `skipTrack`, and `loadSavedSongs` implementations. First, in the `AppState` interface, rename `loadSavedSongs: () => void;` to `loadFeedback: () => Promise<void>;`. Then replace the three method bodies:

```ts
  saveTrack: (track) => {
    const withMeta: Track = {
      ...track,
      savedAt: Date.now(),
      sourceImage: get().uploadedImageUrl || undefined,
    };
    set((s) => ({ savedSongs: [...s.savedSongs, withMeta] }));
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saved",
        track: {
          title: track.title,
          artist: track.artist,
          reason: track.reason,
          matchScore: track.matchScore,
          artwork: track.artwork,
          thumbnail: track.thumbnail,
          appleMusicUrl: track.appleMusicUrl,
          youtubeUrl: track.youtubeUrl,
          youtubeId: track.youtubeId,
          previewUrl: track.previewUrl,
          previewProvider: track.previewProvider,
        },
        genres: get().vibeProfile?.musicDNA.genres ?? [],
        sourceImage: get().uploadedImageUrl || undefined,
      }),
    }).catch(() => {});
  },

  skipTrack: (track) => {
    const withMeta: Track = {
      ...track,
      skippedAt: Date.now(),
      sourceImage: get().uploadedImageUrl || undefined,
    };
    set((s) => ({ skippedSongs: [...s.skippedSongs, withMeta].slice(-50) }));
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "skipped",
        track: {
          title: track.title,
          artist: track.artist,
          reason: track.reason,
          matchScore: track.matchScore,
          artwork: track.artwork,
          thumbnail: track.thumbnail,
          appleMusicUrl: track.appleMusicUrl,
          youtubeUrl: track.youtubeUrl,
          youtubeId: track.youtubeId,
          previewUrl: track.previewUrl,
          previewProvider: track.previewProvider,
        },
        genres: get().vibeProfile?.musicDNA.genres ?? [],
        sourceImage: get().uploadedImageUrl || undefined,
      }),
    }).catch(() => {});
  },
```

And replace the old `loadSavedSongs` body (the one reading `vibesong_library`/`vibesong_skipped` from `localStorage`) with:

```ts
  loadFeedback: async () => {
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) return;
      const data = await res.json();
      set({ savedSongs: data.saved ?? [], skippedSongs: data.skipped ?? [] });
    } catch {
      // keep whatever is already in memory on network failure
    }
  },
```

- [ ] **Step 3: Update the three call sites**

In `app/library/page.tsx` and `app/profile/page.tsx`, change:

```ts
const { savedSongs, loadSavedSongs } = useAppStore();
...
useEffect(() => {
  loadSavedSongs();
}, [loadSavedSongs]);
```

to:

```ts
const { savedSongs, loadFeedback } = useAppStore();
...
useEffect(() => {
  loadFeedback();
}, [loadFeedback]);
```

`app/app/page.tsx`'s call site will be replaced entirely in Task 16 — skip it for now.

- [ ] **Step 4: Run lint and tests**

Run: `npm run lint && npm test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/feedback store/useAppStore.ts app/library/page.tsx app/profile/page.tsx
git commit -m "Persist save/skip feedback to Supabase instead of localStorage"
```

---

## Task 13: Migration API Route

**Files:**
- Create: `app/api/migrate-local/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getOrCreateProfile, markMigrated } from "../../../lib/db/profiles";
import { upsertUserTaste } from "../../../lib/db/userTaste";
import { insertFeedback } from "../../../lib/db/trackFeedback";
import { normalizeTaste } from "../../../lib/matching";
import type { Track } from "../../../store/useAppStore";

export const runtime = "nodejs";

interface MigrateBody {
  userTaste?: Record<string, unknown> | null;
  savedSongs?: Track[];
  skippedSongs?: Track[];
  credits?: number | null;
}

function toFeedbackTrack(track: Track) {
  return {
    title: track.title,
    artist: track.artist,
    reason: track.reason,
    matchScore: track.matchScore,
    artwork: track.artwork,
    thumbnail: track.thumbnail,
    appleMusicUrl: track.appleMusicUrl,
    youtubeUrl: track.youtubeUrl,
    youtubeId: track.youtubeId,
    previewUrl: track.previewUrl,
    previewProvider: track.previewProvider,
    sourceImage: track.sourceImage,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(session.user.id);
  if (profile.migratedLocalData) {
    return NextResponse.json({ migrated: false, alreadyDone: true });
  }

  const body: MigrateBody = await req.json();

  if (body.userTaste && typeof body.userTaste === "object") {
    const taste = normalizeTaste(body.userTaste);
    if (taste.setupComplete) {
      await upsertUserTaste(session.user.id, taste);
    }
  }

  const saved = Array.isArray(body.savedSongs) ? body.savedSongs : [];
  const skipped = Array.isArray(body.skippedSongs) ? body.skippedSongs : [];

  await Promise.allSettled([
    ...saved.map((track) =>
      insertFeedback(session.user.id, "saved", toFeedbackTrack(track))
    ),
    ...skipped.map((track) =>
      insertFeedback(session.user.id, "skipped", toFeedbackTrack(track))
    ),
  ]);

  await markMigrated(
    session.user.id,
    typeof body.credits === "number" ? body.credits : null
  );

  return NextResponse.json({ migrated: true });
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/migrate-local
git commit -m "Add one-time localStorage-to-Supabase migration route"
```

---

## Task 14: Aggregate Taste Profile in the Analyze Route

**Files:**
- Modify: `app/api/analyze/route.ts`

- [ ] **Step 1: Update imports and remove the old feedback mechanism**

At the top of `app/api/analyze/route.ts`, replace:

```ts
import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";
import {
  getDiscoveryInstructions,
  normalizeCandidateScores,
  normalizeTaste,
  type CandidateTrack,
  type UserTaste,
} from "../../../lib/matching";

export const runtime = "nodejs";

interface UserFeedback {
  savedSongs?: Array<{ title: string; artist: string; reason?: string }>;
  skippedSongs?: Array<{ title: string; artist: string; reason?: string }>;
}
```

with:

```ts
import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";
import {
  getDiscoveryInstructions,
  normalizeCandidateScores,
  normalizeTaste,
  type CandidateTrack,
  type UserTaste,
} from "../../../lib/matching";
import { auth } from "../../../auth";
import { getUserTaste } from "../../../lib/db/userTaste";
import { getFeedback } from "../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile, type AggregateTasteProfile } from "../../../lib/tasteProfile";

export const runtime = "nodejs";
```

- [ ] **Step 2: Replace `buildFeedbackBlock` with `buildAggregateTasteBlock`**

Replace the entire `buildFeedbackBlock` function with:

```ts
function buildAggregateTasteBlock(profile: AggregateTasteProfile): string {
  const hasSignal =
    profile.learnedGenres.length > 0 ||
    profile.avoidGenres.length > 0 ||
    profile.learnedArtists.length > 0 ||
    profile.avoidArtists.length > 0;
  if (!hasSignal) return "";

  return `

LEARNED TASTE SIGNALS (from this user's save/skip history across all past matches):
- Genres they keep saving: ${profile.learnedGenres.join(", ") || "none yet"}
- Genres they keep skipping, avoid these: ${profile.avoidGenres.join(", ") || "none"}
- Artists they keep saving: ${profile.learnedArtists.join(", ") || "none yet"}
- Artists they keep skipping, avoid these: ${profile.avoidArtists.join(", ") || "none"}

Treat this as a strong signal, refined over many past matches -- stronger than a single quiz answer.`;
}
```

- [ ] **Step 3: Update `buildPrompt`**

Replace:

```ts
function buildPrompt(taste: UserTaste, feedback: UserFeedback | null): string {
  const hasTaste =
    taste.setupComplete &&
    (taste.genres.length > 0 ||
      taste.favoriteArtists.length > 0 ||
      taste.defaultMood ||
      taste.discoveryStyle !== "balanced" ||
      taste.dislikes.length > 0 ||
      taste.languagePreference !== "No preference" ||
      taste.energyPreference !== "depends");

  return BASE_SYSTEM_PROMPT + (hasTaste ? buildTasteBlock(taste) : "") + buildFeedbackBlock(feedback);
}
```

with:

```ts
function buildPrompt(taste: UserTaste, aggregate: AggregateTasteProfile): string {
  const hasTaste =
    taste.setupComplete &&
    (taste.genres.length > 0 ||
      taste.favoriteArtists.length > 0 ||
      taste.defaultMood ||
      taste.discoveryStyle !== "balanced" ||
      taste.dislikes.length > 0 ||
      taste.languagePreference !== "No preference" ||
      taste.energyPreference !== "depends");

  return (
    BASE_SYSTEM_PROMPT +
    (hasTaste ? buildTasteBlock(taste) : "") +
    buildAggregateTasteBlock(aggregate)
  );
}
```

- [ ] **Step 4: Update the `POST` handler**

Replace:

```ts
export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, userTaste, feedback } = await req.json();
    if (!image || !mimeType) {
      return NextResponse.json(
        { error: "image and mimeType required" },
        { status: 400 }
      );
    }

    const taste = normalizeTaste(userTaste ?? null);
    const prompt = buildPrompt(taste, feedback ?? null);
```

with:

```ts
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const { image, mimeType } = await req.json();
    if (!image || !mimeType) {
      return NextResponse.json(
        { error: "image and mimeType required" },
        { status: 400 }
      );
    }

    const storedTaste = await getUserTaste(session.user.id);
    const taste = normalizeTaste(storedTaste ?? null);

    const [savedFeedback, skippedFeedback] = await Promise.all([
      getFeedback(session.user.id, "saved", 300),
      getFeedback(session.user.id, "skipped", 300),
    ]);
    const aggregate = buildAggregateTasteProfile(savedFeedback, skippedFeedback);

    const prompt = buildPrompt(taste, aggregate);
```

Leave the rest of the function (the OpenAI call, retry logic, `normalizeScores`, error handling) unchanged.

- [ ] **Step 5: Run lint and build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "Use server-side aggregate taste profile in the analyze prompt"
```

---

## Task 15: Auth Gate Component

**Files:**
- Create: `components/AuthGate.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn("email", { email, redirect: false });
    setSubmitting(false);
    if (result?.error) {
      setError("Couldn't send the sign-in link. Try again.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-cream rounded-2xl p-6 space-y-5 text-center">
        <h2 className="font-display font-bold text-2xl text-ink">
          One last step
        </h2>
        <p className="text-black/60 text-sm">
          Sign in to save your matches and get better recommendations over
          time.
        </p>

        <button
          onClick={() => signIn("google")}
          className="w-full py-4 rounded-full font-display font-bold text-base bg-ink text-white active:scale-95 transition-opacity"
        >
          Continue with Google
        </button>

        {sent ? (
          <p className="text-black/60 text-sm">
            Check {email} for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-4 text-ink placeholder:text-black/40 focus:outline-none focus:border-hot-pink transition-colors text-base"
            />
            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full py-4 rounded-full font-display font-bold text-base bg-hot-pink text-white disabled:opacity-30 active:scale-95 transition-opacity glow-pink"
            >
              {submitting ? "Sending..." : "Continue with email"}
            </button>
          </form>
        )}

        {error && <p className="text-error text-sm">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/AuthGate.tsx
git commit -m "Add AuthGate sign-in component"
```

---

## Task 16: Credits Hook and Account Sync Hook

**Files:**
- Create: `lib/useCredits.ts`
- Create: `lib/useAccountSync.ts`

- [ ] **Step 1: Write `lib/useCredits.ts`**

```ts
"use client";
import { useCallback, useEffect, useState } from "react";

export function useCredits() {
  const [credits, setCredits] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/credits");
    if (!res.ok) return;
    const data = await res.json();
    setCredits(data.credits);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deduct = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/credits/deduct", { method: "POST" });
    if (!res.ok) return false;
    const data = await res.json();
    setCredits(data.credits);
    return Boolean(data.ok);
  }, []);

  const add = useCallback(async (amount: number): Promise<void> => {
    const res = await fetch("/api/credits/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setCredits(data.credits);
  }, []);

  return { credits, loaded, refresh, deduct, add };
}
```

- [ ] **Step 2: Write `lib/useAccountSync.ts`**

```ts
"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useAppStore } from "../store/useAppStore";

export function useAccountSync() {
  const { data: session, status } = useSession();
  const [ready, setReady] = useState(false);
  const [tasteComplete, setTasteComplete] = useState<boolean | null>(null);
  const ranFor = useRef<string | null>(null);
  const loadFeedback = useAppStore((s) => s.loadFeedback);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (ranFor.current === session.user.id) return;
    ranFor.current = session.user.id;

    (async () => {
      const localTasteRaw = localStorage.getItem("userTaste");
      const localCreditsRaw = localStorage.getItem("vibesong_credits");

      await fetch("/api/migrate-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userTaste: localTasteRaw ? JSON.parse(localTasteRaw) : null,
          savedSongs: useAppStore.getState().savedSongs,
          skippedSongs: useAppStore.getState().skippedSongs,
          credits: localCreditsRaw ? parseInt(localCreditsRaw, 10) : null,
        }),
      }).catch(() => {});

      const tasteRes = await fetch("/api/taste");
      const taste = tasteRes.ok ? await tasteRes.json() : null;
      setTasteComplete(Boolean(taste?.setupComplete));

      await loadFeedback();
      setReady(true);
    })();
  }, [status, session?.user?.id, loadFeedback]);

  return { session, status, ready, tasteComplete };
}
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/useCredits.ts lib/useAccountSync.ts
git commit -m "Add client hooks for server-side credits and account sync"
```

---

## Task 17: Wire the Auth Gate into the Upload Page

**Files:**
- Modify: `app/app/page.tsx`
- Modify: `components/PricingModal.tsx`
- Delete: `lib/credits.ts`

- [ ] **Step 1: Update `components/PricingModal.tsx`**

Replace the import and `handleContinue`:

```ts
import { addCredits } from "../lib/credits";
```

is removed entirely (no replacement import needed). The prop interface changes from:

```ts
interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onCreditsAdded: (newTotal: number) => void;
}
```

to:

```ts
interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onAddCredits: (amount: number) => Promise<void>;
}
```

And `handleContinue` changes from:

```ts
  const handleContinue = () => {
    const pkg = PACKAGES.find((p) => p.id === selected)!;
    addCredits(pkg.credits);
    onCreditsAdded(currentCredits + pkg.credits);
    onClose();
  };
```

to:

```ts
  const handleContinue = async () => {
    const pkg = PACKAGES.find((p) => p.id === selected)!;
    await onAddCredits(pkg.credits);
    onClose();
  };
```

Update the destructured props in the component signature from `onCreditsAdded` to `onAddCredits` accordingly.

- [ ] **Step 2: Delete `lib/credits.ts`**

Delete the file — it's fully replaced by `lib/useCredits.ts` and the `/api/credits/*` routes.

- [ ] **Step 3: Rewrite `app/app/page.tsx`**

Apply these changes to `app/app/page.tsx`:

1. Replace the import block's credits/session lines. `useSession` is no longer called directly in this file (its job moves into `useAccountSync`), but `signIn` is still used by the "Enhance with your Spotify taste" button. Replace:

```ts
import { useSession, signIn } from "next-auth/react";
```
with:
```ts
import { signIn } from "next-auth/react";
```
Remove:
```ts
import { getCredits, deductCredit } from "../../lib/credits";
```
Add:
```ts
import { useCredits } from "../../lib/useCredits";
import { useAccountSync } from "../../lib/useAccountSync";
import AuthGate from "../../components/AuthGate";
```

2. Replace the credits-related state and the `session`/`useSession()` line:

```ts
  const { data: session } = useSession();
  ...
  const [credits, setCredits] = useState(() =>
    typeof window !== "undefined" ? getCredits() : 3
  );
```

with:

```ts
  const { session, status, ready, tasteComplete } = useAccountSync();
  const { credits, deduct, add } = useCredits();
```

2a. Replace the store destructure and its `loadSavedSongs` effect — `useAccountSync` (Task 16) already calls `loadFeedback()` internally once signed in, so this page no longer needs its own call, and `loadSavedSongs` no longer exists on the store (it was renamed to `loadFeedback` in Task 12). Replace:

```ts
  const {
    setUploadedImage,
    setVibeProfile,
    setTracks,
    setIsAnalyzing,
    savedSongs,
    skippedSongs,
    loadSavedSongs,
    vibeProfile,
    uploadedImageUrl,
  } = useAppStore();

  useEffect(() => {
    loadSavedSongs();
  }, [loadSavedSongs]);
```

with:

```ts
  const {
    setUploadedImage,
    setVibeProfile,
    setTracks,
    setIsAnalyzing,
    savedSongs,
    vibeProfile,
    uploadedImageUrl,
  } = useAppStore();
```

(`skippedSongs` is dropped here because step 4 below removes the only place this page read it; `savedSongs` is kept because the "Recent Vibes" section still displays it.)

3. Replace the `showTasteSetup` state and add a sync effect right after it:

```ts
  const [showTasteSetup, setShowTasteSetup] = useState(() =>
    typeof window !== "undefined" ? !localStorage.getItem("userTaste") : false
  );
```

stays, but add immediately after the other `useEffect`s:

```ts
  useEffect(() => {
    if (tasteComplete !== null) setShowTasteSetup(!tasteComplete);
  }, [tasteComplete]);
```

4. In `runAnalysis`, remove the `userTaste`/`feedback` block sent to `/api/analyze` (the server now loads both from the session), and change the Spotify enhance condition. Replace:

```ts
      try {
        const storedTaste = localStorage.getItem("userTaste");
        const userTaste: UserTaste | null = storedTaste
          ? JSON.parse(storedTaste)
          : null;

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            mimeType,
            userTaste,
            feedback: {
              savedSongs: savedSongs.slice(-12),
              skippedSongs: skippedSongs.slice(-12),
            },
          }),
        });
        if (!analyzeRes.ok) {
          const errBody = await analyzeRes.json().catch(() => ({}));
          throw new Error(
            errBody.detail || errBody.error || `API ${analyzeRes.status}`
          );
        }
        const vibeData = await analyzeRes.json();
        setVibeProfile(vibeData);

        let tracks = vibeData.musicDNA?.tracks || [];

        if (session?.accessToken) {
          try {
            const enhanceRes = await fetch("/api/enhance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                vibeProfile: vibeData,
                accessToken: session.accessToken,
              }),
            });
            if (enhanceRes.ok) {
              const enhanced = await enhanceRes.json();
              if (enhanced.tracks?.length) tracks = enhanced.tracks;
            }
          } catch {
            // Spotify enhancement is optional
          }
        }

        const searchRes = await fetch("/api/search-tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tracks,
            discoveryStyle: userTaste?.discoveryStyle ?? "balanced",
          }),
        });
```

with:

```ts
      try {
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mimeType }),
        });
        if (!analyzeRes.ok) {
          const errBody = await analyzeRes.json().catch(() => ({}));
          throw new Error(
            errBody.detail || errBody.error || `API ${analyzeRes.status}`
          );
        }
        const vibeData = await analyzeRes.json();
        setVibeProfile(vibeData);

        let tracks = vibeData.musicDNA?.tracks || [];

        if (session?.user?.spotifyConnected) {
          try {
            const enhanceRes = await fetch("/api/enhance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vibeProfile: vibeData }),
            });
            if (enhanceRes.ok) {
              const enhanced = await enhanceRes.json();
              if (enhanced.tracks?.length) tracks = enhanced.tracks;
            }
          } catch {
            // Spotify enhancement is optional
          }
        }

        const storedTasteRaw = localStorage.getItem("userTaste");
        const discoveryStyle = storedTasteRaw
          ? JSON.parse(storedTasteRaw)?.discoveryStyle ?? "balanced"
          : "balanced";

        const searchRes = await fetch("/api/search-tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tracks, discoveryStyle }),
        });
```

(`UserTaste` import can stay — it's still used by `TasteSetup`'s `onComplete` typing further down.)

5. Update the `runAnalysis` dependency array (remove `savedSongs`, `skippedSongs` since they're no longer read inside it):

```ts
    [
      session,
      setUploadedImage,
      setVibeProfile,
      setTracks,
      setIsAnalyzing,
      router,
    ]
```

6. Replace `handleImageReady` and `handleCreditsAdded` to use the async `deduct`/`add` from `useCredits`:

```ts
  const handleImageReady = useCallback(
    async (base64: string, mimeType: string, objectUrl: string) => {
      if (credits <= 0) {
        setPendingImage({ base64, mimeType, objectUrl });
        setShowPricing(true);
        return;
      }
      const ok = await deduct();
      if (!ok) {
        setPendingImage({ base64, mimeType, objectUrl });
        setShowPricing(true);
        return;
      }
      setPageState("uploading");
      setTimeout(() => runAnalysis(base64, mimeType, objectUrl), 300);
    },
    [credits, deduct, runAnalysis]
  );

  const handleCreditsAdded = async (amount: number) => {
    await add(amount);
    if (pendingImage) {
      const ok = await deduct();
      if (ok) {
        setPageState("uploading");
        setTimeout(
          () =>
            runAnalysis(
              pendingImage.base64,
              pendingImage.mimeType,
              pendingImage.objectUrl
            ),
          300
        );
      }
      setPendingImage(null);
    }
  };
```

7. Update the single `PricingModal` usage near the bottom of the file from:

```tsx
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onCreditsAdded={handleCreditsAdded}
      />
```

to:

```tsx
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onAddCredits={handleCreditsAdded}
      />
```

8. Gate the whole page behind sign-in. Wrap the final return so that when the quiz is done but there's no session yet, only `AuthGate` renders. Add near the top of the component body, after all hooks:

```ts
  const needsAuthGate = !showTasteSetup && status === "unauthenticated";
```

And change the final return's tail:

```tsx
  if (needsAuthGate) {
    return <AuthGate />;
  }

  return (
    <AppShell
      ...
```

(keep everything else in the existing return as-is, just gate it behind this early return, placed after the existing `if (pageState === "analyzing")` early return and before the main return statement).

9. Remove the now-unused `[errorMsg, setErrorMsg]`-adjacent `getCredits()`/`setCredits` references — `credits` is now only ever read from `useCredits()`, never set directly.

- [ ] **Step 4: Run lint and build**

Run: `npm run lint && npm run build`
Expected: both pass with no references to the deleted `lib/credits.ts` remaining anywhere (search for `from "../../lib/credits"` or `from "../lib/credits"` if the build fails on a missing module).

- [ ] **Step 5: Commit**

```bash
git add app/app/page.tsx components/PricingModal.tsx
git rm lib/credits.ts
git commit -m "Gate the upload flow behind sign-in and move credits to the server"
```

---

## Task 18: Update Profile and Library Pages

**Files:**
- Modify: `app/profile/page.tsx`
- Modify: `app/library/page.tsx`

- [ ] **Step 1: Update `app/profile/page.tsx`**

Replace:

```ts
import { getCredits } from "../../lib/credits";
```

with:

```ts
import { useCredits } from "../../lib/useCredits";
```

Replace:

```ts
  const [credits, setCredits] = useState(() =>
    typeof window !== "undefined" ? getCredits() : 3
  );
```

with:

```ts
  const { credits, add } = useCredits();
```

Replace the not-signed-in branch's Spotify-specific CTA:

```tsx
            <button
              onClick={() => signIn("spotify")}
              className="flex items-center gap-2 bg-spotify-green text-black font-display font-bold py-4 px-8 rounded-full hover:opacity-90 active:scale-95 transition-all"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                music_note
              </span>
              Connect Spotify
            </button>
```

with a generic sign-in link (the actual sign-in screen lives at `/app`, right after the quiz):

```tsx
            <a
              href="/app"
              className="flex items-center gap-2 bg-hot-pink text-white font-display font-bold py-4 px-8 rounded-full hover:opacity-90 active:scale-95 transition-all glow-pink"
            >
              Sign in
            </a>
```

Also update the paragraph above it from "Connect Spotify to personalize your matches" to "Sign in to see your matches and credits".

Replace the hardcoded Spotify badge in the signed-in branch:

```tsx
                <div className="flex items-center justify-center lg:justify-start gap-1 text-lime text-xs font-semibold mt-1">
                  <span className="w-2 h-2 rounded-full bg-lime" />
                  Connected to Spotify
                </div>
```

with:

```tsx
                {session.user?.spotifyConnected ? (
                  <div className="flex items-center justify-center lg:justify-start gap-1 text-lime text-xs font-semibold mt-1">
                    <span className="w-2 h-2 rounded-full bg-lime" />
                    Connected to Spotify
                  </div>
                ) : (
                  <button
                    onClick={() => signIn("spotify")}
                    className="flex items-center justify-center lg:justify-start gap-1 text-spotify-green text-xs font-semibold mt-1 hover:underline"
                  >
                    <span
                      className="material-symbols-outlined text-[14px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      music_note
                    </span>
                    Connect Spotify
                  </button>
                )}
```

Update the `PricingModal` usage's `onCreditsAdded={(newTotal) => setCredits(newTotal)}` to `onAddCredits={add}`.

- [ ] **Step 2: Update `app/library/page.tsx`**

Replace:

```tsx
          <button
            disabled={!session}
            className={`w-full lg:max-w-md py-4 rounded-full font-display font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              session
                ? "bg-spotify-green text-black hover:opacity-90 active:scale-95"
                : "bg-spotify-green/30 text-spotify-green/60 cursor-not-allowed"
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              music_note
            </span>
            {session
              ? "Export playlist to Spotify"
              : "Connect Spotify to export"}
          </button>
```

with:

```tsx
          <button
            disabled={!session?.user?.spotifyConnected}
            className={`w-full lg:max-w-md py-4 rounded-full font-display font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              session?.user?.spotifyConnected
                ? "bg-spotify-green text-black hover:opacity-90 active:scale-95"
                : "bg-spotify-green/30 text-spotify-green/60 cursor-not-allowed"
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              music_note
            </span>
            {session?.user?.spotifyConnected
              ? "Export playlist to Spotify"
              : "Connect Spotify to export"}
          </button>
```

- [ ] **Step 3: Run lint and build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add app/profile/page.tsx app/library/page.tsx
git commit -m "Update profile and library pages for the new account model"
```

---

## Task 19: Full Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests in `tests/*.test.mjs` PASS (including the new `tasteProfile.test.mjs`).

- [ ] **Step 2: Run lint and build**

Run: `npm run lint && npm run build`
Expected: both pass with no errors.

- [ ] **Step 3: Fill in real credentials and smoke test (manual, requires the user)**

This step needs real values in `.env.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`) and the schema already applied from Task 1. Ask the user to provide these (or fill them in themselves) before running this step — do not invent placeholder values and call the smoke test done.

Run: `npm run dev`, then in a fresh/incognito browser:
1. Visit `/app` → complete or skip the taste quiz → confirm the `AuthGate` screen appears and the upload UI is not visible yet.
2. Sign in with Google → confirm redirect back to `/app` shows the upload UI, and `profiles`/`user_taste` rows now exist in Supabase for this user.
3. Upload a photo → confirm analysis completes and results show.
4. Save 2-3 songs and skip 2-3 songs → confirm `track_feedback` rows appear in Supabase with the right `action` and `genres`.
5. Sign out, sign back in with the same email/Google account → confirm `savedSongs` in `/library` still shows what was saved.
6. In Supabase, manually set `profiles.migrated_local_data = false` for a test row, seed `localStorage` with `userTaste`/`vibesong_library`/`vibesong_skipped`/`vibesong_credits` in a fresh browser profile, sign in → confirm `/api/migrate-local` populates Supabase once, and signing in again does not duplicate rows.
7. With curl or similar, call `POST /api/analyze` without any session cookie → confirm `401`.

- [ ] **Step 4: Report results**

Summarize pass/fail for each smoke-test item to the user. Do not claim the feature is complete until all seven checks pass.
