# Apple Music Playlist Import

## Problem

VibeSong's taste signal today comes from three places: onboarding's manual
artist/song picks (`components/onboarding/ArtistStep.tsx`,
`components/onboarding/StorySongsStep.tsx`), in-app swipe feedback, and an
optional Spotify OAuth login (`lib/spotify.ts`) that reads the user's top
artists/tracks. `StorySongsStep` caps favorite songs at 3, typed in one at a
time — there's no way to hand the app a whole playlist's worth of taste in
one action, and no path at all for users who don't want to connect Spotify.

The user wants to add their own playlists to the mix without going through
the official Spotify Web API or Apple Music API (both require OAuth/developer
credentials this project doesn't have set up for playlist read access).

## Goals

- Let a user paste a public Apple Music playlist link and have its tracks
  become taste signal (bias future matches) and candidate pool (eligible as
  direct swipe results), reusing the existing fold-into-`user_taste`
  machinery.
- Zero new API keys, secrets, or developer accounts.
- Graceful, honest fallback to manual entry when a link can't be parsed.

## Non-goals (v1)

- Spotify playlist links. Spotify's public playlist pages don't embed track
  data the way Apple Music's do — reading them requires replicating the web
  player's internal anonymous-token flow, which is undocumented and can
  break or get rate-limited without notice. Deferred until this feature is
  validated; the manual paste box already covers this case in the meantime.
- Private/collaborative Apple Music playlists (not visible in a logged-out
  page fetch — only public share links work).
- CSV/file upload. Dropped in favor of the link-paste flow per discussion;
  can be revisited if link parsing proves too fragile in practice.

## Design

### 1. `lib/appleMusicPlaylist.ts` (new)

```
parseAppleMusicPlaylist(url: string): Promise<{ tracks: {title,artist}[]; truncated: boolean; totalFound: number }>
```

**Revised after fetching two live playlists (one editorial, one
user-created) during planning — corrects an assumption from the first draft
of this spec.** The page does ship a `<script type="application/ld+json">`
block with a clean `MusicPlaylist.track[]` list, but each track only has
`name` (title) — **no artist field**. Artist names instead live in a
second embedded blob, `<script type="application/json"
id="serialized-server-data">`, which is Apple's internal Vue SSR
component-tree state (deeply nested, framework-internal markers like
`"$kind": "flowAction"`). This is *not* a documented/stable format — it's
in the same risk class as the Spotify anonymous-token approach ruled out
earlier, just packaged as embedded JSON instead of a runtime call. Verified
working today against `us/playlist/todays-hits/...` (50/50 tracks, in
order, zero duplicates) and `us/playlist/playlist-by-me/...` (28/28
tracks) — a user-created playlist, not just Apple's own editorial ones.

- Validates the URL host is `music.apple.com` and the path contains
  `/playlist/`; throws a typed error otherwise (`InvalidUrlError`).
- Server-side `fetch()` of the page with a browser-like `User-Agent` header
  (Node runtime only, same rule as every other external call in this
  codebase per `AGENTS.md`) — Apple's page did not reliably return full
  content without one during testing.
- Extracts the `serialized-server-data` JSON blob and recursively walks the
  parsed object tree, collecting every node where sibling properties
  `title` (string) and `artistName` (string) both exist — these are track
  entries, in document order, deduped by lowercase `title|artist`. No JSON-LD
  parsing needed; this single blob carries both fields.
- Throws a typed `ParseError` if the blob is missing or the walk finds zero
  pairs (private playlist, page structure changed, etc.) — the caller turns
  this into the "couldn't read that playlist" UI message agreed on earlier,
  never a silent fallback.
- Caps the returned list at 30 tracks (playlist order); if the source had
  more, `truncated: true` and `totalFound` carries the original count so the
  caller can show "imported the first 30 of N."

### 2. `app/api/taste/import-playlist/route.ts` (new)

`POST { url: string }`, mirrors the shape of the existing
`app/api/taste/story-songs/route.ts`:

1. Auth-gate with `getSupabaseUser()` (401 if signed out — same as every
   other `/api/taste/*` route).
2. `parseAppleMusicPlaylist(url)`. On `InvalidUrlError`/`ParseError`, return
   422 with a message the client renders as "Couldn't read that playlist —
   paste the songs instead," pointing at the existing manual entry UI.
3. Batch the parsed tracks through `autoTagSong` → `insertSong`, 5 at a time
   via `Promise.allSettled` (not all-at-once — 30 concurrent OpenAI tagging
   calls is unnecessary load for one paste).
4. Fold successfully-tagged tracks into `user_taste` using the *same*
   read-existing-then-merge logic already in `story-songs/route.ts`
   (`emotional_vector` weighted add, `genreScores` bump, tagged IDs appended
   to `favoriteStorySongs`) — no separate taste-merge implementation.
5. Respond `{ resolved: [...], truncated: boolean, skipped: number }` so the
   client can show "added 24 of 27 songs" (a few tracks can fail to tag/
   insert; that's not a whole-request failure).

`favoriteStorySongs` has no cap today beyond what `StorySongsStep` enforces
client-side (3) — this route removes that ceiling, so a user who imports a
playlist and later adds manual songs keeps accumulating normally.

### 3. UI: reusable playlist-import entry point

`StorySongsStep` is onboarding-only (`components/OnboardingFlow.tsx`) —
there's currently no post-onboarding place to add favorite songs at all.
Since playlist import is exactly the kind of thing an existing user wants to
do later (not just at signup), the input + submit + result-state logic lives
in one new `components/PlaylistImport.tsx` (URL input, submit button, states:
idle → resolving ("Reading your playlist…") → success, matching the
`pickedCount`/tag-pill visual language already in `StorySongsStep` → error
with a 422 message and a way to jump to manual entry), rendered in two
different shells:

- **Profile page** (`app/profile/page.tsx`): a new "Import a playlist" button
  in the existing left-column action stack, between "Manage credits"
  (`:147-152`) and "Retake quiz" (`:154-159`), same outline-button styling
  (`border border-hot-pink text-hot-pink`). Tapping it opens `PlaylistImport`
  inside a bottom sheet, reusing the sheet pattern already built for
  `components/ShareSheet.tsx` rather than adding a permanently-visible input
  to an already busy page. This is the primary entry point for returning
  users — the gap that makes the feature useful beyond signup.
- **Onboarding** (`components/onboarding/StorySongsStep.tsx`): no sheet
  needed since the step is already a dedicated full-screen surface. A "or
  paste an Apple Music playlist link" toggle above the manual artist/title
  inputs (`:106-142`) swaps in `PlaylistImport` inline, so the two entry
  methods don't compete for space simultaneously.

### Error handling summary

| Failure | Response | User sees |
|---|---|---|
| Not signed in | 401 | Existing sign-in prompt |
| Not an Apple Music playlist URL | 422 `InvalidUrlError` | "That doesn't look like an Apple Music playlist link — paste songs instead" |
| Page fetched but `serialized-server-data` missing/empty | 422 `ParseError` | "Couldn't read that playlist — paste songs instead" |
| Individual track fails to tag/insert | Included in `skipped` count | "Added 24 of 27 songs" (not a hard failure) |
| Playlist longer than 30 tracks | 200, `truncated: true` | "Imported the first 30 tracks" |

## Testing

Following this codebase's existing convention (`tests/itunes.test.mjs`,
`tests/songs.test.mjs`): only pure, network-free functions get automated
unit tests; thin fetch/DB-touching wrappers and Next.js route handlers don't
have dedicated test files and are covered by manual QA instead.

- Unit tests for the pure pieces of `lib/appleMusicPlaylist.ts` — URL
  validation, the tree-walk extractor (fed literal JSON strings shaped like
  the real `serialized-server-data` blob, not a live fetch), and the 30-track
  cap/truncation logic.
- Unit tests for `lib/importSongs.ts`'s `resolveAndFoldSongs` (the shared
  tag/insert/fold-into-taste helper used by both this route and the existing
  `story-songs` route), using the same Supabase-stub pattern as
  `tests/songs.test.mjs`.
- Manual QA: paste a real public Apple Music playlist link end-to-end (both
  `us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb` and a
  user-created playlist were confirmed to parse correctly during planning),
  from both onboarding and the profile screen; verify a subsequent photo
  upload's matches reflect the imported taste.
