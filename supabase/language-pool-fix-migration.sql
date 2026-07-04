-- Language pool fix: addresses "user picks Russian + English but only gets
-- English recommendations".
--
-- Root cause (found via systematic debugging, 2026-07-04):
-- Every candidate pool RPC (match_songs, match_songs_by_tags,
-- match_songs_by_taste, match_songs_by_brief) ranks purely by vector/tag
-- distance across the ENTIRE catalog and caps results at 20-25 rows, with zero
-- language awareness. Language filtering/penalty only happens afterward in
-- buildRecommendations (lib/recommend.ts), applied to whatever already made it
-- into that small pool. Since the catalog is majority-English, the top-25 by
-- vector distance for a given photo rarely contains enough (or any) Russian
-- candidates in the first place -- there is nothing left to promote by the
-- time language scoring runs.
--
-- Fix: add a dedicated language-aware pool, following the same pattern as the
-- existing story/context/taste pools -- filter by the user's preferred
-- languages first, then rank by vector distance within that filtered set, so
-- preferred-language candidates get a guaranteed shot at the merged candidate
-- pool instead of only ever being penalized/filtered after the fact.
--
-- Apply this against the SUPABASE_CATALOG_URL project via the Supabase SQL
-- editor. Idempotent -- safe to re-run. New function, no DROP needed.

CREATE OR REPLACE FUNCTION public.match_songs_by_language(
  p_languages   text[] DEFAULT '{}',
  query_vector  vector(10) DEFAULT NULL,
  p_match_count int DEFAULT 25
)
RETURNS TABLE (
  id                    uuid,
  title                 text,
  artist                text,
  language              text,
  energy                float,
  popularity_tier       int,
  emotional_vector      vector(10),
  genre_tags            text[],
  aesthetic_tags        text[],
  mood_tags             text[],
  story_intent_tags     text[],
  modern_aesthetic_tags text[],
  story_context_tags    text[],
  final_confidence      float,
  needs_review          boolean,
  tag_source            text,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float,
  distance              float
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF cardinality(p_languages) = 0 OR query_vector IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.tag_source, s.itunes_preview_url,
    s.artwork_url, s.apple_music_url, s.youtube_id, s.quality_score,
    (s.emotional_vector <=> query_vector)::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
    AND s.language = ANY (p_languages)
  ORDER BY s.emotional_vector <=> query_vector
  LIMIT p_match_count;
END;
$$;
