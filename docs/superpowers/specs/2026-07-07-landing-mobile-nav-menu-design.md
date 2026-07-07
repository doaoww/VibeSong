# Landing page mobile nav — hamburger menu

## Problem

The landing page nav (`LandingNav` in `components/LandingPage.tsx`) has two
mobile-width bugs, confirmed via real browser rendering at a 390px CSS-pixel
viewport (verified with a same-origin iframe, since this environment's
`resize_window` tool does not actually shrink the render viewport):

1. **Pre-existing, unrelated to any recent change:** the logo link
   ("VibeSong AI") wraps onto two lines ("VibeSong" / "AI") because it has
   no `whitespace-nowrap` and the flex row doesn't leave enough width for it
   at mobile widths.
2. **Regression from the "Sign In" link added in
   `2026-07-07-landing-sign-in-link-design.md`:** the right-hand nav group
   (Sign In + language toggle + "Try Free") no longer fits on one line at
   mobile widths either — "Sign In" wraps to "Sign" / "In" — because a third
   item was added to a group that commit `20996e8` had already tuned to the
   edge of fitting with two items.

Both stem from the same root cause: cramming a growing set of nav items
into a single fixed-width mobile row. The fix is a proper mobile nav
pattern instead of continuing to squeeze items.

## Scope

Add a hamburger menu to `LandingNav` for mobile widths (`<md`), all within
the existing `components/LandingPage.tsx` file — no new component file,
following the file's existing scale (other sections like `Hero`, `Pricing`,
etc. are all defined in this one file already).

### Layout changes

- The existing "hidden md:flex" middle link group (How it Works / Features
  / Pricing) is unchanged — desktop-only, as today.
- The existing right-hand group (Sign In link, `LanguageToggle`,
  `PinkButton` "Try Free") gets `hidden md:flex` added — desktop-only from
  now on, instead of always-visible.
- A new hamburger button appears only at `<md` widths (`md:hidden`):
  a 40×40px tappable circle (`w-10 h-10 flex items-center justify-center
  rounded-full hover:bg-white/5`, matching the existing back-button pattern
  in `components/AppHeader.tsx`), containing a `material-symbols-outlined`
  icon — `menu` when closed, `close` when open.
- Clicking the hamburger toggles a dropdown panel that appears directly
  below the nav bar (not a full-screen overlay): a `motion.div` animated
  with `AnimatePresence` (height/opacity transition, consistent with the
  `framer-motion` patterns already used throughout this file), spanning
  full width, with a dark background consistent with the nav
  (`bg-black/90 backdrop-blur-xl` or similar — exact tone decided at
  implementation time to look correct against the existing nav's
  `bg-black/40 backdrop-blur-xl`).
- Panel contents, stacked vertically, in this order: How it Works,
  Features, Pricing, a divider, Sign In, the language toggle, then the
  "Try Free" button. All reuse the exact same translation keys already in
  use today (`t.landing.navHowItWorks`, `navFeatures`, `navPricing`,
  `navSignIn`, `navTryFree`) — **no new translation keys**.
- Clicking any link or button inside the open panel closes it (sets the
  open state back to `false`), so the panel doesn't stay open after
  navigating to an anchor section or route.

### State

- One `useState<boolean>` in `LandingNav` for open/closed, e.g.
  `mobileMenuOpen` / `setMobileMenuOpen`.

## Out of scope

- No change to desktop (`md+`) layout or behavior at all.
- No new translation keys.
- No change to `/app`'s auth-gate logic (unrelated to this file).
- Fixing the pre-existing logo-wrap bug is not a separate task — it is
  expected to resolve as a side effect of freeing up header width once the
  right-hand group moves into the collapsed hamburger menu on mobile. This
  will be verified in the browser after implementation. If it does NOT
  resolve on its own, it will be flagged as a follow-up rather than
  expanding this task's scope to a dedicated logo-CSS fix.

## Testing

Manual browser verification (the same real-viewport technique used to
diagnose this — a same-origin iframe at 390px CSS width, since
`resize_window` doesn't work in this environment — or an actual mobile
device/emulator if available):

1. At `<md` width: confirm only logo + hamburger icon show in the nav bar
   (no wrapping, no overflow).
2. Click hamburger: panel slides down with all 6 items in the specified
   order, page content below is not covered.
3. Click each link/button in the panel: confirms navigation/anchor-scroll
   happens AND the panel closes.
4. Click hamburger again while open: panel closes, icon reverts to `menu`.
5. Confirm logo no longer wraps at this width (or explicitly note if it
   still does, as an unresolved pre-existing issue).
6. At `md+` width: confirm nav renders exactly as before this change (no
   hamburger visible, all items in their current desktop positions).
