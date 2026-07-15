import { autoTagSong } from "../autoTag";
import type { AutoTagResult } from "../autoTag";
import { insertSong } from "../db/songs";
import { getUserTaste, upsertUserTaste, getEmotionalVector, upsertEmotionalVector } from "../db/userTaste";
import { addVectors, normalizeVector, ZERO_VECTOR } from "../emotionalVector";
import type { UserTaste } from "../matching";

export interface StorySongInput {
  title: string;
  artist: string;
}

export interface ImportedSong {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface ImportSongsResult {
  resolved: ImportedSong[];
  skipped: number;
}

interface ResolvedTaggedSong {
  id: string;
  tagged: AutoTagResult;
}

interface ImportSongsOptions {
  batchSize?: number;
}

const EMPTY_TASTE: UserTaste = {
  favoriteArtists: [],
  defaultMood: "",
  discoveryStyle: "balanced",
  languages: [],
  languageOpenness: "flexible",
  energyPreference: "depends",
  aestheticTags: [],
  avoidedStoryTags: [],
  genreScores: {},
  favoriteStorySongs: [],
  setupComplete: false,
};

function normalizeInputSongs(songs: StorySongInput[]): StorySongInput[] {
  return songs
    .map((song) => ({
      title: song.title.trim(),
      artist: song.artist.trim(),
    }))
    .filter((song) => song.title && song.artist);
}

async function tagAndInsert(song: StorySongInput): Promise<ResolvedTaggedSong> {
  const tagged = await autoTagSong(song.title, song.artist);
  const { id } = await insertSong(tagged);
  return { id, tagged };
}

export async function importSongsIntoTaste(
  userId: string,
  songs: StorySongInput[],
  options: ImportSongsOptions = {}
): Promise<ImportSongsResult> {
  const batchSize = Math.max(1, options.batchSize ?? 5);
  const inputs = normalizeInputSongs(songs);
  const resolved: ResolvedTaggedSong[] = [];
  let skipped = 0;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(tagAndInsert));
    for (const result of settled) {
      if (result.status === "fulfilled") {
        resolved.push(result.value);
      } else {
        skipped += 1;
      }
    }
  }

  if (resolved.length === 0) {
    return { resolved: [], skipped };
  }

  const [existingTaste, existingVector] = await Promise.all([
    getUserTaste(userId).catch(() => null),
    getEmotionalVector(userId).catch(() => null),
  ]);

  let vector = existingVector ?? { ...ZERO_VECTOR };
  const genreScores: Record<string, number> = { ...(existingTaste?.genreScores ?? {}) };
  const favoriteStorySongs = [...(existingTaste?.favoriteStorySongs ?? [])];

  for (const { id, tagged } of resolved) {
    vector = addVectors(vector, tagged.emotional_vector, 0.8);
    for (const genre of tagged.genre_tags) {
      genreScores[genre] = Math.min(1, (genreScores[genre] ?? 0) + 0.6);
    }
    if (!favoriteStorySongs.includes(id)) favoriteStorySongs.push(id);
  }

  await Promise.all([
    upsertEmotionalVector(userId, normalizeVector(vector)),
    upsertUserTaste(userId, {
      ...(existingTaste ?? EMPTY_TASTE),
      genreScores,
      favoriteStorySongs,
    }),
  ]);

  return {
    resolved: resolved.map(({ id, tagged }) => ({
      id,
      title: tagged.title,
      artist: tagged.artist,
      artworkUrl: tagged.artwork_url,
    })),
    skipped,
  };
}

