# Debug Report: Auth Metadata Credit Fallback - 2026-07-07

## Symptom

The live app still displayed `3` credits after four paid 10-credit purchases. The user expected `43` and should not need to pay again to test credit fulfillment.

## Evidence

- Live Supabase Auth admin API works.
- Live Supabase PostgREST for `profiles` and `polar_fulfillments` returns `503 PGRST002` / schema-cache failure.
- The app's credit read/write and Polar idempotency paths previously depended on those PostgREST tables.
- A live restore set the most recent signed-in user's Auth `app_metadata.vibesong_credits` from `3` to `43`.
- A smoke test using the production `getOrCreateProfile` code returned `credits: 43` for that user while a direct `profiles` probe still returned 503.

## Root Cause

The code had no operational fallback for credits or Polar fulfillment idempotency when Supabase PostgREST was unavailable. Even after fixing webhook and stale UI issues, the app could not read or update `profiles.credits` while PostgREST returned 503.

## Fix

- `lib/db/profiles.ts`
  - Added Auth metadata fallback for credit reads and writes.
  - `getOrCreateProfile` falls back to Auth metadata when `profiles` PostgREST is unavailable.
  - `addCredits`, `deductCredit`, `setCredits`, and `markMigrated` can write `app_metadata.vibesong_credits`.
  - When tables work again, higher Auth metadata credits are merged back into the profile path instead of being ignored.
- `lib/db/polarFulfillments.ts`
  - Added Auth metadata fallback for Polar fulfillment idempotency keys when `polar_fulfillments` PostgREST is unavailable.

## Regression Test

Added `tests/creditsAuthFallback.test.mjs` covering:

- Reading credits from Auth metadata when `profiles` returns `PGRST002`.
- Adding credits through Auth metadata when `profiles` is unavailable.
- Deducting credits through Auth metadata when `profiles` is unavailable.
- Claiming Polar fulfillment keys through Auth metadata when `polar_fulfillments` is unavailable.
- Detecting duplicate fallback fulfillment keys.

## Verification

- RED: `node --test .\tests\creditsAuthFallback.test.mjs` failed on current code with `PGRST002`.
- GREEN: targeted fallback tests pass after implementation.
- Full `node --test .\tests\*.test.mjs`: 175 pass.
- TypeScript, ESLint, `git diff --check`, and `next build` pass.
- Live smoke test: production `getOrCreateProfile` returned `43` while `profiles` still returned 503.

## Status

DONE_WITH_CONCERNS: code and live Auth metadata restore are complete; production visibility depends on Vercel deploying the pushed commit. Supabase PostgREST still needs platform/schema-cache recovery for normal table-backed storage.
