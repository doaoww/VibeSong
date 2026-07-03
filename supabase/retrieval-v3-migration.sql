-- Retrieval v3: semantic brief layer. Adds music_supervisor_summary/
-- brief_embedding columns, a new match_songs_by_brief RPC (read path - takes
-- a native vector(1536) param, mirroring match_songs's query_vector
-- vector(10)), and extends create_song/update_song to accept the two new
-- fields (write path - text param cast internally, mirroring how
-- p_emotional_vector is already handled).
--
-- Apply this against the SUPABASE_CATALOG_URL project (not the main auth
-- project) via the Supabase SQL editor. Idempotent - safe to re-run.

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS music_supervisor_summary text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS brief_embedding vector(1536);

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
  quality_score float, distance float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score,
    (s.brief_embedding <=> p_brief_vector) AS distance
  FROM public.songs s
  WHERE s.brief_embedding IS NOT NULL
  ORDER BY s.brief_embedding <=> p_brief_vector
  LIMIT p_match_count;
END;
$$;

-- Extend create_song (write path) with the two new fields.
DROP FUNCTION IF EXISTS public.create_song(
  text, text, text, int, int, text, int, text, float8, text[], text[], text[],
  text[], text[], text, text, text, text, text[], text[], text, text, float8,
  float8, float8, boolean, text[], text, text
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
  p_brief_embedding          text    DEFAULT NULL
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
    music_supervisor_summary, brief_embedding, updated_at
  ) VALUES (
    p_title, p_artist, p_album, p_year, p_duration_seconds, p_language, p_popularity_tier,
    p_emotional_vector::vector(10), p_energy,
    p_genre_tags, p_aesthetic_tags, p_mood_tags,
    p_story_intent_tags, p_modern_aesthetic_tags, p_itunes_preview_url, p_artwork_url,
    p_apple_music_url, p_youtube_id,
    p_story_context_tags, p_discarded_tags, p_confidence_level, p_confidence_reason,
    p_gpt_confidence, p_source_confidence, p_final_confidence, p_needs_review,
    p_evidence_sources, p_tagging_version, p_vibe_summary,
    p_music_supervisor_summary, p_brief_embedding::vector(1536), now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Extend update_song (write path) with the two new fields. The 2026-07-03
-- overload collision (a stale 10-param version left over from the v2
-- migration) was already resolved manually before this migration; this
-- extends the single remaining 11-param canonical signature.
DROP FUNCTION IF EXISTS public.update_song(uuid, text, int, text[], text[], text[], text[], text[], text[], text, boolean);

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
  p_brief_embedding          text    DEFAULT NULL
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
    needs_review             = CASE WHEN p_approve THEN false ELSE needs_review END,
    tag_source               = CASE WHEN p_approve THEN 'auto_plus_manual' ELSE tag_source END,
    manual_reviewed_at       = CASE WHEN p_approve THEN now() ELSE manual_reviewed_at END,
    updated_at               = now()
  WHERE id = p_id;
END;
$$;
