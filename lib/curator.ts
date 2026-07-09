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
