import { supabase } from "../supabase";
import type { AutoTagResult } from "../autoTag";
import { vectorToArray } from "../vectorMath";

export interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  language: string;
  energy: number;
  popularity_tier: number;
  emotional_vector: number[];
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  itunes_preview_url: string | null;
  artwork_url: string | null;
  apple_music_url: string | null;
  youtube_id: string | null;
  quality_score: number;
  distance?: number;
}

export interface SongPatch {
  language: string;
  popularity_tier: number;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
}

export async function insertSong(data: AutoTagResult): Promise<{ id: string }> {
  const vectorArray = vectorToArray(data.emotional_vector);

  const { data: row, error } = await supabase
    .from("songs")
    .insert({
      title: data.title,
      artist: data.artist,
      album: data.album,
      year: data.year,
      duration_seconds: data.duration_seconds,
      language: data.language,
      popularity_tier: data.popularity_tier,
      emotional_vector: vectorArray,
      energy: data.energy,
      genre_tags: data.genre_tags,
      aesthetic_tags: data.aesthetic_tags,
      mood_tags: data.mood_tags,
      story_intent_tags: data.story_intent_tags,
      modern_aesthetic_tags: data.modern_aesthetic_tags,
      itunes_preview_url: data.itunes_preview_url,
      artwork_url: data.artwork_url,
      apple_music_url: data.apple_music_url,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertSong failed: ${error.message}`);
  return { id: row.id };
}

export async function updateSong(id: string, patch: Partial<SongPatch>): Promise<void> {
  const { error } = await supabase
    .from("songs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updateSong failed: ${error.message}`);
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await supabase.from("songs").delete().eq("id", id);
  if (error) throw new Error(`deleteSong failed: ${error.message}`);
}

export async function listSongs(limit = 200, offset = 0): Promise<CatalogSong[]> {
  const { data, error } = await supabase
    .from("songs")
    .select(
      "id,title,artist,language,energy,popularity_tier,genre_tags,aesthetic_tags,mood_tags,story_intent_tags,modern_aesthetic_tags,itunes_preview_url,artwork_url,apple_music_url,youtube_id,quality_score"
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`listSongs failed: ${error.message}`);
  return (data ?? []) as CatalogSong[];
}

export async function searchCatalog(
  queryVector: number[],
  matchCount = 50
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs", {
    query_vector: queryVector,
    match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalog failed: ${error.message}`);
  return (data ?? []) as CatalogSong[];
}

export async function recordFeedback(
  songId: string,
  action: "save" | "skip" | "perfect"
): Promise<void> {
  const { data: song, error: fetchErr } = await supabase
    .from("songs")
    .select("save_count,skip_count,perfect_count")
    .eq("id", songId)
    .single();

  if (fetchErr || !song) return;

  const saveDelta    = action === "save" || action === "perfect" ? 1 : 0;
  const skipDelta    = action === "skip" ? 1 : 0;
  const perfectDelta = action === "perfect" ? 1 : 0;

  const newSave    = song.save_count    + saveDelta;
  const newSkip    = song.skip_count    + skipDelta;
  const newPerfect = song.perfect_count + perfectDelta;
  const total      = newSave + newSkip;
  const quality_score = total === 0 ? 0.5 : newSave / total;

  await supabase
    .from("songs")
    .update({
      save_count: newSave,
      skip_count: newSkip,
      perfect_count: newPerfect,
      quality_score,
    })
    .eq("id", songId);
}
