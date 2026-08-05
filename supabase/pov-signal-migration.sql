-- POV signal: adds a nullable lyrical_address column to songs (NULL = not
-- yet classified, distinct from an explicit 'unclear' GPT read — the
-- backfill script queries WHERE lyrical_address IS NULL) and threads it
-- through every RPC that returns song rows to application scoring code,
-- plus the two write RPCs. No CHECK constraint: validation happens
-- application-side via lib/tagTaxonomy.ts's coercePovSignal, matching this
-- codebase's existing convention for other enum-like text columns
-- (confidence_level, tag_source) which also have no DB-level CHECK.
--
-- Apply this against the SUPABASE_CATALOG_URL project (not the main auth
-- project) via the Supabase SQL editor. Idempotent — safe to re-run.

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrical_address text;

-- 1. match_songs (vector-nearest pool)
DROP FUNCTION IF EXISTS public.match_songs(vector, integer);

CREATE OR REPLACE FUNCTION public.match_songs(
  query_vector  vector(10),
  match_count   int DEFAULT 50
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
  lyrical_address        text,
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
    s.final_confidence, s.needs_review, s.tag_source, s.itunes_preview_url,
    s.artwork_url, s.apple_music_url, s.youtube_id, s.quality_score,
    s.lyrical_address,
    (s.emotional_vector <=> query_vector)::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
  ORDER BY s.emotional_vector <=> query_vector
  LIMIT match_count;
END;
$$;

-- 2. match_songs_by_tags (tag pool)
DROP FUNCTION IF EXISTS public.match_songs_by_tags(text[], text[], text[], text[], int);

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
  lyrical_address        text,
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
    s.apple_music_url, s.youtube_id, s.quality_score, s.lyrical_address,
    NULL::float AS distance
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

-- 3. match_songs_by_taste (artist/genre pool)
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
  lyrical_address        text,
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
    s.apple_music_url, s.youtube_id, s.quality_score, s.lyrical_address,
    NULL::float AS distance
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

-- 4. match_songs_by_language (language pool)
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
  lyrical_address        text,
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
    f.id, f.title, f.artist, f.language, f.energy, f.popularity_tier,
    f.emotional_vector, f.genre_tags, f.aesthetic_tags, f.mood_tags,
    f.story_intent_tags, f.modern_aesthetic_tags, f.story_context_tags,
    f.final_confidence, f.needs_review, f.tag_source, f.itunes_preview_url,
    f.artwork_url, f.apple_music_url, f.youtube_id, f.quality_score,
    f.lyrical_address,
    (f.emotional_vector <=> query_vector)::float AS distance
  FROM filtered f
  ORDER BY f.emotional_vector <=> query_vector
  LIMIT p_match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_songs_by_language(text[], vector, integer) TO service_role;

-- 5. match_songs_by_brief (semantic brief pool)
DROP FUNCTION IF EXISTS public.match_songs_by_brief(vector(1536), int);

CREATE OR REPLACE FUNCTION public.match_songs_by_brief(
  p_brief_vector vector(1536),
  p_match_count  int DEFAULT 25
)
RETURNS TABLE (
  id uuid, title text, artist text, language text, energy float,
  popularity_tier int, emotional_vector vector(10), genre_tags text[],
  aesthetic_tags text[], mood_tags text[], story_intent_tags text[],
  modern_aesthetic_tags text[], story_context_tags text[],
  final_confidence float, needs_review boolean, itunes_preview_url text,
  artwork_url text, apple_music_url text, youtube_id text,
  quality_score float, lyrical_address text, brief_embedding vector(1536), distance float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score, s.lyrical_address,
    s.brief_embedding,
    (s.brief_embedding <=> p_brief_vector) AS distance
  FROM public.songs s
  WHERE s.brief_embedding IS NOT NULL
  ORDER BY s.brief_embedding <=> p_brief_vector
  LIMIT p_match_count;
END;
$$;

-- 6. get_songs_by_ids (favorites/pinned pool)
DROP FUNCTION IF EXISTS public.get_songs_by_ids(uuid[]);

CREATE OR REPLACE FUNCTION public.get_songs_by_ids(
  p_song_ids uuid[]
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
  lyrical_address        text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.tag_source, s.itunes_preview_url,
    s.artwork_url, s.apple_music_url, s.youtube_id, s.quality_score,
    s.lyrical_address
  FROM public.songs s
  WHERE s.id = ANY(p_song_ids);
END;
$$;

-- 7. create_song (write path — new songs from autoTagSong)
DROP FUNCTION IF EXISTS public.create_song(
  text, text, text, int, int, text, int, text, float8, text[], text[], text[],
  text[], text[], text, text, text, text, text[], text[], text, text, float8,
  float8, float8, boolean, text[], text, text, text
);

CREATE OR REPLACE FUNCTION public.create_song(
  p_title                    text,
  p_artist                   text,
  p_album                    text,
  p_year                     int,
  p_duration_seconds         int,
  p_language                 text,
  p_popularity_tier          int,
  p_emotional_vector         text,
  p_energy                   float8,
  p_genre_tags               text[],
  p_aesthetic_tags           text[],
  p_mood_tags                text[],
  p_story_intent_tags        text[],
  p_modern_aesthetic_tags    text[],
  p_itunes_preview_url       text,
  p_artwork_url              text,
  p_apple_music_url          text,
  p_youtube_id               text,
  p_story_context_tags       text[]  DEFAULT '{}',
  p_discarded_tags           text[]  DEFAULT '{}',
  p_confidence_level         text    DEFAULT NULL,
  p_confidence_reason        text    DEFAULT NULL,
  p_gpt_confidence           float8  DEFAULT NULL,
  p_source_confidence        float8  DEFAULT NULL,
  p_final_confidence         float8  DEFAULT NULL,
  p_needs_review             boolean DEFAULT false,
  p_evidence_sources         text[]  DEFAULT '{}',
  p_tagging_version          text    DEFAULT 'v1',
  p_vibe_summary             text    DEFAULT NULL,
  p_music_supervisor_summary text    DEFAULT NULL,
  p_brief_embedding          text    DEFAULT NULL,
  p_lyrical_address          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.songs (
    title, artist, album, year, duration_seconds, language, popularity_tier,
    emotional_vector, energy, genre_tags, aesthetic_tags, mood_tags,
    story_intent_tags, modern_aesthetic_tags, itunes_preview_url, artwork_url,
    apple_music_url, youtube_id,
    story_context_tags, discarded_tags, confidence_level, confidence_reason,
    gpt_confidence, source_confidence, final_confidence, needs_review,
    evidence_sources, tagging_version, vibe_summary,
    music_supervisor_summary, brief_embedding, lyrical_address, updated_at
  ) VALUES (
    p_title, p_artist, p_album, p_year, p_duration_seconds, p_language, p_popularity_tier,
    p_emotional_vector::vector(10), p_energy,
    p_genre_tags, p_aesthetic_tags, p_mood_tags,
    p_story_intent_tags, p_modern_aesthetic_tags, p_itunes_preview_url, p_artwork_url,
    p_apple_music_url, p_youtube_id,
    p_story_context_tags, p_discarded_tags, p_confidence_level, p_confidence_reason,
    p_gpt_confidence, p_source_confidence, p_final_confidence, p_needs_review,
    p_evidence_sources, p_tagging_version, p_vibe_summary,
    p_music_supervisor_summary, p_brief_embedding::vector(1536), p_lyrical_address, now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 8. update_song (write path — admin edits + backfill script)
DROP FUNCTION IF EXISTS public.update_song(uuid, text, int, text[], text[], text[], text[], text[], text[], text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.update_song(
  p_id                       uuid,
  p_language                 text    DEFAULT NULL,
  p_popularity_tier          int     DEFAULT NULL,
  p_genre_tags               text[]  DEFAULT NULL,
  p_aesthetic_tags           text[]  DEFAULT NULL,
  p_mood_tags                text[]  DEFAULT NULL,
  p_story_intent_tags        text[]  DEFAULT NULL,
  p_modern_aesthetic_tags    text[]  DEFAULT NULL,
  p_story_context_tags       text[]  DEFAULT NULL,
  p_vibe_summary             text    DEFAULT NULL,
  p_approve                  boolean DEFAULT false,
  p_music_supervisor_summary text    DEFAULT NULL,
  p_brief_embedding          text    DEFAULT NULL,
  p_lyrical_address          text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs SET
    language                 = COALESCE(p_language,                 language),
    popularity_tier          = COALESCE(p_popularity_tier,          popularity_tier),
    genre_tags               = COALESCE(p_genre_tags,               genre_tags),
    aesthetic_tags           = COALESCE(p_aesthetic_tags,           aesthetic_tags),
    mood_tags                = COALESCE(p_mood_tags,                mood_tags),
    story_intent_tags        = COALESCE(p_story_intent_tags,        story_intent_tags),
    modern_aesthetic_tags    = COALESCE(p_modern_aesthetic_tags,    modern_aesthetic_tags),
    story_context_tags       = COALESCE(p_story_context_tags,       story_context_tags),
    vibe_summary             = COALESCE(p_vibe_summary,             vibe_summary),
    music_supervisor_summary = COALESCE(p_music_supervisor_summary, music_supervisor_summary),
    brief_embedding          = COALESCE(p_brief_embedding::vector(1536), brief_embedding),
    lyrical_address           = COALESCE(p_lyrical_address,          lyrical_address),
    needs_review             = CASE WHEN p_approve THEN false ELSE needs_review END,
    tag_source               = CASE WHEN p_approve THEN 'auto_plus_manual' ELSE tag_source END,
    manual_reviewed_at       = CASE WHEN p_approve THEN now() ELSE manual_reviewed_at END,
    updated_at               = now()
  WHERE id = p_id;
END;
$$;

-- 9. list_catalog (admin listing — Task 8 fix)
-- Extend list_catalog with lyrical_address: the backfill script filters on this field via
-- GET /api/admin/songs → listSongs(), which calls this RPC. Without this addition it never
-- sees a real value and treats every song as unclassified on every run, breaking idempotency.
DROP FUNCTION IF EXISTS public.list_catalog(int, int);

CREATE OR REPLACE FUNCTION public.list_catalog(
  p_limit  int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  title                 text,
  artist                text,
  language              text,
  energy                float8,
  popularity_tier       int4,
  genre_tags            text[],
  aesthetic_tags        text[],
  mood_tags             text[],
  story_intent_tags     text[],
  modern_aesthetic_tags text[],
  story_context_tags    text[],
  discarded_tags        text[],
  confidence_level      text,
  confidence_reason     text,
  gpt_confidence        float8,
  source_confidence     float8,
  final_confidence      float8,
  needs_review          boolean,
  evidence_sources      text[],
  tagging_version       text,
  vibe_summary          text,
  tag_source            text,
  manual_reviewed_at    timestamptz,
  save_count            int4,
  skip_count            int4,
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float8,
  lyrical_address       text,
  created_at            timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, title, artist, language, energy, popularity_tier,
    genre_tags, aesthetic_tags, mood_tags, story_intent_tags, modern_aesthetic_tags,
    story_context_tags, discarded_tags, confidence_level, confidence_reason,
    gpt_confidence, source_confidence, final_confidence, needs_review, evidence_sources,
    tagging_version, vibe_summary, tag_source, manual_reviewed_at, save_count, skip_count,
    itunes_preview_url, artwork_url, apple_music_url, youtube_id, quality_score,
    lyrical_address, created_at
  FROM public.songs
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
