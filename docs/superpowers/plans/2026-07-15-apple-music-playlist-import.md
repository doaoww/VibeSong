# Apple Music Playlist Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users paste a public Apple Music playlist URL, import up to 30 tracks, and fold those tracks into the existing taste profile.

**Architecture:** Add a server-only Apple Music JSON-LD parser, share the existing story-song taste merge through a reusable helper, expose a new `/api/taste/import-playlist` route, and add one reusable client component rendered in onboarding and profile.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, node:test, Supabase helpers already present in the repo.

## Global Constraints

- No Apple Music API, Spotify API, new keys, or developer accounts.
- Only public `music.apple.com/.../playlist/...` links are supported.
- Cap parsed playlist tracks at 30, preserving playlist order.
- External fetch and tagging run server-side in Node runtime only.
- Return 422 for invalid/unreadable playlist links with honest fallback messages.
- Do not touch unrelated dirty files.

---

### Task 1: Apple Music Playlist Parser

**Files:**
- Create: `lib/appleMusicPlaylist.ts`
- Create: `tests/appleMusicPlaylist.test.mjs`
- Create: `tests/fixtures/apple-music-playlist.html`
- Create: `tests/fixtures/apple-music-no-jsonld.html`

**Interfaces:**
- Produces: `parseAppleMusicPlaylist(url: string): Promise<AppleMusicTrack[]>`
- Produces: `InvalidUrlError`, `ParseError`

- [ ] Write failing parser tests for valid playlist, invalid host/path, missing JSON-LD, and truncation.
- [ ] Run `node --test tests/appleMusicPlaylist.test.mjs` and confirm failures.
- [ ] Implement parser with URL validation, server `fetch`, JSON-LD extraction, track normalization, and 30-track cap.
- [ ] Re-run parser tests and confirm pass.

### Task 2: Shared Taste Merge Helper

**Files:**
- Create: `lib/taste/importSongs.ts`
- Create: `tests/importSongs.test.mjs`
- Modify: `app/api/taste/story-songs/route.ts`

**Interfaces:**
- Produces: `importSongsIntoTaste(userId: string, songs: StorySongInput[], options?: { batchSize?: number }): Promise<ImportedSongResult>`
- Consumes: `autoTagSong`, `insertSong`, `getUserTaste`, `upsertUserTaste`, `getEmotionalVector`, `upsertEmotionalVector`

- [ ] Write failing tests proving imported tracks batch at 5, merge vectors/genres/favorite IDs, skip failed tracks, and preserve existing taste.
- [ ] Run `node --test tests/importSongs.test.mjs` and confirm failures.
- [ ] Implement helper and update `story-songs` route to reuse it with the existing 3-song input cap.
- [ ] Re-run helper tests and targeted existing story-song behavior where feasible.

### Task 3: Import Playlist API Route

**Files:**
- Create: `app/api/taste/import-playlist/route.ts`
- Create: `tests/importPlaylistRoute.test.mjs`

**Interfaces:**
- Consumes: `parseAppleMusicPlaylist`
- Consumes: `importSongsIntoTaste`
- Produces: `POST /api/taste/import-playlist`

- [ ] Write failing route tests for 401 signed-out, 422 invalid URL, 422 parse error, and 200 success payload with `resolved`, `truncated`, `skipped`.
- [ ] Run `node --test tests/importPlaylistRoute.test.mjs` and confirm failures.
- [ ] Implement route with Node runtime, auth gate, typed error mapping, and JSON response shape.
- [ ] Re-run route tests and confirm pass.

### Task 4: Playlist Import Client UI

**Files:**
- Create: `components/PlaylistImport.tsx`
- Modify: `components/onboarding/StorySongsStep.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`

**Interfaces:**
- Produces: `<PlaylistImport onImported?: () => void onManualFallback?: () => void compact?: boolean />`
- Consumes: `POST /api/taste/import-playlist`

- [ ] Add UI source checks or component tests that assert the API endpoint, profile entry button, and onboarding toggle exist.
- [ ] Run the checks and confirm failures.
- [ ] Implement the reusable component with idle/loading/success/error states.
- [ ] Render it inline in `StorySongsStep` behind a toggle and in `profile` inside a bottom sheet.
- [ ] Add English and Russian translation keys.
- [ ] Re-run checks.

### Task 5: Verification

**Files:**
- Verify all changed files.

- [ ] Run `npm test -- tests/appleMusicPlaylist.test.mjs tests/importSongs.test.mjs tests/importPlaylistRoute.test.mjs`.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build` if environment variables are available; otherwise record the exact blocker.
