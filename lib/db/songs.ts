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
  music_supervisor_summary?: string | null;
  brief_embedding?: number[] | null;
  tag_source?: string;
  manual_reviewed_at?: string | null;
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
  story_context_tags?: string[];
  vibe_summary?: string;
  music_supervisor_summary?: string;
  brief_embedding?: number[];
  /** Action flag, not a field mirror — see update_song's p_approve in songs-rpc.sql. */
  approve?: boolean;
}

// All write/read operations use RPC functions to bypass PostgREST's inability
// to resolve the pgvector `vector` type in its schema cache.

/**
 * PostgREST has no native JSON mapping for the pgvector `vector` type, so it
 * serializes it as its Postgres text output format ("[0.1,0.2,...]") inside
 * the JSON response body — a string, not a JSON array. Every RPC returning
 * emotional_vector/brief_embedding must run its rows through this before the
 * values reach cosine() or anything else expecting number[]: an unparsed
 * vector string silently produces NaN there (each character like "[" or "."
 * coerces to NaN under numeric multiplication, and NaN propagates through
 * the entire score sum without throwing).
 */
function parsePgVector(value: unknown): number[] | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value as number[];
  if (typeof value !== "string" || value.length === 0) return null;
  const inner = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  if (!inner) return [];
  return inner.split(",").map(Number);
}

function normalizeSong(row: CatalogSong): CatalogSong {
  return {
    ...row,
    emotional_vector: parsePgVector(row.emotional_vector),
    ...(row.brief_embedding !== undefined ? { brief_embedding: parsePgVector(row.brief_embedding) } : {}),
  };
}

function normalizeSongs(rows: CatalogSong[]): CatalogSong[] {
  return rows.map(normalizeSong);
}

export class DuplicateSongError extends Error {}

export async function findSongByTitleArtist(
  title: string,
  artist: string
): Promise<{ id: string; title: string; artist: string } | null> {
  const { data, error } = await supabase.rpc("find_song_by_title_artist", {
    p_title: title,
    p_artist: artist,
  });
  if (error) throw new Error(`findSongByTitleArtist failed: ${error.message}`);
  const rows = (data ?? []) as { id: string; title: string; artist: string }[];
  return rows[0] ?? null;
}

export async function insertSong(data: AutoTagResult): Promise<{ id: string }> {
  const vectorArray = vectorToArray(data.emotional_vector);
  const vectorString = `[${vectorArray.join(",")}]`;
  const youtubeId = (data as AutoTagResult & { youtube_id?: string | null }).youtube_id ?? null;
  const briefEmbeddingString = data.brief_embedding && data.brief_embedding.length
    ? `[${data.brief_embedding.join(",")}]`
    : null;

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
    p_music_supervisor_summary: data.music_supervisor_summary ?? null,
    p_brief_embedding:          briefEmbeddingString,
  });

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateSongError(`"${data.title}" by "${data.artist}" is already in the catalog`);
    }
    throw new Error(`insertSong failed: ${error.message}`);
  }
  return { id: id as string };
}

export async function updateSong(id: string, patch: Partial<SongPatch>): Promise<void> {
  const briefEmbeddingString = patch.brief_embedding && patch.brief_embedding.length
    ? `[${patch.brief_embedding.join(",")}]`
    : null;
  const { error } = await supabase.rpc("update_song", {
    p_id:                    id,
    p_language:              patch.language              ?? null,
    p_popularity_tier:       patch.popularity_tier       ?? null,
    p_genre_tags:            patch.genre_tags            ?? null,
    p_aesthetic_tags:        patch.aesthetic_tags        ?? null,
    p_mood_tags:             patch.mood_tags             ?? null,
    p_story_intent_tags:     patch.story_intent_tags     ?? null,
    p_modern_aesthetic_tags: patch.modern_aesthetic_tags ?? null,
    p_story_context_tags:    patch.story_context_tags    ?? null,
    p_vibe_summary:          patch.vibe_summary          ?? null,
    p_approve:               patch.approve                ?? false,
    p_music_supervisor_summary: patch.music_supervisor_summary ?? null,
    p_brief_embedding:          briefEmbeddingString,
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
  return normalizeSongs((data ?? []) as CatalogSong[]);
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
  return normalizeSongs((data ?? []) as CatalogSong[]);
}

export interface TagPoolArgs {
  contextTags?: string[];
  intentTags?: string[];
  aestheticTags?: string[];
  moodTags?: string[];
}

export async function searchCatalogByTags(
  args: TagPoolArgs,
  matchCount = 25
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs_by_tags", {
    p_context_tags: args.contextTags ?? [],
    p_intent_tags: args.intentTags ?? [],
    p_aesthetic_tags: args.aestheticTags ?? [],
    p_mood_tags: args.moodTags ?? [],
    p_match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalogByTags failed: ${error.message}`);
  return normalizeSongs((data ?? []) as CatalogSong[]);
}

export interface TastePoolArgs {
  artistPatterns?: string[];
  positiveGenres?: string[];
}

export async function searchCatalogByTaste(
  args: TastePoolArgs,
  matchCount = 20
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs_by_taste", {
    p_artist_patterns: args.artistPatterns ?? [],
    p_positive_genres: args.positiveGenres ?? [],
    p_match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalogByTaste failed: ${error.message}`);
  return normalizeSongs((data ?? []) as CatalogSong[]);
}

export async function searchCatalogByBrief(
  embedding: number[],
  matchCount = 25
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs_by_brief", {
    p_brief_vector: embedding,
    p_match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalogByBrief failed: ${error.message}`);
  return normalizeSongs((data ?? []) as CatalogSong[]);
}

export async function searchCatalogByLanguage(
  languages: string[],
  queryVector: number[],
  matchCount = 25
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs_by_language", {
    p_languages: languages,
    query_vector: queryVector,
    p_match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalogByLanguage failed: ${error.message}`);
  return normalizeSongs((data ?? []) as CatalogSong[]);
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
