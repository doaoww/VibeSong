# UI Localization (EN/RU) — Design

## Problem

VibeSong's interface is hardcoded English-only. The user wants visitors to be able
to pick English or Russian for the site's interface.

## Scope

**In scope:** all static UI copy — navigation, headings, buttons, labels, empty
states, onboarding flow, pricing, error/retry messages, landing page marketing
copy.

**Out of scope:**
- AI-generated content per photo (`vibeCaption`, `vibeTags`, song match `reason`
  strings from GPT-4o) — stays in whatever language the model returns (normally
  English). Localizing this would mean changing the `/api/analyze` prompt and is
  a separate, much larger effort with matching-quality implications.
- URL-based locale routing (no `/ru/...` segments) — this is a single-page-app-style
  toggle, not an SEO-driven multi-locale site.
- Syncing the chosen language to the user's account/Supabase profile — locale is
  a per-browser preference only, same as it works today for nothing else in this
  app (credits/taste already sync to account, but locale deliberately does not).
- Pluralization / ICU message formatting — not needed for this app's copy today.

## Architecture

### 1. State — `store/useAppStore.ts`

Add to the existing Zustand store (no new state library):

```ts
locale: "en" | "ru";
setLocale: (locale: "en" | "ru") => void;
```

- Initial value: `"en"` — must be a static default so server-rendered HTML and
  the first client render match (no hydration mismatch). The onboarding flow
  already uses this same pattern (`showOnboarding` defaults `true`, corrected
  post-mount).
- `setLocale` writes `localStorage.setItem("vibesong_locale", locale)` in
  addition to updating store state.

### 2. Locale detection — tiny client component mounted in root layout

`app/layout.tsx` stays a server component — it must not become `"use client"`.
Add a new component `components/LocaleInit.tsx`:

```tsx
"use client";
export default function LocaleInit() {
  useEffect(() => {
    const stored = localStorage.getItem("vibesong_locale");
    if (stored === "en" || stored === "ru") {
      useAppStore.getState().setLocale(stored);
    } else if (navigator.language.toLowerCase().startsWith("ru")) {
      useAppStore.getState().setLocale("ru");
    }
  }, []);
  return null;
}
```

Mounted once as a sibling of `{children}` inside `RootLayout`'s `<body>`. It
renders nothing — purely a hook to run the one-time detection effect app-wide,
without forcing the whole layout (and the `<head>`/font setup around it) to
become a client component. Also sets `document.documentElement.lang = locale`
in the same effect, and re-runs it whenever `locale` changes (via a second
`useEffect` keyed on the store value) so the `<html lang>` attribute tracks
manual toggles too.

Detection order: stored preference wins; otherwise browser language; otherwise
the static `"en"` default already rendered — so there's never a flash of
untranslated content followed by a flash of translated content for English
users, only for Russian-browser users on first visit (same tradeoff the
onboarding flag already accepts).

### 3. Translation files — `lib/translations/`

Three files, per explicit request:

- **`lib/translations/en.ts`** — the base dictionary, grouped by
  page/section namespace:
  `nav`, `landing`, `home`, `results`, `library`, `explore`, `profile`,
  `pricing`, `onboarding` (nested per step: artist, avoidList, language,
  storySongs), `auth`, `common` (shared strings: close, back, retry, etc.)

- **`lib/translations/ru.ts`**:
  ```ts
  import { en } from "./en";
  type Translation = typeof en;
  export const ru: Translation = { /* ... */ };
  ```
  Assigning the literal to a variable typed as `Translation` means TypeScript
  rejects the file at compile time if a key is missing, renamed, or
  type-mismatched — the two dictionaries can't drift apart silently.

- **`lib/translations/index.ts`**:
  ```ts
  import { en } from "./en";
  import { ru as ruRaw } from "./ru";
  export type Locale = "en" | "ru";
  const ru = deepMerge(en, ruRaw); // defense in depth, see below
  export const translations: Record<Locale, typeof en> = { en, ru };
  ```
  `deepMerge` is a small recursive helper (object → merge keys, anything else →
  prefer the override if defined). Belt-and-suspenders: the compile-time check
  above should already guarantee `ru` is complete, but the merge means that if
  that guarantee is ever weakened later (e.g. someone changes `ru.ts` to build
  the object dynamically and TS can no longer fully verify it), a missing key
  falls back to English at runtime instead of rendering `undefined`.

### 4. Hook — `lib/translations/useTranslation.ts`

```ts
export function useTranslation() {
  const locale = useAppStore((s) => s.locale);
  return translations[locale];
}
```

Returns the whole per-locale object (not a `t("key.path")` string-lookup
function) — components destructure by namespace, e.g.:

```tsx
const t = useTranslation();
<h1>{t.home.heading}</h1>
<button>{t.common.retry}</button>
```

This keeps every usage type-checked and autocompletable; a typo in a key path
is a compile error, not a silent blank string.

### 5. Toggle component — `components/LanguageToggle.tsx`

Same visual pattern as the existing `ContrastModeToggle.tsx` (pill buttons,
`bg-hot-pink` for the active state), but compact — a two-segment "EN | RU"
pill sized for a header, not a full-width settings row.

```tsx
"use client";
export default function LanguageToggle() {
  const { locale, setLocale } = useAppStore();
  return (
    <div className="flex items-center rounded-full bg-white/5 border border-white/10 p-0.5 text-xs font-semibold font-display">
      <button onClick={() => setLocale("en")} className={locale === "en" ? "active pill" : "inactive pill"}>EN</button>
      <button onClick={() => setLocale("ru")} className={locale === "ru" ? "active pill" : "inactive pill"}>RU</button>
    </div>
  );
}
```

Mounted inside `components/AppHeader.tsx`'s right-side area, next to
`CreditBadge` — since `AppHeader` is the shared header used by every page
(`app/app`, `library`, `explore`, `profile`, `results`), adding it there once
makes it appear everywhere without touching each page's call site.
`LandingPage.tsx` (the logged-out `/` route) doesn't use `AppHeader`, so it
gets its own small placement of the same `LanguageToggle` component in its
top nav area.

### 6. Migration

Every hardcoded user-facing string across the following gets replaced with a
`t.<namespace>.<key>` lookup:

`components/LandingPage.tsx`, `app/app/page.tsx`, `app/results/page.tsx`,
`app/library/page.tsx`, `app/explore/page.tsx`, `app/profile/page.tsx`,
`components/PricingModal.tsx`, `components/OnboardingFlow.tsx`,
`components/onboarding/*.tsx`, `components/NavBar.tsx`,
`components/AppSidebar.tsx`, `components/AuthGate.tsx`,
`components/CreditBadge.tsx`, `components/VibeTags.tsx`,
`components/MusicDNACard.tsx`, `components/SwipeCard.tsx`,
`components/SongSwipeOnboarding.tsx`, `components/AppHeader.tsx`.

This is a large but mechanical, low-risk pass (~3800 lines across ~17 files
touched, though only a fraction of each file is user-facing copy). The
implementation plan should break this into ordered, independently-shippable
groups (e.g. nav/shared chrome first, then landing, then app/results flow,
then onboarding, then profile/library/pricing) so it can be parallelized
across sub-agents or reviewed incrementally rather than as one giant diff.

## Error handling

- Missing translation key for a locale: caught at compile time (Section 3).
  Runtime deep-merge fallback to English exists as a second line of defense.
- `localStorage` unavailable (private browsing edge cases, SSR): `LocaleInit`'s
  effect only runs client-side post-mount, and reads/writes are already guarded
  by the fact this only executes in the browser; no server-side access is
  attempted.

## Testing

- TypeScript compilation is the primary safety net for translation completeness
  (Section 3's structural typing).
- Manual smoke test: toggle EN → RU → EN on each migrated page, confirm no
  leftover hardcoded English/undefined strings and no layout breakage from
  longer Russian text (Russian strings run ~15-20% longer than English on
  average — worth a visual check on tight buttons/pills).
- No automated i18n test suite — disproportionate for a two-locale, static-copy
  feature.
