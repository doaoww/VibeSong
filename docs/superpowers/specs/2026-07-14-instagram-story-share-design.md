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

## Change (v2)

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
- No server-side image generation or storage — cards are generated and
  discarded client-side, never uploaded or persisted.
- No changes to credits, matching, or the swipe/save data model
  (`store/useAppStore.ts`) beyond reading existing `Track` fields.
- No video story support — photo only, matching the rest of the current
  product surface.
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
