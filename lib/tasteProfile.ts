interface TasteSignal {
  artist: string;
  genres?: string[];
  createdAt?: string;
}

export interface AggregateTasteProfile {
  learnedGenres: string[];
  avoidGenres: string[];
  learnedArtists: string[];
  avoidArtists: string[];
}

const DECAY_DAYS = 30;

function decayWeight(createdAt: string | undefined): number {
  if (!createdAt) return 1;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays / DECAY_DAYS);
}

function tally(rows: TasteSignal[], pick: (row: TasteSignal) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const weight = decayWeight(row.createdAt);
    for (const value of pick(row)) {
      const key = value.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + weight);
    }
  }
  return counts;
}

function topKeys(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

function avoidList(saved: Map<string, number>, skipped: Map<string, number>): string[] {
  return [...skipped.entries()]
    .filter(([key, skipCount]) => skipCount >= 1.5 && skipCount > (saved.get(key) ?? 0) * 2)
    .map(([key]) => key);
}

export function buildAggregateTasteProfile(
  saved: TasteSignal[],
  skipped: TasteSignal[]
): AggregateTasteProfile {
  const savedGenres = tally(saved, (r) => r.genres ?? []);
  const skippedGenres = tally(skipped, (r) => r.genres ?? []);
  const savedArtists = tally(saved, (r) => [r.artist]);
  const skippedArtists = tally(skipped, (r) => [r.artist]);

  return {
    learnedGenres: topKeys(savedGenres, 5),
    avoidGenres: avoidList(savedGenres, skippedGenres),
    learnedArtists: topKeys(savedArtists, 5),
    avoidArtists: avoidList(savedArtists, skippedArtists),
  };
}
