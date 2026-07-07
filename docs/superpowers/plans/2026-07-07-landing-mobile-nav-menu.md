# Landing Page Mobile Nav Hamburger Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's cramped always-visible mobile nav row with a hamburger button that opens a dropdown panel, fixing both the pre-existing logo-wrap bug and the "Sign In" wrap regression at mobile widths.

**Architecture:** All changes are inside the existing `LandingNav` function in `components/LandingPage.tsx` — no new files. Adds one `useState` for open/closed, a `md:hidden` button, and an `AnimatePresence`-animated dropdown panel using the `framer-motion` patterns already used elsewhere in this file.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Framer Motion, Material Symbols icon font (already loaded globally via `app/layout.tsx`, already used elsewhere e.g. `components/AppHeader.tsx`).

## Global Constraints

- No new translation keys — reuse `t.landing.navHowItWorks`, `navFeatures`, `navPricing`, `navSignIn`, `navTryFree` exactly as they exist today.
- No changes to desktop (`md+`) layout or behavior — the existing `hidden ... md:flex` middle link group is untouched; the right-hand group (Sign In / language toggle / Try Free) must render identically on `md+` to how it renders today.
- No change to `/app`'s auth-gate logic (`app/app/page.tsx`) — out of scope, unrelated file.
- Icon usage must use the existing `material-symbols-outlined` class convention (see `components/AppHeader.tsx`'s back button for the established pattern), not a new icon library.
- `aria-label` on the hamburger button is a plain hardcoded string ("Menu" / "Close menu"), not a translation key — it's an accessibility attribute, not visible UI copy, and the spec explicitly says no new translation keys.

---

### Task 1: Add hamburger menu to `LandingNav`

**Files:**
- Modify: `components/LandingPage.tsx:1-135` (imports at top of file, and the entire `LandingNav` function)

**Interfaces:**
- Consumes: `t.landing.navHowItWorks`, `t.landing.navFeatures`, `t.landing.navPricing`, `t.landing.navSignIn`, `t.landing.navTryFree` (all already exist), `LanguageToggle` (default export, no props), `PinkButton` (already defined earlier in this same file, at line 10 — local helper, takes `children`, `className`, `href`, `onClick`; **note:** when `href` is passed, `PinkButton` does NOT wire up `onClick` at all — see Step 1 for how this task works around that).
- Produces: nothing consumed by other tasks — this is the only task in this plan.

- [ ] **Step 1: Update imports**

In `components/LandingPage.tsx`, change line 4 from:

```tsx
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
```

to:

```tsx
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, animate } from "framer-motion";
```

And change line 5 from:

```tsx
import { useEffect, useRef } from "react";
```

to:

```tsx
import { useEffect, useRef, useState } from "react";
```

- [ ] **Step 2: Replace the `LandingNav` function**

Replace the entire current `LandingNav` function (currently lines 97-135) with:

```tsx
function LandingNav() {
  const t = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-white">
          <img src="/android-chrome-192x192.png" alt="" className="h-11 w-11 rounded-lg" />
          VibeSong<span className="text-hot-pink">AI</span>
        </Link>
        <div className="hidden items-center gap-6 lg:gap-8 text-sm text-white/70 md:flex">
          <a href="#how" className="hover:text-white transition-colors">
            {t.landing.navHowItWorks}
          </a>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <a href="#features" className="hover:text-white transition-colors">
            {t.landing.navFeatures}
          </a>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <a href="#pricing" className="hover:text-white transition-colors">
            {t.landing.navPricing}
          </a>
        </div>
        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
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
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Menu"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/5 transition-colors md:hidden"
        >
          <span className="material-symbols-outlined text-[24px]">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5 bg-black/90 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col items-start gap-1 px-4 py-4 text-sm text-white/70">
              <a href="#how" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navHowItWorks}
              </a>
              <a href="#features" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navFeatures}
              </a>
              <a href="#pricing" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navPricing}
              </a>
              <div className="my-2 h-px w-full bg-white/10" />
              <Link href="/app" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navSignIn}
              </Link>
              <div className="py-2">
                <LanguageToggle />
              </div>
              <div onClick={closeMenu} className="mt-2">
                <PinkButton href="/app">
                  {t.landing.navTryFree}
                </PinkButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
```

Note on the `PinkButton` "Try Free" item: `PinkButton` (defined earlier in this file) does not forward an `onClick` prop through to its rendered `Link` when `href` is set — passing `onClick={closeMenu}` directly to `PinkButton` would silently do nothing. That's why it's wrapped in a plain `<div onClick={closeMenu}>` instead — the click event bubbles up from the inner link to this div's handler before the browser navigates, so the menu closes correctly.

Do not add `w-full` to the `PinkButton` here — leave it at its natural pill width (matching how `PinkButton` is used elsewhere on this page, e.g. in `Hero`), left-aligned under the other stacked items, consistent with the approved design mockup.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev` (or confirm it's already running at `http://127.0.0.1:3000`)

Because this environment's browser-automation `resize_window` tool does not actually shrink the render viewport (confirmed earlier in this project — `window.innerWidth` stays at the physical monitor width after calling it), use a same-origin iframe to get a real mobile CSS viewport instead. In a browser tab already on `http://127.0.0.1:3000/`, run this in the page's console (or via a JS-execution browser tool):

```js
const iframe = document.createElement('iframe');
iframe.id = 'mobile-check';
iframe.style.cssText = 'position:fixed;top:0;left:0;width:390px;height:700px;border:0;z-index:999999;background:white;';
iframe.src = '/';
document.body.appendChild(iframe);
```

Wait ~1-2 seconds for it to load, then take a screenshot/zoom of the `(0,0)`-`(390,250)` region of the page and confirm, at this real 390px-wide render:

1. Only the logo and a hamburger icon (`menu` glyph) appear in the nav bar — no wrapping, no overflow, no "Sign In"/toggle/button crammed in.
2. The logo "VibeSong AI" renders on a single line (this was the pre-existing bug — confirm it's now resolved as a side effect of freeing up header width; if it still wraps, note this explicitly in the report as an unresolved pre-existing issue, not a new defect from this task).
3. Click the hamburger icon (dispatch a click at its coordinates, or `document.getElementById('mobile-check').contentDocument.querySelector('button[aria-label="Menu"]').click()`): confirm a panel drops down below the nav bar showing, in order: How it Works, Features, Pricing, a divider, Sign In, the EN/RU toggle, then the Try Free button — and that page content below is not covered (the panel pushes content down, it does not overlay it).
4. Click the hamburger icon again while open: confirm the panel closes and the icon reverts to the `menu` glyph.
5. Re-open the panel and click one of the anchor links (e.g. "How it Works"): confirm the panel closes.
6. Clean up: remove the injected iframe (`document.getElementById('mobile-check').remove()`).

Then repeat a quick check at the default desktop width (no iframe needed — just the normal browser tab) to confirm the nav renders exactly as it did before this change: middle links visible, Sign In + toggle + Try Free visible in their existing positions, no hamburger icon visible.

- [ ] **Step 5: Commit**

```bash
git add components/LandingPage.tsx
git commit -m "$(cat <<'EOF'
Add mobile hamburger menu to landing nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
