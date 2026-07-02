-- Onboarding v2 migration — adaptive onboarding (languages+openness, avoid-list,
-- recently-posted story songs, filtered swipes). Run in the MAIN Supabase
-- project's SQL Editor (not the catalog project).

ALTER TABLE public.user_taste
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS language_openness text NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS genre_scores jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoided_story_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_story_songs uuid[] NOT NULL DEFAULT '{}';

-- Old singular/unscored fields, fully superseded by the columns above.
ALTER TABLE public.user_taste
  DROP COLUMN IF EXISTS language_preference,
  DROP COLUMN IF EXISTS genres,
  DROP COLUMN IF EXISTS dislikes;
