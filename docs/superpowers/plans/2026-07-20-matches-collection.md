# Matches Collection Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/matches` screen that shows each saved/skipped track as a photo+song card (the actual "match"), reachable from Profile's "Мои мэтчи" → "Смотреть все", without changing `/library`.

**Architecture:** Pure frontend addition. No new API routes or DB columns — `Track.sourceImage` is already fetched by the existing `loadFeedback()`/`GET /api/feedback` path. The new page filters the existing `savedSongs` store slice to tracks that have a photo and renders them as a card grid, reusing `/library`'s filter-chip logic (extracted into a shared module) and the existing `ShareSheet` component.

**Tech Stack:** Next.js App Router, React 19, Zustand (`useAppStore`), Tailwind, Framer Motion, existing `ShareSheet`/`AppShell`/`AppHeader` components.

## Global Constraints

- Never call OpenAI or YouTube API from client components (n/a here — no AI/API calls added).
- No hardcoded colors outside the style guide's palette (`#7C3AED`/`#A855F7`/`#EF4444` etc. — this repo's live palette uses `hot-pink`/`lime` Tailwind tokens already used throughout `app/library/page.tsx`; reuse those exact tokens, don't introduce new hex values).
- `/library` must not change in behavior, layout, filters, or route.
- No bottom-nav or sidebar entry for `/matches` — Profile is the only entry point.
- Follow this repo's existing test convention: source-string assertions via `node:test` + `node:fs` (see `tests/playlistImportUi.test.mjs`), not a DOM/component-rendering framework (none is installed).
- `npx tsc --noEmit` and `node --test tests/*.test.mjs` must stay green after every task.

---

### Task 1: Extract shared filter logic out of `/library` into `lib/libraryFilters.ts`

`app/library/page.tsx` currently defines `FILTERS`, `Filter`, `filterSongs()`, and `getFilterLabel()` as private module-level code (lines 12-32). The new `/matches` page needs the identical logic (same four chips, same "This Week" cutoff). Extract it into a shared module first so both pages import one implementation instead of forking it.

**Files:**
- Create: `lib/libraryFilters.ts`
- Create: `tests/libraryFilters.test.mjs`
- Modify: `app/library/page.tsx:1-32`

**Interfaces:**
- Produces: `FILTERS: readonly ["All", "This Week", "Moody", "Hype"]`, `type Filter = (typeof FILTERS)[number]`, `filterSongs(songs: Track[], filter: Filter): Track[]`, `getFilterLabel(filter: Filter, t: typeof en): string` — all exported from `lib/libraryFilters.ts`. Task 3 imports all four.

- [ ] **Step 1: Write the failing test**

Create `tests/libraryFilters.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { filterSongs } from "../lib/libraryFilters.ts";

function track(overrides = {}) {
  return {
    title: "T",
    artist: "A",
    reason: "",
    matchScore: 90,
    thumbnail: "",
    ...overrides,
  };
}

test("filterSongs 'All' returns every song unchanged", () => {
  const songs = [track({ title: "a" }), track({ title: "b" })];
  assert.deepEqual(filterSongs(songs, "All"), songs);
});

test("filterSongs 'This Week' keeps only songs saved in the last 7 days", () => {
  const now = Date.now();
  const recent = track({ title: "recent", savedAt: now - 1000 });
  const old = track({ title: "old", savedAt: now - 8 * 24 * 60 * 60 * 1000 });
  const noDate = track({ title: "no-date" });
  assert.deepEqual(filterSongs([recent, old, noDate], "This Week"), [recent]);
});

test("filterSongs 'Moody'/'Hype' currently pass every song through unchanged", () => {
  const songs = [track({ title: "a" }), track({ title: "b" })];
  assert.deepEqual(filterSongs(songs, "Moody"), songs);
  assert.deepEqual(filterSongs(songs, "Hype"), songs);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/libraryFilters.test.mjs`
Expected: FAIL — `lib/libraryFilters.ts` does not exist yet (module not found).

- [ ] **Step 3: Create `lib/libraryFilters.ts`**

```ts
import type { Track } from "../store/useAppStore";
import type { en } from "./translations/en";

export const FILTERS = ["All", "This Week", "Moody", "Hype"] as const;
export type Filter = (typeof FILTERS)[number];

export function filterSongs(songs: Track[], filter: Filter): Track[] {
  if (filter === "All") return songs;
  if (filter === "This Week") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return songs.filter((s) => (s.savedAt || 0) > weekAgo);
  }
  return songs;
}

export function getFilterLabel(filter: Filter, t: typeof en): string {
  switch (filter) {
    case "All": return t.library.filterAll;
    case "This Week": return t.library.filterThisWeek;
    case "Moody": return t.library.filterMoody;
    case "Hype": return t.library.filterHype;
    default: return filter;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/libraryFilters.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Update `app/library/page.tsx` to import from the new module**

Replace lines 1-32 of `app/library/page.tsx` (the imports block through the end of `getFilterLabel`) with:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import ShareSheet from "../../components/ShareSheet";
import { useAppStore, Track } from "../../store/useAppStore";
import { useTranslation } from "../../lib/translations/useTranslation";
import { resolveSongLink } from "../../lib/songLink";
import { FILTERS, filterSongs, getFilterLabel, type Filter } from "../../lib/libraryFilters";
```

(This removes the now-redundant `import { en } from "../../lib/translations/en";` line along with the local `FILTERS`/`Filter`/`filterSongs`/`getFilterLabel` definitions — `en` was only referenced by the `getFilterLabel` signature that moved into `lib/libraryFilters.ts`.) Everything below line 32 in the original file (the `LibraryPage` component itself) is unchanged.

- [ ] **Step 6: Verify library still builds and behaves identically**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `node --test tests/*.test.mjs`
Expected: all pass (existing count plus the 3 new ones).

- [ ] **Step 7: Commit**

```bash
git add lib/libraryFilters.ts tests/libraryFilters.test.mjs app/library/page.tsx
git commit -m "refactor: extract library filter logic into lib/libraryFilters.ts"
```

---

### Task 2: Add the `matches` translation namespace

**Files:**
- Modify: `lib/translations/en.ts:171-181` (immediately after the `library` block)
- Modify: `lib/translations/ru.ts:175-185` (immediately after the `library` block)

**Interfaces:**
- Produces: `t.matches.heading`, `t.matches.emptyTitle`, `t.matches.emptyBody` (both locales). Task 3 reads all three. `t.library.filterAll/filterThisWeek/filterMoody/filterHype` and `t.share.rowAria` (both already exist) are reused as-is — no new keys needed for those.

- [ ] **Step 1: Add the namespace to `lib/translations/en.ts`**

Insert immediately after the closing `},` of the `library: { ... }` block (after line 181):

```ts
  matches: {
    heading: "Matches",
    emptyTitle: "No matches with a photo yet.",
    emptyBody: "Upload a photo to get started.",
  },
```

- [ ] **Step 2: Add the matching namespace to `lib/translations/ru.ts`**

Insert immediately after the closing `},` of the `library: { ... }` block (after line 185):

```ts
  matches: {
    heading: "Мэтчи",
    emptyTitle: "Пока нет мэтчей с фото.",
    emptyBody: "Загрузи фото, чтобы начать.",
  },
```

- [ ] **Step 3: Verify type parity and existing translation tests**

Run: `npx tsc --noEmit`
Expected: no errors (if `ru.ts`'s `matches` block doesn't match `en.ts`'s shape exactly, `ru: Translation` — where `type Translation = typeof en` — fails to compile).

Run: `node --test tests/translations.test.mjs`
Expected: PASS — `en and ru dictionaries expose identical top-level namespaces` now includes `matches` on both sides.

- [ ] **Step 4: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts
git commit -m "feat: add matches translation namespace (en/ru)"
```

---

### Task 3: Build the `/matches` page and wire Profile's "Смотреть все" link to it

**Files:**
- Create: `app/matches/page.tsx`
- Modify: `app/profile/page.tsx:194-199`
- Test: `tests/matchesPage.test.mjs`

**Interfaces:**
- Consumes: `useAppStore()` → `{ savedSongs: Track[], loadFeedback: () => Promise<void> }` (`store/useAppStore.ts`); `FILTERS`, `Filter`, `filterSongs`, `getFilterLabel` from `lib/libraryFilters.ts` (Task 1); `resolveSongLink(song): string | null` from `lib/songLink.ts`; `t.matches.heading/emptyTitle/emptyBody` (Task 2), `t.library.filterAll/filterThisWeek/filterMoody/filterHype`, `t.share.rowAria(title, artist)`, `t.common.uploadPhotoArrow` (all pre-existing); `<ShareSheet isOpen onClose track photoUrl>` (`components/ShareSheet.tsx`); `<AppShell bottomPad decor header>`, `<AppHeader showCredits center left>` (`components/AppShell.tsx`, `components/AppHeader.tsx`).

- [ ] **Step 1: Write the failing test**

Create `tests/matchesPage.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("matches page filters saved songs to only those with a source photo", async () => {
  const source = await readFile(new URL("../app/matches/page.tsx", import.meta.url), "utf8");
  assert.match(source, /savedSongs\.filter\(\(s\) => Boolean\(s\.sourceImage\)\)/);
  assert.match(source, /t\.matches\.heading/);
  assert.match(source, /ShareSheet/);
});

test("profile 'view all' under My Matches links to /matches, not /library", async () => {
  const source = await readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
  assert.match(source, /myMatchesHeading[\s\S]{0,400}href="\/matches"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/matchesPage.test.mjs`
Expected: FAIL — `app/matches/page.tsx` doesn't exist, and `app/profile/page.tsx` still has `href="/library"` under "Мои мэтчи".

- [ ] **Step 3: Create `app/matches/page.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import ShareSheet from "../../components/ShareSheet";
import { useAppStore, Track } from "../../store/useAppStore";
import { useTranslation } from "../../lib/translations/useTranslation";
import { resolveSongLink } from "../../lib/songLink";
import { FILTERS, filterSongs, getFilterLabel, type Filter } from "../../lib/libraryFilters";

export default function MatchesPage() {
  const { savedSongs, loadFeedback } = useAppStore();
  const t = useTranslation();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [shareTrack, setShareTrack] = useState<Track | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  // Pause playback when leaving the page instead of letting it run under
  // whatever's rendered next.
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const withPhoto = savedSongs.filter((s) => Boolean(s.sourceImage));
  const displayed = filterSongs(withPhoto, activeFilter);

  const handleCardActivate = (song: Track, key: string) => {
    if (song.previewUrl) {
      const audio = audioRef.current;
      if (!audio) return;
      if (playingKey === key) {
        audio.pause();
        setPlayingKey(null);
        return;
      }
      audio.src = song.previewUrl;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      setPlayingKey(key);
      return;
    }
    const link = resolveSongLink(song);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <>
    <AppShell
      bottomPad="large"
      decor
      header={
        <AppHeader
          showCredits={false}
          center={t.matches.heading}
          left={
            <button
              onClick={() => history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors lg:hidden"
            >
              <span className="material-symbols-outlined text-on-surface-variant">
                arrow_back
              </span>
            </button>
          }
        />
      }
    >
      <div className="space-y-6">
        <div className="flex gap-2 overflow-x-auto scroll-hide">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-semibold font-display whitespace-nowrap transition-all ${
                activeFilter === f
                  ? "bg-hot-pink text-white glow-pink"
                  : "border border-outline-variant/30 text-on-surface-variant hover:text-white hover:border-white/30"
              }`}
            >
              {getFilterLabel(f, t)}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              music_off
            </span>
            <p className="text-on-surface-variant">{t.matches.emptyTitle}</p>
            <p className="text-on-surface-variant/60 text-sm">
              {t.matches.emptyBody}
            </p>
            <a
              href="/app"
              className="mt-2 inline-flex items-center gap-2 bg-hot-pink text-white px-6 py-3 rounded-full text-sm font-display font-semibold glow-pink"
            >
              {t.common.uploadPhotoArrow}
            </a>
          </div>
        ) : (
          <>
          <audio
            ref={audioRef}
            onEnded={() => setPlayingKey(null)}
            className="hidden"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {displayed.map((song, i) => {
              const key = `${song.previewUrl || song.youtubeId || song.title}-${i}`;
              const isPlaying = playingKey === key;
              return (
                <motion.div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardActivate(song, key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardActivate(song, key);
                    }
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/20 hover:border-hot-pink/40 cursor-pointer"
                >
                  <img
                    src={song.sourceImage}
                    alt={song.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareTrack(song);
                      setShareSheetOpen(true);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={t.share.rowAria(song.title, song.artist)}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">share</span>
                  </button>

                  {isPlaying && (
                    <span
                      className="absolute top-2 left-2 material-symbols-outlined text-white text-2xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      pause_circle
                    </span>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-2.5 space-y-0.5">
                    <p className="text-white font-display font-bold text-xs truncate">
                      {song.title}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white/70 text-[11px] truncate">
                        {song.artist}
                      </p>
                      {song.matchScore > 0 && (
                        <span className="text-hot-pink text-[11px] font-display font-bold flex-shrink-0">
                          {song.matchScore}%
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          </>
        )}
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

- [ ] **Step 4: Update `app/profile/page.tsx` to link to `/matches`**

In `app/profile/page.tsx`, inside the "Мои мэтчи" section (around line 194-199), change:

```tsx
                    <a
                      href="/library"
                      className="text-hot-pink text-xs font-semibold hover:underline"
                    >
                      {t.profile.viewAll}
                    </a>
```

to:

```tsx
                    <a
                      href="/matches"
                      className="text-hot-pink text-xs font-semibold hover:underline"
                    >
                      {t.profile.viewAll}
                    </a>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/matchesPage.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Full verification**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `node --test tests/*.test.mjs`
Expected: all pass.

- [ ] **Step 7: Manual browser check**

Start the dev server, sign in, upload a photo, save one track and skip another. Navigate to Profile → "Мои мэтчи" → "Смотреть все" and confirm:
- URL is `/matches`, not `/library`.
- Both the saved and skipped tracks with photos appear as square cards showing the actual uploaded photo, title, artist, and match score.
- Tapping a card toggles inline audio preview (if `previewUrl` exists).
- Tapping the share icon opens `ShareSheet` for that track without toggling playback.
- `/library` (via the back arrow or bottom nav) is unchanged — still the plain row list.

- [ ] **Step 8: Commit**

```bash
git add app/matches/page.tsx app/profile/page.tsx tests/matchesPage.test.mjs
git commit -m "feat: add /matches photo+song grid, link Profile's My Matches to it"
```
