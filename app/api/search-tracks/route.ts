import { NextRequest, NextResponse } from "next/server";
import { resolveItunesPreview } from "../../../lib/itunes";
import { scoreResolvedTrack, type DiscoveryStyle, type ResolvedTrack } from "../../../lib/matching";
import { searchYouTubeTrack, GPTTrack } from "../../../lib/youtube";
import { getSimilarTracks } from "../../../lib/lastfm";

export const runtime = "nodejs";

async function resolvePlayableTrack(
  track: GPTTrack,
  discoveryStyle: DiscoveryStyle
): Promise<ResolvedTrack | null> {
  const baseScore = track.matchScore ?? Math.round(track.finalScore ?? 75);
  const finalScore = track.finalScore ?? baseScore;

  const itunes = await resolveItunesPreview(track);
  if (itunes?.previewUrl) {
    return scoreResolvedTrack(
      {
        ...track,
        matchScore: baseScore,
        finalScore,
        previewUrl: itunes.previewUrl,
        previewProvider: "itunes",
        artwork: itunes.artwork,
        appleMusicUrl: itunes.appleMusicUrl,
        thumbnail: itunes.artwork,
        viralMomentSeconds: track.viralMomentSeconds ?? 0,
      },
      discoveryStyle
    );
  }

  const youtube = await searchYouTubeTrack(track);
  if (!youtube) return null;

  return scoreResolvedTrack(
    {
      ...youtube,
      finalScore: youtube.finalScore ?? finalScore,
      previewProvider: "youtube",
    },
    discoveryStyle
  );
}

export async function POST(req: NextRequest) {
  try {
    const { tracks, discoveryStyle = "balanced", likedSeedTracks = [] } = await req.json();
    if (!Array.isArray(tracks)) {
      return NextResponse.json(
        { error: "tracks array required" },
        { status: 400 }
      );
    }

    // Expand candidate list with Last.fm similar tracks for liked seed songs
    let lastfmCandidates: Array<{ title: string; artist: string }> = [];
    if (Array.isArray(likedSeedTracks) && likedSeedTracks.length > 0) {
      const seedsToQuery = (likedSeedTracks as Array<{ title: string; artist: string }>).slice(0, 3);
      const similar = await Promise.all(
        seedsToQuery.map((s) => getSimilarTracks(s.title, s.artist, 8))
      );
      lastfmCandidates = similar.flat();
    }

    // Merge: GPT tracks first, then Last.fm additions (deduplicated by title+artist)
    const seen = new Set(
      tracks.map((t: GPTTrack) => `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`)
    );
    const merged: GPTTrack[] = [...tracks];
    for (const lf of lastfmCandidates) {
      const key = `${lf.title.toLowerCase()}|${lf.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
          title: lf.title,
          artist: lf.artist,
          reason: "",
          matchScore: 70,
          finalScore: 70,
        });
      }
    }

    // Cap at 14 to avoid too many parallel network calls (8 GPT + 6 Last.fm)
    const results = await Promise.allSettled(
      merged.slice(0, 14).map((t: GPTTrack) =>
        resolvePlayableTrack(t, discoveryStyle as DiscoveryStyle)
      )
    );

    const found = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => (b.finalScore ?? b.matchScore) - (a.finalScore ?? a.matchScore))
      .slice(0, 8);

    if (found.length < 5) {
      return NextResponse.json(
        { error: "Not enough tracks found", found },
        { status: 206 }
      );
    }

    return NextResponse.json(found);
  } catch (err) {
    console.error("/api/search-tracks error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
