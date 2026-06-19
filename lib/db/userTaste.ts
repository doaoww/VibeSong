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
  genres: string[];
  favorite_artists: string[];
  default_mood: string;
  discovery_style: string;
  dislikes: string[];
  language_preference: string;
  energy_preference: string;
  aesthetic_tags: string[];
  setup_complete: boolean;
  emotional_vector: Record<string, number> | null;
  context_vectors: Record<string, Record<string, number>> | null;
}

export async function getUserTaste(userId: string): Promise<UserTaste | null> {
  const { data, error } = await supabase
    .from("user_taste")
    .select(
      "genres, favorite_artists, default_mood, discovery_style, dislikes, language_preference, energy_preference, aesthetic_tags, setup_complete"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as UserTasteRow;
  return normalizeTaste({
    genres: row.genres,
    favoriteArtists: row.favorite_artists,
    defaultMood: row.default_mood,
    discoveryStyle: row.discovery_style,
    dislikes: row.dislikes,
    languagePreference: row.language_preference,
    energyPreference: row.energy_preference,
    aestheticTags: row.aesthetic_tags ?? [],
    setupComplete: row.setup_complete,
  });
}

export async function upsertUserTaste(userId: string, taste: UserTaste): Promise<void> {
  const normalized = normalizeTaste(taste);
  const { error } = await supabase.from("user_taste").upsert({
    user_id: userId,
    genres: normalized.genres,
    favorite_artists: normalized.favoriteArtists,
    default_mood: normalized.defaultMood,
    discovery_style: normalized.discoveryStyle,
    dislikes: normalized.dislikes,
    language_preference: normalized.languagePreference,
    energy_preference: normalized.energyPreference,
    aesthetic_tags: normalized.aestheticTags,
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
