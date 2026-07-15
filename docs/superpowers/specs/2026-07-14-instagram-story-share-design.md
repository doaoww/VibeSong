# Instagram Story Share

## Problem

VibeSong's promise is "upload a photo, get the perfect song for your Story" —
but today the loop stops short of Instagram. A user swipes, saves a song, and
is left to screenshot the app and manually recreate a story in Instagram
themselves. The results screen already has a `share` icon in the header
(`app/results/page.tsx:302-306`) that has never been wired to anything. This
is exactly the "Viral growth through shareable vibe cards" goal named in
`docs/BRD.md`, not yet built (tracked as Phase 3 in `docs/PRD.md`).

## Revision history

**v1 (reverted):** shipped and tested on a real device. Instagram opened via
the deep link, but the background photo never appeared and — per design —
the track was only ever baked as flat text onto the image, never a real
attached element. Root-caused to two things, both corrected in v2 below:

1. `FB_APP_ID` was a placeholder (`"0"`). Unlike what v1's spec assumed,
   Instagram appears to silently ignore the pasteboard payload (background
   image) when `source_application` isn't a real, registered Meta App ID —
   the deep link itself still opens Instagram (no app-id check there), but
   the image hand-off is silently dropped.
2. Baking the track title/artist as flat text onto the shared photo was
   never a real "song added to Instagram" experience — Instagram's own
   Music sticker (the thing that actually looks/behaves like an attached
   song, with real playback/attribution) can only be added by the user
   through Instagram's own in-app music search. No web page, and no native
   app without an Apple/Google accessibility entitlement (which is not
   obtainable for automating a third-party app's UI, and would violate
   platform ToS if used that way), can drive taps or fill text fields
   inside another app's UI once a deep-link hands off control. This is a
   hard OS-level sandboxing boundary, not an engineering gap — v2 stops
   pretending otherwise and designs around it honestly.

v2 (below) fixes #1 and redesigns around #2 instead of masking it.

**v3 (current):** before v2 could be verified on a real device, the user
hit an external blocker — registering the required Meta App ID
(developers.facebook.com) failed for reasons outside this app's control.
Rather than debug third-party account/registration issues, v3 drops the
pasteboard/App-ID mechanism entirely and pivots to something that doesn't
depend on Instagram's cooperation at all:

3. Instead of trying to pre-fill Instagram's Stories background (which
   needs the App ID) or its Music sticker (which is impossible per #2
   above), v3 generates a real 15-second **video** — the photo, full-bleed,
   with 15 seconds of the track's actual audio baked in — server-side via
   ffmpeg. A video with real audio already encoded into it doesn't need
   Instagram's Music sticker or any pasteboard trick to "have the song
   attached": when the user posts this video anywhere (Instagram Story,
   feed, any other platform), the audio just plays, because it's genuinely
   part of the file. "Open Instagram" becomes a plain link/app-open (no
   App ID, no pasteboard) with the track name copied to the clipboard as a
   convenience, and the user downloads the video and posts it themselves.

v3 (below) replaces v2's client-side canvas card + pasteboard/Web-Share
hand-off with server-side video generation + a plain Instagram-opener.

## Change (v3)

### 1. Video generation endpoint (`app/api/share-video/route.ts`, new)

A Node-runtime API route (ffmpeg needs a real child process, not Edge) that
combines a user's photo with 15 seconds of a track's preview audio into an
MP4, sized for Stories (1080×1920):

- **Input**: `multipart/form-data` POST with `photo` (the image file) and
  `previewUrl` (the track's existing preview-audio URL — the same
  `Track.previewUrl` field already used for in-app playback) and an
  optional `startSeconds` (from `Track.viralMomentSeconds`, the same field
  `YouTubePlayer` already uses to start playback at the track's most
  "grabby" moment — reused here as the trim start point; defaults to `0`
  if absent).
- **Processing**: ffmpeg (via the `ffmpeg-static` binary + `fluent-ffmpeg`,
  or an equivalent spawn wrapper) takes the photo as a looped still image,
  the audio trimmed to `[startSeconds, startSeconds + 15]` directly from
  `previewUrl` (ffmpeg reads network URLs as input directly — no separate
  download step needed), scales/crops the photo to 1080×1920 (cover-fit,
  same crop semantics as v2's now-removed `computeCoverFit`, just done by
  ffmpeg's `scale`+`crop` filters instead of canvas), and encodes to H.264
  video + AAC audio, exactly 15 seconds (`-shortest -t 15`).
- **Output**: the resulting MP4 streamed back as the response
  (`Content-Type: video/mp4`), not stored anywhere server-side —
  generated and discarded per request, consistent with this feature's
  existing "no persistence" principle.
- **No text, logo, or watermark drawn onto the video** — same as v2's
  photo-only card, just now a photo-plus-audio video instead of a
  photo-only image.
- If a track has no `previewUrl` at all, this endpoint is never called —
  the client falls back to offering a plain photo download instead (see
  §2).
- **Known infrastructure risk, called out explicitly rather than assumed
  away** (this app has been burned twice now by assumptions that looked
  fine on paper and failed in the real deployed environment): Vercel
  serverless functions have execution-time limits that vary by plan
  (typically short by default unless `export const maxDuration = ...` is
  set, and even then capped by the plan tier), and bundling the `ffmpeg`
  binary adds real deployment size. The implementation plan's first task
  is a minimal smoke test — deploy the simplest possible version of this
  endpoint and confirm it actually produces a valid video on Vercel —
  before building the rest of the UI around it, specifically so this risk
  surfaces immediately rather than after another full build-and-ship
  cycle.

### 2. `components/ShareSheet.tsx` (rewritten)

Same bottom-sheet shell as v2, different content and mechanism:

- On open, immediately shows the user's plain photo as a preview (no
  canvas processing needed client-side anymore — v2's `lib/shareCard.ts`
  is removed entirely).
- In the background, if the track has a `previewUrl`, kicks off a request
  to `/api/share-video` and shows "Генерируем видео…"; once it resolves,
  enables **"Скачать видео"** ("Download video") — this **replaces**
  "Скачать фото" entirely, per the user's explicit choice. If the track
  has no `previewUrl`, no video request is made at all, and the sheet
  falls back to offering a plain **"Скачать фото"** button instead (the
  one exception to "replaces entirely" — there's nothing to generate a
  video from).
- **"Открыть Instagram"** button: tapping it (a) copies
  `"{track.title} — {track.artist}"` to the clipboard via
  `navigator.clipboard.writeText`, (b) shows the same confirmation view as
  v2 ("✓ Скопировано: ...", "В Instagram: Стикеры → Музыка → Вставить"),
  then (c) a single further tap simply opens Instagram (e.g. navigating to
  a plain `https://www.instagram.com/` link, or the OS handling an
  `instagram://` scheme if installed) — no pasteboard write, no App ID, no
  platform branching. The user is expected to post the already-downloaded
  video themselves and paste the song name into Instagram's own Music
  sticker search, same manual step as v2 (this app still cannot drive taps
  inside Instagram's UI — that constraint hasn't changed, see Revision
  history #2).
- No platform feature-detection is needed anymore for the Instagram button
  itself (opening a link/app works everywhere) — `lib/instagramShare.ts`'s
  `isIOSSafari`/`canUseWebShareFiles`/`getFacebookAppId`/
  `shareToInstagramStory` and all of `lib/shareCard.ts` become unused and
  are removed.

### 3. Entry points

Unchanged from v2 — still `app/results/page.tsx` (`handleSave` + header
icon) and `app/library/page.tsx` (per-row icon, still gated on
`song.sourceImage`, since a video/photo still needs a photo to start from).

## Superseded (v2, kept for history — do not implement)

### 1. Shareable card image (`lib/shareCard.ts`, new)

A pure function that renders a 1080×1920 PNG (Instagram Story aspect) to an
offscreen `<canvas>` and resolves a `Blob`:

- Just the user's uploaded photo (`uploadedImageUrl` / `Track.sourceImage`),
  cover-fit to the full frame. **No track title/artist/artwork drawn onto
  it** — v1 baked the song info into the image; v2 drops that, since the
  real song attribution now comes from the user adding Instagram's own
  Music sticker (see §3), and duplicating it as flat text on the photo
  would be redundant/inconsistent with whatever they actually search for.
- No watermark, logo, gradient, or any other decoration — just the photo,
  as-is.

Pure function signature: `generateShareCard(photoUrl: string) =>
Promise<Blob>`. No network calls, no server round-trip.

### 2. `components/ShareSheet.tsx` (new)

A bottom sheet (Framer Motion, consistent with existing sheet/modal patterns
in the codebase) that:

- Shows a preview of the generated card (the plain photo).
- Renders **"Добавить в историю"** ("Add to Story") as the primary action.
- Renders **"Скачать фото"** ("Download photo") as a secondary action,
  always available.
- Has a plain close/dismiss (tap outside or X) — never blocks the swipe flow
  underneath.
- **Confirmation step before handoff:** tapping "Добавить в историю" does
  NOT immediately navigate to Instagram. It first (synchronously, in the
  same tap so clipboard-write permissions stay tied to the user gesture)
  copies the plain text `"{track.title} — {track.artist}"` to the
  clipboard via the standard, universally-supported `navigator.clipboard.
  writeText` — this is the one step common to both platforms, and it's
  what the confirmation message below is about. It then swaps the sheet's
  content to a confirmation view:
  - "✓ Скопировано: **{title} — {artist}**"
  - "В Instagram: Стикеры → Музыка → Вставить"
  - A single button, **"Открыть Instagram →"**, which is the only thing
    that actually triggers the `instagram-stories://` navigation.
  This guarantees the user has seen the paste instructions before control
  leaves our page — v1's mistake was assuming a toast could survive/be
  seen through an instant redirect; v2 makes the redirect an explicit,
  separate second tap instead of relying on timing.
  In this confirmation view, the "Скачать фото" button is replaced by the
  single "Открыть Instagram →" button (downloading is no longer the point
  once they've chosen to add to their Story); the close/dismiss (X) stays
  available throughout, including from the confirmation view, with no
  side effect beyond closing (whatever's already on the clipboard simply
  stays there).

### 3. "Add to Story" behavior (platform feature-detected)

No Instagram Graph API, no OAuth, no Meta app review — all client-side.
The plain-text clipboard copy (§2) happens uniformly on the first tap; the
platform-specific mechanics below all happen on the second tap ("Открыть
Instagram →"), since that tap is itself a fresh user gesture and each of
these APIs needs to be invoked directly within a gesture handler:

- **iOS Safari**: on the confirmation-step tap ("Открыть Instagram →"),
  write the PNG to the clipboard as a `ClipboardItem` tagged with
  Instagram's documented pasteboard UTI
  (`com.instagram.sharedSticker.backgroundImage`), then navigate to
  `instagram-stories://share?source_application=<FB_APP_ID>`. Instagram
  opens directly into the Stories composer with the image pre-loaded as the
  background. The user must still manually tap Stickers → Music → paste to
  add a real, Instagram-recognized Music sticker — this app cannot do that
  step for them (see Revision history #2).
- **Android / other browsers supporting Web Share API with files**:
  `navigator.canShare({ files: [file] })` check, then
  `navigator.share({ files: [file] })` on the same confirmation-step tap.
  This opens the OS share sheet, where Android surfaces "Instagram Story"
  as its own direct target alongside "Instagram" — still a one- or two-tap
  flow from there. The clipboard text copy still happens the same way, so
  the same "paste the song name into Music sticker search" flow applies
  once inside Instagram.
- **No support detected** (desktop browsers, older mobile browsers): hide
  the "Add to Story" button entirely; "Download photo" remains the only
  action.
- `FB_APP_ID` **must be a real, registered Meta App ID** this time — v1's
  placeholder (`"0"`) is the prime suspect for the background-image
  failure on real-device testing. Register a free app at
  developers.facebook.com (no App Review needed — Stories sharing via the
  pasteboard/intent hand-off is a review-exempt capability, unlike the
  Graph Content Publishing API used for programmatic feed posts). The user
  will do this registration themselves (requires their own Facebook
  account) and provide the resulting App ID before this ships.

### 4. Entry points

- `app/results/page.tsx`: `handleSave` now also opens `ShareSheet` for the
  just-saved track (non-blocking overlay — closing it returns to the swipe
  stack exactly where the user left off, no changes to `gone`/`nextCard`
  logic).
- The existing but unwired header `share` icon (`app/results/page.tsx:302`)
  opens the same `ShareSheet` for the current top card.
- `app/library/page.tsx`: each saved-song row gets a share icon (mirrors the
  existing per-row play affordance) that opens `ShareSheet` for that row's
  track, using its stored `sourceImage`.

## Out of scope

- Posting to the Instagram **Feed** (regular post). Instagram provides no
  client-side deep link for the feed composer; the only programmatic path is
  the Instagram Graph Content Publishing API, which only works for
  Business/Creator accounts (not personal accounts, which is most of this
  app's users), requires Facebook OAuth login, and requires Meta app review.
  Explicitly deferred — "Download photo" is the fallback for manual feed
  posting.
- No Instagram account linking/login anywhere in this feature.
- No server-side **storage** — the v3 video endpoint generates and streams
  the MP4 back per-request with no database row, blob store, or file left
  behind; "no server round-trip" from v1/v2 is revised in v3 specifically
  for video generation (ffmpeg cannot run in-browser reliably enough to
  trust for this), but the "nothing persisted" principle still holds.
- No changes to credits, matching, or the swipe/save data model
  (`store/useAppStore.ts`) beyond reading existing `Track` fields.
- No video **animation/Ken Burns effect** — the photo is static for the
  full 15 seconds; no zoom/pan, matching the "no decoration" principle
  carried over from v2's card.
- No attempt to auto-open Instagram's Music sticker panel, auto-focus its
  search field, or auto-fill/auto-submit a search inside Instagram's UI —
  there is no API, deep-link parameter, or accessibility hook that allows
  this from outside Instagram's own app, on either iOS or Android. The
  clipboard-text-copy + on-screen instructions in §2 is the actual ceiling
  of what's achievable here.

## Note on concurrent work

`docs/superpowers/specs/2026-07-14-pitch-ready-polish-design.md` (same day,
separate effort) also touches `app/results/page.tsx` and `SwipeCard.tsx`
(match-score breakdown, live re-rank). No overlap in the lines/behavior this
spec touches (`handleSave` gains a `ShareSheet` open call; the pitch-polish
spec touches score display and card reordering), but both should be checked
against the current diff before either lands, to avoid a messy merge.
