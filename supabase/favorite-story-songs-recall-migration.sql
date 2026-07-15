-- RPC to fetch specific songs by id, so a user's own favorite/imported songs
-- (taste.favoriteStorySongs, written by lib/taste/importSongs.ts and the
-- manual story-songs onboarding step) can be pulled back into the
-- recommendation candidate pool alongside the existing similarity/tag/taste
-- pools, instead of just sitting unused in the taste profile.
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
  quality_score         float
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
    s.tag_source,
    s.itunes_preview_url,
    s.artwork_url,
    s.apple_music_url,
    s.youtube_id,
    s.quality_score
  FROM public.songs s
  WHERE s.id = ANY(p_song_ids);
END;
$$;
