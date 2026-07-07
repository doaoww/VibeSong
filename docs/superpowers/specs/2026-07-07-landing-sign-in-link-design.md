# Landing page Sign In link

## Problem

`LandingNav` (in `components/LandingPage.tsx`) only offers a "Try Free" CTA to
`/app`. A returning user who already has an account has no discoverable way
to get back in from the marketing site — the only sign-in affordance today
is buried on `/profile`, or the forced `AuthGate` wall inside `/app` for
first-time visitors. This reads as "no way to sign in."

## Scope

Add a plain "Sign In" link to `LandingNav`, next to the language toggle and
the "Try Free" button. Nothing else changes:

- The `/app` auth-gate-before-quiz ordering stays exactly as-is (confirmed
  explicitly with the user — not touching `needsAuthGate` logic in
  `app/app/page.tsx`).
- No new auth logic. The link just navigates to `/app`, which already:
  - shows `AuthGate` (Google OAuth / Supabase magic link) if
    `status === "unauthenticated"`
  - drops straight into the app if a session already exists

## Changes

1. **`components/LandingPage.tsx`** — in `LandingNav`, add a `Link href="/app"`
   styled as a plain text link (`text-white/70 hover:text-white`, matching
   the existing nav item style), placed before the `LanguageToggle`/`PinkButton`
   group.
2. **`lib/translations/en.ts`** / **`lib/translations/ru.ts`** — add
   `navSignIn` under the `landing` namespace ("Sign In" / "Войти").

## Out of scope

- Changing onboarding/auth-gate order for first-time users.
- A modal/overlay sign-in on the landing page itself (rejected in favor of
  reusing the existing `/app` flow — simpler, zero new redirect logic).
- Any change to `/profile`'s existing sign-in prompt.

## Testing

Manual check: from `/`, click "Sign In" while logged out → lands on `/app`
and sees `AuthGate`. Log in via magic link or Google, confirm redirect into
the app. Visit `/` again while a session is active, click "Sign In" → goes
straight into the app without the gate.
