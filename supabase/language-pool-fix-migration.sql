-- Adds the match_songs_by_language RPC referenced by lib/db/songs.ts's
-- searchCatalogByLanguage() (see app/api/recommend/route.ts's languagePool).
--
-- Root cause of "doesn't work with Hindi/Indian songs" (and any other
-- non-English language preference) has two layers:
--
-- 1. This function was never created in the catalog database — this
--    migration file was committed empty in f2539c7, so the dedicated
--    language candidate pool has been silently erroring ever since, and
--    lib/recommend.ts's hard language filter (languageMatches, "core to
--    matching") then strips almost every candidate for users who select a
--    language preference, since the other pools (vector/tags/taste) are
--    dominated by the mostly-English catalog and were never guaranteed to
--    contain matches in the user's chosen language.
--
-- 2. Once created with the obvious `WHERE language ILIKE ANY(...) ORDER BY
--    emotional_vector <=> query_vector LIMIT n` shape, it still returned 0
--    rows for minority languages (Hindi: 68/2228 rows, Spanish: 28/2228) at
--    the app's real p_match_count=25, while majority-ish languages (Russian
--    72, Kazakh 13 — row count isn't what predicts this, vector clustering
--    relative to the query is) worked fine. Cause: emotional_vector has an
--    HNSW index (songs_emotional_vector_idx, songs-schema.sql), and
--    `ORDER BY ... <=> ... LIMIT n` lets Postgres use it for approximate
--    nearest-neighbor search *before* applying the WHERE language filter —
--    so a small LIMIT only ever sees the top-N globally-nearest vectors,
--    and if none of a minority language's vectors land in that
--    approximate window, the post-filter has nothing to keep. Verified
--    directly: same call with p_match_count=3000 correctly returned all 68
--    Hindi rows. Fix: filter by language in a MATERIALIZED CTE first — an
--    optimizer fence that forces Postgres to fully build the (small,
--    language-only) candidate set before sorting it, so the HNSW index
--    never enters the plan and the sort is an exact, not approximate, scan
--    over just that candidate set.
--
-- DROP first: CREATE OR REPLACE cannot change the RETURNS TABLE column set
-- (Postgres error 42P13), so this must be dropped before every signature change.
DROP FUNCTION IF EXISTS public.match_songs_by_language(text[], vector, integer);

CREATE OR REPLACE FUNCTION public.match_songs_by_language(
  p_languages   text[],
  query_vector  vector(10),
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
  RETURN QUERY
  WITH filtered AS MATERIALIZED (
    SELECT s.*
    FROM public.songs s
    WHERE s.emotional_vector IS NOT NULL
      AND s.language ILIKE ANY (p_languages)
  )
  SELECT
    f.id,
    f.title,
    f.artist,
    f.language,
    f.energy,
    f.popularity_tier,
    f.emotional_vector,
    f.genre_tags,
    f.aesthetic_tags,
    f.mood_tags,
    f.story_intent_tags,
    f.modern_aesthetic_tags,
    f.story_context_tags,
    f.final_confidence,
    f.needs_review,
    f.tag_source,
    f.itunes_preview_url,
    f.artwork_url,
    f.apple_music_url,
    f.youtube_id,
    f.quality_score,
    (f.emotional_vector <=> query_vector)::float AS distance
  FROM filtered f
  ORDER BY f.emotional_vector <=> query_vector
  LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_songs_by_language(text[], vector, integer) TO service_role;
