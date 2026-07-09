import { autoTagSong } from "./autoTag";
import { findSongByTitleArtist, insertSong } from "./db/songs";

export const TRENDING_COUNTRIES = ["us", "ru", "fr", "es", "gb"];
export const MAX_NEW_SONGS_PER_RUN = 15;
export const AUTOTAG_MIN_INTERVAL_MS = 2000;

interface AppleFeedResult {
  name: string;
  artistName: string;
}

interface AppleFeedResponse {
  feed: {
    results: AppleFeedResult[];
  };
}

export interface TrendingCandidate {
  title: string;
  artist: string;
}

export async function fetchTrendingTracks(countryCode: string): Promise<TrendingCandidate[]> {
  const url = `https://rss.marketingtools.apple.com/api/v2/${countryCode}/music/most-played/50/songs.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchTrendingTracks failed for ${countryCode}: ${res.status}`);
  }
  const data = (await res.json()) as AppleFeedResponse;
  return data.feed.results.slice(0, 25).map((r) => ({ title: r.name, artist: r.artistName }));
}

export interface CurateCatalogResult {
  inserted: { title: string; artist: string; id: string }[];
  skipped: number;
  failed: { title: string; artist: string; error: string }[];
}

export interface CurateCatalogOptions {
  minIntervalMs?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function curateCatalog(options: CurateCatalogOptions = {}): Promise<CurateCatalogResult> {
  const minIntervalMs = options.minIntervalMs ?? AUTOTAG_MIN_INTERVAL_MS;
  const inserted: CurateCatalogResult["inserted"] = [];
  const failed: CurateCatalogResult["failed"] = [];
  let skipped = 0;

  for (const country of TRENDING_COUNTRIES) {
    if (inserted.length >= MAX_NEW_SONGS_PER_RUN) break;

    let candidates: TrendingCandidate[];
    try {
      candidates = await fetchTrendingTracks(country);
    } catch {
      continue; // one country's feed being down shouldn't block the rest
    }

    for (const candidate of candidates) {
      if (inserted.length >= MAX_NEW_SONGS_PER_RUN) break;

      let existing: { id: string; title: string; artist: string } | null;
      try {
        existing = await findSongByTitleArtist(candidate.title, candidate.artist);
      } catch (err) {
        failed.push({ ...candidate, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
      if (existing) {
        skipped += 1;
        continue;
      }

      const before = Date.now();
      try {
        const tagged = await autoTagSong(candidate.title, candidate.artist);
        const { id } = await insertSong(tagged);
        inserted.push({ title: candidate.title, artist: candidate.artist, id });
      } catch (err) {
        failed.push({ ...candidate, error: err instanceof Error ? err.message : String(err) });
      }
      const elapsed = Date.now() - before;
      const wait = Math.max(0, minIntervalMs - elapsed);
      if (wait > 0) await sleep(wait);
    }
  }

  return { inserted, skipped, failed };
}
