# Instagram Story Share v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user share their photo straight to an Instagram Story, with the song's name copied to their clipboard so they can drop it into Instagram's own Music sticker in two taps.

**Architecture:** A pure client-side canvas renderer (`lib/shareCard.ts`) turns the user's uploaded photo into a 1080×1920 PNG (no text baked in this time). A platform-detection module (`lib/instagramShare.ts`) picks the best available share path with no API/OAuth: the iOS Safari pasteboard→`instagram-stories://` deep link, or the Web Share API elsewhere. A new `ShareSheet` component runs a two-tap flow — tap 1 copies the track name to the clipboard and shows paste instructions; tap 2 actually hands the photo off to Instagram — wired into the same three entry points as before: right after saving a song, the results-screen header icon, and a per-row icon on the library screen.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Framer Motion, Zustand, Tailwind v4, Node's built-in test runner (`node --test`), Node 24 native TS type-stripping (no build step needed to `import("*.ts")` in tests).

## Why v2 (read this before touching anything)

A v1 of this feature was fully built, reviewed, deployed, and then **reverted**
after real-device testing: Instagram opened, but the photo never appeared,
and the song was only ever flat text baked into the image — never a real
attached element. Full root-cause and rationale:
`docs/superpowers/specs/2026-07-14-instagram-story-share-design.md`
("Revision history" section). In one line: the placeholder `FB_APP_ID`
likely caused Instagram to silently drop the background image, and no web
page or app can programmatically operate Instagram's own Music-sticker
search UI — that is a hard OS sandboxing boundary, not a bug to fix. v2
requires a **real** Meta App ID and redesigns the song-attachment step
around a clipboard-copy + explicit two-tap confirmation instead of
pretending to automate the impossible.

## Global Constraints

- No Instagram Graph API, no OAuth, no Meta app review — every share action is client-side only.
- No feed-post button — "Download photo" is the only feed-posting path (manual).
- The shared image is **just the user's photo** — no text, watermark, logo, or decoration drawn onto it. (This differs from v1, which baked track title/artist onto the image — that's removed in v2.)
- No server round-trip for card generation — everything renders in-browser from data already in the client.
- **`NEXT_PUBLIC_FACEBOOK_APP_ID` must be a real, registered Meta App ID**, not a placeholder — register a free app at developers.facebook.com (no App Review needed for Stories sharing) and add it to `.env.local` and to the Vercel project's environment variables. This is the user's action (requires their own Facebook account) — until it's set, `getFacebookAppId` returns `null` and the iOS deep-link path is correctly treated as unsupported (falls back to "Download photo" only, which is correct behavior, not a bug).
- The "Add to Story" tap is a **two-step flow**: tap 1 (in `ShareSheet`) copies `"{title} — {artist}"` to the clipboard via `navigator.clipboard.writeText` and swaps the sheet to a confirmation view; tap 2 (a distinct "Открыть Instagram →" button) performs the actual platform-specific hand-off (iOS pasteboard image write + deep link, or Web Share). Both taps must each independently be a direct user-gesture-triggered call — never deferred behind an unrelated `await` — because Clipboard/Web-Share APIs require this to keep the browser's permission grant.
- The library screen's per-row share button must only render when `song.sourceImage` exists (v1 shipped this gap and had to patch it after a final review caught it — build it correctly from the start this time).
- `en.ts` / `ru.ts` must stay structurally identical — `ru.ts` is typed as `Translation = typeof en`.
- Follow existing code conventions: double-quoted strings, Tailwind utility classes already used in this codebase (`hot-pink`, `surface-container`, `on-surface-variant`, `outline-variant`, `glow-pink`, `error`), Framer Motion for sheets/modals (see `components/PricingModal.tsx` for the established bottom-sheet pattern), `NEXT_PUBLIC_`-prefixed env vars for client-exposed config (see `app/admin/page.tsx:4`, `process.env.NEXT_PUBLIC_ADMIN_SECRET`).

---

### Task 1: Pure cover-fit math (`lib/shareCard.ts`)

**Files:**
- Create: `lib/shareCard.ts`
- Test: `tests/shareCard.test.mjs`

**Interfaces:**
- Produces: `computeCoverFit(imgWidth: number, imgHeight: number, canvasWidth: number, canvasHeight: number): CoverFit` and the `CoverFit` type — Task 2 imports both from this same file.

`CoverFit` describes how to draw a source image onto the canvas so it fills the frame edge-to-edge, cropping whichever dimension overflows (the same math as CSS `object-fit: cover`). Pure math only — no DOM/canvas here, so this stays unit-testable in Node.

- [ ] **Step 1: Write the failing tests**

Create `tests/shareCard.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const { computeCoverFit } = await import("../lib/shareCard.ts");

test("computeCoverFit crops a wider-than-canvas image on the sides", () => {
  const fit = computeCoverFit(4000, 1000, 1080, 1920);
  assert.equal(fit.offsetY, 0);
  assert.equal(fit.drawHeight, 1920);
  assert.ok(fit.drawWidth > 1080);
  assert.ok(fit.offsetX < 0);
});

test("computeCoverFit crops a taller-than-canvas image on top/bottom", () => {
  const fit = computeCoverFit(1000, 4000, 1080, 1920);
  assert.equal(fit.offsetX, 0);
  assert.equal(fit.drawWidth, 1080);
  assert.ok(fit.drawHeight > 1920);
  assert.ok(fit.offsetY < 0);
});

test("computeCoverFit draws an exact-ratio image with no cropping", () => {
  const fit = computeCoverFit(1080, 1920, 1080, 1920);
  assert.equal(fit.offsetX, 0);
  assert.equal(fit.offsetY, 0);
  assert.equal(fit.drawWidth, 1080);
  assert.equal(fit.drawHeight, 1920);
});

test("computeCoverFit crops a square image into a portrait canvas on the sides", () => {
  const fit = computeCoverFit(1000, 1000, 1080, 1920);
  assert.equal(fit.offsetY, 0);
  assert.equal(fit.drawHeight, 1920);
  assert.ok(fit.drawWidth > 1080);
  assert.ok(fit.offsetX < 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/shareCard.test.mjs`
Expected: fails with `Cannot find module '../lib/shareCard.ts'`.

- [ ] **Step 3: Implement `computeCoverFit`**

Create `lib/shareCard.ts`:

```ts
export interface CoverFit {
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

/**
 * Computes draw offsets/dimensions to render a source image onto a canvas
 * with CSS object-fit: cover semantics — fills the frame edge-to-edge,
 * cropping whichever dimension overflows. Pure math only — canvas drawing
 * happens in generateShareCard (Task 2), which stays untested since it
 * needs a real DOM.
 */
export function computeCoverFit(
  imgWidth: number,
  imgHeight: number,
  canvasWidth: number,
  canvasHeight: number
): CoverFit {
  const imgRatio = imgWidth / imgHeight;
  const targetRatio = canvasWidth / canvasHeight;
  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;
  if (imgRatio > targetRatio) {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * imgRatio;
    offsetX = (canvasWidth - drawWidth) / 2;
  } else {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgRatio;
    offsetY = (canvasHeight - drawHeight) / 2;
  }
  return { offsetX, offsetY, drawWidth, drawHeight };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/shareCard.test.mjs`
Expected: `ℹ tests 4` / `ℹ pass 4` / `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/shareCard.ts tests/shareCard.test.mjs
git commit -m "Add pure cover-fit math for the Instagram share card"
```

---

### Task 2: Canvas rendering (`generateShareCard`)

**Files:**
- Modify: `lib/shareCard.ts`

**Interfaces:**
- Consumes: `computeCoverFit`, `CoverFit` (Task 1, same file).
- Produces: `generateShareCard(photoUrl: string): Promise<Blob>` — this is what `ShareSheet` (Task 6) calls.

This draws to an actual `<canvas>`, which Node's test runner can't exercise (no DOM/jsdom in this project). Verified manually in the browser instead (Task 9). `photoUrl` is always the user's own uploaded photo (a same-origin `blob:`/`data:` URL) — never a cross-origin CDN image — so unlike v1 there is no CORS-taint concern here and no retry-without-artwork logic is needed.

- [ ] **Step 1: Implement the renderer**

Add to `lib/shareCard.ts`:

```ts
export async function generateShareCard(photoUrl: string): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const img = await loadImage(photoUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const fit = computeCoverFit(img.width, img.height, width, height);
  ctx.drawImage(img, fit.offsetX, fit.offsetY, fit.drawWidth, fit.drawHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by `lib/shareCard.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/shareCard.ts
git commit -m "Add canvas rendering for the Instagram share card"
```

---

### Task 3: Platform detection + App ID accessor (`lib/instagramShare.ts`)

**Files:**
- Create: `lib/instagramShare.ts`
- Test: `tests/instagramShare.test.mjs`

**Interfaces:**
- Produces: `isIOSSafari(userAgent: string): boolean`, `canUseWebShareFiles(nav: ShareCapableNavigator, file: File): boolean`, `ShareCapableNavigator` type, `getFacebookAppId(envValue: string | undefined): string | null` — Task 4 adds `shareToInstagramStory` to this same file, reusing all of these.

`getFacebookAppId` takes the raw env value as a parameter (rather than reading `process.env` internally) so it stays testable without mocking Node's global `process` object; the actual call site (Task 6, `ShareSheet.tsx`) passes `process.env.NEXT_PUBLIC_FACEBOOK_APP_ID`.

- [ ] **Step 1: Write the failing tests**

Create `tests/instagramShare.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const { isIOSSafari, canUseWebShareFiles, getFacebookAppId } = await import("../lib/instagramShare.ts");

test("isIOSSafari detects iPhone Safari", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1";
  assert.equal(isIOSSafari(ua), true);
});

test("isIOSSafari detects iPad Safari", () => {
  const ua =
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1";
  assert.equal(isIOSSafari(ua), true);
});

test("isIOSSafari rejects Chrome on iOS (CriOS)", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1";
  assert.equal(isIOSSafari(ua), false);
});

test("isIOSSafari rejects Android Chrome", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
  assert.equal(isIOSSafari(ua), false);
});

test("canUseWebShareFiles reflects navigator.canShare() true", () => {
  const file = new File(["x"], "a.png", { type: "image/png" });
  assert.equal(canUseWebShareFiles({ canShare: () => true }, file), true);
});

test("canUseWebShareFiles reflects navigator.canShare() false", () => {
  const file = new File(["x"], "a.png", { type: "image/png" });
  assert.equal(canUseWebShareFiles({ canShare: () => false }, file), false);
});

test("canUseWebShareFiles is false when canShare is missing entirely", () => {
  const file = new File(["x"], "a.png", { type: "image/png" });
  assert.equal(canUseWebShareFiles({}, file), false);
});

test("getFacebookAppId returns the trimmed value when set", () => {
  assert.equal(getFacebookAppId("  123456789  "), "123456789");
});

test("getFacebookAppId returns null when undefined", () => {
  assert.equal(getFacebookAppId(undefined), null);
});

test("getFacebookAppId returns null for an empty/whitespace-only string", () => {
  assert.equal(getFacebookAppId(""), null);
  assert.equal(getFacebookAppId("   "), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/instagramShare.test.mjs`
Expected: fails with `Cannot find module '../lib/instagramShare.ts'`.

- [ ] **Step 3: Implement the detection functions**

Create `lib/instagramShare.ts`:

```ts
/**
 * True only for actual mobile Safari on iOS — not Chrome/Firefox/Edge on
 * iOS, which all still report "Safari" in their UA string but use WebKit
 * under a different app wrapper that doesn't expose the same pasteboard
 * behavior the Instagram Stories trick relies on.
 */
export function isIOSSafari(userAgent: string): boolean {
  const isIOS = /iP(hone|od|ad)/.test(userAgent);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  const isSafari = /Safari/.test(userAgent);
  return isIOS && isSafari && !isOtherBrowser;
}

export interface ShareCapableNavigator {
  canShare?: (data?: { files?: File[] }) => boolean;
}

export function canUseWebShareFiles(nav: ShareCapableNavigator, file: File): boolean {
  return typeof nav.canShare === "function" && nav.canShare({ files: [file] });
}

/**
 * Reads the Meta/Facebook App ID used for the Stories share deep link's
 * `source_application` parameter. A v1 of this feature shipped with a
 * placeholder ID and the shared photo silently failed to appear in
 * Instagram on real devices — this must be a real, registered Meta App ID
 * (see docs/superpowers/specs/2026-07-14-instagram-story-share-design.md).
 * Takes the raw env value as a parameter rather than reading
 * `process.env` directly so this stays testable without mocking globals.
 */
export function getFacebookAppId(envValue: string | undefined): string | null {
  const trimmed = envValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/instagramShare.test.mjs`
Expected: `ℹ tests 10` / `ℹ pass 10` / `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/instagramShare.ts tests/instagramShare.test.mjs
git commit -m "Add platform detection and App ID accessor for Instagram Story sharing"
```

---

### Task 4: Share orchestration (`shareToInstagramStory`)

**Files:**
- Modify: `lib/instagramShare.ts`

**Interfaces:**
- Consumes: `isIOSSafari`, `canUseWebShareFiles` (Task 3, same file).
- Produces: `shareToInstagramStory(imageBlob: Blob, facebookAppId: string): Promise<ShareOutcome>` and `ShareOutcome` type — `ShareSheet` (Task 6) calls this on the "Открыть Instagram →" (second-tap) button, never on the first tap.

Unlike v1, `facebookAppId` is now a required parameter (not a hardcoded constant) — the caller is responsible for having already confirmed it's non-null via `getFacebookAppId` before calling this. This function touches `navigator.clipboard`, `ClipboardItem`, `window.location`, and `navigator.share` — real browser APIs with no faithful Node stand-in, so this is verified manually (Task 9) rather than via `node --test`, same as Task 2.

- [ ] **Step 1: Implement the orchestration function**

Add to `lib/instagramShare.ts`:

```ts
// Instagram-documented pasteboard type for the Stories composer's background
// image — works from mobile Safari with no OAuth/API, provided
// source_application is a real registered Meta App ID (see
// getFacebookAppId's doc comment above for why this matters).
const INSTAGRAM_STORIES_PASTEBOARD_TYPE = "com.instagram.sharedSticker.backgroundImage";

export type ShareOutcome = "ios-deep-link" | "web-share" | "unsupported";

export async function shareToInstagramStory(
  imageBlob: Blob,
  facebookAppId: string
): Promise<ShareOutcome> {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "unsupported";

  if (isIOSSafari(navigator.userAgent) && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [INSTAGRAM_STORIES_PASTEBOARD_TYPE]: imageBlob }),
      ]);
      window.location.href = `instagram-stories://share?source_application=${facebookAppId}`;
      return "ios-deep-link";
    } catch {
      // Clipboard write can fail on some WebKit versions outside a direct
      // user-gesture call stack — fall through to Web Share API below.
    }
  }

  const file = new File([imageBlob], "vibesong-story.png", { type: "image/png" });
  if (canUseWebShareFiles(navigator, file)) {
    await navigator.share({ files: [file] });
    return "web-share";
  }

  return "unsupported";
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by `lib/instagramShare.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/instagramShare.ts
git commit -m "Add Instagram Story share orchestration"
```

---

### Task 5: Translations

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`

**Interfaces:**
- Produces: a `share` namespace — `t.share.heading`, `t.share.generating`, `t.share.error`, `t.share.previewAlt`, `t.share.addToStory`, `t.share.download`, `t.share.closeAria`, `t.share.openAria`, `t.share.rowAria(title, artist)`, `t.share.copiedConfirmation(title, artist)`, `t.share.pasteInstructions`, `t.share.openInstagram` — `ShareSheet` (Task 6) and the wiring in Tasks 7/8 use these.

- [ ] **Step 1: Add the `share` namespace to `en.ts`**

In `lib/translations/en.ts`, replace:

```ts
    emptyBody: "Upload a photo to get started.",
  },
  explore: {
```

with:

```ts
    emptyBody: "Upload a photo to get started.",
  },
  share: {
    heading: "Share your vibe",
    generating: "Creating your card…",
    error: "Couldn't create the image. Try again.",
    previewAlt: "Your VibeSong story card",
    addToStory: "Add to Instagram Story",
    download: "Download photo",
    closeAria: "Close",
    openAria: "Share this match",
    rowAria: (title: string, artist: string) => `Share ${title} by ${artist}`,
    copiedConfirmation: (title: string, artist: string) => `✓ Copied: ${title} — ${artist}`,
    pasteInstructions: "In Instagram: Stickers → Music → Paste",
    openInstagram: "Open Instagram →",
  },
  explore: {
```

- [ ] **Step 2: Add the matching `share` namespace to `ru.ts`**

In `lib/translations/ru.ts`, replace:

```ts
    emptyBody: "Загрузи фото, чтобы начать.",
  },
  explore: {
```

with:

```ts
    emptyBody: "Загрузи фото, чтобы начать.",
  },
  share: {
    heading: "Поделись своим вайбом",
    generating: "Готовим карточку…",
    error: "Не получилось создать картинку. Попробуй ещё раз.",
    previewAlt: "Карточка для истории VibeSong",
    addToStory: "Добавить в Историю Instagram",
    download: "Скачать фото",
    closeAria: "Закрыть",
    openAria: "Поделиться подбором",
    rowAria: (title: string, artist: string) => `Поделиться: ${title} — ${artist}`,
    copiedConfirmation: (title: string, artist: string) => `✓ Скопировано: ${title} — ${artist}`,
    pasteInstructions: "В Instagram: Стикеры → Музыка → Вставить",
    openInstagram: "Открыть Instagram →",
  },
  explore: {
```

- [ ] **Step 3: Run the translation parity test**

Run: `node --test tests/translations.test.mjs`
Expected: `ℹ tests 5` / `ℹ pass 5` / `ℹ fail 0`

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `ru.ts`'s `share` block matches `en.ts`'s shape exactly).

- [ ] **Step 5: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts
git commit -m "Add share sheet translations"
```

---

### Task 6: `components/ShareSheet.tsx`

**Files:**
- Create: `components/ShareSheet.tsx`

**Interfaces:**
- Consumes: `Track` (from `../store/useAppStore`), `generateShareCard` (Task 2), `isIOSSafari`/`canUseWebShareFiles`/`getFacebookAppId`/`shareToInstagramStory` (Tasks 3–4), `useTranslation` (Task 5's `t.share.*` keys).
- Produces: `<ShareSheet isOpen photoUrl track onClose />` — Tasks 7–8 render this.

This is a two-phase sheet: `"preview"` phase shows the generated photo card with "Добавить в историю"/"Скачать фото"; tapping "Добавить в историю" copies the track name to the clipboard and switches to `"confirmed"` phase, which shows the copied-confirmation text, paste instructions, and a single "Открыть Instagram →" button that performs the actual platform hand-off. `canAddToStory` on iOS additionally requires a non-null `FACEBOOK_APP_ID` — without one, the button is correctly hidden rather than attempting a hand-off that's known to silently fail.

- [ ] **Step 1: Implement the component**

Create `components/ShareSheet.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Track } from "../store/useAppStore";
import { useTranslation } from "../lib/translations/useTranslation";
import { generateShareCard } from "../lib/shareCard";
import { canUseWebShareFiles, getFacebookAppId, isIOSSafari, shareToInstagramStory } from "../lib/instagramShare";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  photoUrl: string | null | undefined;
}

type CardStatus = "idle" | "generating" | "ready" | "error";
type SheetPhase = "preview" | "confirmed";

const FACEBOOK_APP_ID = getFacebookAppId(process.env.NEXT_PUBLIC_FACEBOOK_APP_ID);

export default function ShareSheet({ isOpen, onClose, track, photoUrl }: ShareSheetProps) {
  const t = useTranslation();
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<CardStatus>("idle");
  const [canAddToStory, setCanAddToStory] = useState(false);
  const [phase, setPhase] = useState<SheetPhase>("preview");

  useEffect(() => {
    if (!isOpen || !photoUrl) return;
    let cancelled = false;
    setStatus("generating");
    setPhase("preview");

    generateShareCard(photoUrl)
      .then((blob) => {
        if (cancelled) return;
        setCardBlob(blob);
        setCardUrl(URL.createObjectURL(blob));
        setStatus("ready");
        const file = new File([blob], "vibesong-story.png", { type: "image/png" });
        const iosSupported = isIOSSafari(navigator.userAgent) && FACEBOOK_APP_ID !== null;
        setCanAddToStory(iosSupported || canUseWebShareFiles(navigator, file));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, photoUrl]);

  useEffect(() => {
    if (!isOpen) {
      setCardBlob(null);
      setStatus("idle");
      setPhase("preview");
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (cardUrl) URL.revokeObjectURL(cardUrl);
    };
  }, [cardUrl]);

  const handleAddToStoryTap = async () => {
    if (!track) return;
    try {
      await navigator.clipboard.writeText(`${track.title} — ${track.artist}`);
    } catch {
      // Clipboard text copy failing shouldn't block showing the paste
      // instructions — the user can still type the name manually.
    }
    setPhase("confirmed");
  };

  const handleOpenInstagram = async () => {
    if (!cardBlob || !FACEBOOK_APP_ID) return;
    await shareToInstagramStory(cardBlob, FACEBOOK_APP_ID);
  };

  const handleDownload = () => {
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = "vibesong-story.png";
    a.click();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center lg:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-surface-container rounded-t-2xl lg:rounded-2xl p-6 space-y-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-white">{t.share.heading}</h2>
              <button
                onClick={onClose}
                aria-label={t.share.closeAria}
                className="text-white/50 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black/40 aspect-[9/16] flex items-center justify-center">
              {status === "generating" && (
                <p className="text-on-surface-variant text-sm">{t.share.generating}</p>
              )}
              {status === "error" && (
                <p className="text-error text-sm px-4 text-center">{t.share.error}</p>
              )}
              {status === "ready" && cardUrl && (
                <img src={cardUrl} alt={t.share.previewAlt} className="w-full h-full object-contain" />
              )}
            </div>

            {phase === "confirmed" && track ? (
              <div className="space-y-3">
                <p className="text-white text-sm font-semibold">
                  {t.share.copiedConfirmation(track.title, track.artist)}
                </p>
                <p className="text-on-surface-variant text-sm">{t.share.pasteInstructions}</p>
                <button
                  onClick={handleOpenInstagram}
                  className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink"
                >
                  {t.share.openInstagram}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {canAddToStory && (
                  <button
                    onClick={handleAddToStoryTap}
                    disabled={status !== "ready"}
                    className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink disabled:opacity-50"
                  >
                    {t.share.addToStory}
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  disabled={status !== "ready"}
                  className="w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all disabled:opacity-50"
                >
                  {t.share.download}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by `components/ShareSheet.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ShareSheet.tsx
git commit -m "Add ShareSheet component"
```

---

### Task 7: Wire into `app/results/page.tsx`

**Files:**
- Modify: `app/results/page.tsx`

**Interfaces:**
- Consumes: `ShareSheet` (Task 6), `Track`/`uploadedImageUrl` (existing store state already destructured in this file).

This file was fully reverted after v1, so it is currently in its original pre-feature state — the edits below are identical in shape to v1's Task 7 (same file, same two-branch-fragment problem: the component has an early `if (done) return (...)` branch and a main return, and `<ShareSheet>` must render from both, via a single `shareSheet` element built once).

**Before editing:** re-read the current `app/results/page.tsx` and confirm each old_string below still matches character-for-character — a separate, unrelated concurrent session may be mid-flight on a different plan that also touches this file (match-score breakdown / live re-rank). If any old_string doesn't match, stop and report rather than improvising.

- [ ] **Step 1: Add the import and share state**

Replace:

```tsx
import VibeTags from "../../components/VibeTags";
import { useAppStore, Track } from "../../store/useAppStore";
```

with:

```tsx
import VibeTags from "../../components/VibeTags";
import ShareSheet from "../../components/ShareSheet";
import { useAppStore, Track } from "../../store/useAppStore";
```

Then replace:

```tsx
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [done, setDone] = useState(false);
```

with:

```tsx
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [done, setDone] = useState(false);
  const [shareTrack, setShareTrack] = useState<Track | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
```

- [ ] **Step 2: Open the sheet from `handleSave`**

Replace:

```tsx
  const handleSave = (idx: number, track: Track) => {
    saveTrack(track);
    setSavedTracks((p) => [...p, track]);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    if (getTopIndex(newGone) === -1) setDone(true);
  };
```

with:

```tsx
  const handleSave = (idx: number, track: Track) => {
    saveTrack(track);
    setSavedTracks((p) => [...p, track]);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    if (getTopIndex(newGone) === -1) setDone(true);
    setShareTrack(track);
    setShareSheetOpen(true);
  };
```

- [ ] **Step 3: Build the shared `<ShareSheet>` element once**

Right after `handleSkip` (before `if (done) {`), add:

```tsx
  const shareSheet = (
    <ShareSheet
      isOpen={shareSheetOpen}
      onClose={() => setShareSheetOpen(false)}
      track={shareTrack}
      photoUrl={uploadedImageUrl}
    />
  );
```

- [ ] **Step 4: Render it from the `done` branch**

Replace:

```tsx
  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-y-auto">
```

with:

```tsx
  if (done) {
    return (
      <>
        <div className="min-h-screen bg-background flex flex-col overflow-y-auto">
```

And replace:

```tsx
            </button>
          </motion.div>
        </div>
      </div>
    );
  }
```

with:

```tsx
            </button>
          </motion.div>
        </div>
      </div>
        {shareSheet}
      </>
    );
  }
```

- [ ] **Step 5: Wire the header share icon and render `shareSheet` in the main branch**

Replace:

```tsx
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-hot-pink">
                share
              </span>
            </button>
```

with:

```tsx
            <button
              onClick={() => {
                if (topIdx < 0) return;
                setShareTrack(displayTracks[topIdx]);
                setShareSheetOpen(true);
              }}
              aria-label={t.share.openAria}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-hot-pink">
                share
              </span>
            </button>
```

Then replace:

```tsx
  return (
    <AppShell
```

with:

```tsx
  return (
    <>
    <AppShell
```

And replace:

```tsx
    </AppShell>
  );
}
```

with:

```tsx
    </AppShell>
      {shareSheet}
    </>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add app/results/page.tsx
git commit -m "Wire ShareSheet into the results swipe screen"
```

---

### Task 8: Wire into `app/library/page.tsx`

**Files:**
- Modify: `app/library/page.tsx`

**Interfaces:**
- Consumes: `ShareSheet` (Task 6), `Track` (already imported in this file).

Also fully reverted to its pre-feature state, so this task's edits are shaped like v1's Task 8 — **with one correction learned from v1's post-ship review**: the per-row share button must be gated on `song.sourceImage` from the start (v1 shipped this ungated and needed a follow-up fix after a saved song without a photo left the sheet stuck showing nothing).

- [ ] **Step 1: Add the import and share state**

Replace:

```tsx
import AppHeader from "../../components/AppHeader";
import { useAppStore, Track } from "../../store/useAppStore";
```

with:

```tsx
import AppHeader from "../../components/AppHeader";
import ShareSheet from "../../components/ShareSheet";
import { useAppStore, Track } from "../../store/useAppStore";
```

Then replace:

```tsx
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
```

with:

```tsx
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [shareTrack, setShareTrack] = useState<Track | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
```

- [ ] **Step 2: Add the per-row share icon, gated on `song.sourceImage`**

Replace:

```tsx
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  {song.sourceImage && (
                    <img
                      src={song.sourceImage}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border-2 border-hot-pink/30 hidden sm:block"
                    />
                  )}
```

with:

```tsx
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  {song.sourceImage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareTrack(song);
                        setShareSheetOpen(true);
                      }}
                      aria-label={t.share.rowAria(song.title, song.artist)}
                      className="text-hot-pink/70 hover:text-hot-pink transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">share</span>
                    </button>
                  )}
                  {song.sourceImage && (
                    <img
                      src={song.sourceImage}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border-2 border-hot-pink/30 hidden sm:block"
                    />
                  )}
```

This mirrors the existing `song.sourceImage &&` guard already used one block below for the thumbnail — a row without a saved photo shows neither the thumbnail nor the share button, rather than a share button that opens onto a stuck sheet.

- [ ] **Step 3: Render `ShareSheet`**

Replace:

```tsx
  return (
    <AppShell
      bottomPad="large"
      decor
      header={<AppHeader showCredits={false} center={t.library.heading} />}
    >
```

with:

```tsx
  return (
    <>
    <AppShell
      bottomPad="large"
      decor
      header={<AppHeader showCredits={false} center={t.library.heading} />}
    >
```

And replace:

```tsx
      </div>

    </AppShell>
  );
}
```

with:

```tsx
      </div>

    </AppShell>
      <ShareSheet
        isOpen={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        track={shareTrack}
        photoUrl={shareTrack?.sourceImage}
      />
    </>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add app/library/page.tsx
git commit -m "Wire ShareSheet into the library screen"
```

---

### Task 9: Manual end-to-end verification

**Files:** none (verification only)

This task exists because Tasks 2 and 4 touch canvas rendering and mobile-only browser APIs that have no faithful Node/jsdom equivalent. **This task cannot start until the user has registered a real Meta App ID and set `NEXT_PUBLIC_FACEBOOK_APP_ID`** in `.env.local` (local testing) and in the Vercel project's environment variables (production) — without it, `getFacebookAppId` returns `null` and the iOS "Add to Story" button stays correctly hidden, which would look like nothing is broken but the primary path is untested.

- [ ] **Step 1: Confirm the App ID is set**

Run: `grep NEXT_PUBLIC_FACEBOOK_APP_ID .env.local` — confirm it's present and non-empty before proceeding.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Verify card generation and download on desktop Chrome**

Upload a photo, swipe to save a song, confirm the `ShareSheet` opens automatically showing the plain photo (no text/decoration on it). Click "Download photo" and confirm a PNG downloads. Confirm "Add to Instagram Story" is **not** shown on desktop.

- [ ] **Step 4: Verify the header icon and library row icon**

On `/results`, confirm the header `share` icon opens the sheet for the currently visible top card. On `/library`, confirm each row **with a saved photo** shows a share icon that opens the sheet for that row's song; confirm rows **without** a saved photo show no share icon at all.

- [ ] **Step 5: Verify the full two-tap flow on a real iPhone (Safari)**

Open the deployed app in mobile Safari on an actual iPhone with Instagram installed. Save a song, tap "Добавить в историю", confirm the sheet switches to show "✓ Скопировано: {title} — {artist}" and the paste instructions. Tap "Открыть Instagram →" and confirm Instagram opens directly into the Stories composer **with the photo visible as the background** (this is the specific thing that failed in v1 — check it first). Then manually tap Stickers → Music → tap the search field → confirm the "Paste" suggestion appears above the keyboard → tap it → confirm the copied track name appears in the search box.

- [ ] **Step 6: Verify on a real Android phone (Chrome)**

Same flow. Confirm tapping "Открыть Instagram →" opens the native share sheet with "Instagram Story" as a selectable target, and that the clipboard text is still available to paste into Instagram's Music search afterward.

- [ ] **Step 7: Confirm graceful fallback**

On a browser/device with neither capability (e.g. desktop Firefox, or before the App ID is set), confirm only "Download photo" is shown and works, with no broken/dead button visible.
