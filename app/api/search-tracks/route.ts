import { NextRequest, NextResponse } from "next/server";
import { resolveItunesPreview } from "../../../lib/itunes";
import {
  scoreResolvedTrack,
  applyAvoidPenalties,
  applyLanguagePenalty,
  normalizeCandidateScores,
  type DiscoveryStyle,
  type ResolvedTrack,
} from "../../../lib/matching";
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
    const {
      tracks,
      discoveryStyle = "balanced",
      likedSeedTracks = [],
      languagePreference = "No preference",
      dislikes = [],
    } = await req.json();
    if (!Array.isArray(tracks)) {
      return NextResponse.json(
        { error: "tracks array required" },
        { status: 400 }
      );
    }

    // Apply onboarding quiz preferences: language and dislikes filtering
    let penalized = applyLanguagePenalty(tracks, languagePreference);
    penalized = applyAvoidPenalties(penalized, { avoidArtists: [], avoidGenres: [], dislikes });
    const rescored = normalizeCandidateScores(penalized, discoveryStyle as DiscoveryStyle);

    // Resolve all GPT-curated tracks — don't cap below the candidate count
    const results = await Promise.allSettled(
      rescored.slice(0, 18).map((t: GPTTrack) =>
        resolvePlayableTrack(t, discoveryStyle as DiscoveryStyle)
      )
    );

    const found = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => (b.finalScore ?? b.matchScore) - (a.finalScore ?? a.matchScore))
      .slice(0, 15);

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
