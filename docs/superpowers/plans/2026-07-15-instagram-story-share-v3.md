# Instagram Story Share v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user download a 15-second video (their photo + 15 seconds of the matched song's actual audio) and post it to Instagram themselves, with the track name already copied to their clipboard to paste into Instagram's own Music sticker search.

**Architecture:** A server-side endpoint (`app/api/share-video/route.ts`) uses ffmpeg to combine the user's photo with a trimmed clip of the track's preview audio into an MP4 sized for Stories (1080×1920, 15s). `components/ShareSheet.tsx` shows the photo immediately, requests the video in the background, and offers "Скачать видео" once it's ready (or "Скачать фото" if the track has no audio to work with). A separate "Добавить в историю" → "Открыть Instagram" two-tap flow copies the track name to the clipboard and then just opens Instagram — no pasteboard tricks, no Meta App ID, no platform branching.

**Tech Stack:** Next.js 16 App Router (Node-runtime API route), TypeScript, `ffmpeg-static` + `fluent-ffmpeg`, Framer Motion, Node's built-in test runner, Node 24 native TS type-stripping.

## Why v3 (read this before touching anything)

This is the third iteration of this feature. v1 (baked song text onto a shared photo image, tried an undocumented Instagram pasteboard trick) was reverted after real-device testing found the photo never appeared. v2 fixed the suspected root cause (a placeholder Meta App ID) and redesigned the song-attachment step around a clipboard-copy + two-tap confirmation — but before it could be verified on a real device, the user hit an external blocker registering the required Meta App ID (a Facebook/Meta developer account issue outside this app's control). Full history: `docs/superpowers/specs/2026-07-14-instagram-story-share-design.md` ("Revision history" section).

v3 sidesteps the App ID requirement entirely by not needing Instagram's cooperation at all: a video with the song's real audio baked in doesn't need Instagram's Music sticker or a background pre-fill trick — posting the video anywhere just plays the audio, because it's genuinely part of the file. This removes essentially all of v2's `lib/instagramShare.ts` and `lib/shareCard.ts`.

## Global Constraints

- The generated video is **just the photo (static, no animation/Ken Burns, no zoom/pan) + 15 seconds of audio** — no text, logo, or watermark drawn onto it, carrying over the "no decoration" principle from v1/v2's photo-only card.
- Video dimensions: exactly 1080×1920 (Instagram Story aspect), cover-fit crop (fill frame, crop overflow) — same crop semantics as v2's removed `computeCoverFit`, just done by ffmpeg's `scale`+`crop` filters server-side instead of canvas client-side.
- Video duration: exactly 15 seconds, starting at `Track.viralMomentSeconds` (the same field `components/YouTubePlayer.tsx` already uses to start playback at the track's most "grabby" moment) if present, else `0`.
- Audio source: `Track.previewUrl` (the same field already used for in-app preview playback elsewhere in the app) — ffmpeg reads this URL directly as an input, no separate download step. If a track has no `previewUrl` at all, no video request is made client-side, and the sheet falls back to offering a plain photo download instead — this is the one case where the "video replaces photo download" rule doesn't apply.
- No Instagram Graph API, no OAuth, no Meta App Review, **no Meta App ID of any kind** — this is the whole point of v3. "Открыть Instagram" is a plain link/app-open, with no platform feature-detection needed (opening a link works everywhere, unlike v2's iOS-pasteboard-vs-Web-Share branching).
- No server-side **storage** — the video is generated per-request and streamed straight back in the HTTP response; nothing is written to a database or persisted after the request completes (aside from an ephemeral, self-cleaning temp directory during generation).
- `en.ts` / `ru.ts` must stay structurally identical — `ru.ts` is typed as `Translation = typeof en`.
- Follow existing code conventions: double-quoted strings, `export const runtime = "nodejs";` for API routes needing non-Edge capabilities (see `app/api/analyze/route.ts:28`), `export const maxDuration = N;` for routes that may run long (see `app/api/analyze/route.ts:33`, which documents exactly this pattern), Tailwind classes already used in this codebase (`hot-pink`, `surface-container`, `on-surface-variant`, `outline-variant`, `glow-pink`, `error`), Framer Motion bottom-sheet pattern already established in `components/PricingModal.tsx`.
- **`app/results/page.tsx` and `app/library/page.tsx` need NO changes in this plan.** `ShareSheet`'s external prop contract (`isOpen`, `onClose`, `track`, `photoUrl`) stays exactly the same as v2 — the entire rewrite is internal to `ShareSheet.tsx` plus new backend code. Do not touch those two files; this also sidesteps the collision risk with the separate concurrent session's plan that touches `app/results/page.tsx`, since this plan doesn't need to go near it.
- A run of `npm test` immediately before starting this plan reports the current baseline count — record it and use it (not a number written into this plan) as the reference point for later tasks that add or remove tests, since a separate concurrent session may also be changing the shared test count.

---

### Task 1: Pure ffmpeg-plan builder (`lib/generateShareVideo.ts`)

**Files:**
- Create: `lib/generateShareVideo.ts`
- Test: `tests/generateShareVideo.test.mjs`

**Interfaces:**
- Produces: `buildShareVideoPlan(startSeconds: number): ShareVideoPlan` and the `ShareVideoPlan` type — Task 2 imports both from this same file.

This is the option-construction logic for the ffmpeg command (scale/crop filter string, seek offset, output flags) as a pure function with no process spawning or file I/O — that part (Task 2) needs a real ffmpeg binary and has no automated test. Keeping this piece pure means the part that's easy to get subtly wrong (a malformed filter string, the wrong seek flag) is actually verified in CI.

- [ ] **Step 1: Write the failing tests**

Create `tests/generateShareVideo.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const { buildShareVideoPlan } = await import("../lib/generateShareVideo.ts");

test("buildShareVideoPlan targets a 1080x1920, 15-second output", () => {
  const plan = buildShareVideoPlan(0);
  assert.equal(plan.width, 1080);
  assert.equal(plan.height, 1920);
  assert.equal(plan.durationSeconds, 15);
});

test("buildShareVideoPlan seeks the audio input to the given start second", () => {
  const plan = buildShareVideoPlan(42);
  assert.deepEqual(plan.audioInputOptions, ["-ss", "42"]);
});

test("buildShareVideoPlan clamps a negative start second to 0", () => {
  const plan = buildShareVideoPlan(-5);
  assert.deepEqual(plan.audioInputOptions, ["-ss", "0"]);
});

test("buildShareVideoPlan's scale/crop filter targets the exact output dimensions", () => {
  const plan = buildShareVideoPlan(0);
  assert.equal(
    plan.scaleCropFilter,
    "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
  );
});

test("buildShareVideoPlan's output options cap duration at 15s and mark it as the shortest stream", () => {
  const plan = buildShareVideoPlan(0);
  assert.ok(plan.outputOptions.includes("-shortest"));
  const tIndex = plan.outputOptions.indexOf("-t");
  assert.ok(tIndex !== -1);
  assert.equal(plan.outputOptions[tIndex + 1], "15");
});

test("buildShareVideoPlan marks the photo input to loop", () => {
  const plan = buildShareVideoPlan(0);
  assert.deepEqual(plan.photoInputOptions, ["-loop", "1"]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/generateShareVideo.test.mjs`
Expected: fails with `Cannot find module '../lib/generateShareVideo.ts'`.

- [ ] **Step 3: Implement `buildShareVideoPlan`**

Create `lib/generateShareVideo.ts`:

```ts
export interface ShareVideoPlan {
  width: number;
  height: number;
  durationSeconds: number;
  scaleCropFilter: string;
  photoInputOptions: string[];
  audioInputOptions: string[];
  outputOptions: string[];
}

/**
 * Pure construction of the ffmpeg option arrays for combining a still photo
 * with a trimmed audio clip into a 1080x1920, 15-second MP4. No process
 * spawning or file I/O here — that's generateShareVideo (same file, added
 * in the next task), which needs a real ffmpeg binary and has no
 * automated test. This stays pure so the option-building logic is
 * verified without needing ffmpeg installed in the test environment.
 */
export function buildShareVideoPlan(startSeconds: number): ShareVideoPlan {
  const width = 1080;
  const height = 1920;
  const durationSeconds = 15;
  const scaleCropFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const safeStart = Math.max(0, startSeconds);

  return {
    width,
    height,
    durationSeconds,
    scaleCropFilter,
    photoInputOptions: ["-loop", "1"],
    audioInputOptions: ["-ss", String(safeStart)],
    outputOptions: [
      "-vf", scaleCropFilter,
      "-c:v", "libx264",
      "-tune", "stillimage",
      "-c:a", "aac",
      "-b:a", "128k",
      "-pix_fmt", "yuv420p",
      "-shortest",
      "-t", String(durationSeconds),
      "-movflags", "+faststart",
    ],
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/generateShareVideo.test.mjs`
Expected: `ℹ tests 6` / `ℹ pass 6` / `ℹ fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/generateShareVideo.ts tests/generateShareVideo.test.mjs
git commit -m "Add pure ffmpeg-plan builder for the share video"
```

---

### Task 2: Video generation execution (`generateShareVideo`)

**Files:**
- Modify: `lib/generateShareVideo.ts`
- Modify: `package.json` (add `ffmpeg-static`, `fluent-ffmpeg` dependencies and `@types/fluent-ffmpeg` dev dependency)

**Interfaces:**
- Consumes: `buildShareVideoPlan`, `ShareVideoPlan` (Task 1, same file).
- Produces: `generateShareVideo(input: GenerateShareVideoInput): Promise<Buffer>` and `GenerateShareVideoInput` type — Task 3's API route calls this.

This spawns a real `ffmpeg` process via temp files — no automated test is possible here without a real ffmpeg binary and a real network-reachable audio URL, so this task is verified by a manual local run instead (Step 4 below), the same "DOM/IO-heavy code gets manual verification, pure logic gets tests" split this codebase has used elsewhere for browser-only code.

**Note on `ffmpeg-static` and cross-platform installs:** this package downloads a binary matching whatever OS `npm install` runs on. Installing it locally on a Windows dev machine gets a Windows binary (fine for local testing here); when this code is deployed, Vercel's own build step runs `npm install` on its Linux build machines and fetches the matching Linux binary automatically — this is the standard, widely-used way this package works on Vercel, not something requiring extra configuration. Real-device/production confirmation still happens in Task 7.

- [ ] **Step 1: Install dependencies**

```bash
npm install ffmpeg-static fluent-ffmpeg
npm install --save-dev @types/fluent-ffmpeg
```

- [ ] **Step 2: Implement `generateShareVideo`**

Add to `lib/generateShareVideo.ts`:

```ts
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export interface GenerateShareVideoInput {
  photoBytes: Buffer;
  previewUrl: string;
  startSeconds: number;
}

/**
 * Combines a still photo with a trimmed audio clip into an MP4 sized for
 * Instagram Stories, via a temporary directory and a spawned ffmpeg
 * process. Requires a real ffmpeg binary — no automated test; verified
 * manually (Step 4 below) and again against the deployed route in Task 7.
 */
export async function generateShareVideo({
  photoBytes,
  previewUrl,
  startSeconds,
}: GenerateShareVideoInput): Promise<Buffer> {
  const plan = buildShareVideoPlan(startSeconds);
  const dir = await mkdtemp(join(tmpdir(), "vibesong-share-"));
  const photoPath = join(dir, "photo.jpg");
  const outputPath = join(dir, "output.mp4");

  try {
    await writeFile(photoPath, photoBytes);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(photoPath)
        .inputOptions(plan.photoInputOptions)
        .input(previewUrl)
        .inputOptions(plan.audioInputOptions)
        .outputOptions(plan.outputOptions)
        .on("end", () => resolve())
        .on("error", (err) => reject(err instanceof Error ? err : new Error(String(err))))
        .save(outputPath);
    });

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. If `ffmpeg-static`'s default export type doesn't line up cleanly (some versions type it as `string | null`), the `if (ffmpegPath)` guard above already handles the `null` case at runtime — adjust only the import/typing if `tsc` complains, not the logic.

- [ ] **Step 4: Manual local verification**

Write a throwaway Node script (do not commit it — delete it after this step, or run it via `node --eval`/a scratch file outside the repo) that:
1. Reads a real local JPEG into a `Buffer`.
2. Calls `generateShareVideo({ photoBytes, previewUrl: "<a real iTunes preview URL, e.g. one already visible in this app's dev tools/network tab from playing a track>", startSeconds: 0 })`.
3. Writes the returned `Buffer` to a local `.mp4` file.
4. Open that file in a video player (or run `ffprobe` on it, using the same `ffmpeg-static` binary's sibling `ffprobe` if available, or any locally installed `ffprobe`) and confirm: it's an MP4, roughly 15 seconds long, has both a video stream (visibly showing the test photo) and an audio stream (audibly playing the track's preview).

Report the outcome (what you saw/heard, the file's actual duration) in your task report — this is the evidence this task is genuinely done, not just "code compiles."

- [ ] **Step 5: Commit**

```bash
git add lib/generateShareVideo.ts package.json package-lock.json
git commit -m "Add video generation via ffmpeg"
```

---

### Task 3: HTTP endpoint (`app/api/share-video/route.ts`)

**Files:**
- Create: `app/api/share-video/route.ts`

**Interfaces:**
- Consumes: `generateShareVideo` (Task 2).
- Produces: `POST /api/share-video` — `components/ShareSheet.tsx` (Task 5) calls this.

No automated test for this task (an HTTP route wrapping ffmpeg execution is the same "needs a real environment" category as Task 2) — verified by a manual local run against `next dev` in Step 3 below.

- [ ] **Step 1: Implement the route**

Create `app/api/share-video/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateShareVideo } from "../../../lib/generateShareVideo";

export const runtime = "nodejs";
// Video generation involves fetching a remote audio URL and running ffmpeg
// end-to-end — comfortably longer than a typical API response, so this
// needs an explicit budget the same way app/api/analyze/route.ts does.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const photo = formData.get("photo");
  const previewUrl = formData.get("previewUrl");
  const startSecondsRaw = formData.get("startSeconds");

  if (!(photo instanceof File) || typeof previewUrl !== "string" || !previewUrl) {
    return NextResponse.json({ error: "Missing photo or previewUrl" }, { status: 400 });
  }

  const startSeconds = typeof startSecondsRaw === "string" ? Number(startSecondsRaw) || 0 : 0;

  try {
    const photoBytes = Buffer.from(await photo.arrayBuffer());
    const videoBytes = await generateShareVideo({ photoBytes, previewUrl, startSeconds });
    return new NextResponse(new Uint8Array(videoBytes), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="vibesong-story.mp4"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video generation failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual local verification**

Run: `npm run dev`

Then, from another terminal, POST a real photo + a real preview URL to the running dev server, e.g.:

```bash
curl -X POST http://localhost:3000/api/share-video \
  -F "photo=@/path/to/a/test-photo.jpg" \
  -F "previewUrl=<a real iTunes preview URL>" \
  -F "startSeconds=0" \
  -o /tmp/share-video-test.mp4
```

Confirm the response is a valid, playable MP4 (open it, or `ffprobe` it) with both video and audio. Report the exact command you ran and what you observed in your task report.

- [ ] **Step 4: Commit**

```bash
git add app/api/share-video/route.ts
git commit -m "Add the share-video API route"
```

---

### Task 4: Translations

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`

**Interfaces:**
- Produces: updated `t.share.generating`, `t.share.error`, `t.share.previewAlt` copy, plus new `t.share.downloadVideo` and `t.share.downloadPhoto` keys (replacing the old `t.share.download`) — `ShareSheet` (Task 5) uses these. `t.share.heading`, `addToStory`, `closeAria`, `openAria`, `rowAria`, `copiedConfirmation`, `pasteInstructions`, `openInstagram` are unchanged from v2 and already correct — this task does not touch them.

- [ ] **Step 1: Update `en.ts`'s `share` block**

In `lib/translations/en.ts`, replace:

```ts
    generating: "Creating your card…",
    error: "Couldn't create the image. Try again.",
    previewAlt: "Your VibeSong story card",
    addToStory: "Add to Instagram Story",
    download: "Download photo",
```

with:

```ts
    generating: "Generating your video…",
    error: "Couldn't create the video. Try again.",
    previewAlt: "Your photo",
    addToStory: "Add to Instagram Story",
    downloadVideo: "Download video",
    downloadPhoto: "Download photo",
```

- [ ] **Step 2: Update `ru.ts`'s `share` block**

In `lib/translations/ru.ts`, replace:

```ts
    generating: "Готовим карточку…",
    error: "Не получилось создать картинку. Попробуй ещё раз.",
    previewAlt: "Карточка для истории VibeSong",
    addToStory: "Добавить в Историю Instagram",
    download: "Скачать фото",
```

with:

```ts
    generating: "Генерируем видео…",
    error: "Не получилось создать видео. Попробуй ещё раз.",
    previewAlt: "Твоё фото",
    addToStory: "Добавить в Историю Instagram",
    downloadVideo: "Скачать видео",
    downloadPhoto: "Скачать фото",
```

- [ ] **Step 3: Run the translation parity test**

Run: `node --test tests/translations.test.mjs`
Expected: `ℹ tests 5` / `ℹ pass 5` / `ℹ fail 0`

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (this is what would catch a `downloadVideo`/`downloadPhoto` shape mismatch between `en.ts` and `ru.ts`). Note: this WILL show errors at this point for `components/ShareSheet.tsx`, which still references the now-removed `t.share.download` key — that's expected and gets fixed in Task 5, not this one. Confirm the *only* new errors are inside `components/ShareSheet.tsx`.

- [ ] **Step 5: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts
git commit -m "Update share sheet translations for video download"
```

---

### Task 5: Rewrite `components/ShareSheet.tsx`

**Files:**
- Modify: `components/ShareSheet.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Track` (from `../store/useAppStore`, pre-existing — specifically its `previewUrl` and `viralMomentSeconds` fields), `useTranslation` (Task 4's updated `t.share.*` keys), the new `POST /api/share-video` endpoint (Task 3).
- Produces: `<ShareSheet isOpen photoUrl track onClose />` — **the exact same props as v2**; `app/results/page.tsx` and `app/library/page.tsx` need no changes at all.

This replaces the entire internal implementation: no more client-side canvas card generation, no more iOS/Web-Share platform branching, no more Meta App ID. The photo shows immediately; a video request happens in the background if the track has `previewUrl`; the Instagram button is a plain two-tap copy-then-open flow.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `components/ShareSheet.tsx` with:

```tsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Track } from "../store/useAppStore";
import { useTranslation } from "../lib/translations/useTranslation";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  photoUrl: string | null | undefined;
}

type VideoStatus = "idle" | "generating" | "ready" | "error" | "unavailable";
type SheetPhase = "preview" | "confirmed";

export default function ShareSheet({ isOpen, onClose, track, photoUrl }: ShareSheetProps) {
  const t = useTranslation();
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<SheetPhase>("preview");

  useEffect(() => {
    if (!isOpen || !photoUrl || !track) return;
    let cancelled = false;
    setPhase("preview");

    if (!track.previewUrl) {
      setVideoStatus("unavailable");
      return;
    }

    setVideoStatus("generating");
    const previewUrl = track.previewUrl;

    (async () => {
      try {
        const photoBlob = await fetch(photoUrl).then((r) => r.blob());
        const formData = new FormData();
        formData.append("photo", photoBlob, "photo.jpg");
        formData.append("previewUrl", previewUrl);
        formData.append("startSeconds", String(track.viralMomentSeconds ?? 0));

        const res = await fetch("/api/share-video", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Video generation failed");
        const videoBlob = await res.blob();
        if (cancelled) return;
        setVideoUrl(URL.createObjectURL(videoBlob));
        setVideoStatus("ready");
      } catch {
        if (!cancelled) setVideoStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, photoUrl, track]);

  useEffect(() => {
    if (!isOpen) {
      setVideoStatus("idle");
      setPhase("preview");
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

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

  const handleOpenInstagram = () => {
    window.location.href = "https://www.instagram.com/";
  };

  const handleDownloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "vibesong-story.mp4";
    a.click();
  };

  const handleDownloadPhoto = () => {
    if (!photoUrl) return;
    const a = document.createElement("a");
    a.href = photoUrl;
    a.download = "vibesong-story.jpg";
    a.click();
  };

  const showPhotoFallback = videoStatus === "unavailable" || videoStatus === "error";

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

            <div className="rounded-xl overflow-hidden bg-black/40 aspect-[9/16] flex items-center justify-center relative">
              {photoUrl && (
                <img src={photoUrl} alt={t.share.previewAlt} className="w-full h-full object-contain" />
              )}
              {videoStatus === "generating" && (
                <p className="absolute bottom-2 inset-x-0 text-center text-on-surface-variant text-xs bg-black/60 py-1">
                  {t.share.generating}
                </p>
              )}
              {videoStatus === "error" && (
                <p className="absolute bottom-2 inset-x-0 text-center text-error text-xs bg-black/60 py-1 px-2">
                  {t.share.error}
                </p>
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
                <button
                  onClick={handleAddToStoryTap}
                  className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink"
                >
                  {t.share.addToStory}
                </button>
                {showPhotoFallback ? (
                  <button
                    onClick={handleDownloadPhoto}
                    className="w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all"
                  >
                    {t.share.downloadPhoto}
                  </button>
                ) : (
                  <button
                    onClick={handleDownloadVideo}
                    disabled={videoStatus !== "ready"}
                    className="w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all disabled:opacity-50"
                  >
                    {t.share.downloadVideo}
                  </button>
                )}
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
Expected: no errors. This should now also resolve the `t.share.download` errors Task 4 left behind, since this file no longer references that key.

- [ ] **Step 3: Commit**

```bash
git add components/ShareSheet.tsx
git commit -m "Rewrite ShareSheet around server-side video generation"
```

---

### Task 6: Remove obsolete v2 files

**Files:**
- Delete: `lib/shareCard.ts`
- Delete: `lib/instagramShare.ts`
- Delete: `tests/shareCard.test.mjs`
- Delete: `tests/instagramShare.test.mjs`

**Interfaces:** none — this task only removes now-dead code. Confirmed (as of writing this plan) that the only files importing `lib/shareCard.ts` or `lib/instagramShare.ts` were `components/ShareSheet.tsx` (rewritten in Task 5 to no longer do so) and the two test files being deleted here. Re-verify this yourself before deleting, in case anything changed between Task 5 and this task.

- [ ] **Step 1: Confirm nothing else references these files**

Run: `grep -rln "lib/shareCard\|lib/instagramShare" app components lib tests`
Expected output: only `tests/shareCard.test.mjs` and `tests/instagramShare.test.mjs` (the files this task deletes). If anything else shows up, STOP and report NEEDS_CONTEXT rather than deleting.

- [ ] **Step 2: Record the current test count**

Run: `npm test 2>&1 | tail -8` and note the `tests`/`pass` count before deleting anything — this is your baseline for Step 4.

- [ ] **Step 3: Delete the four files**

```bash
git rm lib/shareCard.ts lib/instagramShare.ts tests/shareCard.test.mjs tests/instagramShare.test.mjs
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm test` — expect the total test count to be exactly 14 lower than what you recorded in Step 2 (4 tests from `shareCard.test.mjs` + 10 from `instagramShare.test.mjs`), with everything else still passing. If the count doesn't drop by exactly 14, or anything else fails, investigate before committing — don't assume it's fine.

- [ ] **Step 5: Commit**

```bash
git commit -m "Remove client-side card generation and pasteboard code superseded by server-side video"
```

---

### Task 7: Manual end-to-end verification

**Files:** none (verification only)

Unlike v1/v2, **this task has no external prerequisite** — no Meta App ID, no third-party registration, nothing blocking it. This is a real improvement over the previous two attempts, worth confirming explicitly before starting: run `grep -n "FACEBOOK_APP_ID\|instagram-stories://" -r app components lib` and confirm it returns nothing, i.e. v2's App-ID mechanism is fully gone.

- [ ] **Step 1: Start the dev server and verify the full flow locally**

Run: `npm run dev`. Upload a photo, swipe to save a song with a `previewUrl` (most tracks should have one), confirm `ShareSheet` opens showing the photo immediately, then "Генерируем видео…" appears and is replaced by an enabled "Скачать видео" button once ready. Click it and confirm a playable `.mp4` downloads with both the photo and the track's audio.

- [ ] **Step 2: Verify the no-preview fallback**

Find or contrive a saved track with no `previewUrl` (or temporarily stub one in dev tools) and confirm the sheet skips straight to offering "Скачать фото" with no "Генерируем видео…" state ever shown.

- [ ] **Step 3: Verify the Instagram button flow**

Click "Добавить в историю", confirm the sheet switches to show "✓ Скопировано: {title} — {artist}" and the paste instructions, then click "Открыть Instagram →" and confirm it navigates to Instagram (opens the app if installed on mobile, or instagram.com in a browser tab on desktop).

- [ ] **Step 4: Verify the header icon and library row icon**

On `/results`, confirm the header `share` icon opens the sheet for the currently visible top card. On `/library`, confirm each row with a saved photo shows a share icon that opens the sheet for that row's song; rows without a saved photo still show no share icon (unchanged from v2 — this plan didn't touch that gating logic).

- [ ] **Step 5: Verify on the actual deployed environment**

After pushing and deploying (confirm with the user before pushing to `main`/triggering a deploy, per this app's usual git-push conventions), repeat Steps 1–3 against the real deployed URL, on a real phone. This is the step that actually confirms ffmpeg genuinely works in Vercel's serverless environment (not just locally) — the specific class of "worked in dev, silently different in production" risk this plan's Global Constraints and Task 2 both call out. Confirm the video generation request completes within Vercel's actual function timeout and produces a valid file, and that mobile browser download behavior (particularly iOS Safari, historically pickier about triggering file downloads from JS) actually saves the video where the user can find and post it.
