import { supabase } from "../supabase";
import { normalizeTaste, type UserTaste } from "../matching";
import { type EmotionalVector, VECTOR_KEYS, ZERO_VECTOR } from "../emotionalVector";

export type MomentType =
  | "reflective-solo"
  | "social"
  | "nature-escape"
  | "urban"
  | "romance"
  | "high-energy"
  | "unknown";

interface UserTasteRow {
  favorite_artists: string[];
  default_mood: string;
  discovery_style: string;
  languages: string[];
  language_openness: string;
  energy_preference: string;
  aesthetic_tags: string[];
  genre_scores: Record<string, number> | null;
  avoided_story_tags: string[];
  favorite_story_songs: string[];
  setup_complete: boolean;
}

const TASTE_COLUMNS =
  "favorite_artists, default_mood, discovery_style, languages, language_openness, " +
  "energy_preference, aesthetic_tags, genre_scores, avoided_story_tags, " +
  "favorite_story_songs, setup_complete";

export async function getUserTaste(userId: string): Promise<UserTaste | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select(TASTE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as UserTasteRow;
  return normalizeTaste({
    favoriteArtists: row.favorite_artists,
    defaultMood: row.default_mood,
    discoveryStyle: row.discovery_style,
    languages: row.languages,
    languageOpenness: row.language_openness,
    energyPreference: row.energy_preference,
    aestheticTags: row.aesthetic_tags ?? [],
    genreScores: row.genre_scores ?? {},
    avoidedStoryTags: row.avoided_story_tags ?? [],
    favoriteStorySongs: row.favorite_story_songs ?? [],
    setupComplete: row.setup_complete,
  });
}

export async function upsertUserTaste(userId: string, taste: UserTaste): Promise<void> {
  const normalized = normalizeTaste(taste);
  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    favorite_artists: normalized.favoriteArtists,
    default_mood: normalized.defaultMood,
    discovery_style: normalized.discoveryStyle,
    languages: normalized.languages,
    language_openness: normalized.languageOpenness,
    energy_preference: normalized.energyPreference,
    aesthetic_tags: normalized.aestheticTags,
    genre_scores: normalized.genreScores,
    avoided_story_tags: normalized.avoidedStoryTags,
    favorite_story_songs: normalized.favoriteStorySongs,
    setup_complete: normalized.setupComplete,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getEmotionalVector(userId: string): Promise<EmotionalVector | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select("emotional_vector")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.emotional_vector) return null;
  const raw = data.emotional_vector as Record<string, number>;
  const vec = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    if (typeof raw[key] === "number") vec[key] = raw[key];
  }
  return vec;
}

export async function upsertEmotionalVector(
  userId: string,
  vector: EmotionalVector
): Promise<void> {
  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    emotional_vector: vector,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Durable, per-account counterpart to lib/recentlyShownSongs.ts's client-side
// localStorage log. That client-side log alone (capped at 60 = 5 requests
// worth) is the only thing standing between a testing/usage session and
// literal repeats: track_feedback only records songs the user explicitly
// saved or skipped, never ones just shown and glanced past, and a real check
// against this account found only 40 total saved+skipped rows across 5 days
// of heavy testing — the vast majority of what was actually shown lives only
// in whichever single browser tab happened to show it. Once a session goes
// past ~5 uploads (very normal for either real usage or QA), or the user
// switches device/browser/private-window, the client-side FIFO window
// evicts/loses songs that are still fresh to the user, and they can resurface.
// This column persists a much longer rolling window server-side so the block
// survives across devices and beyond 5 requests. See
// supabase/recently-shown-songs-migration.sql.
const RECENTLY_SHOWN_CAP = 150;

export async function getRecentlyShownSongIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_taste")
    .select("recently_shown_song_ids")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const ids = data?.recently_shown_song_ids as string[] | null | undefined;
  return Array.isArray(ids) ? ids : [];
}

/** Prepends newIds (most-recent-first, deduped) and truncates to RECENTLY_SHOWN_CAP. */
export async function appendRecentlyShownSongIds(userId: string, newIds: string[]): Promise<void> {
  if (newIds.length === 0) return;
  const existing = await getRecentlyShownSongIds(userId);
  const merged = [...newIds, ...existing.filter((id) => !newIds.includes(id))].slice(0, RECENTLY_SHOWN_CAP);
  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    recently_shown_song_ids: merged,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Explicit "always show this song" override — see
// supabase/pinned-songs-migration.sql for why this is deliberately separate
// from favorite_story_songs (which is intentionally rotated/capped, not
// guaranteed). Missing column (migration not yet run) degrades to [].
export async function getPinnedSongIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_taste")
    .select("pinned_song_ids")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const ids = data?.pinned_song_ids as string[] | null | undefined;
  return Array.isArray(ids) ? ids : [];
}

export async function getContextVector(
  userId: string,
  momentType: MomentType
): Promise<EmotionalVector | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select("context_vectors")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const contextVectors = data?.context_vectors as Record<string, Record<string, number>> | null;
  const raw = contextVectors?.[momentType];
  if (!raw) return null;
  const vec = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    if (typeof raw[key] === "number") vec[key] = raw[key];
  }
  return vec;
}

export async function getAllContextVectors(
  userId: string
): Promise<Record<string, Record<string, number>> | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select("context_vectors")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.context_vectors as Record<string, Record<string, number>>) ?? null;
}

export async function upsertContextVector(
  userId: string,
  momentType: MomentType,
  vector: EmotionalVector
): Promise<void> {
  const { data } = await supabase
    .from("user_taste")
    .select("context_vectors")
    .eq("user_id", userId)
    .maybeSingle();

  const existing = (data?.context_vectors as Record<string, unknown>) ?? {};
  const updated = { ...existing, [momentType]: vector };

  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    context_vectors: updated,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
