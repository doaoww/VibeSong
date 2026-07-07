# Story Songs Manual Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the catalog-search-only song picker in onboarding step 4 (`StorySongsStep`) with two plain Artist/Title text fields plus an explicit Add action, so users can add any song regardless of catalog coverage, and drop the Back button from that step.

**Architecture:** `StorySongsStep.tsx` currently drives a debounced fetch to `/api/song-search` (which queries the internal Supabase song catalog) and renders a suggestions dropdown. That fetch, its state, and the dropdown are removed and replaced with two controlled `<input>`s and a local `addSong()` handler that pushes straight into the existing `picked` array — no network call needed to add a song. The save path (`POST /api/taste/story-songs` → `autoTagSong` → taste/emotional-vector upsert) is untouched; it already accepts arbitrary title/artist pairs. `OnboardingFlow.tsx` stops passing `onBack` into this step. The now-orphaned `/api/song-search` route and its backing `searchCatalogByText` function are deleted in a follow-up cleanup task.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4. No component test framework is installed in this repo (only `node --test` over `tests/*.test.mjs` for pure-logic modules) — verification for the UI task is `tsc --noEmit` + `npm run lint` + manual check against the running dev server, matching how the rest of this codebase verifies UI changes.

## Global Constraints

- Never call OpenAI or YouTube API from client components.
- Never expose API keys to the browser.
- All AI routes must use `export const runtime = "nodejs"`.
- Styling must use only the design-system values: background `#080808`, card `#111111`/border `#222222`, primary `#7C3AED` (`hot-pink` utility class in this codebase), text `#F5F5F5`/muted `#888888`, card radius 16px, button radius 12px (Tailwind `rounded-xl`), pill radius 999px (`rounded-full`). No hardcoded colors outside these values.
- `ru.ts`'s exported `ru` object is typed as `Translation = typeof en` — any key added/removed in `en.ts` must be mirrored exactly in `ru.ts` or the TypeScript build fails.
- 3-song limit on `picked` stays as-is.

---

### Task 1: Manual Artist/Title entry UI, translations, and parent wiring

**Files:**
- Modify: `lib/translations/en.ts:273-292` (the `storySongs` object)
- Modify: `lib/translations/ru.ts:276-295` (the `storySongs` object)
- Modify: `components/onboarding/StorySongsStep.tsx` (full rewrite)
- Modify: `components/OnboardingFlow.tsx:111-122` (the `step === "story-songs"` branch)

**Interfaces:**
- Consumes: `useTranslation()` from `lib/translations/useTranslation.ts` (unchanged hook, new keys read off `t.onboarding.storySongs`); `POST /api/taste/story-songs` (unchanged: `{ songs: { title: string; artist: string }[] }` → `{ resolved: [...] }` on success, unchanged from before this plan).
- Produces: `StorySongsStep` component with **props `{ onNext: () => void; onSkip: () => void }`** (the `onBack` prop is removed — no other file except `OnboardingFlow.tsx` imports `StorySongsStep`, confirmed by `grep -rl "StorySongsStep" components/ app/`).

- [ ] **Step 1: Update `lib/translations/en.ts`**

Open `lib/translations/en.ts` and find the `storySongs` block (lines 273-292):

```ts
    storySongs: {
      saveFailed: "Couldn't save those songs — you can still continue.",
      heading: "Which songs have you recently posted?",
      subtitle: "Add up to 3 songs you've recently used in your Instagram or TikTok stories.",
      searchLabel: "Find songs",
      searchPlaceholder: "Search for a song...",
      searchHint: "Type at least 2 letters, then choose a song from the results.",
      keepTyping: "Keep typing to search.",
      pickedCount: (count: number) => `${count}/3 added`,
      searching: "Searching songs...",
      noMatches: "No matches yet. Try a title or artist.",
      addLabel: "Add",
      removeSong: (title: string, artist: string) => `Remove ${title} by ${artist}`,
      maxReached: "3 songs added. Remove one to change your picks.",
      finding: "Finding these songs…",
      continueLabel: "Continue",
      continueWithSelection: "Continue with selected songs",
      continueWithoutSongs: "Continue without songs",
      optionalNote: "This step is optional. Adding songs makes matching more personal.",
    },
```

Replace it with:

```ts
    storySongs: {
      saveFailed: "Couldn't save those songs — you can still continue.",
      heading: "Which songs have you recently posted?",
      subtitle: "Add up to 3 songs you've recently used in your Instagram or TikTok stories.",
      artistPlaceholder: "Artist",
      titlePlaceholder: "Song title",
      fillBothFields: "Fill in both artist and title.",
      pickedCount: (count: number) => `${count}/3 added`,
      addLabel: "Add",
      removeSong: (title: string, artist: string) => `Remove ${title} by ${artist}`,
      maxReached: "3 songs added. Remove one to change your picks.",
      finding: "Finding these songs…",
      continueLabel: "Continue",
      continueWithSelection: "Continue with selected songs",
      continueWithoutSongs: "Continue without songs",
      optionalNote: "This step is optional. Adding songs makes matching more personal.",
    },
```

- [ ] **Step 2: Update `lib/translations/ru.ts`**

Open `lib/translations/ru.ts` and find the matching `storySongs` block (lines 276-295):

```ts
    storySongs: {
      saveFailed: "Не удалось сохранить эти песни — можно продолжить.",
      heading: "Какие песни ты недавно постил(а)?",
      subtitle: "Добавь до 3 песен, которые недавно использовал(а) в сторис Instagram или TikTok.",
      searchLabel: "Найти песни",
      searchPlaceholder: "Поиск песни...",
      searchHint: "Введи минимум 2 буквы, потом выбери песню из результатов.",
      keepTyping: "Введи ещё пару букв для поиска.",
      pickedCount: (count: number) => `${count}/3 добавлено`,
      searching: "Ищем песни...",
      noMatches: "Пока ничего не нашли. Попробуй название или артиста.",
      addLabel: "Добавить",
      removeSong: (title: string, artist: string) => `Убрать ${title}, ${artist}`,
      maxReached: "3 песни добавлены. Убери одну, чтобы заменить выбор.",
      finding: "Ищем эти песни…",
      continueLabel: "Продолжить",
      continueWithSelection: "Продолжить с выбранными песнями",
      continueWithoutSongs: "Продолжить без песен",
      optionalNote: "Этот шаг необязательный. Песни помогут сделать подбор точнее.",
    },
```

Replace it with:

```ts
    storySongs: {
      saveFailed: "Не удалось сохранить эти песни — можно продолжить.",
      heading: "Какие песни ты недавно постил(а)?",
      subtitle: "Добавь до 3 песен, которые недавно использовал(а) в сторис Instagram или TikTok.",
      artistPlaceholder: "Артист",
      titlePlaceholder: "Название песни",
      fillBothFields: "Заполни и артиста, и название.",
      pickedCount: (count: number) => `${count}/3 добавлено`,
      addLabel: "Добавить",
      removeSong: (title: string, artist: string) => `Убрать ${title}, ${artist}`,
      maxReached: "3 песни добавлены. Убери одну, чтобы заменить выбор.",
      finding: "Ищем эти песни…",
      continueLabel: "Продолжить",
      continueWithSelection: "Продолжить с выбранными песнями",
      continueWithoutSongs: "Продолжить без песен",
      optionalNote: "Этот шаг необязательный. Песни помогут сделать подбор точнее.",
    },
```

- [ ] **Step 3: Rewrite `components/onboarding/StorySongsStep.tsx`**

Replace the entire file with:

```tsx
"use client";
import { useRef, useState } from "react";
import { useTranslation } from "../../lib/translations/useTranslation";

interface PickedSong {
  title: string;
  artist: string;
}

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export default function StorySongsStep({ onNext, onSkip }: Props) {
  const t = useTranslation();
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<PickedSong[]>([]);
  const [showFillHint, setShowFillHint] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const artistInputRef = useRef<HTMLInputElement>(null);

  const addSong = () => {
    const trimmedArtist = artist.trim();
    const trimmedTitle = title.trim();
    if (!trimmedArtist || !trimmedTitle) {
      setShowFillHint(true);
      return;
    }
    if (picked.length >= 3) return;
    if (picked.some((p) => p.title === trimmedTitle && p.artist === trimmedArtist)) return;
    setPicked((prev) => [...prev, { title: trimmedTitle, artist: trimmedArtist }]);
    setArtist("");
    setTitle("");
    setShowFillHint(false);
    artistInputRef.current?.focus();
  };

  const removeSong = (song: PickedSong) =>
    setPicked((prev) => prev.filter((p) => !(p.title === song.title && p.artist === song.artist)));

  const primaryLabel = resolving
    ? t.onboarding.storySongs.finding
    : picked.length > 0
      ? t.onboarding.storySongs.continueWithSelection
      : t.onboarding.storySongs.continueWithoutSongs;

  const handleContinue = async () => {
    if (picked.length === 0) { onSkip(); return; }
    setResolving(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/story-songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: picked }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      onNext();
    } catch {
      setError(t.onboarding.storySongs.saveFailed);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">
          {t.onboarding.storySongs.heading}
        </h2>
        <p className="text-white/40 text-sm">
          {t.onboarding.storySongs.subtitle}
        </p>
      </div>

      <div className="space-y-3">
        {picked.length > 0 && (
          <div className="flex items-center justify-end">
            <span className="text-white/35 text-xs font-semibold">
              {t.onboarding.storySongs.pickedCount(picked.length)}
            </span>
          </div>
        )}

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {picked.map((s) => (
              <button
                key={`${s.title}-${s.artist}`}
                type="button"
                onClick={() => removeSong(s)}
                aria-label={t.onboarding.storySongs.removeSong(s.title, s.artist)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-hot-pink text-white active:scale-95 transition-transform"
              >
                {s.title} — {s.artist}
                <span className="text-white/70" aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        {picked.length < 3 && (
          <div className="space-y-2">
            <input
              ref={artistInputRef}
              type="text"
              value={artist}
              onChange={(e) => { setArtist(e.target.value); setShowFillHint(false); }}
              aria-label={t.onboarding.storySongs.artistPlaceholder}
              placeholder={t.onboarding.storySongs.artistPlaceholder}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
            />
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setShowFillHint(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSong();
                }
              }}
              aria-label={t.onboarding.storySongs.titlePlaceholder}
              placeholder={t.onboarding.storySongs.titlePlaceholder}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
            />
            <button
              type="button"
              onClick={addSong}
              className="w-full py-3.5 rounded-xl border border-hot-pink/30 text-hot-pink font-semibold text-sm active:scale-95 transition-transform"
            >
              {t.onboarding.storySongs.addLabel}
            </button>
            {showFillHint && (
              <p className="text-white/45 text-xs">{t.onboarding.storySongs.fillBothFields}</p>
            )}
          </div>
        )}

        {picked.length >= 3 && (
          <p className="text-white/35 text-xs leading-relaxed">
            {t.onboarding.storySongs.maxReached}
          </p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleContinue}
          disabled={resolving}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-60"
        >
          {primaryLabel}
        </button>
        <p className="text-center text-white/30 text-xs">
          {t.onboarding.storySongs.optionalNote}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `components/OnboardingFlow.tsx`**

Find the `step === "story-songs"` branch (lines 111-122):

```tsx
  if (step === "story-songs") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">{t.onboarding.setupStep(4)}</p>
        <StorySongsStep
          onNext={finishToSwipe}
          onBack={() => setStep("avoid")}
          onSkip={finishToSwipe}
        />
      </div>
    );
  }
```

Replace with:

```tsx
  if (step === "story-songs") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">{t.onboarding.setupStep(4)}</p>
        <StorySongsStep
          onNext={finishToSwipe}
          onSkip={finishToSwipe}
        />
      </div>
    );
  }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. This is the step that verifies `ru.ts` mirrors `en.ts`'s new `storySongs` shape exactly, and that no remaining file still passes `onBack` to `StorySongsStep` or reads a removed translation key (e.g. `searchLabel`, `noMatches`).

- [ ] **Step 6: Run the existing test suite**

Run: `npm test`
Expected: all tests in `tests/*.test.mjs` pass, including `tests/translations.test.mjs` (namespace-parity checks unaffected by this rename since both `en.ts`/`ru.ts` keep identical key sets).

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Manual verification against the dev server**

Run: `npm run dev`, then in a browser:
1. Sign in (or use whatever auth bypass this environment normally uses) and start onboarding from the language step, clicking through Language → Artists → Avoid List to reach "Какие песни ты недавно постил(а)?" (step 4/4).
2. Confirm there is no Back button — only the two inputs, the Add button, and the bottom primary button reading "Продолжить без песен" (or "Skip"-equivalent copy).
3. Click Add with both fields empty — confirm the hint text appears and nothing is added.
4. Type an artist and title for a song that is very unlikely to be in any catalog (e.g. artist "Zzyzx Test Artist", title "Nonexistent Song 1"), click Add — confirm it appears as a removable chip above the inputs and the fields clear.
5. Repeat for a 2nd and 3rd song — confirm after the 3rd add, the input fields and Add button disappear and the "3 песни добавлены…" message shows.
6. Remove one chip via its `×` — confirm the input fields reappear.
7. Click the bottom button — confirm it reads "Продолжить с выбранными песнями" while `picked.length > 0`, and that clicking it POSTs to `/api/taste/story-songs` (check the Network tab for a 200/OK) and advances to the swipe step.
8. Restart onboarding, reach the same step, and click the bottom button immediately with zero songs picked — confirm it reads the skip-labelled copy and advances without a network call to `/api/taste/story-songs`.

Report the outcome of steps 1-8 before proceeding.

- [ ] **Step 9: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts components/onboarding/StorySongsStep.tsx components/OnboardingFlow.tsx
git commit -m "Replace story-songs catalog search with manual artist/title entry"
```

---

### Task 2: Remove the now-unused catalog search endpoint

**Files:**
- Delete: `app/api/song-search/route.ts`
- Modify: `lib/db/songs.ts:283-297` (remove `SongSearchResult` interface and `searchCatalogByText`)

**Interfaces:**
- Consumes: nothing (this task only removes code once Task 1 has landed and no longer calls `/api/song-search` or `searchCatalogByText`).
- Produces: nothing new — pure deletion.

- [ ] **Step 1: Confirm nothing still references the code being removed**

Run: `grep -rn "song-search" app/ components/ lib/` and `grep -rn "searchCatalogByText" app/ components/ lib/ tests/`
Expected: the only remaining match for `song-search` is `app/api/song-search/route.ts` itself, and the only remaining match for `searchCatalogByText` is its definition in `lib/db/songs.ts` (no test file references it — confirmed during planning by reading `tests/songs.test.mjs`, which does not test this function).

- [ ] **Step 2: Delete the route**

```bash
rm app/api/song-search/route.ts
```

- [ ] **Step 3: Remove `searchCatalogByText` from `lib/db/songs.ts`**

Open `lib/db/songs.ts`. The file currently ends (lines 283-297) with:

```ts

export interface SongSearchResult {
  id: string;
  title: string;
  artist: string;
}

export async function searchCatalogByText(query: string, limit = 8): Promise<SongSearchResult[]> {
  const { data, error } = await supabase.rpc("search_catalog", {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw new Error(`searchCatalogByText failed: ${error.message}`);
  return (data ?? []) as SongSearchResult[];
}
```

Delete this entire block (everything from the blank line before `export interface SongSearchResult` through the end of `searchCatalogByText`), leaving `recordFeedback` (lines 273-282) as the last export in the file.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `npm test`
Expected: all tests pass, including `tests/songs.test.mjs` (unaffected — it never exercised `searchCatalogByText`).

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A app/api/song-search lib/db/songs.ts
git commit -m "Remove unused song-search catalog endpoint"
```
