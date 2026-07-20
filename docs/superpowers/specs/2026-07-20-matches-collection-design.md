# Matches Collection Screen

## Problem

A "match" in VibeSong is the pairing of a user's uploaded photo with the song
AI matched to it — that's the whole product ("Твоё фото. Твой саундтрек.").
Today there is nowhere in the app that actually shows that pairing. `/library`
(`app/library/page.tsx`) lists saved songs as plain rows — album art or a
tiny 32px circular photo badge, title, artist. The user reported this reads
as "photos aren't being saved" even though they are: direct inspection of
`track_feedback.source_image` confirms every one of this user's swipe-session
rows has the photo attached (7/7 rows checked). The photo is there; there's
just no screen that shows it.

## Goals

- A dedicated screen where each match is presented as photo + song together.
- Reachable from Profile ("Мои мэтчи" → "Смотреть все").
- No changes to `/library`, which stays the plain song list it is today.
- No backend changes — `sourceImage` is already captured and persisted
  correctly (`store/useAppStore.ts:150,180,189,225` →
  `lib/db/trackFeedback.ts:66-84` → `track_feedback.source_image`).

## Non-goals

- No bottom-nav entry (confirmed with user — Profile is the only entry point).
- No change to `/library`'s row layout, filters, or behavior.
- No redesign of the profile mini-preview grid (`app/profile/page.tsx:201-230`)
  — it already shows photo-first square tiles and is out of scope here.

## Route & entry point

New page: `app/matches/page.tsx`, route `/matches`.

`app/profile/page.tsx:194-199` — the "Смотреть все" link under "Мои мэтчи"
changes from `href="/library"` to `href="/matches"`. Nothing else on the
profile page changes.

## Data

Reuses the existing store — no new API route:

- `useAppStore().savedSongs`, populated by `loadFeedback()`
  (`store/useAppStore.ts:247-270`), which already fetches `sourceImage` via
  `GET /api/feedback`.
- The matches screen filters this list client-side to
  `savedSongs.filter(s => s.sourceImage)` — matches without a photo (e.g.
  onboarding-quiz likes, which were never tied to an uploaded photo) are
  dropped from this view entirely, per user decision. They remain visible in
  `/library` as before.

## Layout

Square card grid, `grid-cols-2 md:grid-cols-3`, following the visual
language already used on `/explore` (`app/explore/page.tsx:100-138`) and the
mobile layout of `SwipeCard` (`components/SwipeCard.tsx:129-159`):

- `song.sourceImage` fills the card edge-to-edge (`object-cover`,
  `aspect-square`).
- Bottom gradient scrim (`bg-gradient-to-t from-black/70 to-transparent`)
  holding title, artist, and `matchScore%` — same text treatment as
  `/explore`'s cards.
- Small share icon, top-right corner, shown on every card (every card here
  has a photo by construction, so sharing is always available — unlike
  `/library`, which conditionally shows it).

## Interactions

- Tap the card body → toggle inline audio preview via `song.previewUrl`,
  same single-active-track pattern as `/library` (`app/library/page.tsx:55-72`,
  one shared `<audio>` element, tapping the currently-playing card pauses it).
- Tap the share icon → opens `ShareSheet` (`components/ShareSheet.tsx`) with
  that track and its `sourceImage`, same wiring as `/library`'s share button.

## Filters

Same four chips as `/library` (All / This Week / Moody / Hype), reusing
`filterSongs()`/`FILTERS` (`app/library/page.tsx:12-22`) applied after the
photo filter. `Moody`/`Hype` are currently no-ops in that function (fall
through to returning all songs unchanged) — this spec doesn't change that;
it's pre-existing `/library` behavior being mirrored, not introduced here.

## Empty state

If `savedSongs` has no entries with a photo, show the same empty-state
pattern as `/library` (icon + message + "Upload a photo" CTA to `/app`), with
copy specific to this screen (e.g. "No matches with a photo yet").

## Verification

- `node --test tests/*.test.mjs` and `npx tsc --noEmit` must stay clean.
- Manual check: upload a photo, save/skip a track, confirm it appears on
  `/matches` with the photo visible, and does *not* need a second visit to
  `/library` to be "found."
