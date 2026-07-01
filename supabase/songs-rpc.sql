-- RPC functions to bypass PostgREST schema cache issues with the vector type.
-- PostgREST cannot resolve the pgvector `vector` type from the extensions schema,
-- so all direct .from("songs") calls fail. These functions run in SQL directly.

-- List songs (no vector column — PostgREST can serialize these types fine)
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
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,
  quality_score         float8,
  created_at            timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, title, artist, language, energy, popularity_tier,
    genre_tags, aesthetic_tags, mood_tags, story_intent_tags, modern_aesthetic_tags,
    itunes_preview_url, artwork_url, apple_music_url, youtube_id, quality_score, created_at
  FROM public.songs
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Insert a song (vector passed as text '[0.1,0.2,...]', cast to vector(10) in SQL)
CREATE OR REPLACE FUNCTION public.create_song(
  p_title                text,
  p_artist               text,
  p_album                text,
  p_year                 int,
  p_duration_seconds     int,
  p_language             text,
  p_popularity_tier      int,
  p_emotional_vector     text,
  p_energy               float8,
  p_genre_tags           text[],
  p_aesthetic_tags       text[],
  p_mood_tags            text[],
  p_story_intent_tags    text[],
  p_modern_aesthetic_tags text[],
  p_itunes_preview_url   text,
  p_artwork_url          text,
  p_apple_music_url      text,
  p_youtube_id           text
)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.songs (
    title, artist, album, year, duration_seconds, language, popularity_tier,
    emotional_vector, energy, genre_tags, aesthetic_tags, mood_tags,
    story_intent_tags, modern_aesthetic_tags, itunes_preview_url, artwork_url,
    apple_music_url, youtube_id, updated_at
  ) VALUES (
    p_title, p_artist, p_album, p_year, p_duration_seconds, p_language, p_popularity_tier,
    p_emotional_vector::vector(10), p_energy,
    p_genre_tags, p_aesthetic_tags, p_mood_tags,
    p_story_intent_tags, p_modern_aesthetic_tags,
    p_itunes_preview_url, p_artwork_url, p_apple_music_url, p_youtube_id,
    now()
  ) RETURNING id;
$$;

-- Update song metadata
CREATE OR REPLACE FUNCTION public.update_song(
  p_id                   uuid,
  p_language             text    DEFAULT NULL,
  p_popularity_tier      int     DEFAULT NULL,
  p_genre_tags           text[]  DEFAULT NULL,
  p_aesthetic_tags       text[]  DEFAULT NULL,
  p_mood_tags            text[]  DEFAULT NULL,
  p_story_intent_tags    text[]  DEFAULT NULL,
  p_modern_aesthetic_tags text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs SET
    language             = COALESCE(p_language,              language),
    popularity_tier      = COALESCE(p_popularity_tier,       popularity_tier),
    genre_tags           = COALESCE(p_genre_tags,            genre_tags),
    aesthetic_tags       = COALESCE(p_aesthetic_tags,        aesthetic_tags),
    mood_tags            = COALESCE(p_mood_tags,             mood_tags),
    story_intent_tags    = COALESCE(p_story_intent_tags,     story_intent_tags),
    modern_aesthetic_tags = COALESCE(p_modern_aesthetic_tags, modern_aesthetic_tags),
    updated_at           = now()
  WHERE id = p_id;
END;
$$;

-- Delete a song
CREATE OR REPLACE FUNCTION public.delete_song(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.songs WHERE id = p_id;
$$;

-- Record feedback and update quality_score
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
    quality_score = CASE WHEN v_total = 0 THEN 0.5 ELSE v_save::float8 / v_total END
  WHERE id = p_song_id;
END;
$$;

-- Lightweight text search for onboarding's "recently posted story songs" autocomplete.
CREATE OR REPLACE FUNCTION public.search_catalog(
  p_query text,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id     uuid,
  title  text,
  artist text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, title, artist
  FROM public.songs
  WHERE title ILIKE '%' || p_query || '%' OR artist ILIKE '%' || p_query || '%'
  ORDER BY popularity_tier DESC, created_at DESC
  LIMIT p_limit;
$$;
