# Debug Report: Credits Reset To 3 After Purchases - 2026-07-07

## Symptom

The account still displayed `3` credits even after four successful 10-credit purchases. Expected balance: `43`.

## Evidence

- `useAccountSync` reads `localStorage["vibesong_credits"]` and posts it to `/api/migrate-local`.
- `/api/migrate-local` calls `markMigrated(user.id, localCredits)`.
- `markMigrated` previously wrote `credits: credits ?? profile.credits`, so a stale browser value of `3` could overwrite a higher paid server balance.
- Regression test confirmed this: with server credits `43` and local credits `3`, the old code attempted to update the profile to `3`.
- Live Supabase Auth API responds, but PostgREST for `profiles` and `polar_fulfillments` returns `503 PGRST002: Could not query the database for the schema cache. Retrying.`

## Root Cause

Local-data migration trusted stale local credit state as authoritative and could lower the server-side credit balance after payment fulfillment.

## Fix

`markMigrated` now merges local credits with server credits using max semantics:

- If local credits are higher, preserve useful anonymous credits.
- If local credits are stale/lower, keep the paid server balance.

## Regression Test

Added `tests/creditsMigration.test.mjs`:

- `markMigrated never lowers paid server credits with stale local credits`
- `markMigrated can raise server credits when local anonymous credits are higher`

## Verification

- RED: `node --test .\tests\creditsMigration.test.mjs` failed because old code updated `credits` from `43` to `3`.
- GREEN: targeted test passed after the fix.
- Full `node --test .\tests\*.test.mjs`: 170 pass.
- TypeScript, ESLint, `git diff --check`, and `next build` passed.

## Remaining Live Blocker

The code fix prevents future resets, but it does not restore the already-lost `+40` credits. Restoring the account to `43` requires writing to `profiles.credits` or replaying paid purchases. That write is currently blocked because Supabase PostgREST is returning 503 for the relevant tables. Once Supabase DB API recovers, update the affected user's `profiles.credits` to `43` or replay the four paid fulfillments.

## Status

DONE_WITH_CONCERNS: root cause fixed and tested; live backfill blocked by Supabase PostgREST 503.
