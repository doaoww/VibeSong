# Pricing Copy Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pricing legible — disclose that Pro is a recurring subscription on the landing page, explain what a credit buys, make the purchase modal's expiry/cancel messaging match the selected package, and give the modal a distinct heading when it opens because the user ran out of credits.

**Architecture:** Copy and presentation only. Four small, independently reviewable changes: (1) new translation keys, (2) landing page Pro card + explainer line, (3) modal's package-aware banner, (4) modal's context-aware heading wired from `app/app/page.tsx`. No billing/webhook/credit-deduction logic changes.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind, the project's own `lib/translations` i18n system (no external i18n library).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-08-pricing-copy-clarity-design.md` — approved, do not deviate without checking back with the user.
- Do not touch: `lib/polar.ts`, `lib/polarFulfillment.ts`, `app/api/webhooks/polar/route.ts`, `app/api/credits/*`, or any Polar product config.
- Do not touch `docs/BRD.md` / `docs/PRD.md` (reconciling Pro's feature set is explicitly out of scope).
- `ru.ts` is typed as `Translation = typeof en` (see `lib/translations/ru.ts:1-3`) — every key added to `en.ts` MUST have a matching key added to `ru.ts`, or `npx tsc --noEmit` fails.
- No unit tests apply (copy/presentational change; `tests/*.test.mjs` only covers `lib/` logic) — verification is `npx tsc --noEmit` plus manual dev-server checks, per the spec's Testing section.

---

### Task 1: Translation keys

**Files:**
- Modify: `lib/translations/en.ts:69-81` (landing namespace, pricing fields), `lib/translations/en.ts:209-234` (pricing namespace)
- Modify: `lib/translations/ru.ts:73-85` (landing namespace, pricing fields), `lib/translations/ru.ts:213-234` (pricing namespace)

**Interfaces:**
- Produces: `t.landing.subscriptionBadge`, `t.landing.perMonthSuffix`, `t.landing.whatsACredit`, `t.pricing.oneTimeExpiry`, `t.pricing.subscriptionExpiry`, `t.pricing.outOfCreditsHeading` — all consumed by Tasks 2–4.
- Removes: `t.pricing.neverExpire` (only current usage is `components/PricingModal.tsx:142`, replaced in Task 3).

- [ ] **Step 1: Add landing-namespace keys to `en.ts`**

In `lib/translations/en.ts`, find this block (around line 75-77):

```typescript
    proLabel: "PRO",
    proCredits: "500 credits",
    proPrice: "$0.04 / match",
```

Replace with:

```typescript
    proLabel: "PRO",
    proCredits: "500 credits",
    proPrice: "$0.04 / match",
    subscriptionBadge: "SUBSCRIPTION",
    perMonthSuffix: "/month",
    whatsACredit: "1 credit = 1 photo, analyzed → a full set of song matches to swipe through.",
```

- [ ] **Step 2: Add landing-namespace keys to `ru.ts`**

In `lib/translations/ru.ts`, find this block (around line 79-81):

```typescript
    proLabel: "PRO",
    proCredits: "500 кредитов",
    proPrice: "$0.04 / мэтч",
```

Replace with:

```typescript
    proLabel: "PRO",
    proCredits: "500 кредитов",
    proPrice: "$0.04 / мэтч",
    subscriptionBadge: "ПОДПИСКА",
    perMonthSuffix: "/мес",
    whatsACredit: "1 кредит = 1 фото на анализ → полная подборка песен на свайп.",
```

- [ ] **Step 3: Replace `neverExpire` with the package-aware keys, and add `outOfCreditsHeading`, in `en.ts`**

In `lib/translations/en.ts`, find (around line 226-228):

```typescript
    eachMatchUses: "Each photo match uses 1 credit",
    neverExpire: "Credits never expire · Cancel anytime",
    subscriptionLabel: "SUBSCRIPTION",
```

Replace with:

```typescript
    eachMatchUses: "Each photo match uses 1 credit",
    oneTimeExpiry: "Credits never expire",
    subscriptionExpiry: "Renews monthly — unused credits reset to 500, cancel anytime",
    outOfCreditsHeading: "Out of credits",
    subscriptionLabel: "SUBSCRIPTION",
```

- [ ] **Step 4: Replace `neverExpire` with the package-aware keys, and add `outOfCreditsHeading`, in `ru.ts`**

In `lib/translations/ru.ts`, find (around line 230-232):

```typescript
    eachMatchUses: "Каждый мэтч по фото списывает 1 кредит",
    neverExpire: "Кредиты не сгорают · Отмена в любой момент",
    subscriptionLabel: "ПОДПИСКА",
```

Replace with:

```typescript
    eachMatchUses: "Каждый мэтч по фото списывает 1 кредит",
    oneTimeExpiry: "Кредиты не сгорают",
    subscriptionExpiry: "Продлевается каждый месяц — баланс каждый раз обновляется до 500 кредитов, отменить можно в любой момент",
    outOfCreditsHeading: "Кредиты закончились",
    subscriptionLabel: "ПОДПИСКА",
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This will only fully pass once Tasks 2-4 stop referencing the now-deleted `neverExpire` key — if you run this check right after Task 1 alone, `components/PricingModal.tsx` will still reference `t.pricing.neverExpire` and fail to compile. That's expected at this point; the check that must be clean is the one at the end of Task 3.)

- [ ] **Step 6: Commit**

```bash
git add lib/translations/en.ts lib/translations/ru.ts
git commit -m "feat: add translation keys for pricing copy clarity"
```

---

### Task 2: Landing page Pro card discloses subscription + "what's a credit" line

**Files:**
- Modify: `components/LandingPage.tsx:500-556` (the `Pricing()` component)

**Interfaces:**
- Consumes: `t.landing.subscriptionBadge`, `t.landing.perMonthSuffix`, `t.landing.whatsACredit` (from Task 1).

- [ ] **Step 1: Add `isSubscription` to the `plans` array**

In `components/LandingPage.tsx`, find:

```tsx
  const plans = [
    { name: t.landing.starterLabel, price: "$1.99", credits: t.landing.starterCredits, per: t.landing.starterPrice, popular: false },
    { name: t.landing.popularLabel, price: "$6.99", credits: t.landing.popularCredits, per: t.landing.popularPrice, popular: true },
    { name: t.landing.proLabel, price: "$19.99", credits: t.landing.proCredits, per: t.landing.proPrice, popular: false },
  ];
```

Replace with:

```tsx
  const plans = [
    { name: t.landing.starterLabel, price: "$1.99", credits: t.landing.starterCredits, per: t.landing.starterPrice, popular: false, isSubscription: false },
    { name: t.landing.popularLabel, price: "$6.99", credits: t.landing.popularCredits, per: t.landing.popularPrice, popular: true, isSubscription: false },
    { name: t.landing.proLabel, price: "$19.99", credits: t.landing.proCredits, per: t.landing.proPrice, popular: false, isSubscription: true },
  ];
```

- [ ] **Step 2: Render the subscription badge and `/month` suffix**

Find:

```tsx
              {p.popular && (
                <div className="absolute -top-3 left-6 rounded-full bg-hot-pink px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                  {t.landing.mostPopularBadge}
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">
                {p.name}
              </div>
              <div className="mt-4 font-display text-5xl md:text-6xl font-bold">{p.price}</div>
              <div className="mt-2 text-black/60">{p.credits}</div>
```

Replace with:

```tsx
              {p.popular && (
                <div className="absolute -top-3 left-6 rounded-full bg-hot-pink px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                  {t.landing.mostPopularBadge}
                </div>
              )}
              {p.isSubscription && (
                <div className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                  {t.landing.subscriptionBadge}
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">
                {p.name}
              </div>
              <div className="mt-4 font-display text-5xl md:text-6xl font-bold">
                {p.price}
                {p.isSubscription && (
                  <span className="ml-1 text-lg md:text-xl font-semibold text-black/40">
                    {t.landing.perMonthSuffix}
                  </span>
                )}
              </div>
              <div className="mt-2 text-black/60">{p.credits}</div>
```

(`p.popular` and `p.isSubscription` are never both true across the three plans, so the two absolutely-positioned badges never collide.)

- [ ] **Step 3: Add the "what's a credit" line under the grid**

Find the end of the grid and section:

```tsx
        <div className="mt-10 md:mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => (
```

... (grid content unchanged) ... then find the grid's closing tags:

```tsx
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
```

Replace with:

```tsx
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-black/50">
          {t.landing.whatsACredit}
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors related to `LandingPage.tsx` (errors about `PricingModal.tsx`'s still-referenced `neverExpire` are expected until Task 3 — ignore those for now, confirm no *new* errors point at `LandingPage.tsx`).

- [ ] **Step 5: Manual check**

Run the dev server (`npm run dev`), visit `/`, scroll to the pricing section:
- Pro card shows a black "SUBSCRIPTION" pill (top-left, same position style as "MOST POPULAR") and "$19.99/month" (smaller "/month" next to the price).
- Starter and Popular cards are unchanged (no badge, no suffix).
- A muted line reading "1 credit = 1 photo, analyzed → a full set of song matches to swipe through." appears centered under the three cards.
- Switch to Russian (language toggle) and confirm the Russian versions of all three render correctly, no `undefined` text.

- [ ] **Step 6: Commit**

```bash
git add components/LandingPage.tsx
git commit -m "feat: disclose Pro subscription and explain credits on landing pricing"
```

---

### Task 3: Modal's expiry/cancel banner becomes package-aware

**Files:**
- Modify: `components/PricingModal.tsx:64-95` (state/computed values), `components/PricingModal.tsx:131-144` (banner), `components/PricingModal.tsx:236-240` (button label — reuse the hoisted value)

**Interfaces:**
- Consumes: `t.pricing.oneTimeExpiry`, `t.pricing.subscriptionExpiry` (from Task 1).
- Produces: `selectedPkg` (a plain `const`, not exported — local to the component, but Task 4 will read `PACKAGES`/`selected` the same way this task does, so keep the shape: `{ id, label, credits, price, priceNote, perMatch, badge, saveBadge, popular, isSubscription }`, matching `getPackages()`'s existing return type).

- [ ] **Step 1: Hoist a single `selectedPkg` lookup**

Find:

```tsx
  const t = useTranslation();
  const PACKAGES = useMemo(() => getPackages(t), [t]);
  const [selected, setSelected] = useState("popular");

  const [adding, setAdding] = useState(false);
```

Replace with:

```tsx
  const t = useTranslation();
  const PACKAGES = useMemo(() => getPackages(t), [t]);
  const [selected, setSelected] = useState("popular");
  const selectedPkg = PACKAGES.find((p) => p.id === selected)!;

  const [adding, setAdding] = useState(false);
```

- [ ] **Step 2: Replace the two later `PACKAGES.find` lookups with `selectedPkg`**

Find (in `handleContinue`):

```tsx
  const handleContinue = async () => {
    const pkg = PACKAGES.find((p) => p.id === selected)!;
    setAdding(true);
```

Replace with:

```tsx
  const handleContinue = async () => {
    const pkg = selectedPkg;
    setAdding(true);
```

Find (in the button label):

```tsx
                : (() => {
                    const pkg = PACKAGES.find((p) => p.id === selected)!;
                    if (pkg.isSubscription) return t.pricing.subscribeFor(pkg.price);
                    return t.pricing.getCreditsFor(pkg.credits, pkg.price);
                  })()}
```

Replace with:

```tsx
                : selectedPkg.isSubscription
                ? t.pricing.subscribeFor(selectedPkg.price)
                : t.pricing.getCreditsFor(selectedPkg.credits, selectedPkg.price)}
```

- [ ] **Step 3: Make the banner package-aware**

Find:

```tsx
              <div className="inline-flex items-center gap-1.5 mt-2 bg-black/5 text-black/50 text-[11px] font-semibold px-3 py-1 rounded-full">
                <span>✦</span>
                <span>{t.pricing.neverExpire}</span>
              </div>
```

Replace with:

```tsx
              <div className="inline-flex items-center gap-1.5 mt-2 bg-black/5 text-black/50 text-[11px] font-semibold px-3 py-1 rounded-full">
                <span>✦</span>
                <span>{selectedPkg.isSubscription ? t.pricing.subscriptionExpiry : t.pricing.oneTimeExpiry}</span>
              </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. This is the first point in the plan where the full project must compile cleanly — `neverExpire` is no longer referenced anywhere.

- [ ] **Step 5: Manual check**

With the dev server running, open the pricing modal (e.g. from `/profile`, tap "Get Credits" / the credits badge):
- Default selection is "popular" (one-time) — banner reads "Credits never expire".
- Tap the "PRO" package — banner switches to "Renews monthly — unused credits reset to 500, cancel anytime", and the CTA button reads "Subscribe for $19.99/mo →".
- Tap back to "Starter" or "Popular" — banner switches back, button reads "Get N credits for $X →".

- [ ] **Step 6: Commit**

```bash
git add components/PricingModal.tsx
git commit -m "fix: make pricing modal's expiry/cancel banner package-aware"
```

---

### Task 4: Modal heading reacts to why it opened

**Files:**
- Modify: `components/PricingModal.tsx:6-12` (props interface), `:55-62` (destructure), `:122-124` (heading)
- Modify: `app/app/page.tsx:29` (new state), `:256-276` (`handleImageReady`), `:387` (`onCreditsClick`), `:550-556` (`<PricingModal>` usage)

**Interfaces:**
- Consumes: `t.pricing.outOfCreditsHeading` (from Task 1).
- Produces: `PricingModalProps.reason?: "out-of-credits"` — an optional prop; any existing caller that omits it (e.g. `app/profile/page.tsx`) keeps today's behavior unchanged.

- [ ] **Step 1: Add the `reason` prop to `PricingModalProps`**

Find:

```tsx
interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onAddCredits: (amount: number) => Promise<void>;
  onRefreshCredits: () => Promise<number | null>;
}
```

Replace with:

```tsx
interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onAddCredits: (amount: number) => Promise<void>;
  onRefreshCredits: () => Promise<number | null>;
  reason?: "out-of-credits";
}
```

- [ ] **Step 2: Destructure `reason` and use it for the heading**

Find:

```tsx
export default function PricingModal({
  isOpen,
  onClose,
  currentCredits,
  onAddCredits,
  onRefreshCredits,
}: PricingModalProps) {
```

Replace with:

```tsx
export default function PricingModal({
  isOpen,
  onClose,
  currentCredits,
  onAddCredits,
  onRefreshCredits,
  reason,
}: PricingModalProps) {
```

Find:

```tsx
              <h2 className="font-display font-bold text-lg text-ink">
                {t.pricing.getCredits}
              </h2>
```

Replace with:

```tsx
              <h2 className="font-display font-bold text-lg text-ink">
                {reason === "out-of-credits" ? t.pricing.outOfCreditsHeading : t.pricing.getCredits}
              </h2>
```

- [ ] **Step 3: Track why the modal was opened, in `app/app/page.tsx`**

Find:

```tsx
  const [showPricing, setShowPricing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
```

Replace with:

```tsx
  const [showPricing, setShowPricing] = useState(false);
  const [pricingReason, setPricingReason] = useState<"out-of-credits" | undefined>(undefined);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
```

- [ ] **Step 4: Set the reason at both out-of-credits trigger sites**

Find:

```tsx
      if (credits <= 0) {
        setPendingImage({ base64, mimeType, objectUrl, exifData, thumbnailDataUrl });
        setShowPricing(true);
        return;
      }
```

Replace with:

```tsx
      if (credits <= 0) {
        setPendingImage({ base64, mimeType, objectUrl, exifData, thumbnailDataUrl });
        setPricingReason("out-of-credits");
        setShowPricing(true);
        return;
      }
```

Find:

```tsx
      deduct().then((ok) => {
        if (!ok) {
          setPageState("idle");
          setPendingImage({ base64, mimeType, objectUrl, exifData, thumbnailDataUrl });
          setShowPricing(true);
        }
      });
```

Replace with:

```tsx
      deduct().then((ok) => {
        if (!ok) {
          setPageState("idle");
          setPendingImage({ base64, mimeType, objectUrl, exifData, thumbnailDataUrl });
          setPricingReason("out-of-credits");
          setShowPricing(true);
        }
      });
```

- [ ] **Step 5: Clear the reason on the voluntary "buy credits" open**

Find:

```tsx
        <AppHeader
          credits={credits}
          onCreditsClick={() => setShowPricing(true)}
        />
```

Replace with:

```tsx
        <AppHeader
          credits={credits}
          onCreditsClick={() => {
            setPricingReason(undefined);
            setShowPricing(true);
          }}
        />
```

- [ ] **Step 6: Pass `reason` to `<PricingModal>`**

Find:

```tsx
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onAddCredits={handleCreditsAdded}
        onRefreshCredits={refresh}
      />
```

Replace with:

```tsx
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onAddCredits={handleCreditsAdded}
        onRefreshCredits={refresh}
        reason={pricingReason}
      />
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual check**

With the dev server running and a test account:
- From `/profile`, open the pricing modal (voluntary path) — heading reads "Get Credits".
- In `/app`, spend credits down to 0 (or temporarily set a test account's balance to 0 via the DB), then try uploading a photo — the modal opens with the heading "Out of credits" instead of "Get Credits".
- Open the modal via the credits badge in `/app`'s header (`onCreditsClick`) with credits still at 0 from the previous step — heading reads "Get Credits" again (confirms the reason resets on the voluntary path even right after an out-of-credits open).

- [ ] **Step 9: Commit**

```bash
git add components/PricingModal.tsx app/app/page.tsx
git commit -m "feat: show a distinct heading when the pricing modal opens from hitting 0 credits"
```

---

### Task 5: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the existing test suite**

Run: `npm test`
Expected: all tests pass (this change touches no files under `lib/recommend.ts`, `lib/autoTag.ts`, etc., so the count should match the last known-good baseline — 194 passing).

- [ ] **Step 3: Full manual walkthrough**

Repeat the manual-check steps from Tasks 2-4 in one pass, in both `en` and `ru` locales:
1. `/` pricing section — Pro subscription badge + `/month`, "what's a credit" line, both locales.
2. Pricing modal from `/profile` — package-aware banner switches correctly between all three packages, correct CTA labels.
3. `/app` at 0 credits — modal opens with "Out of credits" / "Кредиты закончились".
4. `/app` credits badge tap — modal opens with the normal "Get Credits" / "Купить кредиты" heading.

- [ ] **Step 4: Report completion**

Summarize to the user: all 4 spec items implemented, `tsc`/`npm test` clean, manual walkthrough done in both locales. Nothing to commit at this step (already committed per-task).
