-- update_song currently has one asymmetric write path for needs_review:
-- p_approve can only ever CLEAR it (see the "Approve" button in /admin).
-- There was no way to explicitly SET it on an already-inserted row, which is
-- exactly what lib/autoTag.ts's new hasVersionMarkerQualifier() check needs
-- for the 12 existing catalog songs it would have caught if it had existed
-- at insertion time (live/instrumental/karaoke/tribute recordings currently
-- sitting at needs_review=false). Adds a symmetric p_flag_for_review boolean
-- action flag, mirroring p_approve's shape exactly.
--
-- DROP matches the 15-param signature live after song-generation-migration.sql
-- (...p_lyrical_address text, p_song_generation text).
DROP FUNCTION IF EXISTS public.update_song(uuid, text, int, text[], text[], text[], text[], text[], text[], text, boolean, text, text, text, text);

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
  p_lyrical_address          text    DEFAULT NULL,
  p_song_generation          text    DEFAULT NULL,
  p_flag_for_review          boolean DEFAULT false
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
    song_generation           = COALESCE(p_song_generation,          song_generation),
    -- p_approve and p_flag_for_review are mutually exclusive action flags from
    -- the client; if both were somehow true, approve wins (matches the intent
    -- of an explicit human sign-off outweighing an automated flag).
    needs_review              = CASE
                                   WHEN p_approve THEN false
                                   WHEN p_flag_for_review THEN true
                                   ELSE needs_review
                                 END,
    tag_source                = CASE WHEN p_approve THEN 'auto_plus_manual' ELSE tag_source END,
    manual_reviewed_at        = CASE WHEN p_approve THEN now() ELSE manual_reviewed_at END,
    updated_at                = now()
  WHERE id = p_id;
END;
$$;
