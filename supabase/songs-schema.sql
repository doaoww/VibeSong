-- Enable pgvector extension in the "extensions" schema, not "public".
-- Installing it in public exposes pgvector's internal functions (vector_in,
-- vector_out, etc. — some with `internal`/`cstring` param types) to PostgREST's
-- schema-cache introspection, which can fail the *entire* cache build with
-- "Could not query the database for the schema cache" (PGRST002).
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

-- Songs catalog table
CREATE TABLE IF NOT EXISTS public.songs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  artist                text NOT NULL,
  album                 text,
  year                  int,
  duration_seconds      int,
  language              text NOT NULL DEFAULT 'English',
  popularity_tier       int NOT NULL DEFAULT 3 CHECK (popularity_tier BETWEEN 1 AND 5),

  -- 10-dimension emotional vector: [dreamy, nostalgia, energy, cinematic, darkness, confidence, intimacy, danceability, electronic, acoustic]
  emotional_vector      vector(10),

  -- energy extracted separately for SQL filtering in rules layer
  energy                float NOT NULL DEFAULT 0.5,

  -- Tag arrays
  genre_tags            text[] NOT NULL DEFAULT '{}',
  aesthetic_tags        text[] NOT NULL DEFAULT '{}',
  mood_tags             text[] NOT NULL DEFAULT '{}',
  story_intent_tags     text[] NOT NULL DEFAULT '{}',
  modern_aesthetic_tags text[] NOT NULL DEFAULT '{}',
  story_context_tags    text[] NOT NULL DEFAULT '{}',

  -- Auto-tagging reliability metadata
  discarded_tags        text[] NOT NULL DEFAULT '{}',
  confidence_level      text,
  confidence_reason     text,
  gpt_confidence        float,
  source_confidence     float,
  final_confidence      float,
  needs_review          boolean NOT NULL DEFAULT false,
  evidence_sources      text[] NOT NULL DEFAULT '{}',
  tagging_version       text NOT NULL DEFAULT 'v1',
  vibe_summary          text,

  -- Playback URLs
  itunes_preview_url    text,
  artwork_url           text,
  apple_music_url       text,
  youtube_id            text,

  -- Quality metrics updated by user feedback
  save_count            int NOT NULL DEFAULT 0,
  skip_count            int NOT NULL DEFAULT 0,
  perfect_count         int NOT NULL DEFAULT 0,
  quality_score         float NOT NULL DEFAULT 0.5,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- HNSW index for cosine similarity search (pgvector)
-- Works on empty tables; better recall than IVFFlat for small catalogs
CREATE INDEX IF NOT EXISTS songs_emotional_vector_idx
  ON public.songs
  USING hnsw (emotional_vector vector_cosine_ops);

-- Enable RLS (admin API routes use service role key, so they bypass RLS)
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read songs (needed for recommend API which uses anon key in some paths)
DROP POLICY IF EXISTS "songs_read_all" ON public.songs;
CREATE POLICY "songs_read_all" ON public.songs FOR SELECT USING (true);

-- Add new columns to the songs table (idempotent — safe to run on existing tables)
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS story_context_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discarded_tags     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confidence_level    text,
  ADD COLUMN IF NOT EXISTS confidence_reason   text,
  ADD COLUMN IF NOT EXISTS gpt_confidence      float,
  ADD COLUMN IF NOT EXISTS source_confidence   float,
  ADD COLUMN IF NOT EXISTS final_confidence    float,
  ADD COLUMN IF NOT EXISTS needs_review        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence_sources    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tagging_version     text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS vibe_summary        text;

-- RPC function for pgvector similarity search
-- Returns top match_count songs sorted by cosine distance to query_vector
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
    s.id,
    s.title,
    s.artist,
    s.language,
    s.energy,
    s.popularity_tier,
    s.emotional_vector,
    s.genre_tags,
    s.aesthetic_tags,
    s.mood_tags,
    s.story_intent_tags,
    s.modern_aesthetic_tags,
    s.story_context_tags,
    s.final_confidence,
    s.needs_review,
    s.itunes_preview_url,
    s.artwork_url,
    s.apple_music_url,
    s.youtube_id,
    s.quality_score,
    (s.emotional_vector <=> query_vector)::float AS distance
  FROM public.songs s
  WHERE s.emotional_vector IS NOT NULL
  ORDER BY s.emotional_vector <=> query_vector
  LIMIT match_count;
END;
$$;
