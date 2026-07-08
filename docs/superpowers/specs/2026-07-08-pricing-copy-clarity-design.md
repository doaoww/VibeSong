# Pricing copy clarity

## Problem

Real users tested the app today and said the pricing was "unclear" — what
they're actually paying for. Investigating the current copy against the
actual billing code (`lib/polarFulfillment.ts`, `app/api/webhooks/polar/route.ts`)
turned up four concrete gaps, all confirmed with the user:

1. **The landing page's Pro card never discloses it's a subscription.**
   `Pricing()` in `components/LandingPage.tsx` renders Starter/Popular/Pro as
   identical-looking one-time price cards — no "/month", no subscription
   badge. `PricingModal.tsx` *does* show a "SUBSCRIPTION" badge and "/ month"
   for Pro, but a user forms their first impression on the landing page,
   where that distinction doesn't exist.
2. **"1 credit = 1 photo match" is never explained on the landing page.**
   That fact only exists as small print (`t.pricing.eachMatchUses`) inside
   the purchase modal, which many people won't open before deciding whether
   to bother.
3. **The modal's "Credits never expire · Cancel anytime" banner is static
   and package-agnostic.** It's shown once, above package selection,
   regardless of which package is selected — "Cancel anytime" makes no sense
   next to a one-time Starter/Popular purchase, and it doesn't mention that
   Pro's monthly renewal *overwrites* the balance to 500
   (`setCredits(userId, config.credits)` in `lib/polarFulfillment.ts`, not
   additive like `addCredits` for one-time packs) — so unused credits don't
   roll over past a renewal.
4. **The modal gives no context for why it opened.** Whether a user taps
   "buy more" voluntarily or gets redirected because they hit 0 credits
   (`app/app/page.tsx`'s `credits <= 0` branch), the modal shows the same
   neutral "Get Credits" heading.

## Scope

Copy and presentation only — confirmed with the user not to touch: Polar
product config, webhook/fulfillment logic, credit deduction, or the BRD/PRD
Pro-tier feature set (BRD describes Pro as unlimited matches + Spotify
export; shipped Pro is 500 credits/mo — reconciling that gap is explicitly
out of scope for this pass).

## Changes

### 1. Landing page Pro card discloses subscription (`components/LandingPage.tsx`)

In `Pricing()`, the `plans` array already has `popular: boolean`; add
`isSubscription: boolean` (true only for the Pro entry). When true, render:
- A "SUBSCRIPTION" badge next to the tier name (small pill, same visual
  language as the existing "MOST POPULAR" badge, non-conflicting position
  since only Pro has it).
- The price row shows "$19.99" with a `/month` suffix directly next to it
  (not just "500 credits" below), mirroring `PricingModal`'s treatment.

New translation keys (`landing` namespace, en/ru):
- `subscriptionBadge`: "SUBSCRIPTION" / "ПОДПИСКА"
- `perMonthSuffix`: "/month" / "/мес"

### 2. "What's a credit?" line under the landing pricing grid (`components/LandingPage.tsx`)

One short line rendered under the 3-card grid in `Pricing()`, centered,
muted text (matching `simplePricingBody`'s treatment tier):

- EN: "1 credit = 1 photo, analyzed → a full set of song matches to swipe through."
- RU: "1 кредит = 1 фото на анализ → полная подборка песен на свайп."

(No specific match count in the copy — `app/api/recommend/route.ts` caps
results at 12 via `applyArtistDiversityCap`, but the existing "How it Works"
copy elsewhere already says "Five perfect songs"; rather than introduce a
third number, this line stays count-agnostic.)

New key: `landing.whatsACredit`.

### 3. Modal's expiry/cancel banner becomes package-aware (`components/PricingModal.tsx`)

Replace the single static `t.pricing.neverExpire` banner (currently shown
once, above package selection, independent of `selected`) with a banner
that reads the currently-selected package and switches text:

- One-time packages (`starter`, `popular`): "Credits never expire"
- Subscription (`pro`): "Renews monthly — unused credits reset to 500, cancel anytime"

Implementation: compute `const selectedPkg = PACKAGES.find(p => p.id === selected)!`
(already exists further down for `handleContinue`/button label — hoist it
up), then branch the banner text on `selectedPkg.isSubscription`. Since
`selected` is already state that drives re-renders (package highlighting),
this banner just needs to read the same value — no new state.

New translation keys (`pricing` namespace, en/ru):
- `oneTimeExpiry`: "Credits never expire" / "Кредиты не сгорают"
- `subscriptionExpiry`: "Renews monthly — unused credits reset to 500, cancel anytime" / "Продлевается каждый месяц — баланс каждый раз обновляется до 500 кредитов, отменить можно в любой момент"

(Replaces `neverExpire`, which becomes unused and can be removed.)

### 4. Modal headline reacts to why it opened (`components/PricingModal.tsx`, `app/app/page.tsx`)

`PricingModal` gains an optional prop `reason?: "out-of-credits"`. When set,
the header title (`t.pricing.getCredits`, currently always "Get Credits")
switches to a shorter explanatory heading:

- EN: "Out of credits"
- RU: "Кредиты закончились"

`app/app/page.tsx` passes `reason="out-of-credits"` only in the branch where
`setShowPricing(true)` is triggered by `credits <= 0` (both call sites: the
`handleImageReady` guard and the `deduct()` failure fallback). The
voluntary "buy more credits" open (e.g. from `/profile`) passes no `reason`
and keeps the current neutral heading — no change there.

New translation key: `pricing.outOfCreditsHeading`.

## Out of scope

- Any change to Polar product IDs, webhook handling, `addCredits`/`setCredits`
  semantics, or the actual renewal/cancellation behavior itself.
- Reconciling BRD/PRD's Phase 3 Pro description (unlimited + Spotify export)
  with the shipped 500-credits/mo Pro tier — flagged to the user as a
  separate, bigger product decision, not part of this pass.
- Visual/layout redesign of the pricing cards beyond the badge/line additions
  above (no new color tokens, no restructuring of the grid).

## Testing

No unit tests apply (copy/presentational change, not covered by the
`tests/*.test.mjs` suite, which is all `lib/` logic). Manual verification via
dev server per the `verify` skill / CLAUDE.md UI-testing rule:

1. Visit `/` — confirm Pro card shows "SUBSCRIPTION" badge + "/month"; Starter
   and Popular cards unchanged. Confirm the "1 credit = ..." line renders
   under the grid. Check both `en` and `ru` locales.
2. Open the pricing modal from `/profile` (voluntary path) — heading reads
   "Get Credits". Tap between Starter/Popular and Pro — banner text switches
   between "Credits never expire" and the renewal/cancel copy.
3. Drain credits to 0 in `/app` and trigger an upload — modal opens with
   "Out of credits" heading instead of "Get Credits".
4. Re-run `npx tsc --noEmit` to confirm no type errors from the new
   `PricingModal` prop.
