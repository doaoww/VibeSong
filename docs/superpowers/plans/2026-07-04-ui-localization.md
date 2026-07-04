# EN/RU UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors toggle the VibeSong UI between English and Russian, with the choice detected from the browser on first visit and remembered in `localStorage`.

**Architecture:** A `locale: "en" | "ru"` field lives in the existing Zustand store. A typed dictionary pair (`lib/translations/en.ts`, `lib/translations/ru.ts`) holds every static UI string, grouped by page/section namespace; `ru.ts` is typed against `typeof en` so TypeScript rejects the file if a key is missing or mistyped. A `useTranslation()` hook returns the whole per-locale object so components read `t.namespace.key` with full autocomplete. A tiny `"use client"` component (`LocaleInit`) mounted inside the still-server-rendered root layout handles first-visit browser-language detection and `localStorage` persistence. A header toggle (`LanguageToggle`) lets the user override it anytime.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand, TypeScript, Tailwind v4. No new dependencies. Tests use Node's native `--test` runner with direct `.ts` imports (Node 24 strips TS types natively — confirmed working via the existing `tests/tagTaxonomy.test.mjs` pattern).

## Global Constraints

- Store field name is `locale` (not `uiLanguage`), typed `"en" | "ru"`.
- `localStorage` key is `"vibesong_locale"`.
- Persistence is `localStorage` only — no Supabase/account sync.
- Detection order: stored preference → `navigator.language` starts with `"ru"` → static `"en"` default. No URL-based locale routing.
- `app/layout.tsx` must stay a server component (no `"use client"` on the file itself) — the client-only detection logic lives entirely inside `components/LocaleInit.tsx`.
- Translation files: `lib/translations/en.ts`, `lib/translations/ru.ts`, `lib/translations/index.ts` (three files, not one). `ru.ts` must be written as `const ru: Translation = {...}` where `type Translation = typeof en`.
- `useTranslation()` returns the full per-locale object (`t.nav.home`), not a `t("nav.home")` string-lookup function.
- Out of scope, do not touch: AI-generated content from `/api/analyze` (`vibeCaption`, `vibeTags`, song match `reason` strings), proper nouns (artist names, song titles), the `VibeSong` / `AI` brand wordmark, and any `EN`/`RU` label text on the toggle itself (those are language codes, not translated content).
- Any UI string with interpolated dynamic values (counts, prices, names) is stored as a function `(args) => string` in both `en.ts` and `ru.ts`, not split into prefix/suffix keys.
- Russian phrasing that would otherwise need a gendered verb/adjective ending uses the standard Russian UX convention of a parenthetical alternate ending, e.g. `выбрал(а)`.

---

## Task 1: Add `locale` to the Zustand store

**Files:**
- Modify: `store/useAppStore.ts`

**Interfaces:**
- Produces: `locale: "en" | "ru"` (state field), `setLocale(locale: "en" | "ru"): void` (action) — every later task's `LocaleInit`, `LanguageToggle`, and `useTranslation()` read/write these.

- [ ] **Step 1: Add the field and setter to the store interface and implementation**

In `store/useAppStore.ts`, add to the `AppState` interface (near `contrastMode: boolean;`):

```ts
  contrastMode: boolean;
  locale: "en" | "ru";
```

and near `setContrastMode: (v: boolean) => void;`:

```ts
  setContrastMode: (v: boolean) => void;
  setLocale: (locale: "en" | "ru") => void;
```

In the `create<AppState>((set, get) => ({...}))` body, add near `contrastMode: false,`:

```ts
  contrastMode: false,
  locale: "en",
```

and near the `setContrastMode` implementation:

```ts
  setContrastMode: (v) => set({ contrastMode: v }),
  setLocale: (locale) => {
    if (typeof window !== "undefined") localStorage.setItem("vibesong_locale", locale);
    set({ locale });
  },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add store/useAppStore.ts
git commit -m "feat: add locale field to app store"
```

---

## Task 2: Translation infrastructure, shared chrome (`common`, `nav`), and the toggle

**Files:**
- Create: `lib/translations/en.ts`
- Create: `lib/translations/ru.ts`
- Create: `lib/translations/index.ts`
- Create: `lib/translations/useTranslation.ts`
- Create: `tests/translations.test.mjs`
- Create: `components/LocaleInit.tsx`
- Create: `components/LanguageToggle.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/AppHeader.tsx`
- Modify: `components/NavBar.tsx`
- Modify: `components/AppSidebar.tsx`

**Interfaces:**
- Consumes: `useAppStore` state `locale`/`setLocale` from Task 1.
- Produces: `translations: Record<"en"|"ru", typeof en>` and `deepMerge()` from `lib/translations/index.ts`; `useTranslation()` hook from `lib/translations/useTranslation.ts` — every subsequent migration task imports `useTranslation` and reads `t.<namespace>`. Establishes the `common` and `nav` namespaces other tasks will reference (`t.common.skip`, `t.common.back`, etc.).

- [ ] **Step 1: Write `lib/translations/en.ts` with the `common` and `nav` namespaces**

```ts
export const en = {
  common: {
    skip: "Skip",
    back: "Back",
    next: "Next",
    tryAgain: "Try again",
    uploadPhotoArrow: "Upload a photo →",
  },
  nav: {
    home: "Home",
    upload: "Upload",
    explore: "Explore",
    library: "Library",
    profile: "Profile",
  },
};
```

- [ ] **Step 2: Write `lib/translations/ru.ts`, typed against `en`**

```ts
import { en } from "./en";

type Translation = typeof en;

export const ru: Translation = {
  common: {
    skip: "Пропустить",
    back: "Назад",
    next: "Далее",
    tryAgain: "Повторить",
    uploadPhotoArrow: "Загрузить фото →",
  },
  nav: {
    home: "Главная",
    upload: "Загрузить",
    explore: "Обзор",
    library: "Библиотека",
    profile: "Профиль",
  },
};
```

- [ ] **Step 3: Write `lib/translations/index.ts` with `deepMerge` and the `translations` map**

```ts
import { en } from "./en";
import { ru as ruOverrides } from "./ru";

export type Locale = "en" | "ru";

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively overlays `override` onto `base`, key by key. `ru.ts` is already
 * type-checked to fully match `en`'s shape at compile time (see ru.ts) — this
 * merge is a runtime safety net in case that guarantee is ever weakened later
 * (e.g. a key built dynamically in a way TS can't fully verify), so a missing
 * Russian key falls back to English at runtime instead of rendering `undefined`.
 */
export function deepMerge<T extends PlainObject>(base: T, override: PlainObject): T {
  const result: PlainObject = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    const baseValue = base[key];
    if (isPlainObject(overrideValue) && isPlainObject(baseValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue;
    }
  }
  return result as T;
}

export const translations: Record<Locale, typeof en> = {
  en,
  ru: deepMerge(en, ruOverrides),
};
```

- [ ] **Step 4: Write the failing test for `deepMerge` and dictionary parity**

Create `tests/translations.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const { deepMerge, translations } = await import("../lib/translations/index.ts");

test("deepMerge overlays nested keys without dropping siblings", () => {
  const base = { a: { x: 1, y: 2 }, b: 3 };
  const override = { a: { y: 20 } };
  assert.deepEqual(deepMerge(base, override), { a: { x: 1, y: 20 }, b: 3 });
});

test("deepMerge ignores undefined override values", () => {
  const base = { a: 1, b: 2 };
  const override = { a: undefined };
  assert.deepEqual(deepMerge(base, override), { a: 1, b: 2 });
});

test("deepMerge replaces functions wholesale instead of descending into them", () => {
  const base = { greet: (n) => `hi ${n}` };
  const override = { greet: (n) => `hey ${n}` };
  const merged = deepMerge(base, override);
  assert.equal(merged.greet(1), "hey 1");
});

test("en and ru dictionaries expose identical top-level namespaces", () => {
  assert.deepEqual(Object.keys(translations.en).sort(), Object.keys(translations.ru).sort());
});

test("en and ru common namespace has identical keys", () => {
  assert.deepEqual(
    Object.keys(translations.en.common).sort(),
    Object.keys(translations.ru.common).sort()
  );
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/translations.test.mjs`
Expected: `5` tests pass, `0` fail. (These pass immediately since Steps 1-3 already wrote the implementation — this repo's existing `tests/*.test.mjs` convention is regression tests written alongside the code, not strict red-green TDD; see `tests/tagTaxonomy.test.mjs` for the same style.)

- [ ] **Step 6: Write `lib/translations/useTranslation.ts`**

```ts
"use client";
import { useAppStore } from "../../store/useAppStore";
import { translations } from "./index";

export function useTranslation() {
  const locale = useAppStore((s) => s.locale);
  return translations[locale];
}
```

- [ ] **Step 7: Write `components/LocaleInit.tsx`**

```tsx
"use client";
import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export default function LocaleInit() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  // One-time detection: stored preference wins, then browser language, else
  // the static "en" default already rendered on the server.
  useEffect(() => {
    const stored = localStorage.getItem("vibesong_locale");
    if (stored === "en" || stored === "ru") {
      setLocale(stored);
    } else if (navigator.language.toLowerCase().startsWith("ru")) {
      setLocale("ru");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep <html lang> in sync with manual toggles too.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
```

- [ ] **Step 8: Mount `LocaleInit` in the root layout without converting it to a client component**

In `app/layout.tsx`, add the import:

```ts
import LocaleInit from "../components/LocaleInit";
```

and mount it as the first child inside `<body>`, alongside the existing `{children}`:

```tsx
      <body
        className={`${spaceGrotesk.variable} ${dmSans.variable} font-sans min-h-full bg-background text-on-surface antialiased`}
      >
        <LocaleInit />
        {children}
        <Analytics />
      </body>
```

`RootLayout` itself has no `"use client"` directive — it stays a server
component; only `LocaleInit.tsx` is client-side.

- [ ] **Step 9: Write `components/LanguageToggle.tsx`**

```tsx
"use client";
import { useAppStore } from "../store/useAppStore";

export default function LanguageToggle() {
  const { locale, setLocale } = useAppStore();

  return (
    <div className="flex items-center rounded-full bg-white/5 border border-white/10 p-0.5 text-xs font-semibold font-display">
      <button
        onClick={() => setLocale("en")}
        className={`px-2.5 py-1 rounded-full transition-all ${
          locale === "en" ? "bg-hot-pink text-white" : "text-white/50 hover:text-white/80"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("ru")}
        className={`px-2.5 py-1 rounded-full transition-all ${
          locale === "ru" ? "bg-hot-pink text-white" : "text-white/50 hover:text-white/80"
        }`}
      >
        RU
      </button>
    </div>
  );
}
```

- [ ] **Step 10: Mount the toggle in `AppHeader.tsx` and translate its "Upload" fallback title**

In `components/AppHeader.tsx`, add imports:

```ts
import LanguageToggle from "./LanguageToggle";
import { useTranslation } from "../lib/translations/useTranslation";
```

Inside the component body, before the `return`:

```ts
  const t = useTranslation();
```

Replace the hardcoded default center title (currently `"Upload"` at line 42):

```tsx
        {center ? (
          <span className="font-display font-bold text-sm text-white lg:text-lg lg:flex-1 lg:ml-0">
            {center}
          </span>
        ) : (
          <span className="hidden lg:block font-display font-bold text-lg text-white flex-1">
            {t.nav.upload}
          </span>
        )}
```

Add the toggle just before the closing `right` block, so it always renders
regardless of whether a page customized `right`:

```tsx
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {right ?? (
            showCredits ? (
              <CreditBadge credits={credits} onClick={onCreditsClick} />
            ) : (
              <div className="w-16" />
            )
          )}
        </div>
```

(This replaces the previous bare `{right ?? (...)}` expression — wrap it in
the `<div className="flex items-center gap-2">` shown above.)

- [ ] **Step 11: Migrate `components/NavBar.tsx`**

Add the import and hook call (same pattern as Step 10), then replace each
hardcoded label with its `t.nav.*` equivalent:

| Original (line) | Replace with |
|---|---|
| `L6: "Home"` | `{t.nav.home}` |
| `L7: "Explore"` | `{t.nav.explore}` |
| `L8: "Library"` | `{t.nav.library}` |
| `L9: "Profile"` | `{t.nav.profile}` |

- [ ] **Step 12: Migrate `components/AppSidebar.tsx`**

Add the import and hook call, then replace:

| Original (line) | Replace with |
|---|---|
| `L7: "Upload"` | `{t.nav.upload}` |
| `L8: "Explore"` | `{t.nav.explore}` |
| `L9: "Library"` | `{t.nav.library}` |
| `L10: "Profile"` | `{t.nav.profile}` |
| `L62: "Upload a photo →"` | `{t.common.uploadPhotoArrow}` |

Leave the `"VibeSong"` / `"AI"` wordmark at L24 untouched (brand name, out of scope).

- [ ] **Step 13: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint components/LocaleInit.tsx components/LanguageToggle.tsx components/AppHeader.tsx components/NavBar.tsx components/AppSidebar.tsx lib/translations/*.ts app/layout.tsx`
Expected: 0 errors (pre-existing warnings in files this task doesn't touch are out of scope).

- [ ] **Step 14: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/app` in a browser.
Expected: an "EN | RU" pill appears in the header. Clicking "RU" immediately
switches the nav labels (Home/Explore/Library/Profile in the mobile bottom
bar, or the sidebar on desktop widths) to Russian, and the header's default
"Upload" title (visible on desktop) becomes "Загрузить". Reloading the page
keeps the Russian selection (stored in `localStorage["vibesong_locale"]`).

- [ ] **Step 15: Commit**

```bash
git add store/useAppStore.ts lib/translations tests/translations.test.mjs components/LocaleInit.tsx components/LanguageToggle.tsx components/AppHeader.tsx components/NavBar.tsx components/AppSidebar.tsx app/layout.tsx
git commit -m "feat: add EN/RU translation infrastructure and header toggle"
```

---

## Task 3: Migrate the landing page (`landing` namespace)

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`
- Modify: `components/LandingPage.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 2.
- Produces: `t.landing.*` — used only by `LandingPage.tsx`.

- [ ] **Step 1: Add the `landing` namespace to `lib/translations/en.ts`**

Add this key alongside `common`/`nav` in the exported object:

```ts
  landing: {
    navHowItWorks: "How it Works",
    navFeatures: "Features",
    navPricing: "Pricing",
    navTryFree: "Try Free →",
    heroBadge: "✦ AI Music Matching",
    heroHeadingLine1: "Your photo.",
    heroHeadingLine2: "Your soundtrack.",
    heroSubtitle: "Drop any photo. Our AI reads the vibe, the color, the mood, the energy, and finds songs that just fit.",
    heroCtaPrimary: "Upload a Photo →",
    heroCtaSecondary: "See How It Works",
    heroMicrocopy: "3 free matches · No signup needed · Any photo works",
    marqueeWords: ["MOOD", "ENERGY", "VIBE", "AESTHETIC", "SOUNDTRACK", "FEELING", "COLOR", "MOMENT"],
    yourGenres: "Your genres",
    genreIndie: "Indie",
    genreHipHop: "Hip-Hop",
    genreRnb: "R&B",
    genrePop: "Pop",
    genreLofi: "Lo-fi",
    yourArtists: "Your artists",
    addMore: "+ add",
    yourMood: "Your mood",
    moodChill: "Chill",
    moodHype: "Hype",
    moodSad: "Sad",
    moodRomantic: "Romantic",
    quizHeadingPre: "First, we learn",
    quizHeadingWhat: "what you ",
    quizHeadingLove: "love.",
    takeQuiz: "Take the quiz →",
    step1Title: "DROP ANYTHING",
    step1Body: "Any photo from your camera roll. Beach, city, bedroom, anything.",
    step2Title: "AI READS THE ROOM",
    step2Body: "GPT-4o analyzes mood, colors, energy, and emotion from your photo.",
    step3Title: "SWIPE YOUR SOUND",
    step3Body: "Five perfect songs. Tinder-style swiping. Save the ones that hit different.",
    howItWorksLabel: "How it works",
    howItWorksHeading: "Three steps to your perfect sound",
    tagDreamy: "Dreamy",
    tagSynthwave: "Synthwave",
    tagCity: "City",
    tagWarm: "Warm",
    tagMoody: "Moody",
    realMatches: "Real matches",
    whatPhotosSound: "What photos sound like",
    matchAlt: (song: string, artist: string) => `${song} by ${artist}`,
    statTracksSuffix: "M+",
    statTracksLabel: "Tracks searched per match",
    statTimePrefix: "< ",
    statTimeSuffix: "s",
    statTimeLabel: "Time to find your song",
    statAccuracyLabel: "Average match accuracy",
    starterLabel: "STARTER",
    starterCredits: "10 credits",
    starterPrice: "$0.20 / match",
    popularLabel: "POPULAR",
    popularCredits: "50 credits",
    popularPrice: "$0.14 / match",
    proLabel: "PRO",
    proCredits: "200 credits",
    proPrice: "$0.10 / match",
    simplePricingHeading: "Simple pricing.",
    simplePricingBody: "Start free, pay when you love it.",
    mostPopularBadge: "★ Most Popular",
    getStarted: "Get started",
    readyHeading: "READY?",
    findSoundtrack: "Find your soundtrack.",
    finalCtaBody: "Upload your first photo free. No signup needed.",
    threeFreeIncluded: "3 free matches included",
    openApp: "Open App",
    footerTagline: "Your photo. Your soundtrack.",
  },
```

- [ ] **Step 2: Add the matching `landing` block to `lib/translations/ru.ts`**

```ts
  landing: {
    navHowItWorks: "Как это работает",
    navFeatures: "Возможности",
    navPricing: "Цены",
    navTryFree: "Попробовать бесплатно →",
    heroBadge: "✦ Подбор музыки от ИИ",
    heroHeadingLine1: "Твоё фото.",
    heroHeadingLine2: "Твой саундтрек.",
    heroSubtitle: "Загрузи любое фото. ИИ считывает вайб, цвет, настроение, энергию — и находит песни, которые идеально подходят.",
    heroCtaPrimary: "Загрузить фото →",
    heroCtaSecondary: "Как это работает",
    heroMicrocopy: "3 бесплатных мэтча · Без регистрации · Любое фото подойдёт",
    marqueeWords: ["НАСТРОЕНИЕ", "ЭНЕРГИЯ", "ВАЙБ", "ЭСТЕТИКА", "САУНДТРЕК", "ЧУВСТВО", "ЦВЕТ", "МОМЕНТ"],
    yourGenres: "Твои жанры",
    genreIndie: "Инди",
    genreHipHop: "Хип-хоп",
    genreRnb: "R&B",
    genrePop: "Поп",
    genreLofi: "Lo-fi",
    yourArtists: "Твои артисты",
    addMore: "+ добавить",
    yourMood: "Твоё настроение",
    moodChill: "Чилл",
    moodHype: "Хайп",
    moodSad: "Грустное",
    moodRomantic: "Романтика",
    quizHeadingPre: "Сначала мы узнаём,",
    quizHeadingWhat: "что ты ",
    quizHeadingLove: "любишь.",
    takeQuiz: "Пройти опрос →",
    step1Title: "ЗАГРУЖАЙ ЛЮБОЕ ФОТО",
    step1Body: "Любое фото из галереи. Пляж, город, комната — что угодно.",
    step2Title: "ИИ СЧИТЫВАЕТ АТМОСФЕРУ",
    step2Body: "GPT-4o анализирует настроение, цвета, энергию и эмоции твоего фото.",
    step3Title: "СВАЙПАЙ СВОЙ ЗВУК",
    step3Body: "Пять идеальных песен. Свайпы как в Tinder. Сохраняй те, что зацепили.",
    howItWorksLabel: "Как это работает",
    howItWorksHeading: "Три шага к твоему идеальному звуку",
    tagDreamy: "Мечтательно",
    tagSynthwave: "Синтвейв",
    tagCity: "Город",
    tagWarm: "Тепло",
    tagMoody: "Мрачно",
    realMatches: "Реальные мэтчи",
    whatPhotosSound: "Как звучат фото",
    matchAlt: (song: string, artist: string) => `${song} by ${artist}`,
    statTracksSuffix: "M+",
    statTracksLabel: "Треков анализируется на мэтч",
    statTimePrefix: "< ",
    statTimeSuffix: "с",
    statTimeLabel: "Время на подбор песни",
    statAccuracyLabel: "Средняя точность мэтча",
    starterLabel: "СТАРТ",
    starterCredits: "10 кредитов",
    starterPrice: "$0.20 / мэтч",
    popularLabel: "ПОПУЛЯРНО",
    popularCredits: "50 кредитов",
    popularPrice: "$0.14 / мэтч",
    proLabel: "PRO",
    proCredits: "200 кредитов",
    proPrice: "$0.10 / мэтч",
    simplePricingHeading: "Простые цены.",
    simplePricingBody: "Начни бесплатно, плати, когда полюбишь.",
    mostPopularBadge: "★ Самый популярный",
    getStarted: "Начать",
    readyHeading: "ГОТОВ?",
    findSoundtrack: "Найди свой саундтрек.",
    finalCtaBody: "Загрузи первое фото бесплатно. Регистрация не нужна.",
    threeFreeIncluded: "3 бесплатных мэтча включены",
    openApp: "Открыть приложение",
    footerTagline: "Твоё фото. Твой саундтрек.",
  },
```

Note: `matchAlt` is left identical in both locales — it renders an `alt` attribute
built from a dynamic song/artist pair (proper nouns), not translatable copy.

- [ ] **Step 3: Migrate `components/LandingPage.tsx`**

Add near the top of the component:

```ts
import { useTranslation } from "../lib/translations/useTranslation";
```

and inside the component body:

```ts
  const t = useTranslation();
```

Replace each string per this table (leave all artist names, song titles, and
the `VibeSong`/`AI` wordmark at L101 untouched):

| Line | Original | Replace with |
|---|---|---|
| 105 | `"How it Works"` | `{t.landing.navHowItWorks}` |
| 109 | `"Features"` | `{t.landing.navFeatures}` |
| 113 | `"Pricing"` | `{t.landing.navPricing}` |
| 117 | `"Try Free →"` | `{t.landing.navTryFree}` |
| 143 | `"✦ AI Music Matching"` | `{t.landing.heroBadge}` |
| 147 | `"Your photo."` | `{t.landing.heroHeadingLine1}` |
| 148 | `"Your soundtrack."` | `{t.landing.heroHeadingLine2}` |
| 157 | `"Drop any photo. Our AI reads..."` | `{t.landing.heroSubtitle}` |
| 168 | `"Upload a Photo →"` | `{t.landing.heroCtaPrimary}` |
| 171 | `"See How It Works"` | `{t.landing.heroCtaSecondary}` |
| 181 | `"3 free matches · No signup needed · Any photo works"` | `{t.landing.heroMicrocopy}` |
| 190 | `["MOOD","ENERGY","VIBE","AESTHETIC","SOUNDTRACK","FEELING","COLOR","MOMENT"]` array | `t.landing.marqueeWords` |
| 210 | `"Your genres"` | `{t.landing.yourGenres}` |
| 210 | `"Indie"` / `"Hip-Hop"` / `"R&B"` / `"Pop"` / `"Lo-fi"` chips | `{t.landing.genreIndie}` / `{t.landing.genreHipHop}` / `{t.landing.genreRnb}` / `{t.landing.genrePop}` / `{t.landing.genreLofi}` |
| 211 | `"Your artists"` | `{t.landing.yourArtists}` |
| 211 | `"+ add"` | `{t.landing.addMore}` |
| 211 | `"Frank Ocean"` / `"SZA"` | *(leave — proper nouns)* |
| 212 | `"Your mood"` | `{t.landing.yourMood}` |
| 212 | `"Chill"` / `"Hype"` / `"Sad"` / `"Romantic"` chips | `{t.landing.moodChill}` / `{t.landing.moodHype}` / `{t.landing.moodSad}` / `{t.landing.moodRomantic}` |
| 219 | `"First, we learn"` | `{t.landing.quizHeadingPre}` |
| 221 | `"what you "` | `{t.landing.quizHeadingWhat}` |
| 221 | `"love."` | `{t.landing.quizHeadingLove}` |
| 258 | `"Take the quiz →"` | `{t.landing.takeQuiz}` |
| 270 | `"DROP ANYTHING"` | `{t.landing.step1Title}` |
| 271 | `"Any photo from your camera roll..."` | `{t.landing.step1Body}` |
| 274 | `"AI READS THE ROOM"` | `{t.landing.step2Title}` |
| 276 | `"GPT-4o analyzes mood..."` | `{t.landing.step2Body}` |
| 279 | `"SWIPE YOUR SOUND"` | `{t.landing.step3Title}` |
| 281 | `"Five perfect songs..."` | `{t.landing.step3Body}` |
| 293 | `"How it works"` | `{t.landing.howItWorksLabel}` |
| 296 | `"Three steps to your perfect sound"` | `{t.landing.howItWorksHeading}` |
| 325-328 | song/artist names, `"Dreamy"`, `"Synthwave"`/`"City"`, `"Warm"`, `"Moody"` | keep song/artist names; replace `"Dreamy"`→`{t.landing.tagDreamy}`, `"Synthwave"`→`{t.landing.tagSynthwave}`, `"City"`→`{t.landing.tagCity}`, `"Warm"`→`{t.landing.tagWarm}`, `"Moody"`→`{t.landing.tagMoody}` |
| 334 | `"Real matches"` | `{t.landing.realMatches}` |
| 338 | `"What photos sound like"` | `{t.landing.whatPhotosSound}` |
| 355 | `` `${c.song} by ${c.artist}` `` alt | `{t.landing.matchAlt(c.song, c.artist)}` |
| 396 | `"M+"` | `{t.landing.statTracksSuffix}` |
| 398 | `"Tracks searched per match"` | `{t.landing.statTracksLabel}` |
| 409 | `"< "` | `{t.landing.statTimePrefix}` |
| 410 | `"s"` | `{t.landing.statTimeSuffix}` |
| 412 | `"Time to find your song"` | `{t.landing.statTimeLabel}` |
| 425 | `"Average match accuracy"` | `{t.landing.statAccuracyLabel}` |
| 437 | `"STARTER"` / `"10 credits"` / `"$0.20 / match"` | `{t.landing.starterLabel}` / `{t.landing.starterCredits}` / `{t.landing.starterPrice}` |
| 438 | `"POPULAR"` / `"50 credits"` / `"$0.14 / match"` | `{t.landing.popularLabel}` / `{t.landing.popularCredits}` / `{t.landing.popularPrice}` |
| 439 | `"PRO"` / `"200 credits"` / `"$0.10 / match"` | `{t.landing.proLabel}` / `{t.landing.proCredits}` / `{t.landing.proPrice}` |
| 446 | `"Simple pricing."` | `{t.landing.simplePricingHeading}` |
| 449 | `"Start free, pay when you love it."` | `{t.landing.simplePricingBody}` |
| 467 | `"★ Most Popular"` | `{t.landing.mostPopularBadge}` |
| 482 | `"Get started"` | `{t.landing.getStarted}` |
| 509 | `"READY?"` | `{t.landing.readyHeading}` |
| 512 | `"Find your soundtrack."` | `{t.landing.findSoundtrack}` |
| 514 | `"Upload your first photo free. No signup needed."` | `{t.landing.finalCtaBody}` |
| 521 | `"3 free matches included"` | `{t.landing.threeFreeIncluded}` |
| 538 | `"Open App"` | `{t.landing.openApp}` |
| 549 | `"© 2026 VibeSong AI"` | *(leave — brand name)* |
| 550 | `"Your photo. Your soundtrack."` | `{t.landing.footerTagline}` |

Also add a `<LanguageToggle />` next to the existing nav links (around L105-117,
inside the desktop nav bar) so logged-out visitors can switch language too —
import it the same way as in `AppHeader.tsx` (Task 2, Step 9).

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint components/LandingPage.tsx lib/translations/en.ts lib/translations/ru.ts`
Expected: 0 new errors.

- [ ] **Step 5: Run the translation test suite**

Run: `node --test tests/translations.test.mjs`
Expected: all pass (the `en`/`ru` top-level-key parity test now also covers `landing`).

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/`.
Expected: toggling RU translates the hero, nav, how-it-works, pricing teaser,
and footer sections; artist/song names and the VibeSong wordmark stay
unchanged; no layout overflow on the pricing cards or nav with the longer
Russian strings.

- [ ] **Step 7: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts components/LandingPage.tsx
git commit -m "feat: localize landing page (EN/RU)"
```

---

## Task 4: Migrate the upload/home page (`home` namespace)

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`
- Modify: `app/app/page.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 2.
- Produces: `t.home.*` — used only by `app/app/page.tsx`.

- [ ] **Step 1: Add the `home` namespace to `lib/translations/en.ts`**

```ts
  home: {
    analyzingTexts: [
      "Reading the vibe...",
      "Analyzing mood & energy...",
      "Searching millions of tracks...",
      "Curating your soundtrack...",
    ],
    marqueeWords: ["MOOD", "ENERGY", "VIBE", "SOUND", "FEELING", "COLOR"],
    errorRefund: "Analysis temporarily failed — no credit was used. Try again?",
    uploadedAlt: "Your upload",
    analyzingSubtext: "This takes about 5 seconds",
    creditsAddedToast: "✓ Credits added — enjoy your matches!",
    badge: "✦ AI Music Matching",
    headingLine1: "Your photo.",
    headingLine2: "Your soundtrack.",
    subtitle: "Drop any photo. Our AI reads the vibe and finds songs that just fit.",
    errorHeading: "Couldn't read that photo's vibe",
    freeMatches: (credits: number) => `✦ ${credits} free matches · Any photo works`,
    recentVibesHeading: "Recent Vibes",
    seeAll: "See all",
  },
```

- [ ] **Step 2: Add the matching `home` block to `lib/translations/ru.ts`**

```ts
  home: {
    analyzingTexts: [
      "Считываем вайб...",
      "Анализируем настроение и энергию...",
      "Ищем среди миллионов треков...",
      "Собираем твой саундтрек...",
    ],
    marqueeWords: ["НАСТРОЕНИЕ", "ЭНЕРГИЯ", "ВАЙБ", "ЗВУК", "ЧУВСТВО", "ЦВЕТ"],
    errorRefund: "Анализ временно не удался — кредит не списан. Попробовать снова?",
    uploadedAlt: "Твоё фото",
    analyzingSubtext: "Это займёт около 5 секунд",
    creditsAddedToast: "✓ Кредиты добавлены — наслаждайся мэтчами!",
    badge: "✦ Подбор музыки от ИИ",
    headingLine1: "Твоё фото.",
    headingLine2: "Твой саундтрек.",
    subtitle: "Загрузи любое фото. ИИ считывает вайб и находит песни, которые подходят.",
    errorHeading: "Не удалось считать вайб фото",
    freeMatches: (credits: number) => `✦ ${credits} бесплатных мэтчей · Любое фото подойдёт`,
    recentVibesHeading: "Недавние вайбы",
    seeAll: "Смотреть все",
  },
```

- [ ] **Step 3: Migrate `app/app/page.tsx`**

Add the import and call `const t = useTranslation();` inside the component
(same pattern as Task 3, Step 3). Then:

- Delete the module-level `const ANALYZING_TEXTS = [...]` array (line 20) and
  `const MARQUEE_WORDS = [...]` array (line 27) — both move into the
  dictionary (Step 1/2 above) since `t` is only available inside the
  component via the hook.
- Line 116: change `setAnalyzeTextIdx((i) => (i + 1) % ANALYZING_TEXTS.length);`
  to `setAnalyzeTextIdx((i) => (i + 1) % t.home.analyzingTexts.length);`
- Line 322: change `{ANALYZING_TEXTS[analyzeTextIdx]}` to
  `{t.home.analyzingTexts[analyzeTextIdx]}`
- Line 490: change `{MARQUEE_WORDS.map((w, i) => (` to
  `{t.home.marqueeWords.map((w, i) => (`

Replace the remaining strings per this table:

| Line | Original | Replace with |
|---|---|---|
| 207 | `"Analysis temporarily failed — no credit was used. Try again?"` | `t.home.errorRefund` (used as the argument to `setErrorMsg(...)`) |
| 274 | `"Your upload"` alt | `{t.home.uploadedAlt}` |
| 326 | `"This takes about 5 seconds"` | `{t.home.analyzingSubtext}` |
| 358 | `"✓ Credits added — enjoy your matches!"` | `{t.home.creditsAddedToast}` |
| 371 | `"✦ AI Music Matching"` | `{t.home.badge}` |
| 380 | `"Your photo."` | `{t.home.headingLine1}` |
| 382 | `"Your soundtrack."` | `{t.home.headingLine2}` |
| 391 | `"Drop any photo. Our AI reads the vibe and finds songs that just fit."` | `{t.home.subtitle}` |
| 404 | `"Couldn't read that photo's vibe"` | `{t.home.errorHeading}` |
| 416 | `"Try again"` | `{t.common.tryAgain}` |
| 436 | `` `${credits} free matches · Any photo works` `` (with a leading `✦` already in the surrounding JSX) | `{t.home.freeMatches(credits)}` — note this key already includes the `✦`, so drop the separate hardcoded `✦` character in the JSX around it |
| 446 | `"Recent Vibes"` | `{t.home.recentVibesHeading}` |
| 452 | `"See all"` | `{t.home.seeAll}` |

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint app/app/page.tsx lib/translations/en.ts lib/translations/ru.ts`
Expected: no new errors (pre-existing unrelated errors at lines 41/55 of this
file, noted during the earlier reliability fix, are out of scope).

- [ ] **Step 5: Run the translation test suite**

Run: `node --test tests/translations.test.mjs`
Expected: all pass.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/app`, toggle to RU.
Expected: hero heading, subtitle, badge, free-matches line, and "Recent
Vibes" section all switch to Russian; the analyzing-screen looping text
(trigger by uploading a photo, if credentials allow, or by inspecting the
rendered marquee words on the idle screen) also shows Russian.

- [ ] **Step 7: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts app/app/page.tsx
git commit -m "feat: localize upload/home page (EN/RU)"
```

---

## Task 5: Migrate results/swipe experience (`results`, `swipe` namespaces)

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`
- Modify: `app/results/page.tsx`
- Modify: `components/SwipeCard.tsx`
- Modify: `components/MusicDNACard.tsx`
- Modify: `components/SongSwipeOnboarding.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 2.
- Produces: `t.results.*` (used by `app/results/page.tsx`), `t.swipe.*` (used by `SwipeCard.tsx`, `MusicDNACard.tsx`, `SongSwipeOnboarding.tsx`).

- [ ] **Step 1: Add the `results` and `swipe` namespaces to `lib/translations/en.ts`**

```ts
  results: {
    yourPhoto: "Your photo",
    yourVibeAlt: "Your vibe",
    skipAria: "Skip song",
    saveAria: "Save song",
    saveLabel: "Save",
    yourSoundtrack: "Your soundtrack",
    songsChosen: (count: number) => `Выбрано песен: ${count} ✦`,
    nothingSaved: "Nothing saved",
    tryAnotherPhoto: "Try another photo?",
    openLibrary: "Open Library →",
    matchAnotherPhoto: "Match another photo",
    tracksLeft: (remaining: number, total: number) => `${remaining} of ${total} left`,
    nowPlayingMatch: "Now playing match",
    swipeHint: "Swipe right to save · left to skip",
  },
  swipe: {
    dnaDreamy: "Dreamy",
    dnaNostalgic: "Nostalgic",
    dnaCinematic: "Cinematic",
    dnaIntimate: "Intimate",
    dnaDark: "Dark",
    dnaEnergy: "Energy",
    dnaConfident: "Confident",
    dnaDanceable: "Danceable",
    your: "Your",
    musicDna: "Music DNA",
    tunedToThis: "Every match is tuned to this.",
    startMatching: "Start matching →",
    matchScore: "Match Score",
    stampNope: "NOPE",
    stampSave: "SAVE",
    yourVibeAlt: "Your vibe",
    loadingSongs: "Loading songs...",
    tasteMatch: "taste match",
    weKnowTaste: "We know your taste!",
    swipeMoreToReach: (pct: number) => `Swipe 10 more songs to reach ${pct}% accuracy`,
    fullyCalibrated: "Your taste profile is fully calibrated",
    loadingButton: "Loading...",
    swipeMoreButton: "Swipe 10 more →",
    seeMyDna: "See my Music DNA →",
    doYouVibe: "Do you vibe with this?",
    stampLove: "LOVE",
    playing: "playing",
    tapToPlay: "▶ tap to play",
    skipAria: "Skip",
    loveItAria: "Love it",
    swipeHintFull: "Swipe or tap · right to love it · left to skip",
  },
```

Note: `results.songsChosen` intentionally reorders the English "N song(s)
chosen" into a form that avoids Russian noun pluralization entirely (see
Step 2) — English keeps the natural `count === 1 ? "song" : "songs"` phrasing
in its own render logic (unchanged from today), only the Russian string is
reshaped.

- [ ] **Step 2: Add the matching `results` and `swipe` blocks to `lib/translations/ru.ts`**

```ts
  results: {
    yourPhoto: "Твоё фото",
    yourVibeAlt: "Твой вайб",
    skipAria: "Пропустить песню",
    saveAria: "Сохранить песню",
    saveLabel: "Сохранить",
    yourSoundtrack: "Твой саундтрек",
    songsChosen: (count: number) => `Выбрано песен: ${count} ✦`,
    nothingSaved: "Ничего не сохранено",
    tryAnotherPhoto: "Попробовать другое фото?",
    openLibrary: "Открыть библиотеку →",
    matchAnotherPhoto: "Подобрать к другому фото",
    tracksLeft: (remaining: number, total: number) => `Осталось ${remaining} из ${total}`,
    nowPlayingMatch: "Сейчас играет",
    swipeHint: "Свайп вправо — сохранить, влево — пропустить",
  },
  swipe: {
    dnaDreamy: "Мечтательность",
    dnaNostalgic: "Ностальгия",
    dnaCinematic: "Кинематографичность",
    dnaIntimate: "Интимность",
    dnaDark: "Мрачность",
    dnaEnergy: "Энергия",
    dnaConfident: "Уверенность",
    dnaDanceable: "Танцевальность",
    your: "Твоя",
    musicDna: "Музыкальная ДНК",
    tunedToThis: "Каждый мэтч настроен под это.",
    startMatching: "Начать подбор →",
    matchScore: "Точность мэтча",
    stampNope: "МИМО",
    stampSave: "СЭЙВ",
    yourVibeAlt: "Твой вайб",
    loadingSongs: "Загружаем песни...",
    tasteMatch: "совпадение вкуса",
    weKnowTaste: "Мы знаем твой вкус!",
    swipeMoreToReach: (pct: number) => `Свайпни ещё 10 песен, чтобы достичь точности ${pct}%`,
    fullyCalibrated: "Твой профиль вкуса полностью откалиброван",
    loadingButton: "Загрузка...",
    swipeMoreButton: "Ещё 10 →",
    seeMyDna: "Смотреть мою Музыкальную ДНК →",
    doYouVibe: "Тебе заходит?",
    stampLove: "ОГОНЬ",
    playing: "играет",
    tapToPlay: "▶ нажми, чтобы включить",
    skipAria: "Пропустить",
    loveItAria: "Нравится",
    swipeHintFull: "Свайпай или тапай · вправо — нравится, влево — пропустить",
  },
```

- [ ] **Step 3: Migrate `app/results/page.tsx`**

Add the import/hook call, then replace per this table:

| Line | Original | Replace with |
|---|---|---|
| 22 | `"Your photo"` | `{t.results.yourPhoto}` |
| 28 | `"Your vibe"` alt | `{t.results.yourVibeAlt}` |
| 61 | `"Skip song"` aria-label | `t.results.skipAria` |
| 67 | `"Skip"` | `{t.common.skip}` |
| 72 | `"Save song"` aria-label | `t.results.saveAria` |
| 83 | `"Save"` | `{t.results.saveLabel}` |
| 196 | `"Your soundtrack"` | `{t.results.yourSoundtrack}` |
| 198 | `` `${savedTracks.length} song${plural} chosen ✦` `` | `{t.results.songsChosen(savedTracks.length)}` |
| 203 | `"Nothing saved"` | `{t.results.nothingSaved}` |
| 204 | `"Try another photo?"` | `{t.results.tryAnotherPhoto}` |
| 255 | `"Open Library →"` | `{t.results.openLibrary}` |
| 262 | `"Match another photo"` | `{t.results.matchAnotherPhoto}` |
| 286 | `` `${displayTracks.length - gone.size} of ${displayTracks.length} left` `` | `{t.results.tracksLeft(displayTracks.length - gone.size, displayTracks.length)}` |
| 310 | `"Now playing match"` | `{t.results.nowPlayingMatch}` |
| 314 | `"Swipe right to save · left to skip"` | `{t.results.swipeHint}` |

- [ ] **Step 4: Migrate `components/SwipeCard.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 46 | `"Match Score"` | `{t.swipe.matchScore}` |
| 122 | `"NOPE"` | `{t.swipe.stampNope}` |
| 128 | `"SAVE"` | `{t.swipe.stampSave}` |
| 137 | `"Your vibe"` alt | `{t.swipe.yourVibeAlt}` |

- [ ] **Step 5: Migrate `components/MusicDNACard.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 6 | `"Dreamy"` | `t.swipe.dnaDreamy` |
| 7 | `"Nostalgic"` | `t.swipe.dnaNostalgic` |
| 8 | `"Cinematic"` | `t.swipe.dnaCinematic` |
| 9 | `"Intimate"` | `t.swipe.dnaIntimate` |
| 10 | `"Dark"` | `t.swipe.dnaDark` |
| 11 | `"Energy"` | `t.swipe.dnaEnergy` |
| 12 | `"Confident"` | `t.swipe.dnaConfident` |
| 13 | `"Danceable"` | `t.swipe.dnaDanceable` |
| 35 | `"Your"` | `{t.swipe.your}` |
| 36 | `"Music DNA"` | `{t.swipe.musicDna}` |
| 37 | `"Every match is tuned to this."` | `{t.swipe.tunedToThis}` |
| 77 | `"Start matching →"` | `{t.swipe.startMatching}` |

(Lines 6-13 are likely an array/object of DNA axis labels used to render the
radar chart — replace the label source with the `t.swipe.dna*` values instead
of the hardcoded strings, keeping whatever numeric/key structure the chart
code depends on unchanged.)

- [ ] **Step 6: Migrate `components/SongSwipeOnboarding.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 193 | `"Loading songs..."` | `{t.swipe.loadingSongs}` |
| 223 | `"taste match"` | `{t.swipe.tasteMatch}` |
| 228 | `"We know your taste!"` | `{t.swipe.weKnowTaste}` |
| 232 | `` `Swipe 10 more songs to reach ${nextConfidence}% accuracy` `` | `{t.swipe.swipeMoreToReach(nextConfidence)}` |
| 234 | `"Your taste profile is fully calibrated"` | `{t.swipe.fullyCalibrated}` |
| 245 | `"Loading..."` / `"Swipe 10 more →"` | `{t.swipe.loadingButton}` / `{t.swipe.swipeMoreButton}` |
| 256 | `"See my Music DNA →"` | `{t.swipe.seeMyDna}` |
| 304 | `"Skip"` | `{t.common.skip}` |
| 310 | `"Do you vibe with this?"` | `{t.swipe.doYouVibe}` |
| 343 | `"LOVE"` | `{t.swipe.stampLove}` |
| 350 | `"NOPE"` | `{t.swipe.stampNope}` |
| 370 | `"playing"` | `{t.swipe.playing}` |
| 374 | `"▶ tap to play"` | `{t.swipe.tapToPlay}` |
| 405 | `"Skip"` aria-label | `t.swipe.skipAria` |
| 413 | `"Love it"` aria-label | `t.swipe.loveItAria` |
| 421 | `"Swipe or tap · right to love it · left to skip"` | `{t.swipe.swipeHintFull}` |

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint app/results/page.tsx components/SwipeCard.tsx components/MusicDNACard.tsx components/SongSwipeOnboarding.tsx lib/translations/en.ts lib/translations/ru.ts`
Expected: no new errors.

- [ ] **Step 8: Run the translation test suite**

Run: `node --test tests/translations.test.mjs`
Expected: all pass.

- [ ] **Step 9: Manual verification**

Run: `npm run dev`. The results/swipe flow requires a signed-in session with
tracks loaded (via the normal upload flow) to view fully — at minimum,
confirm via `npx tsc --noEmit` and a code read-through that every replaced
string routes through `t.results`/`t.swipe`, and spot-check
`components/SwipeCard.tsx` and `components/MusicDNACard.tsx` render correctly
in isolation if reachable from `/results` with existing saved songs in
`localStorage`/library.

- [ ] **Step 10: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts app/results/page.tsx components/SwipeCard.tsx components/MusicDNACard.tsx components/SongSwipeOnboarding.tsx
git commit -m "feat: localize results/swipe experience (EN/RU)"
```

---

## Task 6: Migrate library and explore pages (`library`, `explore` namespaces)

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`
- Modify: `app/library/page.tsx`
- Modify: `app/explore/page.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 2.
- Produces: `t.library.*`, `t.explore.*`.

- [ ] **Step 1: Add the `library` and `explore` namespaces to `lib/translations/en.ts`**

```ts
  library: {
    filterAll: "All",
    filterThisWeek: "This Week",
    filterMoody: "Moody",
    filterHype: "Hype",
    heading: "Library",
    savedSongsHeading: "Saved Songs",
    subtitle: "From your VibeSong matches",
    emptyTitle: "No saved songs yet.",
    emptyBody: "Upload a photo to get started.",
  },
  explore: {
    heading: "Explore",
    realMatches: "Real matches",
    whatPhotosSound: "What photos sound like",
    subtitle: "Example vibes from the community. Upload your own photo to get a personalized soundtrack.",
    uploadYourPhoto: "Upload your photo",
    tagLateNight: "Late Night",
    tagSynthwave: "Synthwave",
    tagCity: "City",
    tagIndie: "Indie",
    tagWarm: "Warm",
    tagMoody: "Moody",
    tagFunk: "Funk",
    tagNoir: "Noir",
    tagSoft: "Soft",
    tagRnb: "R&B",
  },
```

- [ ] **Step 2: Add the matching blocks to `lib/translations/ru.ts`**

```ts
  library: {
    filterAll: "Все",
    filterThisWeek: "На этой неделе",
    filterMoody: "Мрачное",
    filterHype: "Хайп",
    heading: "Библиотека",
    savedSongsHeading: "Сохранённые песни",
    subtitle: "Из твоих мэтчей VibeSong",
    emptyTitle: "Пока нет сохранённых песен.",
    emptyBody: "Загрузи фото, чтобы начать.",
  },
  explore: {
    heading: "Обзор",
    realMatches: "Реальные мэтчи",
    whatPhotosSound: "Как звучат фото",
    subtitle: "Примеры вайбов от сообщества. Загрузи своё фото, чтобы получить персональный саундтрек.",
    uploadYourPhoto: "Загрузить своё фото",
    tagLateNight: "Поздняя ночь",
    tagSynthwave: "Синтвейв",
    tagCity: "Город",
    tagIndie: "Инди",
    tagWarm: "Тепло",
    tagMoody: "Мрачно",
    tagFunk: "Фанк",
    tagNoir: "Нуар",
    tagSoft: "Нежно",
    tagRnb: "R&B",
  },
```

- [ ] **Step 3: Migrate `app/library/page.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 8 | `"All"` / `"This Week"` / `"Moody"` / `"Hype"` filter buttons | `{t.library.filterAll}` / `{t.library.filterThisWeek}` / `{t.library.filterMoody}` / `{t.library.filterHype}` |
| 34 | `"Library"` (passed as `center=` to `AppHeader`) | `t.library.heading` |
| 39 | `"Saved Songs"` | `{t.library.savedSongsHeading}` |
| 41 | `"From your VibeSong matches"` | `{t.library.subtitle}` |
| 67 | `"No saved songs yet."` | `{t.library.emptyTitle}` |
| 68 | `"Upload a photo to get started."` | `{t.library.emptyBody}` |
| 75 | `"Upload a photo →"` | `{t.common.uploadPhotoArrow}` |

- [ ] **Step 4: Migrate `app/explore/page.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 12 | `"R&B"` / `"Late Night"` tags | `{t.explore.tagRnb}` / `{t.explore.tagLateNight}` |
| 19 | `"Synthwave"` / `"City"` tags | `{t.explore.tagSynthwave}` / `{t.explore.tagCity}` |
| 26 | `"Indie"` / `"Warm"` tags | `{t.explore.tagIndie}` / `{t.explore.tagWarm}` |
| 33 | `"Moody"` tag | `{t.explore.tagMoody}` |
| 40 | `"Funk"` / `"Noir"` tags | `{t.explore.tagFunk}` / `{t.explore.tagNoir}` |
| 47 | `"Soft"` tag | `{t.explore.tagSoft}` |
| 53 | `"Explore"` (passed as `center=`) | `t.explore.heading` |
| 56 | `"Real matches"` | `{t.explore.realMatches}` |
| 59 | `"What photos sound like"` | `{t.explore.whatPhotosSound}` |
| 62 | `"Example vibes from the community..."` | `{t.explore.subtitle}` |
| 103 | `"Upload your photo"` | `{t.explore.uploadYourPhoto}` |

Leave all artist names (`"Frank Ocean"`, `"The Weeknd"`, `"Rex Orange
County"`, `"SZA"`, `"Childish Gambino"`) and song titles (`"Nights"`,
`"Blinding Lights"`, `"Happiness"`, `"Kill Bill"`, `"Redbone"`,
`"Sunflower"`) untouched.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint app/library/page.tsx app/explore/page.tsx lib/translations/en.ts lib/translations/ru.ts`
Expected: no new errors.

- [ ] **Step 6: Run the translation test suite**

Run: `node --test tests/translations.test.mjs`
Expected: all pass.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/library` and
`http://localhost:3000/explore`, toggle RU on each.
Expected: headings, filters, empty states, and demo-card tags switch to
Russian; artist/song names stay in English.

- [ ] **Step 8: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts app/library/page.tsx app/explore/page.tsx
git commit -m "feat: localize library and explore pages (EN/RU)"
```

---

## Task 7: Migrate profile and pricing (`profile`, `pricing` namespaces)

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`
- Modify: `app/profile/page.tsx`
- Modify: `components/PricingModal.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 2.
- Produces: `t.profile.*`, `t.pricing.*`.

- [ ] **Step 1: Add the `profile` and `pricing` namespaces to `lib/translations/en.ts`**

```ts
  profile: {
    heading: "Profile",
    yourProfileHeading: "Your Profile",
    signInPrompt: "Sign in to see your matches and credits",
    signIn: "Sign in",
    statMatches: "Matches",
    statSaved: "Saved",
    statCredits: "Credits",
    manageCredits: (credits: number) => `Manage Credits · ${credits} left`,
    retakeQuiz: "Retake taste quiz",
    signOut: "Sign out",
    myMatchesHeading: "My Matches",
    viewAll: "View All",
    yourTasteHeading: "Your Taste",
    learnedFrom: "Learned from what you save and skip",
    genresYouSave: "Genres you save",
    artistsYouSave: "Artists you save",
    genresAvoiding: "Genres we're avoiding",
    artistsAvoiding: "Artists we're avoiding",
  },
  pricing: {
    tryIt: "Try it",
    oneTime: "one-time",
    starterPerMatch: "$0.30 per match",
    popular: "Popular",
    popularPerMatch: "$0.20 per match",
    mostPopularBadge: "MOST POPULAR",
    save33: "SAVE 33%",
    unlimited: "Unlimited",
    perMonth: "/ month",
    unlimitedMatches: "Unlimited matches",
    bestValue: "BEST VALUE",
    errorStatus: (status: number) => `Error ${status}`,
    checkoutFailed: "Checkout failed",
    getCredits: "Get Credits",
    balance: "Balance",
    creditsRemaining: "credits remaining",
    eachMatchUses: "Each photo match uses 1 credit",
    neverExpire: "Credits never expire · Cancel anytime",
    subscriptionLabel: "SUBSCRIPTION",
    unlimitedEveryMonth: "Unlimited matches every month",
    creditsPerMatch: (credits: number, perMatch: string) => `${credits} credits · ${perMatch}`,
    done: "✓ Done! Enjoy your matches",
    processing: "Processing…",
    subscribeFor: (price: string) => `Subscribe for ${price}/mo →`,
    getCreditsFor: (credits: number, price: string) => `Get ${credits} credits for ${price} →`,
  },
```

- [ ] **Step 2: Add the matching blocks to `lib/translations/ru.ts`**

```ts
  profile: {
    heading: "Профиль",
    yourProfileHeading: "Твой профиль",
    signInPrompt: "Войди, чтобы увидеть свои мэтчи и кредиты",
    signIn: "Войти",
    statMatches: "Мэтчи",
    statSaved: "Сохранено",
    statCredits: "Кредиты",
    manageCredits: (credits: number) => `Управление кредитами · осталось ${credits}`,
    retakeQuiz: "Пройти опрос заново",
    signOut: "Выйти",
    myMatchesHeading: "Мои мэтчи",
    viewAll: "Смотреть все",
    yourTasteHeading: "Твой вкус",
    learnedFrom: "На основе того, что ты сохраняешь и пропускаешь",
    genresYouSave: "Жанры, которые ты сохраняешь",
    artistsYouSave: "Артисты, которых ты сохраняешь",
    genresAvoiding: "Жанры, которых избегаем",
    artistsAvoiding: "Артисты, которых избегаем",
  },
  pricing: {
    tryIt: "Попробовать",
    oneTime: "разовый",
    starterPerMatch: "$0.30 за мэтч",
    popular: "Популярно",
    popularPerMatch: "$0.20 за мэтч",
    mostPopularBadge: "САМЫЙ ПОПУЛЯРНЫЙ",
    save33: "ВЫГОДА 33%",
    unlimited: "Безлимит",
    perMonth: "/ месяц",
    unlimitedMatches: "Безлимитные мэтчи",
    bestValue: "ВЫГОДНЕЕ ВСЕГО",
    errorStatus: (status: number) => `Ошибка ${status}`,
    checkoutFailed: "Оплата не прошла",
    getCredits: "Купить кредиты",
    balance: "Баланс",
    creditsRemaining: "кредитов осталось",
    eachMatchUses: "Каждый мэтч по фото списывает 1 кредит",
    neverExpire: "Кредиты не сгорают · Отмена в любой момент",
    subscriptionLabel: "ПОДПИСКА",
    unlimitedEveryMonth: "Безлимитные мэтчи каждый месяц",
    creditsPerMatch: (credits: number, perMatch: string) => `${credits} кредитов · ${perMatch}`,
    done: "✓ Готово! Наслаждайся мэтчами",
    processing: "Обработка…",
    subscribeFor: (price: string) => `Оформить за ${price}/мес →`,
    getCreditsFor: (credits: number, price: string) => `Получить ${credits} кредитов за ${price} →`,
  },
```

- [ ] **Step 3: Migrate `app/profile/page.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 71 | `"Profile"` (passed as `center=`) | `t.profile.heading` |
| 94 | `"Your Profile"` | `{t.profile.yourProfileHeading}` |
| 97 | `"Sign in to see your matches and credits"` | `{t.profile.signInPrompt}` |
| 105 | `"Sign in"` | `{t.profile.signIn}` |
| 109 | `"Matches"` | `{t.profile.statMatches}` |
| 110 | `"Saved"` | `{t.profile.statSaved}` |
| 111 | `"Credits"` | `{t.profile.statCredits}` |
| 149 | `` `Manage Credits · ${credits} left` `` | `{t.profile.manageCredits(credits)}` |
| 156 | `"Retake taste quiz"` | `{t.profile.retakeQuiz}` |
| 163 | `"Sign out"` | `{t.profile.signOut}` |
| 176 | `"My Matches"` | `{t.profile.myMatchesHeading}` |
| 182 | `"View All"` | `{t.profile.viewAll}` |
| 307 | `"Your Taste"` | `{t.profile.yourTasteHeading}` |
| 310 | `"Learned from what you save and skip"` | `{t.profile.learnedFrom}` |
| 314 | `"Genres you save"` | `{t.profile.genresYouSave}` |
| 315 | `"Artists you save"` | `{t.profile.artistsYouSave}` |
| 316 | `"Genres we're avoiding"` | `{t.profile.genresAvoiding}` |
| 317 | `"Artists we're avoiding"` | `{t.profile.artistsAvoiding}` |

- [ ] **Step 4: Migrate `components/PricingModal.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 15 | `"Try it"` | `t.pricing.tryIt` |
| 18 | `"one-time"` | `t.pricing.oneTime` |
| 19 | `"$0.30 per match"` | `t.pricing.starterPerMatch` |
| 27 | `"Popular"` | `t.pricing.popular` |
| 31 | `"$0.20 per match"` | `t.pricing.popularPerMatch` |
| 32 | `"MOST POPULAR"` | `t.pricing.mostPopularBadge` |
| 33 | `"SAVE 33%"` | `t.pricing.save33` |
| 39 | `"Unlimited"` | `t.pricing.unlimited` |
| 42 | `"/ month"` | `t.pricing.perMonth` |
| 43 | `"Unlimited matches"` | `t.pricing.unlimitedMatches` |
| 44 | `"BEST VALUE"` | `t.pricing.bestValue` |
| 75 | `` `Error ${res.status}` `` | `t.pricing.errorStatus(res.status)` |
| 80 | `"Checkout failed"` | `t.pricing.checkoutFailed` |
| 111 | `"Get Credits"` | `{t.pricing.getCredits}` |
| 120 | `"Balance"` | `{t.pricing.balance}` |
| 124 | `"credits remaining"` | `{t.pricing.creditsRemaining}` |
| 126 | `"Each photo match uses 1 credit"` | `{t.pricing.eachMatchUses}` |
| 130 | `"Credits never expire · Cancel anytime"` | `{t.pricing.neverExpire}` |
| 164 | `"SUBSCRIPTION"` | `{t.pricing.subscriptionLabel}` |
| 177 | `"Unlimited matches every month"` | `{t.pricing.unlimitedEveryMonth}` |
| 178 | `` `${pkg.credits} credits · ${pkg.perMatch}` `` | `{t.pricing.creditsPerMatch(pkg.credits, pkg.perMatch)}` |
| 223 | `"✓ Done! Enjoy your matches"` | `{t.pricing.done}` |
| 225 | `"Processing…"` | `{t.pricing.processing}` |
| 228 | `` `Subscribe for ${pkg.price}/mo →` `` | `{t.pricing.subscribeFor(pkg.price)}` |
| 229 | `` `Get ${pkg.credits} credits for ${pkg.price} →` `` | `{t.pricing.getCreditsFor(pkg.credits, pkg.price)}` |

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint app/profile/page.tsx components/PricingModal.tsx lib/translations/en.ts lib/translations/ru.ts`
Expected: no new errors.

- [ ] **Step 6: Run the translation test suite**

Run: `node --test tests/translations.test.mjs`
Expected: all pass.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/profile`, toggle RU, and open
the pricing modal (via "Manage Credits").
Expected: profile stats/headings and all three pricing tiers' copy switch to
Russian; prices (`$0.20`, etc.) stay as-is.

- [ ] **Step 8: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts app/profile/page.tsx components/PricingModal.tsx
git commit -m "feat: localize profile page and pricing modal (EN/RU)"
```

---

## Task 8: Migrate the onboarding flow (`onboarding` namespace)

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`
- Modify: `components/OnboardingFlow.tsx`
- Modify: `components/onboarding/ArtistStep.tsx`
- Modify: `components/onboarding/AvoidListStep.tsx`
- Modify: `components/onboarding/LanguageStep.tsx`
- Modify: `components/onboarding/StorySongsStep.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 2.
- Produces: `t.onboarding.*` (nested per step: `artist`, `avoidList`, `language`, `storySongs`).

- [ ] **Step 1: Add the `onboarding` namespace to `lib/translations/en.ts`**

```ts
  onboarding: {
    setupStep: (n: number) => `Setup · ${n} of 4`,
    artist: {
      heading: "Artists you love",
      subtitle: "Name 2-3 — the more you add, the better we match.",
      placeholderExample: "e.g. Земфира",
      helpText: "Can't find them? Type the name and press Enter.",
      continueImprove: "Keep improving my matches →",
      skipToUpload: "Skip to upload →",
    },
    avoidList: {
      tagEdm: "EDM",
      tagRap: "Rap",
      tagMainstreamPop: "Mainstream pop",
      tagSadAcoustic: "Sad acoustic",
      tagTooDramatic: "Too dramatic",
      tagTooNiche: "Too niche",
      tagTooMainstream: "Too mainstream",
      heading: "Anything to avoid?",
      subtitle: "Optional — no wrong answers.",
    },
    language: {
      russian: "Russian",
      english: "English",
      korean: "Korean",
      spanish: "Spanish",
      arabic: "Arabic",
      french: "French",
      turkish: "Turkish",
      uzbek: "Uzbek",
      hindi: "Hindi",
      japanese: "Japanese",
      onlySelected: "Only what I selected",
      mostlyMine: "Mostly mine, sometimes others",
      openToAnything: "Open to anything if the vibe fits",
      heading: "Which languages do you actually post/listen to in your stories?",
      subtitle: "Pick at least one.",
      openness: "How open are you to other languages?",
    },
    storySongs: {
      saveFailed: "Couldn't save those songs — you can still continue.",
      heading: "Which songs have you recently posted?",
      subtitle: "Add up to 3 songs you've recently used in your Instagram or TikTok stories.",
      searchPlaceholder: "Search for a song...",
      finding: "Finding these songs…",
      continueLabel: "Continue",
    },
  },
```

- [ ] **Step 2: Add the matching `onboarding` block to `lib/translations/ru.ts`**

```ts
  onboarding: {
    setupStep: (n: number) => `Настройка · ${n} из 4`,
    artist: {
      heading: "Артисты, которых ты любишь",
      subtitle: "Назови 2-3 — чем больше добавишь, тем точнее подбор.",
      placeholderExample: "например, Земфира",
      helpText: "Не нашлось? Введи имя и нажми Enter.",
      continueImprove: "Улучшить мои мэтчи →",
      skipToUpload: "Пропустить и загрузить →",
    },
    avoidList: {
      tagEdm: "EDM",
      tagRap: "Рэп",
      tagMainstreamPop: "Попса",
      tagSadAcoustic: "Грустная акустика",
      tagTooDramatic: "Слишком драматично",
      tagTooNiche: "Слишком нишевое",
      tagTooMainstream: "Слишком попсово",
      heading: "Есть что-то, чего лучше избегать?",
      subtitle: "Необязательно — неправильных ответов нет.",
    },
    language: {
      russian: "Русский",
      english: "Английский",
      korean: "Корейский",
      spanish: "Испанский",
      arabic: "Арабский",
      french: "Французский",
      turkish: "Турецкий",
      uzbek: "Узбекский",
      hindi: "Хинди",
      japanese: "Японский",
      onlySelected: "Только то, что выбрал(а)",
      mostlyMine: "В основном мои, иногда другие",
      openToAnything: "Годится всё, если вайб подходит",
      heading: "На каких языках ты реально постишь и слушаешь в сторис?",
      subtitle: "Выбери хотя бы один.",
      openness: "Насколько ты открыт(а) другим языкам?",
    },
    storySongs: {
      saveFailed: "Не удалось сохранить эти песни — можно продолжить.",
      heading: "Какие песни ты недавно постил(а)?",
      subtitle: "Добавь до 3 песен, которые недавно использовал(а) в сторис Instagram или TikTok.",
      searchPlaceholder: "Поиск песни...",
      finding: "Ищем эти песни…",
      continueLabel: "Продолжить",
    },
  },
```

- [ ] **Step 3: Migrate `components/OnboardingFlow.tsx`**

Add the import/hook call, then replace all four step-counter strings:

| Line | Original | Replace with |
|---|---|---|
| 65 | `"Setup · 1 of 4"` | `{t.onboarding.setupStep(1)}` |
| 79 | `"Setup · 2 of 4"` | `{t.onboarding.setupStep(2)}` |
| 93 | `"Setup · 3 of 4"` | `{t.onboarding.setupStep(3)}` |
| 112 | `"Setup · 4 of 4"` | `{t.onboarding.setupStep(4)}` |

- [ ] **Step 4: Migrate `components/onboarding/ArtistStep.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 40 | `"Artists you love"` | `{t.onboarding.artist.heading}` |
| 41 | `"Name 2-3 — the more you add, the better we match."` | `{t.onboarding.artist.subtitle}` |
| 65 | `"e.g. Земфира"` placeholder | `t.onboarding.artist.placeholderExample` |
| 83 | `"Can't find them? Type the name and press Enter."` | `{t.onboarding.artist.helpText}` |
| 91 | `"Keep improving my matches →"` | `{t.onboarding.artist.continueImprove}` |
| 97 | `"Skip to upload →"` | `{t.onboarding.artist.skipToUpload}` |

- [ ] **Step 5: Migrate `components/onboarding/AvoidListStep.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 9 | `"EDM"` | `t.onboarding.avoidList.tagEdm` |
| 10 | `"Rap"` | `t.onboarding.avoidList.tagRap` |
| 11 | `"Mainstream pop"` | `t.onboarding.avoidList.tagMainstreamPop` |
| 12 | `"Sad acoustic"` | `t.onboarding.avoidList.tagSadAcoustic` |
| 13 | `"Too dramatic"` | `t.onboarding.avoidList.tagTooDramatic` |
| 14 | `"Too niche"` | `t.onboarding.avoidList.tagTooNiche` |
| 15 | `"Too mainstream"` | `t.onboarding.avoidList.tagTooMainstream` |
| 54 | `"Anything to avoid?"` | `{t.onboarding.avoidList.heading}` |
| 55 | `"Optional — no wrong answers."` | `{t.onboarding.avoidList.subtitle}` |
| 74 | `"Back"` | `{t.common.back}` |
| 80 | `"Next"` | `{t.common.next}` |

Note: this file's tag array (`"EDM"`, `"Rap"`, etc. at L9-15) is likely both
the display label and the value persisted/matched elsewhere (e.g. sent to an
API or stored in `onboardingPrefs`). Only replace the **display** label in
JSX — if the same array doubles as the value passed to
`setOnboardingPrefs`/API calls, keep the underlying value the original
English string (e.g. `"EDM"`) and render `t.onboarding.avoidList.tagEdm` only
in the visible label, so downstream matching logic (which expects English
genre/dislike strings) is unaffected. Read the surrounding code before
editing to confirm which usages are display-only vs data values.

- [ ] **Step 6: Migrate `components/onboarding/LanguageStep.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 4 | `"Russian"` / `"English"` / `"Korean"` / `"Spanish"` / `"Arabic"` / `"French"` | `t.onboarding.language.russian` / `.english` / `.korean` / `.spanish` / `.arabic` / `.french` |
| 5 | `"Turkish"` / `"Uzbek"` / `"Hindi"` / `"Japanese"` | `t.onboarding.language.turkish` / `.uzbek` / `.hindi` / `.japanese` |
| 9 | `"Only what I selected"` | `t.onboarding.language.onlySelected` |
| 10 | `"Mostly mine, sometimes others"` | `t.onboarding.language.mostlyMine` |
| 11 | `"Open to anything if the vibe fits"` | `t.onboarding.language.openToAnything` |
| 33 | `"Which languages do you actually post/listen to in your stories?"` | `{t.onboarding.language.heading}` |
| 35 | `"Pick at least one."` | `{t.onboarding.language.subtitle}` |
| 54 | `"How open are you to other languages?"` | `{t.onboarding.language.openness}` |
| 77 | `"Next"` | `{t.common.next}` |

Same caution as Step 5: the language names at L4-5 and the openness options
at L9-11 likely double as stored preference **values** (matched against the
song catalog's `language` field elsewhere, per `lib/matching.ts`/`taste`
logic seen earlier). Only swap the rendered label text, not the underlying
value used for matching/storage — confirm by reading how the array feeding
these buttons is consumed before editing.

- [ ] **Step 7: Migrate `components/onboarding/StorySongsStep.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 64 | `"Couldn't save those songs — you can still continue."` | `{t.onboarding.storySongs.saveFailed}` |
| 73 | `"Which songs have you recently posted?"` | `{t.onboarding.storySongs.heading}` |
| 76 | `"Add up to 3 songs you've recently used in your Instagram or TikTok stories."` | `{t.onboarding.storySongs.subtitle}` |
| 102 | `"Search for a song..."` placeholder | `t.onboarding.storySongs.searchPlaceholder` |
| 125 | `"Back"` | `{t.common.back}` |
| 132 | `"Finding these songs…"` / `"Continue"` / `"Skip"` | `{t.onboarding.storySongs.finding}` / `{t.onboarding.storySongs.continueLabel}` / `{t.common.skip}` |

- [ ] **Step 8: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint components/OnboardingFlow.tsx components/onboarding/*.tsx lib/translations/en.ts lib/translations/ru.ts`
Expected: no new errors.

- [ ] **Step 9: Run the translation test suite**

Run: `node --test tests/translations.test.mjs`
Expected: all pass.

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, clear `localStorage` (or use a private window) to trigger
the onboarding flow at `http://localhost:3000/app`, toggle RU.
Expected: all four onboarding steps display Russian headings/labels/buttons;
confirm the "language you post in" and "avoid list" choices still work
functionally afterward (e.g. results still respect the picked language) —
per Steps 5/6's caution, a functional regression here would mean the display
swap accidentally changed a stored value.

- [ ] **Step 11: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts components/OnboardingFlow.tsx components/onboarding
git commit -m "feat: localize onboarding flow (EN/RU)"
```

---

## Task 9: Migrate auth gate (`auth` namespace) and final full-app QA

**Files:**
- Modify: `lib/translations/en.ts`
- Modify: `lib/translations/ru.ts`
- Modify: `components/AuthGate.tsx`

**Interfaces:**
- Consumes: `useTranslation()` from Task 2.
- Produces: `t.auth.*`.

- [ ] **Step 1: Add the `auth` namespace to `lib/translations/en.ts`**

```ts
  auth: {
    sendFailed: "Couldn't send the link. Try again.",
    checkInbox: "Check your inbox",
    linkSentTo: (email: string) => `We sent a sign-in link to ${email}. Click it to continue — no password needed.`,
    didntGetIt: "Didn't get it?",
    oneLastStep: "One last step",
    signInBenefit: "Sign in to save your matches and get better recommendations over time.",
    continueWithGoogle: "Continue with Google",
    or: "or",
    sendingLink: "Sending link...",
    sendMagicLink: "Send magic link",
    noPasswordNeeded: "We'll email you a link — no password needed.",
  },
```

- [ ] **Step 2: Add the matching `auth` block to `lib/translations/ru.ts`**

```ts
  auth: {
    sendFailed: "Не удалось отправить ссылку. Попробуй ещё раз.",
    checkInbox: "Проверь почту",
    linkSentTo: (email: string) => `Мы отправили ссылку для входа на ${email}. Перейди по ней, чтобы продолжить — пароль не нужен.`,
    didntGetIt: "Не пришло?",
    oneLastStep: "Последний шаг",
    signInBenefit: "Войди, чтобы сохранять мэтчи и получать более точные рекомендации со временем.",
    continueWithGoogle: "Продолжить с Google",
    or: "или",
    sendingLink: "Отправляем ссылку...",
    sendMagicLink: "Отправить ссылку для входа",
    noPasswordNeeded: "Мы пришлём ссылку на почту — пароль не нужен.",
  },
```

- [ ] **Step 3: Migrate `components/AuthGate.tsx`**

Add the import/hook call, then replace:

| Line | Original | Replace with |
|---|---|---|
| 27 | `"Couldn't send the link. Try again."` | `{t.auth.sendFailed}` |
| 53 | `"Check your inbox"` | `{t.auth.checkInbox}` |
| 54 | `` `We sent a sign-in link to ${email}. Click it to continue — no password needed.` `` | `{t.auth.linkSentTo(email)}` |
| 58 | `"Didn't get it?"` | `{t.auth.didntGetIt}` |
| 64 | `"Try again"` | `{t.common.tryAgain}` |
| 71 | `"One last step"` | `{t.auth.oneLastStep}` |
| 72 | `"Sign in to save your matches and get better recommendations over time."` | `{t.auth.signInBenefit}` |
| 81 | `"Continue with Google"` | `{t.auth.continueWithGoogle}` |
| 86 | `"or"` | `{t.auth.or}` |
| 96 | `"your@email.com"` placeholder | *(leave — universal placeholder format, not language-specific)* |
| 105 | `"Sending link..."` / `"Send magic link"` | `{t.auth.sendingLink}` / `{t.auth.sendMagicLink}` |
| 107 | `"We'll email you a link — no password needed."` | `{t.auth.noPasswordNeeded}` |

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0.

Run: `npx eslint components/AuthGate.tsx lib/translations/en.ts lib/translations/ru.ts`
Expected: no new errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all existing tests plus `tests/translations.test.mjs` pass — this
is the last task touching the dictionaries, so this is the final full parity
check across every namespace added in Tasks 2-9.

- [ ] **Step 6: Full-app manual QA pass**

Run: `npm run dev`. With the language toggle, walk every route in both EN and
RU: `/`, `/app`, `/results` (if reachable with saved tracks), `/library`,
`/explore`, `/profile`, the pricing modal, and the onboarding flow (private
window). Confirm:
- No leftover hardcoded English text on any page while RU is selected.
- No visibly broken layout from longer Russian strings (check the pricing
  cards, onboarding step buttons, and the header toggle itself at narrow
  mobile widths).
- Reloading mid-session keeps the selected language.
- Switching back to EN restores the original English copy exactly.

- [ ] **Step 7: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts components/AuthGate.tsx
git commit -m "feat: localize auth gate (EN/RU), complete UI localization"
```
