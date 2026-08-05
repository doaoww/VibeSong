-- Adds the user's self-reported generation (derived from an age-range
-- picked during onboarding — see components/onboarding/AgeStep.tsx) to
-- user_taste. Values: 'gen-z' | 'millennial' | 'gen-x' | 'boomer' | 'unclear'
-- (never 'timeless' on this side — that value only applies to songs, see
-- supabase/song-generation-migration.sql). No CHECK constraint: validated
-- application-side via lib/tagTaxonomy.ts's coerceGeneration, matching this
-- codebase's existing convention for other enum-like text columns.
--
-- Apply this against the MAIN auth/user project (SUPABASE_URL), not the
-- catalog project (SUPABASE_CATALOG_URL) — user_taste lives there, unlike
-- songs. Direct table access via supabase-js, no RPC functions to update.
-- Idempotent — safe to re-run.

ALTER TABLE public.user_taste ADD COLUMN IF NOT EXISTS generation text;
