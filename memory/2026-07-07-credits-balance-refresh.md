# Credits Balance Refresh Debug - 2026-07-07

## Symptom

After successful Polar purchases, the dashboard pricing entry still displayed `3` credits in both the `Get Credits` button and the `Balance` value.

## Findings

- The client hook (`lib/useCredits.ts`) cached credits in `localStorage` and fetched `/api/credits` without an explicit no-store policy.
- `PricingModal` displayed the `currentCredits` prop but did not refresh the server balance when opened.
- `/api/credits` returned the balance without a `Cache-Control: no-store` header.
- A live read-only Supabase status check against `profiles` and `polar_fulfillments` returned HTTP 503 for both tables. While this persists, the deployed app cannot reliably read the real server credit balance.

## Fix

- Fetch `/api/credits` with `{ cache: "no-store" }`.
- Return `/api/credits` responses with `Cache-Control: no-store`.
- Refresh credits when `PricingModal` opens.
- Pass the `refresh` callback into the modal from app and profile pages.
- Added regression coverage in `tests/creditsRefresh.test.mjs`.

## Verification

- `node --test .\tests\creditsRefresh.test.mjs`
- `node --test .\tests\*.test.mjs`
- `node .\node_modules\typescript\bin\tsc --noEmit -p tsconfig.json`
- `.\node_modules\.bin\eslint.cmd --quiet lib\useCredits.ts components\PricingModal.tsx app\api\credits\route.ts app\app\page.tsx app\profile\page.tsx tests\creditsRefresh.test.mjs`
- `git diff --check`
- `node .\node_modules\next\dist\bin\next build` with network access for Google Fonts

## Remaining Live Blocker

Supabase PostgREST returned 503 for `profiles` and `polar_fulfillments` during read-only verification. The code path is fixed, but production balance display and fulfillment verification require Supabase API health to recover and the Polar fulfillments migration to be applied.
