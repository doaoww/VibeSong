-- Ranking quality fix: addresses "the same mainstream song is always
-- recommended first regardless of the photo".
--
-- Root cause (found via systematic debugging, 2026-07-03):
-- 1. record_song_feedback computed quality_score = save_count / total with no
--    smoothing, so a song shown once and saved once hit quality_score = 1.0 -
--    identical weight to a song saved 500/500 times.
-- 2. match_songs_by_tags and match_songs_by_taste (the Story/Context and Taste
--    candidate pools) ordered candidates purely by `quality_score DESC`, not by
--    how well the song actually matched the query's tags/artists/genres. Any
--    song that picked up an early quality_score near 1.0 (plausible for a
--    globally famous track reflexively saved during dev testing) would sit at
--    the top of those two pools for almost every request, regardless of photo.
-- 3. buildRecommendations (lib/recommend.ts) clamps finalScore to 100 and uses
--    a stable sort, so ties are broken by insertion order into the merged
--    candidate list - i.e. by which pool a song came from and where in it -
--    not by relevance. A song reliably at the top of a quality_score-only pool
--    reliably wins ties too.
--
-- This migration: (a) adds Bayesian smoothing to quality_score so it takes a
-- real sample size to move away from the 0.5 prior, and (b) reorders the two
-- affected pools by tag/artist/genre overlap first, quality_score as a
-- tiebreaker only.
--
-- Apply this against the SUPABASE_CATALOG_URL project via the Supabase SQL
-- editor. Idempotent - safe to re-run. Does not change any function signature,
-- so CREATE OR REPLACE is sufficient (no DROP needed).

-- (a) Smooth quality_score: prior of 0.5 with weight 4 (equivalent to 2
-- "phantom" saves and 2 "phantom" skips baked in). A song needs a real sample
-- to move meaningfully away from 0.5 instead of hitting 1.0 off one interaction.
CREATE OR REPLACE FUNCTION public.record_song_feedback(
  p_song_id uuid,
  p_action  text  -- 'save' | 'skip' | 'perfect'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_save    int;
  v_skip    int;
  v_perfect int;
  v_total   int;
BEGIN
  SELECT save_count, skip_count, perfect_count
  INTO v_save, v_skip, v_perfect
  FROM public.songs WHERE id = p_song_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF p_action = 'save' OR p_action = 'perfect' THEN v_save := v_save + 1; END IF;
  IF p_action = 'skip'    THEN v_skip    := v_skip    + 1; END IF;
  IF p_action = 'perfect' THEN v_perfect := v_perfect + 1; END IF;

  v_total := v_save + v_skip;

  UPDATE public.songs SET
    save_count    = v_save,
    skip_count    = v_skip,
    perfect_count = v_perfect,
    quality_score = (v_save::float8 + 2) / (v_total::float8 + 4)
  WHERE id = p_song_id;
END;
$$;

-- (b) Story/Context Tags Pool: order by actual tag-overlap count across all
-- four tag families first, quality_score only as a tiebreaker.
CREATE OR REPLACE FUNCTION public.match_songs_by_tags(
  p_context_tags   text[] DEFAULT '{}',
  p_intent_tags    text[] DEFAULT '{}',
  p_aesthetic_tags text[] DEFAULT '{}',
  p_mood_tags      text[] DEFAULT '{}',
  p_match_count    int DEFAULT 25
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
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score, NULL::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
    AND (
      (cardinality(p_context_tags)   > 0 AND s.story_context_tags    && p_context_tags)
      OR (cardinality(p_intent_tags)    > 0 AND s.story_intent_tags    && p_intent_tags)
      OR (cardinality(p_aesthetic_tags) > 0 AND s.modern_aesthetic_tags && p_aesthetic_tags)
      OR (cardinality(p_mood_tags)      > 0 AND s.mood_tags            && p_mood_tags)
    )
  ORDER BY
    (
      cardinality(ARRAY(SELECT unnest(s.story_context_tags) INTERSECT SELECT unnest(p_context_tags)))
      + cardinality(ARRAY(SELECT unnest(s.story_intent_tags) INTERSECT SELECT unnest(p_intent_tags)))
      + cardinality(ARRAY(SELECT unnest(s.modern_aesthetic_tags) INTERSECT SELECT unnest(p_aesthetic_tags)))
      + cardinality(ARRAY(SELECT unnest(s.mood_tags) INTERSECT SELECT unnest(p_mood_tags)))
    ) DESC,
    s.quality_score DESC,
    s.id
  LIMIT p_match_count;
END;
$$;

-- Taste Pool: order by relevance (exact/liked-artist match weighted above
-- genre overlap) first, quality_score only as a tiebreaker.
CREATE OR REPLACE FUNCTION public.match_songs_by_taste(
  p_artist_patterns  text[] DEFAULT '{}',
  p_positive_genres  text[] DEFAULT '{}',
  p_match_count      int DEFAULT 20
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
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score, NULL::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
    AND (
      (cardinality(p_artist_patterns) > 0 AND s.artist ILIKE ANY (p_artist_patterns))
      OR (cardinality(p_positive_genres) > 0 AND s.genre_tags && p_positive_genres)
    )
  ORDER BY
    (
      (CASE WHEN cardinality(p_artist_patterns) > 0 AND s.artist ILIKE ANY (p_artist_patterns) THEN 2 ELSE 0 END)
      + cardinality(ARRAY(SELECT unnest(s.genre_tags) INTERSECT SELECT unnest(p_positive_genres)))
    ) DESC,
    s.quality_score DESC,
    s.id
  LIMIT p_match_count;
END;
$$;

-- One-time backfill: recompute quality_score for existing rows under the new
-- smoothed formula so the fix applies immediately, not just to future feedback.
UPDATE public.songs
SET quality_score = (save_count::float8 + 2) / ((save_count + skip_count)::float8 + 4);
