# Instagram Story Share

## Problem

VibeSong's promise is "upload a photo, get the perfect song for your Story" —
but today the loop stops short of Instagram. A user swipes, saves a song, and
is left to screenshot the app and manually recreate a story in Instagram
themselves. The results screen already has a `share` icon in the header
(`app/results/page.tsx:302-306`) that has never been wired to anything. This
is exactly the "Viral growth through shareable vibe cards" goal named in
`docs/BRD.md`, not yet built (tracked as Phase 3 in `docs/PRD.md`).

## Change

### 1. Shareable card image (`lib/shareCard.ts`, new)

A pure function that renders a 1080×1920 PNG (Instagram Story aspect) to an
offscreen `<canvas>` and resolves a `Blob`:

- Background: the user's uploaded photo (`uploadedImageUrl` /
  `Track.sourceImage`), cover-fit to the full frame.
- Bottom third: a dark gradient overlay for legibility.
- A rounded "music sticker" plate near the bottom, styled like Instagram's
  native music sticker: track artwork thumbnail (`track.artwork ||
  track.thumbnail`), track title (bold), artist (muted) below it.
- Small "VibeSong" wordmark watermark in a corner.
- No other text, decoration, or UI chrome — just photo + song + watermark, as
  confirmed with the user.

Pure function signature: `generateShareCard(track: Track, photoUrl: string) =>
Promise<Blob>`. No network calls, no server round-trip — everything needed
(photo, artwork, track title/artist) is already available client-side by the
time a card is saved.

### 2. `components/ShareSheet.tsx` (new)

A bottom sheet (Framer Motion, consistent with existing sheet/modal patterns
in the codebase) that:

- Shows a preview of the generated card.
- Renders **"Добавить в историю"** ("Add to Story") as the primary action.
- Renders **"Скачать фото"** ("Download photo") as a secondary action,
  always available.
- Has a plain close/dismiss (tap outside or X) — never blocks the swipe flow
  underneath.

### 3. "Add to Story" behavior (platform feature-detected)

No Instagram Graph API, no OAuth, no Meta app review — all client-side:

- **iOS Safari**: write the PNG to the clipboard as a `ClipboardItem` tagged
  with Instagram's documented pasteboard UTI
  (`com.instagram.sharedSticker.backgroundImage`), then navigate to
  `instagram-stories://share?source_application=<FB_APP_ID>`. Instagram opens
  directly into the Stories composer with the image pre-loaded.
- **Android / other browsers supporting Web Share API with files**:
  `navigator.canShare({ files: [file] })` check, then
  `navigator.share({ files: [file] })`. This opens the OS share sheet, where
  Android surfaces "Instagram Story" as its own direct target alongside
  "Instagram" — still a one- or two-tap flow.
- **No support detected** (desktop browsers, older mobile browsers): hide the
  "Add to Story" button entirely; "Download photo" remains the only action.
- `FB_APP_ID` is a public, non-secret identifier — safe to inline as a client
  constant, no env var/secret handling needed. In practice Instagram does not
  strictly validate this value for the pasteboard-trick path (unlike a full
  native SDK integration), so a placeholder numeric ID is enough to ship; the
  implementation plan should verify this against a real device before
  treating it as done, and swap in a real Meta App ID later only if analytics
  attribution on Meta's side ever becomes a goal (it isn't one here).

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
- No server-side image generation or storage — cards are generated and
  discarded client-side, never uploaded or persisted.
- No changes to credits, matching, or the swipe/save data model
  (`store/useAppStore.ts`) beyond reading existing `Track` fields.
- No video story support — photo only, matching the rest of the current
  product surface.

## Note on concurrent work

`docs/superpowers/specs/2026-07-14-pitch-ready-polish-design.md` (same day,
separate effort) also touches `app/results/page.tsx` and `SwipeCard.tsx`
(match-score breakdown, live re-rank). No overlap in the lines/behavior this
spec touches (`handleSave` gains a `ShareSheet` open call; the pitch-polish
spec touches score display and card reordering), but both should be checked
against the current diff before either lands, to avoid a messy merge.
