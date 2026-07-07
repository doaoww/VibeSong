# Vibe Intent Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type an optional free-text "what vibe do you want" phrase before uploading a photo, and have GPT-4o Vision weight that intent heavily when analyzing the photo and directing song matching.

**Architecture:** A pure sanitizer function (`lib/vibeIntent.ts`) caps/cleans the text server-side; a new `vibeIntent` field on the Zustand store carries the trimmed text from the upload screen through to the results screen; `/api/analyze` folds the sanitized text into the GPT-4o Vision prompt as a new labeled block (same pattern as the existing EXIF block). `/api/recommend` is untouched — it already fully consumes the `matchSignals`/`musicBrief` fields the steer flows through.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zustand, Tailwind v4, Node's built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-07-08-vibe-intent-input-design.md`

## Global Constraints

- Never call OpenAI from client components; all AI logic stays in the Node-runtime `/api/analyze` route. (AGENTS.md)
- No hardcoded colors — reuse existing Tailwind design tokens already used in the touched files (`text-on-surface-variant`, `border-outline-variant`, `hot-pink`, `bg-surface-container-low`, etc.). (design/style-guide.md)
- Vibe intent text is capped at 120 characters both client-side (`maxLength={120}`) and server-side (defensive re-slice in `sanitizeVibeIntent`). (spec)
- No changes to `/api/recommend`, vector blending, or the `ENABLE_BRIEF_POOL` embedding pathway — that flag must stay off by default per its existing invariant (`HANDOFF_CODEX.md`). (spec)
- `lib/translations/ru.ts` is typed as `Translation = typeof en` — every new key added to `en.ts` needs a matching entry added to `ru.ts` in the same task, or the project fails to typecheck.
- No changes to the 3-free-credit system, credit deduction, upload/analyze/recommend sequencing, or video frame extraction. (spec, out of scope)

---

## Task 1: Vibe intent sanitizer

**Files:**
- Create: `lib/vibeIntent.ts`
- Test: `tests/vibeIntent.test.mjs`

**Interfaces:**
- Produces: `sanitizeVibeIntent(raw: unknown): string` — trims whitespace, returns `""` for any non-string input, caps the result at 120 characters.

- [ ] **Step 1: Write the failing test**

Create `tests/vibeIntent.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const { sanitizeVibeIntent } = await import("../lib/vibeIntent.ts");

test("sanitizeVibeIntent trims surrounding whitespace", () => {
  assert.equal(sanitizeVibeIntent("  cozy homebody night  "), "cozy homebody night");
});

test("sanitizeVibeIntent returns empty string for non-string input", () => {
  assert.equal(sanitizeVibeIntent(null), "");
  assert.equal(sanitizeVibeIntent(undefined), "");
  assert.equal(sanitizeVibeIntent(42), "");
  assert.equal(sanitizeVibeIntent(["a"]), "");
});

test("sanitizeVibeIntent caps length at 120 characters", () => {
  const result = sanitizeVibeIntent("x".repeat(500));
  assert.equal(result.length, 120);
});

test("sanitizeVibeIntent returns empty string for whitespace-only input", () => {
  assert.equal(sanitizeVibeIntent("   "), "");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/vibeIntent.test.mjs`
Expected: FAIL — cannot find module `../lib/vibeIntent.ts`

- [ ] **Step 3: Write the minimal implementation**

Create `lib/vibeIntent.ts`:

```ts
const MAX_VIBE_INTENT_LENGTH = 120;

/**
 * Server-side safety net for the free-text "what vibe do you want" input —
 * the client already enforces a 120-char maxLength, this re-validates so a
 * malformed or hand-crafted request body can't inject an unbounded string
 * into the GPT-4o Vision prompt.
 */
export function sanitizeVibeIntent(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_VIBE_INTENT_LENGTH);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/vibeIntent.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/vibeIntent.ts tests/vibeIntent.test.mjs
git commit -m "Add sanitizeVibeIntent for the vibe intent input"
```

---

## Task 2: Store field for vibe intent

**Files:**
- Modify: `store/useAppStore.ts:81-110` (interface `AppState`), `:112-126` (initial state), `:246-250` (setter implementation), `:213-220` (`resetSession`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `useAppStore.getState().vibeIntent: string | null` and `useAppStore.getState().setVibeIntent(text: string): void`, consumed by Task 6 and Task 7.

No dedicated automated test — this codebase has no existing test coverage for `useAppStore` (Zustand store), so this task is verified via typecheck (Step 3) and the end-to-end manual check in Task 8.

- [ ] **Step 1: Add the field and setter to the `AppState` interface**

In `store/useAppStore.ts`, change:

```ts
  onboardingPrefs: { languagePreference: string; dislikes: string[] };
  contrastMode: boolean;
  locale: "en" | "ru";

  setUploadedImage: (base64: string, objectUrl: string) => void;
```

to:

```ts
  onboardingPrefs: { languagePreference: string; dislikes: string[] };
  contrastMode: boolean;
  locale: "en" | "ru";
  vibeIntent: string | null;

  setUploadedImage: (base64: string, objectUrl: string) => void;
```

And change:

```ts
  setContrastMode: (v: boolean) => void;
  setLocale: (locale: "en" | "ru") => void;
}
```

to:

```ts
  setContrastMode: (v: boolean) => void;
  setLocale: (locale: "en" | "ru") => void;
  setVibeIntent: (text: string) => void;
}
```

- [ ] **Step 2: Add the initial value and setter implementation**

Change:

```ts
  contrastMode: false,
  locale: "en",
```

to:

```ts
  contrastMode: false,
  locale: "en",
  vibeIntent: null,
```

Change:

```ts
  setLocale: (locale) => {
    if (typeof window !== "undefined") localStorage.setItem("vibesong_locale", locale);
    set({ locale });
  },
}));
```

to:

```ts
  setLocale: (locale) => {
    if (typeof window !== "undefined") localStorage.setItem("vibesong_locale", locale);
    set({ locale });
  },

  setVibeIntent: (text) => set({ vibeIntent: text.trim() || null }),
}));
```

- [ ] **Step 3: Clear `vibeIntent` in `resetSession`**

Change:

```ts
  resetSession: () =>
    set({
      uploadedImage: null,
      uploadedImageUrl: null,
      vibeProfile: null,
      tracks: [],
      currentCardIndex: 0,
    }),
```

to:

```ts
  resetSession: () =>
    set({
      uploadedImage: null,
      uploadedImageUrl: null,
      vibeProfile: null,
      tracks: [],
      currentCardIndex: 0,
      vibeIntent: null,
    }),
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add store/useAppStore.ts
git commit -m "Add vibeIntent field to app store"
```

---

## Task 3: Translation strings

**Files:**
- Modify: `lib/translations/en.ts:89-125` (`home` and `results` objects)
- Modify: `lib/translations/ru.ts:93-129` (`home` and `results` objects)

**Interfaces:**
- Consumes: nothing new.
- Produces: `t.home.vibeIntentPlaceholder: string` and `t.results.youToldUs: (text: string) => string`, consumed by Task 6 and Task 7.

- [ ] **Step 1: Add the English strings**

In `lib/translations/en.ts`, change:

```ts
    recentVibesHeading: "Recent Vibes",
    seeAll: "See all",
  },
  results: {
```

to:

```ts
    recentVibesHeading: "Recent Vibes",
    seeAll: "See all",
    vibeIntentPlaceholder: "What vibe do you want? (optional)",
  },
  results: {
```

And change:

```ts
    nowPlayingMatch: "Now playing match",
    swipeHint: "Swipe right to save · left to skip",
  },
```

to:

```ts
    nowPlayingMatch: "Now playing match",
    swipeHint: "Swipe right to save · left to skip",
    youToldUs: (text: string) => `You told us: "${text}"`,
  },
```

- [ ] **Step 2: Add the Russian strings**

In `lib/translations/ru.ts`, change:

```ts
    recentVibesHeading: "Недавние вайбы",
    seeAll: "Смотреть все",
  },
  results: {
```

to:

```ts
    recentVibesHeading: "Недавние вайбы",
    seeAll: "Смотреть все",
    vibeIntentPlaceholder: "Какой вайб тебе нужен? (необязательно)",
  },
  results: {
```

And change:

```ts
    nowPlayingMatch: "Сейчас играет",
    swipeHint: "Свайп вправо — сохранить, влево — пропустить",
  },
```

to:

```ts
    nowPlayingMatch: "Сейчас играет",
    swipeHint: "Свайп вправо — сохранить, влево — пропустить",
    youToldUs: (text: string) => `Ты хотел(а): «${text}»`,
  },
```

- [ ] **Step 3: Run the translations test and typecheck**

Run: `node --test tests/translations.test.mjs`
Expected: PASS — `en` and `ru` still expose identical top-level and `home`/`results` keys.

Run: `npx tsc --noEmit`
Expected: No errors (a mismatch between `en.ts` and `ru.ts`'s `youToldUs` signature would fail here).

- [ ] **Step 4: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts
git commit -m "Add vibe intent translation strings"
```

---

## Task 4: Fold vibe intent into the GPT-4o Vision prompt

**Files:**
- Modify: `app/api/analyze/route.ts:1-25` (imports), `:131-133` (`buildPrompt`), `:210-238` (POST handler)

**Interfaces:**
- Consumes: `sanitizeVibeIntent` from `lib/vibeIntent.ts` (Task 1).
- Produces: `/api/analyze` now accepts an optional `vibeIntent: string` field in its request body; when non-empty (after sanitizing), the GPT-4o Vision prompt includes a labeled block instructing GPT to weight it heavily. No response schema changes.

There is no existing unit test coverage for this route's inline prompt builders (`buildExifBlock` is untested too, for the same reason: it's tightly coupled to the live OpenAI call). Task 1's test already covers the sanitizer's actual validation logic; this task is verified via typecheck and the end-to-end manual check in Task 8.

- [ ] **Step 1: Import the sanitizer**

In `app/api/analyze/route.ts`, change:

```ts
import { embedText } from "../../../lib/embeddings";
import { vectorToArray } from "../../../lib/vectorMath";
import type { ExifData } from "../../../store/useAppStore";
```

to:

```ts
import { embedText } from "../../../lib/embeddings";
import { vectorToArray } from "../../../lib/vectorMath";
import { sanitizeVibeIntent } from "../../../lib/vibeIntent";
import type { ExifData } from "../../../store/useAppStore";
```

- [ ] **Step 2: Add `buildVibeIntentBlock` and extend `buildPrompt`**

Change:

```ts
function buildPrompt(exifBlock: string): string {
  return BASE_SYSTEM_PROMPT + exifBlock;
}
```

to:

```ts
function buildPrompt(exifBlock: string, vibeIntentBlock: string): string {
  return BASE_SYSTEM_PROMPT + exifBlock + vibeIntentBlock;
}

function buildVibeIntentBlock(vibeIntent: unknown): string {
  const cleaned = sanitizeVibeIntent(vibeIntent);
  if (!cleaned) return "";
  return `\n\nUSER'S REQUESTED VIBE (weight this heavily as the dominant driver of emotion, musicDNA, matchSignals, and musicBrief — but still ground scene/visual fields in what is literally visible in the photo):\n"${cleaned}"`;
}
```

- [ ] **Step 3: Read `vibeIntent` from the request and build the block**

Change:

```ts
    const { image, mimeType, exifData = null, contrastMode = false } = await req.json();
```

to:

```ts
    const { image, mimeType, exifData = null, contrastMode = false, vibeIntent = "" } = await req.json();
```

Change:

```ts
    // Add EXIF block before GPT call (photo metadata as additional context)
    const exifBlock = buildExifBlock(exifData as ExifData | null);
    const prompt = buildPrompt(exifBlock);
```

to:

```ts
    // Add EXIF block before GPT call (photo metadata as additional context)
    const exifBlock = buildExifBlock(exifData as ExifData | null);
    const vibeIntentBlock = buildVibeIntentBlock(vibeIntent);
    const prompt = buildPrompt(exifBlock, vibeIntentBlock);
```

Every other use of `prompt` in this file (the retry/fix prompt built after a parse failure) already reuses this same variable, so it automatically picks up the vibe intent block too — no further changes needed there.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "Fold user vibe intent into the photo analysis prompt"
```

---

## Task 5: `VibeIntentInput` component

**Files:**
- Create: `components/VibeIntentInput.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<VibeIntentInput value={string} onChange={(value: string) => void} placeholder={string} />`, consumed by Task 6.

No automated test — this project has no React component testing infra (no `@testing-library/react`, no jsdom in `devDependencies`), consistent with every other component in `components/`. Verified visually in Task 8's manual check.

- [ ] **Step 1: Create the component**

Create `components/VibeIntentInput.tsx`:

```tsx
"use client";

interface VibeIntentInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export default function VibeIntentInput({ value, onChange, placeholder }: VibeIntentInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={120}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full bg-surface-container-low/50 border border-outline-variant/20 rounded-xl px-4 py-3.5 text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-hot-pink transition-colors text-sm"
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/VibeIntentInput.tsx
git commit -m "Add VibeIntentInput component"
```

---

## Task 6: Wire the input into the upload screen

**Files:**
- Modify: `app/app/page.tsx:5-6` (imports), `:74-75` (local state), `:90-102` (store destructure), `:138-260` (`runAnalysis`), `:310-313` (analyzing screen JSX), `:448` (upload section JSX)

**Interfaces:**
- Consumes: `VibeIntentInput` (Task 5), `useAppStore().vibeIntent` / `setVibeIntent` (Task 2), `t.home.vibeIntentPlaceholder` (Task 3).
- Produces: `/api/analyze` requests now include `vibeIntent: string` in the POST body; the store's `vibeIntent` is populated the moment analysis starts.

- [ ] **Step 1: Import the component**

In `app/app/page.tsx`, change:

```tsx
import DropZone from "../../components/DropZone";
import AppShell from "../../components/AppShell";
```

to:

```tsx
import DropZone from "../../components/DropZone";
import VibeIntentInput from "../../components/VibeIntentInput";
import AppShell from "../../components/AppShell";
```

- [ ] **Step 2: Add local state for the live input value**

Change:

```tsx
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
```

to:

```tsx
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vibeIntentText, setVibeIntentText] = useState("");
```

(This stays separate from the store: the store's `setVibeIntent` trims on every call, which would strip a trailing space while the user is still typing a phrase.)

- [ ] **Step 3: Pull `vibeIntent`/`setVibeIntent` from the store**

Change:

```tsx
  const {
    setUploadedImage,
    setVibeProfile,
    setTracks,
    setIsAnalyzing,
    setLikedSeedTracks,
    setOnboardingPrefs,
    savedSongs,
    vibeProfile,
    uploadedImageUrl,
    likedSeedTracks,
    loadFeedback,
  } = useAppStore();
```

to:

```tsx
  const {
    setUploadedImage,
    setVibeProfile,
    setTracks,
    setIsAnalyzing,
    setLikedSeedTracks,
    setOnboardingPrefs,
    savedSongs,
    vibeProfile,
    vibeIntent,
    uploadedImageUrl,
    likedSeedTracks,
    loadFeedback,
    setVibeIntent,
  } = useAppStore();
```

- [ ] **Step 4: Send `vibeIntent` with the analyze request and store it**

Change:

```tsx
      setPageState("analyzing");
      setErrorMsg(null);
      setFailedUpload(null);
      setIsAnalyzing(true);
      setUploadedImage(base64, objectUrl);

      try {
        const { contrastMode, onboardingPrefs } = useAppStore.getState();
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mimeType, exifData, contrastMode }),
        });
```

to:

```tsx
      setPageState("analyzing");
      setErrorMsg(null);
      setFailedUpload(null);
      setIsAnalyzing(true);
      setUploadedImage(base64, objectUrl);
      setVibeIntent(vibeIntentText);

      try {
        const { contrastMode, onboardingPrefs } = useAppStore.getState();
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            mimeType,
            exifData,
            contrastMode,
            vibeIntent: vibeIntentText.trim(),
          }),
        });
```

- [ ] **Step 5: Add `vibeIntentText`/`setVibeIntent` to `runAnalysis`'s dependency array**

Change:

```tsx
    [
      user,
      add,
      setUploadedImage,
      setVibeProfile,
      setTracks,
      setIsAnalyzing,
      router,
      likedSeedTracks,
      t,
    ]
  );
```

to:

```tsx
    [
      user,
      add,
      setUploadedImage,
      setVibeProfile,
      setTracks,
      setIsAnalyzing,
      router,
      likedSeedTracks,
      t,
      vibeIntentText,
      setVibeIntent,
    ]
  );
```

- [ ] **Step 6: Show the typed vibe on the analyzing screen**

Change:

```tsx
          <div className="flex-1 flex flex-col items-center justify-start pt-6 px-6 space-y-5">
            {vibeProfile?.vibeTags && (
              <VibeTags tags={vibeProfile.vibeTags} animate />
            )}

            <div className="flex items-end gap-1 h-10">
```

to:

```tsx
          <div className="flex-1 flex flex-col items-center justify-start pt-6 px-6 space-y-5">
            {vibeProfile?.vibeTags && (
              <VibeTags tags={vibeProfile.vibeTags} animate />
            )}

            {vibeIntent && (
              <p className="text-on-surface-variant text-sm italic text-center">
                “{vibeIntent}”
              </p>
            )}

            <div className="flex items-end gap-1 h-10">
```

- [ ] **Step 7: Render the input above the DropZone**

Change:

```tsx
            <DropZone onImageReady={handleImageReady} disabled={loaded && credits <= 0} />

            <ContrastModeToggle />
```

to:

```tsx
            <VibeIntentInput
              value={vibeIntentText}
              onChange={setVibeIntentText}
              placeholder={t.home.vibeIntentPlaceholder}
            />

            <DropZone onImageReady={handleImageReady} disabled={loaded && credits <= 0} />

            <ContrastModeToggle />
```

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add app/app/page.tsx
git commit -m "Wire vibe intent input into the upload screen"
```

---

## Task 7: Show the vibe intent on the results screen

**Files:**
- Modify: `app/results/page.tsx:11-48` (`VibeHero`), `:124-131` (`ResultsPage` store destructure), `:305-314` (`VibeHero` usage)

**Interfaces:**
- Consumes: `useAppStore().vibeIntent` (Task 2), `t.results.youToldUs` (Task 3).
- Produces: nothing new for later tasks — this is the last consumer of `vibeIntent`.

- [ ] **Step 1: Accept and render `vibeIntent` in `VibeHero`**

Change:

```tsx
function VibeHero({
  imageUrl,
  caption,
  tags,
  t,
}: {
  imageUrl: string;
  caption?: string;
  tags?: string[];
  t: ReturnType<typeof useTranslation>;
}) {
  return (
    <section className="space-y-3">
      <p className="text-hot-pink text-xs font-display font-semibold uppercase tracking-widest">
        {t.results.yourPhoto}
      </p>

      <div className="w-full rounded-xl overflow-hidden bg-surface-container border border-outline-variant/25 flex items-center justify-center">
        <img
          src={imageUrl}
          alt={t.results.yourVibeAlt}
          className="w-full h-auto max-h-[calc(100vh-14rem)] object-contain"
        />
      </div>

      {(caption || tags?.length) && (
        <div className="space-y-2 px-0.5">
          {caption && (
            <p className="text-white italic text-base leading-relaxed line-clamp-2">
              {caption}
            </p>
          )}
          {tags && tags.length > 0 && <VibeTags tags={tags} />}
        </div>
      )}
    </section>
  );
}
```

to:

```tsx
function VibeHero({
  imageUrl,
  caption,
  tags,
  vibeIntent,
  t,
}: {
  imageUrl: string;
  caption?: string;
  tags?: string[];
  vibeIntent?: string | null;
  t: ReturnType<typeof useTranslation>;
}) {
  return (
    <section className="space-y-3">
      <p className="text-hot-pink text-xs font-display font-semibold uppercase tracking-widest">
        {t.results.yourPhoto}
      </p>

      <div className="w-full rounded-xl overflow-hidden bg-surface-container border border-outline-variant/25 flex items-center justify-center">
        <img
          src={imageUrl}
          alt={t.results.yourVibeAlt}
          className="w-full h-auto max-h-[calc(100vh-14rem)] object-contain"
        />
      </div>

      {(caption || tags?.length || vibeIntent) && (
        <div className="space-y-2 px-0.5">
          {caption && (
            <p className="text-white italic text-base leading-relaxed line-clamp-2">
              {caption}
            </p>
          )}
          {vibeIntent && (
            <p className="text-on-surface-variant text-sm">
              {t.results.youToldUs(vibeIntent)}
            </p>
          )}
          {tags && tags.length > 0 && <VibeTags tags={tags} />}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Pull `vibeIntent` from the store and pass it down**

Change:

```tsx
  const {
    tracks,
    vibeProfile,
    uploadedImageUrl,
    saveTrack,
    skipTrack,
    nextCard,
  } = useAppStore();
```

to:

```tsx
  const {
    tracks,
    vibeProfile,
    vibeIntent,
    uploadedImageUrl,
    saveTrack,
    skipTrack,
    nextCard,
  } = useAppStore();
```

Change:

```tsx
        {uploadedImageUrl && (
          <aside className="hidden lg:block lg:sticky lg:top-[4.5rem]">
            <VibeHero
              imageUrl={uploadedImageUrl}
              caption={vibeProfile?.vibeCaption}
              tags={vibeProfile?.vibeTags}
              t={t}
            />
          </aside>
        )}
```

to:

```tsx
        {uploadedImageUrl && (
          <aside className="hidden lg:block lg:sticky lg:top-[4.5rem]">
            <VibeHero
              imageUrl={uploadedImageUrl}
              caption={vibeProfile?.vibeCaption}
              tags={vibeProfile?.vibeTags}
              vibeIntent={vibeIntent}
              t={t}
            />
          </aside>
        )}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/results/page.tsx
git commit -m "Show the user's vibe intent on the results screen"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: All tests pass, including the new `tests/vibeIntent.test.mjs` and the existing `tests/translations.test.mjs`.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Build succeeds with no type or lint errors.

- [ ] **Step 3: Manual smoke test — text steers the match**

Run: `npm run dev`, then in a browser:

1. Open `http://localhost:3000/app` and sign in if prompted (`AuthGate`).
2. Confirm a text field reading "What vibe do you want? (optional)" appears above the "Drop your photo" box.
3. Type `she'll regret leaving me` into it.
4. Upload any neutral photo (e.g. a plain selfie or landscape — nothing overtly breakup-themed).
5. On the analyzing screen, confirm the quoted text `"she'll regret leaving me"` appears near the mood tags.
6. Wait for results. On desktop width (≥1024px), confirm the left sidebar shows `You told us: "she'll regret leaving me"` under the photo caption.
7. Check the returned song matches lean toward spite/breakup-anthem energy rather than a neutral read of the photo.

- [ ] **Step 4: Manual smoke test — empty input is a no-op**

1. Return to `/app`, leave the vibe field blank, and upload a photo.
2. Confirm the analyzing screen shows no quoted vibe line and the results sidebar shows no "You told us" line.
3. Confirm the rest of the flow (swiping, saving, library) behaves exactly as before this change.

- [ ] **Step 5: Manual smoke test — Russian locale**

1. Switch the app to Russian via the existing language toggle.
2. Confirm the input placeholder reads "Какой вайб тебе нужен? (необязательно)".
3. Repeat step 3's flow in Russian and confirm the results sidebar reads `Ты хотел(а): «...»`.
