import { supabase } from "../supabase";
import { normalizeTaste, type UserTaste } from "../matching";

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
