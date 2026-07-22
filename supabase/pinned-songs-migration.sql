-- Adds an explicit "pin this song" override, separate from
-- favorite_story_songs. Favorites are deliberately *not* guaranteed
-- (capFavoriteSongs + sampleFavoriteSongIds in lib/recommend.ts /
-- app/api/recommend/route.ts intentionally rotate/cap them so no single
-- favorite dominates every request — that was the fix for the earlier
-- "pocket locket"/"The King" always-appearing bug). pinned_song_ids is the
-- opposite, narrow, explicit mechanism: a song listed here always survives
-- into the final response (if it passes the normal hard filters — language,
-- energy, hard anti-tags, etc. — it is not exempt from those), bypassing
-- score-based competition and the favorites cap/rotation entirely.
--
-- Run in the Supabase SQL editor for the MAIN project (public.user_taste,
-- not the catalog project).

ALTER TABLE public.user_taste
  ADD COLUMN IF NOT EXISTS pinned_song_ids text[] NOT NULL DEFAULT '{}';
