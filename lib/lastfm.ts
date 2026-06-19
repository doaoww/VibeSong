export interface SimilarTrack {
  title: string;
  artist: string;
}

export async function getSimilarTracks(
  title: string,
  artist: string,
  limit = 10
): Promise<SimilarTrack[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.warn("[lastfm] LASTFM_API_KEY not set");
    return [];
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "track.getSimilar");
  url.searchParams.set("track", title);
  url.searchParams.set("artist", artist);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const tracks = data?.similartracks?.track;
    if (!Array.isArray(tracks)) return [];
    return tracks.slice(0, limit).map((t: { name: string; artist: { name: string } }) => ({
      title: t.name,
      artist: t.artist.name,
    }));
  } catch {
    return [];
  }
}
