# Instagram Story Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user share a saved song + their photo straight to an Instagram Story, right after they pick it.

**Architecture:** A pure client-side canvas renderer (`lib/shareCard.ts`) turns the user's uploaded photo + the chosen track into a 1080×1920 PNG. A platform-detection module (`lib/instagramShare.ts`) picks the best available share path with no API/OAuth: the iOS Safari pasteboard→`instagram-stories://` deep link, or the Web Share API's native share sheet elsewhere. A new `ShareSheet` component wraps both and is wired into three entry points: right after saving a song, the existing (currently unwired) header share icon on `/results`, and a per-row share icon on `/library`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Framer Motion, Zustand, Tailwind v4, Node's built-in test runner (`node --test`), Node 24 native TS type-stripping (no build step needed to `import("*.ts")` in tests).

## Global Constraints

- No Instagram Graph API, no OAuth, no Meta app review — every share action is client-side only, per `docs/superpowers/specs/2026-07-14-instagram-story-share-design.md`.
- No feed-post button — "Download photo" is the only feed-posting path (manual).
- No watermark, logo, or extra decoration on the card — just photo + track info.
- No server round-trip for card generation — everything renders in-browser from data already in the client (`Track` fields, `uploadedImageUrl`/`sourceImage`).
- `en.ts` / `ru.ts` must stay structurally identical — `ru.ts` is typed as `Translation = typeof en`, so any new key added to one must be added to the other with the same shape (see `tests/translations.test.mjs`).
- Follow existing code conventions: double-quoted strings, Tailwind utility classes already used in this codebase (`hot-pink`, `surface-container`, `on-surface-variant`, `outline-variant`, `glow-pink`, `error`), Framer Motion for sheets/modals (see `components/PricingModal.tsx` for the established bottom-sheet pattern).

---

### Task 1: Pure card layout math (`lib/shareCard.ts`)

**Files:**
- Create: `lib/shareCard.ts`
- Test: `tests/shareCard.test.mjs`

**Interfaces:**
- Produces: `computeShareCardLayout(width = 1080, height = 1920): ShareCardLayout`, `truncateToWidth(text: string, maxWidth: number, measure: (s: string) => number): string`, and the `ShareCardLayout` type — Task 2 imports both from this same file.

`ShareCardLayout` describes where everything goes on the canvas: a bottom "music sticker" plate holding a square artwork thumbnail, a title line, and an artist line, plus the Y-range for the darkening gradient above the plate. This task only covers the numeric layout and text-truncation logic — both are plain functions with no DOM dependency, so they're fully unit-testable in Node without a browser.

- [ ] **Step 1: Write the failing tests**

Create `tests/shareCard.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const { computeShareCardLayout, truncateToWidth } = await import("../lib/shareCard.ts");

test("computeShareCardLayout keeps the plate fully inside the canvas", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.ok(layout.plate.x >= 0);
  assert.ok(layout.plate.y >= 0);
  assert.ok(layout.plate.x + layout.plate.width <= layout.width);
  assert.ok(layout.plate.y + layout.plate.height <= layout.height);
});

test("computeShareCardLayout keeps the artwork square fully inside the plate", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.ok(layout.artwork.x >= layout.plate.x);
  assert.ok(layout.artwork.y >= layout.plate.y);
  assert.ok(layout.artwork.x + layout.artwork.size <= layout.plate.x + layout.plate.width);
  assert.ok(layout.artwork.y + layout.artwork.size <= layout.plate.y + layout.plate.height);
});

test("computeShareCardLayout stacks the title above the artist at the same left edge", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.equal(layout.title.x, layout.artist.x);
  assert.ok(layout.title.y < layout.artist.y);
});

test("computeShareCardLayout produces a valid in-bounds layout for other aspect ratios", () => {
  const layout = computeShareCardLayout(720, 1280);
  assert.equal(layout.width, 720);
  assert.equal(layout.height, 1280);
  assert.ok(layout.plate.x + layout.plate.width <= 720);
  assert.ok(layout.plate.y + layout.plate.height <= 1280);
});

test("computeShareCardLayout places the gradient above the plate and ending at the bottom edge", () => {
  const layout = computeShareCardLayout(1080, 1920);
  assert.ok(layout.gradientStartY < layout.plate.y);
  assert.equal(layout.gradientEndY, layout.height);
});

test("truncateToWidth returns the original text when it already fits", () => {
  const measure = (s) => s.length;
  assert.equal(truncateToWidth("Blinding Lights", 100, measure), "Blinding Lights");
});

test("truncateToWidth shortens and appends an ellipsis when text overflows", () => {
  const measure = (s) => s.length;
  assert.equal(truncateToWidth("Blinding Lights", 5, measure), "Blin…");
});

test("truncateToWidth never returns an empty string", () => {
  const measure = (s) => s.length * 100;
  const result = truncateToWidth("Blinding Lights", 1, measure);
  assert.ok(result.length >= 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/shareCard.test.mjs`
Expected: fails with something like `Cannot find module '../lib/shareCard.ts'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `computeShareCardLayout` and `truncateToWidth`**

Create `lib/shareCard.ts`:

```ts
export interface ShareCardLayout {
  width: number;
  height: number;
  gradientStartY: number;
  gradientEndY: number;
  plate: { x: number; y: number; width: number; height: number; radius: number };
  artwork: { x: number; y: number; size: number };
  title: { x: number; y: number; maxWidth: number };
  artist: { x: number; y: number; maxWidth: number };
}

/**
 * Lays out a 9:16 "music sticker" card: photo fills the frame, a rounded
 * plate sits near the bottom holding a square artwork thumbnail with the
 * track title/artist beside it. Pure math only — no canvas/DOM here so this
 * stays unit-testable; drawing happens in generateShareCardImage (Task 2).
 */
export function computeShareCardLayout(width = 1080, height = 1920): ShareCardLayout {
  const margin = Math.round(width * 0.06);
  const plateHeight = Math.round(height * 0.11);
  const plateWidth = width - margin * 2;
  const plateY = height - margin * 2 - plateHeight;
  const artworkPadding = Math.round(plateHeight * 0.14);
  const artworkSize = plateHeight - artworkPadding * 2;
  const artworkX = margin + artworkPadding;
  const artworkY = plateY + artworkPadding;
  const textX = artworkX + artworkSize + artworkPadding;
  const textMaxWidth = margin + plateWidth - artworkPadding - textX;

  return {
    width,
    height,
    gradientStartY: Math.round(height * 0.55),
    gradientEndY: height,
    plate: {
      x: margin,
      y: plateY,
      width: plateWidth,
      height: plateHeight,
      radius: Math.round(plateHeight * 0.18),
    },
    artwork: { x: artworkX, y: artworkY, size: artworkSize },
    title: { x: textX, y: artworkY + Math.round(artworkSize * 0.1), maxWidth: textMaxWidth },
    artist: { x: textX, y: artworkY + Math.round(artworkSize * 0.58), maxWidth: textMaxWidth },
  };
}

/**
 * Shortens text to fit maxWidth using a caller-supplied measure function
 * (canvas's ctx.measureText in production, a trivial length-based stub in
 * tests) so the truncation logic itself stays DOM-free and testable.
 */
export function truncateToWidth(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && measure(text.slice(0, end) + "…") > maxWidth) {
    end -= 1;
  }
  return text.slice(0, end) + "…";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/shareCard.test.mjs`
Expected: `ℹ tests 8` / `ℹ pass 8` / `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/shareCard.ts tests/shareCard.test.mjs
git commit -m "Add pure layout math for the Instagram share card"
```

---

### Task 2: Canvas rendering (`generateShareCardImage`)

**Files:**
- Modify: `lib/shareCard.ts`

**Interfaces:**
- Consumes: `computeShareCardLayout`, `truncateToWidth`, `ShareCardLayout` (Task 1, same file).
- Produces: `generateShareCardImage(track: { title: string; artist: string; artwork?: string; thumbnail: string }, photoUrl: string): Promise<Blob>` — this is what `ShareSheet` (Task 6) calls.

This step draws to an actual `<canvas>`, which Node's test runner can't exercise (no DOM/jsdom in this project — see `package.json`'s plain `node --test` setup). It's verified manually in the browser instead, same approach the codebase already takes for other browser-only pieces. No automated test step here — that's intentional, not an oversight.

Cross-origin note: `track.artwork`/`track.thumbnail` come from iTunes/YouTube CDNs. If a CDN doesn't serve permissive CORS headers, drawing that image taints the canvas and `toBlob` fails. The implementation below retries once without the artwork image rather than failing the whole share flow.

- [ ] **Step 1: Implement the renderer**

Add to `lib/shareCard.ts`:

```ts
export async function generateShareCardImage(
  track: { title: string; artist: string; artwork?: string; thumbnail: string },
  photoUrl: string
): Promise<Blob> {
  const layout = computeShareCardLayout();
  const photo = await loadImage(photoUrl, false);

  const blob = await renderCard(layout, track, photo, true);
  if (blob) return blob;

  // Cross-origin artwork tainted the canvas (CDN didn't send CORS headers) —
  // redraw without it instead of failing the whole share flow.
  const fallbackBlob = await renderCard(layout, track, photo, false);
  if (!fallbackBlob) throw new Error("Canvas toBlob failed");
  return fallbackBlob;
}

async function renderCard(
  layout: ShareCardLayout,
  track: { title: string; artist: string; artwork?: string; thumbnail: string },
  photo: HTMLImageElement,
  includeArtwork: boolean
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  drawCover(ctx, photo, layout.width, layout.height);

  const gradient = ctx.createLinearGradient(0, layout.gradientStartY, 0, layout.gradientEndY);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, layout.gradientStartY, layout.width, layout.gradientEndY - layout.gradientStartY);

  drawRoundedRectPath(ctx, layout.plate.x, layout.plate.y, layout.plate.width, layout.plate.height, layout.plate.radius);
  ctx.fillStyle = "rgba(17, 17, 17, 0.72)";
  ctx.fill();

  const artUrl = track.artwork || track.thumbnail;
  if (includeArtwork && artUrl) {
    try {
      const art = await loadImage(artUrl, true);
      ctx.save();
      drawRoundedRectPath(ctx, layout.artwork.x, layout.artwork.y, layout.artwork.size, layout.artwork.size, 16);
      ctx.clip();
      ctx.drawImage(art, layout.artwork.x, layout.artwork.y, layout.artwork.size, layout.artwork.size);
      ctx.restore();
    } catch {
      // Artwork failed to load at all (network error/404) — the plate still
      // renders fine with just the title/artist text.
    }
  }

  ctx.textBaseline = "top";
  ctx.fillStyle = "#F5F5F5";
  ctx.font = "700 44px Inter, sans-serif";
  ctx.fillText(
    truncateToWidth(track.title, layout.title.maxWidth, (s) => ctx.measureText(s).width),
    layout.title.x,
    layout.title.y
  );

  ctx.fillStyle = "#888888";
  ctx.font = "400 34px Inter, sans-serif";
  ctx.fillText(
    truncateToWidth(track.artist, layout.artist.maxWidth, (s) => ctx.measureText(s).width),
    layout.artist.x,
    layout.artist.y
  );

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
  const imgRatio = img.width / img.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;
  if (imgRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * imgRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imgRatio;
    offsetY = (height - drawHeight) / 2;
  }
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
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

(Manual browser verification of the actual rendered image happens in Task 9, once `ShareSheet` can display it.)

---

### Task 3: Platform detection (`lib/instagramShare.ts`)

**Files:**
- Create: `lib/instagramShare.ts`
- Test: `tests/instagramShare.test.mjs`

**Interfaces:**
- Produces: `isIOSSafari(userAgent: string): boolean`, `canUseWebShareFiles(nav: ShareCapableNavigator, file: File): boolean`, `ShareCapableNavigator` type — Task 4 adds `shareToInstagramStory` to this same file, reusing both.

Both functions take their inputs as plain parameters (a UA string, a nav-like object) instead of reading `navigator` directly, so they're fully testable in Node without any browser globals.

- [ ] **Step 1: Write the failing tests**

Create `tests/instagramShare.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const { isIOSSafari, canUseWebShareFiles } = await import("../lib/instagramShare.ts");

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/instagramShare.test.mjs`
Expected: `ℹ tests 7` / `ℹ pass 7` / `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/instagramShare.ts tests/instagramShare.test.mjs
git commit -m "Add platform detection for Instagram Story sharing"
```

---

### Task 4: Share orchestration (`shareToInstagramStory`)

**Files:**
- Modify: `lib/instagramShare.ts`

**Interfaces:**
- Consumes: `isIOSSafari`, `canUseWebShareFiles` (Task 3, same file).
- Produces: `shareToInstagramStory(imageBlob: Blob): Promise<ShareOutcome>` and `ShareOutcome` type — `ShareSheet` (Task 6) calls this on the "Add to Instagram Story" button.

This function touches `navigator.clipboard`, `ClipboardItem`, `window.location`, and `navigator.share` — all real browser APIs with no faithful Node stand-in, so like Task 2 this is verified manually (Task 9) rather than via `node --test`.

- [ ] **Step 1: Implement the orchestration function**

Add to `lib/instagramShare.ts`:

```ts
// Instagram-documented pasteboard type for the Stories composer's background
// image — works from mobile Safari with no OAuth/API. Instagram doesn't
// strictly validate source_application for this path (unlike a full native
// SDK integration), so a placeholder id is enough; see
// docs/superpowers/specs/2026-07-14-instagram-story-share-design.md.
const INSTAGRAM_STORIES_PASTEBOARD_TYPE = "com.instagram.sharedSticker.backgroundImage";
const FB_APP_ID = "0";

export type ShareOutcome = "ios-deep-link" | "web-share" | "unsupported";

export async function shareToInstagramStory(imageBlob: Blob): Promise<ShareOutcome> {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "unsupported";

  if (isIOSSafari(navigator.userAgent) && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [INSTAGRAM_STORIES_PASTEBOARD_TYPE]: imageBlob }),
      ]);
      window.location.href = `instagram-stories://share?source_application=${FB_APP_ID}`;
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
- Produces: a `share` namespace on the translation object — `t.share.heading`, `t.share.generating`, `t.share.error`, `t.share.previewAlt`, `t.share.addToStory`, `t.share.download`, `t.share.closeAria`, `t.share.openAria`, `t.share.rowAria(title, artist)` — `ShareSheet` (Task 6) and the wiring in Tasks 7/8 use these.

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
  },
  explore: {
```

- [ ] **Step 3: Run the translation parity test**

Run: `node --test tests/translations.test.mjs`
Expected: `ℹ tests 5` / `ℹ pass 5` / `ℹ fail 0` (the "identical top-level namespaces" test confirms `share` landed in both files).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `ru.ts`'s `share` block matches `en.ts`'s shape — `ru.ts` is typed as `Translation = typeof en`, so a missing or mistyped key here is a compile error, not just a runtime gap).

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
- Consumes: `Track` (from `../store/useAppStore`), `generateShareCardImage` (Task 2), `isIOSSafari`/`canUseWebShareFiles`/`shareToInstagramStory` (Tasks 3–4), `useTranslation` (Task 5's `t.share.*` keys).
- Produces: `<ShareSheet isOpen photoUrl track onClose />` — Tasks 7–8 render this.

Follows the existing bottom-sheet pattern from `components/PricingModal.tsx` (fixed overlay + spring-animated sheet), but in the app's dark surface colors rather than `PricingModal`'s light "cream" pricing-specific styling.

- [ ] **Step 1: Implement the component**

Create `components/ShareSheet.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Track } from "../store/useAppStore";
import { useTranslation } from "../lib/translations/useTranslation";
import { generateShareCardImage } from "../lib/shareCard";
import { canUseWebShareFiles, isIOSSafari, shareToInstagramStory } from "../lib/instagramShare";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  photoUrl: string | null | undefined;
}

type CardStatus = "idle" | "generating" | "ready" | "error";

export default function ShareSheet({ isOpen, onClose, track, photoUrl }: ShareSheetProps) {
  const t = useTranslation();
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<CardStatus>("idle");
  const [canAddToStory, setCanAddToStory] = useState(false);

  useEffect(() => {
    if (!isOpen || !track || !photoUrl) return;
    let cancelled = false;
    setStatus("generating");
    setCanAddToStory(false);

    generateShareCardImage(track, photoUrl)
      .then((blob) => {
        if (cancelled) return;
        setCardBlob(blob);
        setCardUrl(URL.createObjectURL(blob));
        setStatus("ready");
        const file = new File([blob], "vibesong-story.png", { type: "image/png" });
        setCanAddToStory(isIOSSafari(navigator.userAgent) || canUseWebShareFiles(navigator, file));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, track, photoUrl]);

  useEffect(() => {
    if (!isOpen) {
      setCardBlob(null);
      setStatus("idle");
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (cardUrl) URL.revokeObjectURL(cardUrl);
    };
  }, [cardUrl]);

  const handleAddToStory = async () => {
    if (!cardBlob) return;
    await shareToInstagramStory(cardBlob);
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

            <div className="space-y-2">
              {canAddToStory && (
                <button
                  onClick={handleAddToStory}
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

Two entry points here: `handleSave` opens the sheet for the just-saved track (non-blocking — closing it returns to the swipe stack untouched), and the existing-but-unwired header `share` icon opens it for whatever's currently on top. Because the component has an early `if (done) return (...)` branch that renders a completely different tree, the `<ShareSheet>` element is built once and referenced in both branches — otherwise a save that finishes the last card would flip `done` to `true` on the very next render and silently drop the sheet.

- [ ] **Step 1: Add the import and share state**

In `app/results/page.tsx`, replace:

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

Replace the existing `handleSave` (lines 158-165):

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

Right after the `handleSkip` function (after line 173, before `if (done) {`), add:

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

The `done` branch currently returns a single top-level `<div>` (lines 176-282). Change the opening/closing of that return to a fragment so `shareSheet` can sit alongside it:

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

And replace the closing of that branch:

```tsx
            </button>
          </motion.div>
        </div>
      </div>
    );
  }
```

(closing the Actions `motion.div`, the inner content div, and the outer min-h-screen div) with:

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

Replace the header's share button (lines 302-306):

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

Then wrap the main component's final return in a fragment so `shareSheet` renders alongside `<AppShell>`. Replace the final `return (` before `<AppShell` (line 286-287):

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

And replace the closing of that return (the final `</AppShell>` and the function's closing, lines 372-374):

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
Expected: all existing tests still pass (this task only touches JSX/state wiring, no logic under test).

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

Adds a share icon to each saved-song row (next to the existing play/match-score icons), independent of the row's own click-to-play behavior — it must call `stopPropagation` so tapping it doesn't also trigger `handleRowActivate`.

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

- [ ] **Step 2: Add the per-row share icon**

Inside the row's icon cluster (the `<div className="flex items-center gap-2 md:gap-3 flex-shrink-0">` block, lines 172-193), add a share button. Replace:

```tsx
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  {song.sourceImage && (
```

with:

```tsx
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
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
                  {song.sourceImage && (
```

- [ ] **Step 3: Render `ShareSheet`**

Wrap the component's return in a fragment so `ShareSheet` can render alongside `<AppShell>`. Replace the return statement (line 71-76):

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

And replace the closing (lines 200-204):

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

This task exists because Tasks 2 and 4 touch canvas rendering and mobile-only browser APIs (`ClipboardItem`, `instagram-stories://`, `navigator.share`) that have no faithful Node/jsdom equivalent — they can only be confirmed by actually using the app.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify card generation and download on desktop Chrome**

Upload a photo, swipe to save a song, confirm the `ShareSheet` opens automatically showing a generated 9:16 card image (photo + title/artist plate, no watermark). Click "Download photo" and confirm a PNG downloads. Confirm the "Add to Instagram Story" button is **not** shown (desktop Chrome supports neither the iOS trick nor `navigator.canShare` with files in the way that matters here).

- [ ] **Step 3: Verify the header icon and library row icon**

On `/results`, confirm the header `share` icon opens the sheet for the currently visible top card. On `/library`, confirm each row's new share icon opens the sheet for that row's song using its saved photo (`sourceImage`).

- [ ] **Step 4: Verify "Add to Story" on a real iPhone (Safari)**

Open the deployed/dev app in mobile Safari on an actual iPhone with Instagram installed. Save a song, confirm the "Add to Instagram Story" button appears, tap it, and confirm Instagram opens directly into the Stories composer with the card image pre-loaded as the background.

- [ ] **Step 5: Verify "Add to Story" on a real Android phone (Chrome)**

Same flow on an Android phone with Instagram installed. Confirm tapping "Add to Instagram Story" opens the native share sheet and that Instagram Story is selectable as a direct target.

- [ ] **Step 6: Confirm graceful fallback**

On a browser/device with neither capability (e.g. desktop Firefox), confirm only "Download photo" is shown and works, with no broken/dead button visible.
