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
