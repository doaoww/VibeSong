# Pitch-Ready Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the match-score breakdown and existing retrieval intelligence in the swipe UI, harden the demo flow against silent long waits, and add a visible live in-session taste-learning re-rank — all ahead of an investor pitch this week.

**Architecture:** Pure UI/display work layered on data the backend already computes (`scoreComponents`, `emotional_vector`) plus one new small pure-function module (`lib/sessionTaste.ts`) that composes two already-tested primitives (`buildTasteVector`, `cosine`) to score and reorder the client-side swipe stack. No new API routes, no changes to `/api/recommend`'s scoring formula, no persistence beyond the existing session.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zustand (`store/useAppStore.ts`), Framer Motion, Node's built-in test runner (`node --test`, `.mjs` test files that import `.ts` sources directly).

## Global Constraints

- Styling must use only the existing design tokens already used in the touched files (`hot-pink`, `lime`, `on-surface-variant`, `surface-container`, etc.) — no new colors introduced.
- Every new/changed user-facing string must exist in **both** `lib/translations/en.ts` and `lib/translations/ru.ts` — `ru.ts`'s `Translation` type is `typeof en`, so a missing key is a TypeScript compile error, not just a UX gap.
- No changes to `/api/recommend`'s scoring formula (`lib/recommend.ts`), the curator agent, credits, or auth — per the spec's "Out of scope."
- New pure logic (`lib/sessionTaste.ts`) must ship with `node --test` coverage following this repo's existing test convention (see `tests/emotionalVector.test.mjs`): direct `import ... from "../lib/x.ts"`, `node:assert/strict`, `node:test`.
- `npm run test` and `npx tsc --noEmit` must both pass before any task is considered done.

---

## Task 1: Translation keys for score breakdown, learning toast, and demo-safety text

**Files:**
- Modify: `lib/translations/en.ts:146` (end of `swipe` block) and `lib/translations/en.ts:102` (inside `home` block)
- Modify: `lib/translations/ru.ts:151` (end of `swipe` block) and `lib/translations/ru.ts` (inside `home` block, same key as en)
- Test: manual — `npx tsc --noEmit`

**Interfaces:**
- Produces: `t.swipe.photoFitLabel`, `t.swipe.tasteFitLabel`, `t.swipe.storyFitLabel`, `t.swipe.learningYourVibe`, `t.home.stillWorkingText`, `t.home.catalogFreshness` — consumed by Tasks 3, 4, 5, 7.

- [ ] **Step 1: Add new `swipe` keys to `lib/translations/en.ts`**

In `lib/translations/en.ts`, inside the `swipe: { ... }` block, right before the closing `},` at line 163 (after `swipeHintFull: "..."`), add:

```ts
    photoFitLabel: "Photo vibe",
    tasteFitLabel: "Your taste",
    storyFitLabel: "Story",
    learningYourVibe: "Learning your vibe…",
```

- [ ] **Step 2: Add matching `swipe` keys to `lib/translations/ru.ts`**

In `lib/translations/ru.ts`, inside the `swipe: { ... }` block, right before its closing `},` (mirrors the line added in Step 1), add:

```ts
    photoFitLabel: "Вайб фото",
    tasteFitLabel: "Твой вкус",
    storyFitLabel: "История",
    learningYourVibe: "Изучаю твой вкус…",
```

- [ ] **Step 3: Add `home.stillWorkingText` to both files**

In `lib/translations/en.ts`, inside the `home: { ... }` block, right after the `analyzingSubtext: "This takes about 5 seconds",` line, add:

```ts
    stillWorkingText: "Still working — checking your photo against thousands of tracks",
    catalogFreshness: "Catalog auto-updates daily from global trending charts",
```

In `lib/translations/ru.ts`, inside the `home: { ... }` block, at the same position (after the `analyzingSubtext` override), add:

```ts
    stillWorkingText: "Всё ещё работаю — сверяю твоё фото с тысячами треков",
    catalogFreshness: "Каталог обновляется ежедневно из мировых чартов",
```

- [ ] **Step 4: Verify the translation types compile**

Run: `npx tsc --noEmit`
Expected: no new errors. If `ru.ts` is missing a key `en.ts` has (or vice versa), TypeScript will fail to compile `ru.ts`'s `const ru: Translation = {...}` — fix any reported missing key before continuing.

- [ ] **Step 5: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts
git commit -m "feat: add translation keys for match breakdown and demo-safety text"
```

---

## Task 2: Thread `storyFitScore` and `emotionalVector` onto `Track`

**Files:**
- Modify: `store/useAppStore.ts:58-80` (`Track` interface)
- Modify: `app/app/page.tsx:205-227` (`mappedTracks` mapping)

**Interfaces:**
- Consumes: `/api/recommend`'s response `songs[].scoreComponents.storyFit` (already computed, see `lib/recommend.ts:320`) and `songs[].emotional_vector` (already present on `CatalogSong`, see `lib/db/songs.ts:12`) — neither requires a backend change.
- Produces: `Track.storyFitScore?: number` and `Track.emotionalVector?: number[] | null` — consumed by Task 4 (breakdown display) and Task 7 (live re-rank).

- [ ] **Step 1: Add the two fields to the `Track` interface**

In `store/useAppStore.ts`, inside `export interface Track { ... }` (around line 58-80), add two fields right after the existing `tasteFitScore?: number;` line:

```ts
  storyFitScore?: number;
  emotionalVector?: number[] | null;
```

- [ ] **Step 2: Extend the inline mapping type in `app/app/page.tsx`**

In `app/app/page.tsx`, find the `recommendedSongs.map((s: { ... }) => ({ ... }))` block (around line 205-227). Update the inline parameter type to add `emotional_vector`:

```ts
        const mappedTracks: Track[] = recommendedSongs.map((s: {
          title: string; artist: string; language: string;
          story_intent_tags: string[]; mood_tags: string[]; genre_tags: string[];
          scoreComponents: { finalScore: number; photoFit: number; tasteFit: number; storyFit: number };
          artwork_url: string | null; itunes_preview_url: string | null;
          apple_music_url: string | null; youtube_id: string | null;
          emotional_vector: number[] | null;
        }) => ({
```

- [ ] **Step 3: Populate the two new fields in the returned object**

In the same mapping's return object, right after the existing `tasteFitScore: s.scoreComponents.tasteFit,` line, add:

```ts
          storyFitScore: s.scoreComponents.storyFit,
          emotionalVector: s.emotional_vector,
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add store/useAppStore.ts "app/app/page.tsx"
git commit -m "feat: thread storyFitScore and emotionalVector onto Track"
```

---

## Task 3: Demo-safety fallback text on the analyzing screen

**Files:**
- Modify: `app/app/page.tsx:137-143` (existing `analyzeTextIdx` interval effect) and the `analyzing` render block (around line 356-371)

**Interfaces:**
- Consumes: `t.home.stillWorkingText` (Task 1).
- Produces: no new exports — self-contained UI behavior.

- [ ] **Step 1: Add a "still working" timer alongside the existing text-cycling effect**

In `app/app/page.tsx`, near the existing effect at line 137-143:

```ts
  useEffect(() => {
    if (pageState !== "analyzing") return;
    const interval = setInterval(() => {
      setAnalyzeTextIdx((i) => (i + 1) % t.home.analyzingTexts.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [pageState, t]);
```

add a new sibling effect right after it:

```ts
  const [showStillWorking, setShowStillWorking] = useState(false);
  useEffect(() => {
    if (pageState !== "analyzing") {
      setShowStillWorking(false);
      return;
    }
    const timer = setTimeout(() => setShowStillWorking(true), 8000);
    return () => clearTimeout(timer);
  }, [pageState]);
```

- [ ] **Step 2: Render the fallback text in the analyzing screen**

In the `pageState === "analyzing"` render block, right after the existing:

```tsx
            <p className="text-on-surface-variant text-sm">
              {t.home.analyzingSubtext}
            </p>
```

add:

```tsx
            {showStillWorking && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-on-surface-variant/70 text-xs text-center max-w-xs"
              >
                {t.home.stillWorkingText}
              </motion.p>
            )}
```

- [ ] **Step 3: Manually verify via the dev server**

Run: `npm run dev`, upload a photo, and confirm the analyzing screen still cycles its texts normally within the first ~8 seconds (typical case, unaffected). To see the fallback text itself, temporarily throttle network in devtools or add a `await new Promise(r => setTimeout(r, 9000))` before the `fetch("/api/analyze")` call, confirm the fallback line appears, then remove the temporary delay.
Expected: fallback text appears only after ~8s, styled subtly under the main analyzing message, and disappears immediately once `pageState` leaves `"analyzing"`.

- [ ] **Step 4: Commit**

```bash
git add "app/app/page.tsx"
git commit -m "feat: show a fallback message when analysis runs past 8 seconds"
```

---

## Task 4: Render the match-score breakdown in SwipeCard

**Files:**
- Modify: `components/SwipeCard.tsx:42-61` (replace `MatchScore`) and both the mobile (line ~166-204) and desktop (line ~226-239) layout blocks

**Interfaces:**
- Consumes: `Track.photoFitScore`, `Track.tasteFitScore`, `Track.storyFitScore` (Task 2), `t.swipe.photoFitLabel` / `tasteFitLabel` / `storyFitLabel` (Task 1).
- Produces: no new exports — internal component change only.

- [ ] **Step 1: Replace the `MatchScore` component with `MatchBreakdown`**

In `components/SwipeCard.tsx`, replace the existing `MatchScore` function (lines 42-61) with:

```tsx
// Max possible contribution of each score component, mirroring the weights
// in lib/recommend.ts's scoring layer: photoFit = cosine * 40, tasteFit =
// genreScore*15 + artistScore*10 + aestheticMatch*5 (max 30), storyFit =
// min(3, matches) * 7 * confFactor (max 3*7*1 = 21). Bars show each
// component as a % of its own max so they're visually comparable even
// though the raw point scales differ.
const PHOTO_FIT_MAX = 40;
const TASTE_FIT_MAX = 30;
const STORY_FIT_MAX = 21;

function pctOfMax(score: number | undefined, max: number): number {
  if (typeof score !== "number") return 0;
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
}

function BreakdownBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-baseline">
        <span className="text-on-surface-variant text-[9px] uppercase tracking-wide">
          {label}
        </span>
        <span className="text-white text-[10px] font-semibold tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-hot-pink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MatchBreakdown({
  track,
  t,
}: {
  track: Track;
  t: ReturnType<typeof useTranslation>;
}) {
  const hasBreakdown =
    typeof track.photoFitScore === "number" &&
    typeof track.tasteFitScore === "number" &&
    typeof track.storyFitScore === "number";

  if (!hasBreakdown) {
    // Fallback for any track without a breakdown (e.g. older cached data) —
    // shows just the overall score, same as the previous single-bar UI.
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-end">
          <span className="text-lime text-[10px] font-semibold uppercase tracking-widest">
            {t.swipe.matchScore}
          </span>
          <span className="text-white font-display font-bold text-base lg:text-lg">
            {track.matchScore}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-hot-pink" style={{ width: `${track.matchScore}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-full">
      <BreakdownBar label={t.swipe.photoFitLabel} pct={pctOfMax(track.photoFitScore, PHOTO_FIT_MAX)} />
      <BreakdownBar label={t.swipe.tasteFitLabel} pct={pctOfMax(track.tasteFitScore, TASTE_FIT_MAX)} />
      <BreakdownBar label={t.swipe.storyFitLabel} pct={pctOfMax(track.storyFitScore, STORY_FIT_MAX)} />
    </div>
  );
}

function CompactBreakdown({
  track,
  t,
}: {
  track: Track;
  t: ReturnType<typeof useTranslation>;
}) {
  const hasBreakdown =
    typeof track.photoFitScore === "number" &&
    typeof track.tasteFitScore === "number" &&
    typeof track.storyFitScore === "number";
  if (!hasBreakdown) return null;

  return (
    <p className="text-on-surface-variant text-[10px] truncate">
      {t.swipe.photoFitLabel} {pctOfMax(track.photoFitScore, PHOTO_FIT_MAX)}% ·{" "}
      {t.swipe.tasteFitLabel} {pctOfMax(track.tasteFitScore, TASTE_FIT_MAX)}% ·{" "}
      {t.swipe.storyFitLabel} {pctOfMax(track.storyFitScore, STORY_FIT_MAX)}%
    </p>
  );
}
```

- [ ] **Step 2: Use `MatchBreakdown` on desktop (replacing the old `MatchScore` call)**

In `components/SwipeCard.tsx`, in the desktop layout block, replace:

```tsx
            <MatchScore score={track.matchScore} t={t} />
```

with:

```tsx
            <MatchBreakdown track={track} t={t} />
```

- [ ] **Step 3: Show `reason` and `CompactBreakdown` on mobile**

In the mobile layout block, find this section (the info row with title/artist/score):

```tsx
            <div className="min-w-0 flex-1">
              <h2 className="text-white font-display font-bold text-base leading-tight truncate">
                {track.title}
              </h2>
              <p className="text-on-surface-variant text-xs truncate mt-0.5">
                {track.artist}
              </p>
            </div>
            <span className="flex-shrink-0 font-display font-bold text-hot-pink text-sm tabular-nums">
              {track.matchScore}%
            </span>
          </div>
```

Replace it with (adds a `reason` line and the compact breakdown below the existing row, keeping the existing title/artist/score row untouched):

```tsx
            <div className="min-w-0 flex-1">
              <h2 className="text-white font-display font-bold text-base leading-tight truncate">
                {track.title}
              </h2>
              <p className="text-on-surface-variant text-xs truncate mt-0.5">
                {track.artist}
              </p>
            </div>
            <span className="flex-shrink-0 font-display font-bold text-hot-pink text-sm tabular-nums">
              {track.matchScore}%
            </span>
          </div>

          {track.reason && (
            <p className="text-on-surface-variant italic text-[11px] leading-snug line-clamp-1">
              {track.reason}
            </p>
          )}
          <CompactBreakdown track={track} t={t} />
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, upload a photo, reach `/results`, and confirm on both a desktop-width and a mobile-width (devtools responsive mode, e.g. 390px) viewport: three labeled bars (or the compact one-line version on mobile) show percentages that look plausible (roughly track with a high `matchScore` also has a high `photoFit`/`tasteFit` reading), and no layout overflow/clipping occurs.
Expected: breakdown renders cleanly on both layouts; no console errors.

- [ ] **Step 5: Commit**

```bash
git add components/SwipeCard.tsx
git commit -m "feat: show match-score breakdown (photo/taste/story fit) on swipe cards"
```

---

## Task 5: "Catalog auto-updates daily" freshness line on the home screen

Surfaces the autonomous curator agent (`lib/curator.ts` + `app/api/cron/curate-catalog/route.ts`) in the product itself, not just the deck — a one-line, static, zero-risk addition (no DB query, no new loading state).

**Files:**
- Modify: `app/app/page.tsx` (home screen, near the existing "free matches" line around line 486-488)

**Interfaces:**
- Consumes: `t.home.catalogFreshness` (Task 1).

- [ ] **Step 1: Add the freshness line under the existing free-matches line**

In `app/app/page.tsx`, find:

```tsx
            <p className="text-center text-xs text-on-surface-variant">
              <span className="text-hot-pink">✦</span> {t.home.freeMatches(credits)}
            </p>
```

and add a new line directly after it:

```tsx
            <p className="text-center text-xs text-on-surface-variant">
              <span className="text-hot-pink">✦</span> {t.home.freeMatches(credits)}
            </p>
            <p className="text-center text-[11px] text-on-surface-variant/60">
              {t.home.catalogFreshness}
            </p>
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, open `/app`, confirm the new line renders under the free-matches line without crowding the upload dropzone, on both desktop and a mobile-width viewport.
Expected: subtle, single line, no layout shift/overflow.

- [ ] **Step 3: Commit**

```bash
git add "app/app/page.tsx"
git commit -m "feat: surface autonomous catalog curator agent on the home screen"
```

---

## Task 6: `lib/sessionTaste.ts` — session taste vector + live re-scoring (TDD)

**Files:**
- Create: `lib/sessionTaste.ts`
- Test: `tests/sessionTaste.test.mjs`

**Interfaces:**
- Consumes: `buildTasteVector` from `lib/emotionalVector.ts` (existing, tested in `tests/emotionalVector.test.mjs`), `arrayToVector`/`vectorToArray`/`cosine` from `lib/vectorMath.ts` (existing, tested in `tests/vectorMath.test.mjs`).
- Produces: `computeSessionTasteVector(saved, skipped): number[] | null` and `scoreRemainingTracks<T>(tracks, sessionVector): Array<T & { liveScore: number }>` — consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

Create `tests/sessionTaste.test.mjs`:

```js
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { computeSessionTasteVector, scoreRemainingTracks } from "../lib/sessionTaste.ts";

test("computeSessionTasteVector returns null before any track is saved", () => {
  const result = computeSessionTasteVector([], [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]);
  assert.equal(result, null);
});

test("computeSessionTasteVector returns a 10-length vector once a track is saved", () => {
  const saved = [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }];
  const result = computeSessionTasteVector(saved, []);
  assert.equal(result.length, 10);
  assert.equal(result[0], 1);
});

test("computeSessionTasteVector weighs the saved track's dimension over a skipped one", () => {
  const saved = [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]; // dreamy
  const skipped = [{ emotionalVector: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] }]; // nostalgia
  const result = computeSessionTasteVector(saved, skipped);
  assert.ok(result[0] > result[1]);
});

test("computeSessionTasteVector ignores tracks without a usable emotionalVector", () => {
  const saved = [{ emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { emotionalVector: null }, {}];
  const result = computeSessionTasteVector(saved, []);
  assert.equal(result.length, 10);
  assert.equal(result[0], 1);
});

test("scoreRemainingTracks ranks the track closer to the session vector first", () => {
  const sessionVector = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const tracks = [
    { id: "far", finalScore: 50, emotionalVector: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
    { id: "close", finalScore: 50, emotionalVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ];
  const result = scoreRemainingTracks(tracks, sessionVector);
  assert.equal(result[0].id, "close");
});

test("scoreRemainingTracks falls back to 60% of base score when a track has no vector", () => {
  const sessionVector = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const tracks = [{ id: "novector", finalScore: 80 }];
  const result = scoreRemainingTracks(tracks, sessionVector);
  assert.equal(result[0].liveScore, 48);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/sessionTaste.test.mjs`
Expected: FAIL — `Cannot find module '../lib/sessionTaste.ts'` (file doesn't exist yet).

- [ ] **Step 3: Implement `lib/sessionTaste.ts`**

```ts
import { buildTasteVector } from "./emotionalVector";
import { arrayToVector, vectorToArray, cosine } from "./vectorMath";

export interface SessionTrack {
  emotionalVector?: number[] | null;
}

function hasUsableVector(track: SessionTrack): track is SessionTrack & { emotionalVector: number[] } {
  return Array.isArray(track.emotionalVector) && track.emotionalVector.length === 10;
}

/**
 * Folds this session's saved/skipped tracks into a single taste vector,
 * reusing the already-tested buildTasteVector (likes add, skips subtract at
 * 0.2, clamped non-negative, normalized). Returns null until at least one
 * track has been saved — the live re-rank stays off (server ranking only)
 * until there's a real signal to learn from.
 */
export function computeSessionTasteVector(
  saved: SessionTrack[],
  skipped: SessionTrack[]
): number[] | null {
  const validSaved = saved.filter(hasUsableVector);
  if (validSaved.length === 0) return null;

  const toTasteInput = (tracks: SessionTrack[]) =>
    tracks.filter(hasUsableVector).map((t) => ({ emotionalVector: arrayToVector(t.emotionalVector) }));

  const taste = buildTasteVector(toTasteInput(saved), toTasteInput(skipped));
  return vectorToArray(taste);
}

export interface ScoredTrack {
  emotionalVector?: number[] | null;
  finalScore?: number;
}

/**
 * Re-scores tracks against the live session taste vector: 60% original
 * server score, 40% cosine similarity to the session vector, sorted
 * descending. Tracks without an emotionalVector fall back to 60% of their
 * base score (similarity term contributes 0) rather than being excluded.
 */
export function scoreRemainingTracks<T extends ScoredTrack>(
  tracks: T[],
  sessionVector: number[]
): Array<T & { liveScore: number }> {
  return tracks
    .map((track) => {
      const base = typeof track.finalScore === "number" ? track.finalScore : 0;
      const sim = hasUsableVector(track)
        ? Math.max(0, Math.min(1, cosine(sessionVector, track.emotionalVector)))
        : 0;
      const liveScore = Math.round(Math.max(0, Math.min(100, base * 0.6 + sim * 100 * 0.4)));
      return { ...track, liveScore };
    })
    .sort((a, b) => b.liveScore - a.liveScore);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/sessionTaste.test.mjs`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npm run test`
Expected: PASS — all existing tests plus the 6 new ones.

- [ ] **Step 6: Commit**

```bash
git add lib/sessionTaste.ts tests/sessionTaste.test.mjs
git commit -m "feat: add lib/sessionTaste for live in-session taste re-ranking"
```

---

## Task 7: Wire live taste re-rank into the results page + animate reordering

**Files:**
- Modify: `app/results/page.tsx:1-9` (imports), `128-173` (state + handlers), `284-286` (topIdx), `325-356` (render block)
- Modify: `components/SwipeCard.tsx:104-119` (motion.div style/animate split)

**Interfaces:**
- Consumes: `computeSessionTasteVector`, `scoreRemainingTracks` from `lib/sessionTaste.ts` (Task 6); `Track.emotionalVector`, `Track.finalScore` (Task 2); `t.swipe.learningYourVibe` (Task 1).

- [ ] **Step 1: Import the new module in `app/results/page.tsx`**

Add near the top imports:

```ts
import { computeSessionTasteVector, scoreRemainingTracks } from "../../lib/sessionTaste";
```

- [ ] **Step 2: Add session-tracking state**

Replace the existing state block:

```ts
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [done, setDone] = useState(false);
```

with:

```ts
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [skippedThisSession, setSkippedThisSession] = useState<Track[]>([]);
  const [remainingOrder, setRemainingOrder] = useState<number[] | null>(null);
  const [liveScores, setLiveScores] = useState<Record<number, number>>({});
  const [justLearned, setJustLearned] = useState(false);
  const [done, setDone] = useState(false);
```

- [ ] **Step 3: Add the `recomputeOrder` helper**

Right after `displayTracks = tracks` (around line 145), add:

```ts
  type IndexedTrack = Track & { __idx: number };

  const recomputeOrder = (newGone: Set<number>, saved: Track[], skipped: Track[]) => {
    const sessionVector = computeSessionTasteVector(saved, skipped);
    if (!sessionVector) {
      setRemainingOrder(null);
      setLiveScores({});
      return;
    }
    const indexed: IndexedTrack[] = displayTracks
      .map((track, i) => ({ ...track, __idx: i }))
      .filter((track) => !newGone.has(track.__idx));
    const scored = scoreRemainingTracks(indexed, sessionVector);
    setRemainingOrder(scored.map((track) => track.__idx));
    const scoresByIdx: Record<number, number> = {};
    for (const track of scored) scoresByIdx[track.__idx] = track.liveScore;
    setLiveScores(scoresByIdx);
    setJustLearned(true);
    setTimeout(() => setJustLearned(false), 1500);
  };
```

- [ ] **Step 4: Call it from `handleSave`/`handleSkip`**

Replace:

```ts
  const handleSave = (idx: number, track: Track) => {
    saveTrack(track);
    setSavedTracks((p) => [...p, track]);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    if (getTopIndex(newGone) === -1) setDone(true);
  };

  const handleSkip = (idx: number, track: Track) => {
    skipTrack(track);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    if (getTopIndex(newGone) === -1) setDone(true);
  };
```

with:

```ts
  const handleSave = (idx: number, track: Track) => {
    saveTrack(track);
    const newSaved = [...savedTracks, track];
    setSavedTracks(newSaved);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    recomputeOrder(newGone, newSaved, skippedThisSession);
    if (getTopIndex(newGone) === -1) setDone(true);
  };

  const handleSkip = (idx: number, track: Track) => {
    skipTrack(track);
    const newSkipped = [...skippedThisSession, track];
    setSkippedThisSession(newSkipped);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    recomputeOrder(newGone, savedTracks, newSkipped);
    if (getTopIndex(newGone) === -1) setDone(true);
  };
```

- [ ] **Step 5: Replace index-order rendering with `orderedIndices`**

Replace:

```ts
  const topIdx = getTopIndex(gone);
```

with:

```ts
  const orderedIndices =
    remainingOrder ?? displayTracks.map((_, i) => i).filter((i) => !gone.has(i));
  const topIdx = orderedIndices.length > 0 ? orderedIndices[0] : -1;
```

- [ ] **Step 6: Update the card-stack render loop**

Replace:

```tsx
            <AnimatePresence>
              {displayTracks.map((track, idx) => {
                if (gone.has(idx)) return null;
                const isTop = idx === topIdx;
                const stackIndex = idx - (topIdx === -1 ? 0 : topIdx);
                return (
                  <SwipeCard
                    key={`${track.previewUrl || track.youtubeId || track.title}-${idx}`}
                    track={track}
                    isTop={isTop}
                    stackIndex={Math.max(0, stackIndex)}
                    onSave={() => handleSave(idx, track)}
                    onSkip={() => handleSkip(idx, track)}
                    vibeImageUrl={uploadedImageUrl ?? undefined}
                    vibeCaption={vibeProfile?.vibeCaption}
                    vibeTags={vibeProfile?.vibeTags}
                  />
                );
              })}
            </AnimatePresence>
```

with:

```tsx
            <AnimatePresence>
              {orderedIndices.map((idx, position) => {
                const track = displayTracks[idx];
                const liveScore = liveScores[idx];
                const cardTrack = liveScore !== undefined ? { ...track, matchScore: liveScore } : track;
                return (
                  <SwipeCard
                    key={`${track.previewUrl || track.youtubeId || track.title}-${idx}`}
                    track={cardTrack}
                    isTop={position === 0}
                    stackIndex={position}
                    onSave={() => handleSave(idx, track)}
                    onSkip={() => handleSkip(idx, track)}
                    vibeImageUrl={uploadedImageUrl ?? undefined}
                    vibeCaption={vibeProfile?.vibeCaption}
                    vibeTags={vibeProfile?.vibeTags}
                  />
                );
              })}
            </AnimatePresence>
```

- [ ] **Step 7: Add the "Learning your vibe" toast above the card stack**

Right before the `<div className="relative flex-1 ...">` card-stack container (around line 335), add:

```tsx
          <AnimatePresence>
            {justLearned && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mx-auto w-fit bg-hot-pink/15 border border-hot-pink/30 text-hot-pink text-xs font-semibold px-3 py-1.5 rounded-full"
              >
                {t.swipe.learningYourVibe}
              </motion.div>
            )}
          </AnimatePresence>
```

- [ ] **Step 8: Animate stack-position changes in `SwipeCard` so reordering is visible**

In `components/SwipeCard.tsx`, replace the outer `motion.div`'s props:

```tsx
    <motion.div
      style={{
        x,
        rotate,
        opacity: cardOpacity,
        zIndex: 10 - stackIndex,
        scale: isTop ? 1 : 1 - stackIndex * 0.04,
        y: stackIndex * 8,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none touch-pan-y"
    >
```

with:

```tsx
    <motion.div
      style={{ x, rotate, opacity: cardOpacity, zIndex: 10 - stackIndex }}
      animate={{ scale: isTop ? 1 : 1 - stackIndex * 0.04, y: stackIndex * 8 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none touch-pan-y"
    >
```

- [ ] **Step 9: Manually verify the live re-rank end to end**

Run: `npm run dev`, upload a photo, reach `/results`. Save 2-3 cards in a row that look similar in vibe (e.g. same genre tag if visible), then observe:
1. After the first save, the "Learning your vibe…" pill appears briefly above the stack.
2. The percentage on the next card(s) changes (compare before/after a save — open devtools React tab or just watch the number).
3. The stack visibly glides (spring animation) rather than snapping when cards reorder.
4. Skip-only sessions (no saves) behave exactly as before — no re-rank, no toast — confirming the "needs a save first" gate.
5. `getTopIndex`/`done` flow still triggers correctly at the end of the stack (reach the end, confirm the "done" screen appears).
Expected: all five behaviors match; no console errors; no card ever appears twice or vanishes.

- [ ] **Step 10: Run the full test suite**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add app/results/page.tsx components/SwipeCard.tsx
git commit -m "feat: live in-session taste re-rank with animated stack reordering"
```

---

## Task 8: Final manual QA pass (mobile viewport, full flow)

**Files:** none (verification only)

- [ ] **Step 1: Run the full flow at a phone-sized viewport**

Run: `npm run dev`, open devtools responsive mode at 390×844 (iPhone 12/13 size — adjust to match whatever device the pitch video will actually be recorded on), and walk the entire path: upload (confirm the Task 5 freshness line renders) → analyzing (confirm text cycles, and if you throttle network, confirm the Task 3 fallback appears) → results (confirm breakdown bars/compact text from Task 4 render without clipping, confirm Task 7's live re-rank and toast work) → save several / reach the end → done screen → library.

- [ ] **Step 2: Confirm no regressions in the existing test suite and type-check**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all three pass clean.

- [ ] **Step 3: Note any visual issues found and fix inline**

If Step 1 surfaces a real clipping/overflow/timing issue, fix it directly in the relevant file from Tasks 3, 4, 5, or 7 (don't create a new task for it — this is the safety-net pass those tasks anticipated). Re-run Step 1 after any fix.

- [ ] **Step 4: Commit any final fixes (only if Step 3 changed something)**

```bash
git add -A
git commit -m "fix: address visual QA findings from pitch-ready polish pass"
```
