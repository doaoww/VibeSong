# Landing Page Sign In Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable "Sign In" link to the landing page nav so returning users with an existing account have an obvious way back into the app.

**Architecture:** Pure UI addition — one new `Link` in `LandingNav` (`components/LandingPage.tsx`) pointing at `/app`, plus one new translation key in both locale files. No new auth logic: `/app` (`app/app/page.tsx`) already shows `AuthGate` for unauthenticated visitors and drops straight into the app for authenticated ones.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, `next/link`.

## Global Constraints

- Do not touch `needsAuthGate` / `effectiveShowOnboarding` logic in `app/app/page.tsx` — the auth-gate-before-quiz order for first-time users must stay exactly as it is today (confirmed with user).
- No new component, no modal, no new redirect logic — the link just navigates to `/app`.
- Follow existing translation pattern: add key under the `landing` namespace in both `lib/translations/en.ts` and `lib/translations/ru.ts` (types are inferred from `en.ts`, no separate interface file to update).
- Match existing nav link styling (`text-white/70 hover:text-white transition-colors`), not a button — must not visually compete with the primary "Try Free" CTA.

---

### Task 1: Add `navSignIn` translation key

**Files:**
- Modify: `lib/translations/en.ts:20` (insert after `navTryFree`)
- Modify: `lib/translations/ru.ts:24` (insert after `navTryFree`)

**Interfaces:**
- Produces: `t.landing.navSignIn` (string), consumed by Task 2.

- [ ] **Step 1: Add the English key**

In `lib/translations/en.ts`, inside the `landing` object, right after the `navTryFree` line:

```ts
    navTryFree: "Try Free →",
    navSignIn: "Sign In",
```

- [ ] **Step 2: Add the Russian key**

In `lib/translations/ru.ts`, inside the `landing` object, right after the `navTryFree` line:

```ts
    navTryFree: "Попробовать бесплатно →",
    navSignIn: "Войти",
```

- [ ] **Step 3: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors (the key is additive; `ru.ts`'s shape is checked against `en.ts`'s inferred type elsewhere in the codebase — if that check exists, it will fail loudly on a missing key, not a extra one, so no action needed here beyond confirming a clean run).

- [ ] **Step 4: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts
git commit -m "$(cat <<'EOF'
Add navSignIn translation key for landing nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add the Sign In link to `LandingNav`

**Files:**
- Modify: `components/LandingPage.tsx:120-125` (the `LandingNav` right-hand button group)

**Interfaces:**
- Consumes: `t.landing.navSignIn` (produced by Task 1), `Link` from `next/link` (already imported at the top of this file).

- [ ] **Step 1: Add the link before the language toggle**

In `components/LandingPage.tsx`, inside `LandingNav`, the current right-hand group is:

```tsx
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle />
          <PinkButton href="/app" className="!px-4 !py-2 text-xs sm:!px-5 sm:!py-2.5 sm:text-sm">
            {t.landing.navTryFree}
          </PinkButton>
        </div>
```

Replace it with:

```tsx
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/app"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            {t.landing.navSignIn}
          </Link>
          <LanguageToggle />
          <PinkButton href="/app" className="!px-4 !py-2 text-xs sm:!px-5 sm:!py-2.5 sm:text-sm">
            {t.landing.navTryFree}
          </PinkButton>
        </div>
```

- [ ] **Step 2: Confirm `Link` is already imported**

Check `components/LandingPage.tsx:3` — it already has `import Link from "next/link";` (used elsewhere in the same file), so no import changes are needed.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`
Then:
1. Open `http://localhost:3000/` in a browser where you are NOT logged in (or an incognito window).
2. Confirm a "Sign In" text link now appears in the top nav, to the left of the language toggle and the "Try Free" button.
3. Click "Sign In" → confirm it navigates to `/app` and shows the `AuthGate` screen (Google button + magic link form).
4. Complete sign-in (magic link or Google) → confirm you land in the app.
5. Go back to `/` → click "Sign In" again → confirm it now goes straight into the app (no `AuthGate` shown), since a session already exists.
6. Resize to a mobile width (or use device toolbar) → confirm the nav doesn't overflow/wrap awkwardly with the new link present.

- [ ] **Step 5: Commit**

```bash
git add components/LandingPage.tsx
git commit -m "$(cat <<'EOF'
Add Sign In link to landing page nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
