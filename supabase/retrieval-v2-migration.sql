-- Retrieval v2: hybrid retrieval pools (tag overlap + taste match), plus
-- extending update_song so the backfill script can write story_context_tags
-- and vibe_summary onto existing rows (the original update_song predates
-- those two columns and never exposed them).
--
-- Apply this against the SUPABASE_CATALOG_URL project (not the main auth
-- project) via the Supabase SQL editor. Idempotent - safe to re-run.

CREATE INDEX IF NOT EXISTS songs_story_context_tags_idx ON public.songs USING gin (story_context_tags);
CREATE INDEX IF NOT EXISTS songs_story_intent_tags_idx ON public.songs USING gin (story_intent_tags);
CREATE INDEX IF NOT EXISTS songs_modern_aesthetic_tags_idx ON public.songs USING gin (modern_aesthetic_tags);
CREATE INDEX IF NOT EXISTS songs_mood_tags_idx ON public.songs USING gin (mood_tags);
CREATE INDEX IF NOT EXISTS songs_genre_tags_idx ON public.songs USING gin (genre_tags);
CREATE INDEX IF NOT EXISTS songs_artist_idx ON public.songs (artist);

-- Story Tags Pool + Context/Scene Pool share this one function, called twice
-- with different arguments populated (see lib/db/songs.ts::searchCatalogByTags).
DROP FUNCTION IF EXISTS public.match_songs_by_tags(text[], text[], text[], text[], int);

-- Parameters are prefixed p_ (unlike match_songs's query_vector/match_count)
-- because two of them — aesthetic_tags, mood_tags — are also RETURNS TABLE
-- column names, and PL/pgSQL rejects a parameter name reused as an output
-- column name (42P13: "parameter name ... used more than once").
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
  ORDER BY s.quality_score DESC, s.id
  LIMIT p_match_count;
END;
$$;

-- Taste Pool: liked artists, music_direction.references artists (pre-wrapped
-- with %...% by the app layer), or positive genre overlap. Prefixed p_ to
-- stay consistent with match_songs_by_tags above (no actual name collision
-- here, but keeping both new functions' parameter conventions identical
-- avoids relying on which specific columns happen to collide today).
DROP FUNCTION IF EXISTS public.match_songs_by_taste(text[], text[], int);

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
  ORDER BY s.quality_score DESC, s.id
  LIMIT p_match_count;
END;
$$;

-- Extend update_song so the backfill script (scripts/backfill-story-context-tags.mjs)
-- can write story_context_tags/vibe_summary onto existing rows. Postgres requires
-- dropping the old signature before adding parameters via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.update_song(uuid, text, int, text[], text[], text[], text[], text[]);

CREATE OR REPLACE FUNCTION public.update_song(
  p_id                    uuid,
  p_language              text    DEFAULT NULL,
  p_popularity_tier       int     DEFAULT NULL,
  p_genre_tags            text[]  DEFAULT NULL,
  p_aesthetic_tags        text[]  DEFAULT NULL,
  p_mood_tags             text[]  DEFAULT NULL,
  p_story_intent_tags     text[]  DEFAULT NULL,
  p_modern_aesthetic_tags text[]  DEFAULT NULL,
  p_story_context_tags    text[]  DEFAULT NULL,
  p_vibe_summary          text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs SET
    language              = COALESCE(p_language,              language),
    popularity_tier       = COALESCE(p_popularity_tier,       popularity_tier),
    genre_tags            = COALESCE(p_genre_tags,            genre_tags),
    aesthetic_tags        = COALESCE(p_aesthetic_tags,        aesthetic_tags),
    mood_tags             = COALESCE(p_mood_tags,             mood_tags),
    story_intent_tags     = COALESCE(p_story_intent_tags,     story_intent_tags),
    modern_aesthetic_tags = COALESCE(p_modern_aesthetic_tags, modern_aesthetic_tags),
    story_context_tags    = COALESCE(p_story_context_tags,    story_context_tags),
    vibe_summary          = COALESCE(p_vibe_summary,          vibe_summary),
    updated_at            = now()
  WHERE id = p_id;
END;
$$;
