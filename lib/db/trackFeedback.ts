import { supabase } from "../supabase";

export type FeedbackAction = "saved" | "skipped";

export interface FeedbackTrack {
  title: string;
  artist: string;
  reason?: string;
  matchScore?: number;
  genres?: string[];
  artwork?: string;
  thumbnail?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
  youtubeId?: string;
  previewUrl?: string;
  previewProvider?: "itunes" | "youtube";
  sourceImage?: string;
}

export interface FeedbackRow extends FeedbackTrack {
  createdAt: string;
}

interface FeedbackRowRaw {
  title: string;
  artist: string;
  reason: string | null;
  match_score: number | null;
  genres: string[] | null;
  artwork: string | null;
  thumbnail: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  preview_url: string | null;
  preview_provider: "itunes" | "youtube" | null;
  source_image: string | null;
  created_at: string;
}

function mapRow(row: FeedbackRowRaw): FeedbackRow {
  return {
    title: row.title,
    artist: row.artist,
    reason: row.reason ?? undefined,
    matchScore: row.match_score ?? undefined,
    genres: row.genres ?? [],
    artwork: row.artwork ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    youtubeId: row.youtube_id ?? undefined,
    previewUrl: row.preview_url ?? undefined,
    previewProvider: row.preview_provider ?? undefined,
    sourceImage: row.source_image ?? undefined,
    createdAt: row.created_at,
  };
}

export async function insertFeedback(
  userId: string,
  action: FeedbackAction,
  track: FeedbackTrack
): Promise<void> {
  const { error } = await supabase.from("track_feedback").insert({
    user_id: userId,
    action,
    title: track.title,
    artist: track.artist,
    reason: track.reason ?? null,
    match_score: track.matchScore ?? null,
    genres: track.genres ?? [],
    artwork: track.artwork ?? null,
    thumbnail: track.thumbnail ?? null,
    apple_music_url: track.appleMusicUrl ?? null,
    youtube_url: track.youtubeUrl ?? null,
    youtube_id: track.youtubeId ?? null,
    preview_url: track.previewUrl ?? null,
    preview_provider: track.previewProvider ?? null,
    source_image: track.sourceImage ?? null,
  });
  if (error) throw error;
}

const SELECT_COLUMNS =
  "title, artist, reason, match_score, genres, artwork, thumbnail, apple_music_url, youtube_url, youtube_id, preview_url, preview_provider, source_image, created_at";

export async function getFeedback(
  userId: string,
  action: FeedbackAction,
  limit = 200
): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from("track_feedback")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as FeedbackRowRaw[]).map(mapRow);
}
