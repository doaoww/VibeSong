import type { CandidateTrack } from "./matching";

export interface ItunesResult {
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
}

export interface ItunesPreview {
  previewUrl: string;
  artwork: string;
  appleMusicUrl: string;
}

const ITUNES_SEARCH = "https://itunes.apple.com/search";

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(expected: string, actual: string): number {
  const expectedTokens = tokens(expected);
  const actualTokens = new Set(tokens(actual));
  if (!expectedTokens.length || !actualTokens.size) return 0;
  return expectedTokens.filter((token) => actualTokens.has(token)).length / expectedTokens.length;
}

function improveArtwork(url: string): string {
  return url.replace(/100x100bb\.(jpg|png|webp)$/i, "600x600bb.$1");
}

export function selectBestItunesResult(
  artist: string,
  title: string,
  results: ItunesResult[]
): ItunesResult | null {
  let best: { result: ItunesResult; score: number } | null = null;

  for (const result of results) {
    if (!result.previewUrl || !result.trackName || !result.artistName) continue;

    const titleScore = overlapScore(title, result.trackName);
    const artistScore = overlapScore(artist, result.artistName);
    const exactTitle = result.trackName.toLowerCase() === title.toLowerCase() ? 1 : 0;
    const exactArtist = result.artistName.toLowerCase() === artist.toLowerCase() ? 1 : 0;
    const score = titleScore * 5 + artistScore * 4 + exactTitle * 3 + exactArtist * 2;

    if (!best || score > best.score) {
      best = { result, score };
    }
  }

  return best?.score ? best.result : null;
}

export async function resolveItunesPreview(track: CandidateTrack): Promise<ItunesPreview | null> {
  const params = new URLSearchParams({
    term: `${track.artist} ${track.title}`,
    media: "music",
    entity: "song",
    limit: "5",
    country: "US",
  });

  try {
    const res = await fetch(`${ITUNES_SEARCH}?${params.toString()}`, {
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { results?: ItunesResult[] };
    const selected = selectBestItunesResult(track.artist, track.title, data.results ?? []);
    if (!selected?.previewUrl) return null;

    return {
      previewUrl: selected.previewUrl,
      artwork: selected.artworkUrl100 ? improveArtwork(selected.artworkUrl100) : "",
      appleMusicUrl: selected.trackViewUrl ?? "",
    };
  } catch {
    return null;
  }
}
