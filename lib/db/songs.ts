import { supabaseCatalog as supabase } from "../supabaseCatalog";
import type { AutoTagResult } from "../autoTag";
import { vectorToArray } from "../vectorMath";

export interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  language: string;
  energy: number;
  popularity_tier: number;
  emotional_vector: number[] | null;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  story_context_tags: string[];
  discarded_tags?: string[];
  confidence_level?: string | null;
  confidence_reason?: string | null;
  gpt_confidence?: number | null;
  source_confidence?: number | null;
  final_confidence: number | null;
  needs_review: boolean;
  evidence_sources?: string[];
  tagging_version?: string;
  vibe_summary?: string | null;
  save_count?: number;
  skip_count?: number;
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

// All write/read operations use RPC functions to bypass PostgREST's inability
// to resolve the pgvector `vector` type in its schema cache.

export async function insertSong(data: AutoTagResult): Promise<{ id: string }> {
  const vectorArray = vectorToArray(data.emotional_vector);
  const vectorString = `[${vectorArray.join(",")}]`;
  const youtubeId = (data as AutoTagResult & { youtube_id?: string | null }).youtube_id ?? null;

  const { data: id, error } = await supabase.rpc("create_song", {
    p_title:                 data.title,
    p_artist:                data.artist,
    p_album:                 data.album ?? null,
    p_year:                  data.year ?? null,
    p_duration_seconds:      data.duration_seconds ?? null,
    p_language:              data.language,
    p_popularity_tier:       data.popularity_tier,
    p_emotional_vector:      vectorString,
    p_energy:                data.energy,
    p_genre_tags:            data.genre_tags,
    p_aesthetic_tags:        data.aesthetic_tags,
    p_mood_tags:             data.mood_tags,
    p_story_intent_tags:     data.story_intent_tags,
    p_modern_aesthetic_tags: data.modern_aesthetic_tags,
    p_itunes_preview_url:    data.itunes_preview_url ?? null,
    p_artwork_url:           data.artwork_url ?? null,
    p_apple_music_url:       data.apple_music_url ?? null,
    p_youtube_id:            youtubeId,
    p_story_context_tags:    data.story_context_tags,
    p_discarded_tags:        data.discarded_tags,
    p_confidence_level:      data.confidence_level,
    p_confidence_reason:     data.confidence_reason,
    p_gpt_confidence:        data.gpt_confidence,
    p_source_confidence:     data.source_confidence,
    p_final_confidence:      data.final_confidence,
    p_needs_review:          data.needs_review,
    p_evidence_sources:      data.evidence_sources,
    p_tagging_version:       data.tagging_version,
    p_vibe_summary:          data.vibe_summary,
  });

  if (error) throw new Error(`insertSong failed: ${error.message}`);
  return { id: id as string };
}

export async function updateSong(id: string, patch: Partial<SongPatch>): Promise<void> {
  const { error } = await supabase.rpc("update_song", {
    p_id:                    id,
    p_language:              patch.language              ?? null,
    p_popularity_tier:       patch.popularity_tier       ?? null,
    p_genre_tags:            patch.genre_tags            ?? null,
    p_aesthetic_tags:        patch.aesthetic_tags        ?? null,
    p_mood_tags:             patch.mood_tags             ?? null,
    p_story_intent_tags:     patch.story_intent_tags     ?? null,
    p_modern_aesthetic_tags: patch.modern_aesthetic_tags ?? null,
  });
  if (error) throw new Error(`updateSong failed: ${error.message}`);
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_song", { p_id: id });
  if (error) throw new Error(`deleteSong failed: ${error.message}`);
}

export async function listSongs(limit = 200, offset = 0): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("list_catalog", {
    p_limit: limit,
    p_offset: offset,
  });
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
  const { error } = await supabase.rpc("record_song_feedback", {
    p_song_id: songId,
    p_action:  action,
  });
  if (error) throw new Error(`recordFeedback failed: ${error.message}`);
}
