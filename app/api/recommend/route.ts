import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getUserTaste } from "../../../lib/db/userTaste";
import { getFeedback } from "../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile } from "../../../lib/tasteProfile";
import { searchCatalog } from "../../../lib/db/songs";
import { blendQueryVector } from "../../../lib/vectorMath";
import { buildRecommendations } from "../../../lib/recommend";
import { normalizeTaste } from "../../../lib/matching";
import type { EmotionalVector } from "../../../lib/emotionalVector";
import { VECTOR_KEYS } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const photoVectorArray: number[] = body.photoVectorArray;
    const vibeBoosts: Partial<Record<keyof EmotionalVector, number>> = body.vibeBoosts ?? {};
    const storyIntentTags: string[] = body.storyIntentTags ?? [];
    const antiTags: string[] = body.antiTags ?? [];

    if (!photoVectorArray || photoVectorArray.length !== 10) {
      return NextResponse.json({ error: "photoVectorArray (10 numbers) required" }, { status: 400 });
    }

    // Load user taste profile — all with .catch() fallbacks
    const [storedTaste, savedFeedback, skippedFeedback] = await Promise.all([
      getUserTaste(user.id).catch(() => null),
      getFeedback(user.id, "saved", 200).catch(() => []),
      getFeedback(user.id, "skipped", 200).catch(() => []),
    ]);

    const taste = normalizeTaste(storedTaste ?? null);
    const aggregate = buildAggregateTasteProfile(savedFeedback, skippedFeedback);

    // Build taste vector (cold start: all 0.5). Phase 2 will add real stored taste vector.
    const tasteArr: number[] = VECTOR_KEYS.map(() => 0.5);

    // Build optional vibe vector from boosts
    const hasVibe = Object.keys(vibeBoosts).length > 0 || storyIntentTags.length > 0;
    const vibeArr = hasVibe
      ? VECTOR_KEYS.map((k, i) => {
          const boost = vibeBoosts[k as keyof EmotionalVector] ?? 0;
          const photoDim = photoVectorArray[i];
          return Math.max(photoDim - 0.25, Math.min(photoDim + 0.35, photoDim + boost));
        })
      : null;

    // Build final query vector
    const queryVector = blendQueryVector(photoVectorArray, tasteArr, vibeArr, vibeBoosts);

    // pgvector similarity search — 50 candidates
    const candidates = await searchCatalog(queryVector, 50);

    // Derive language list from taste profile
    const rawLang = taste.languagePreference.toLowerCase();
    const languages =
      rawLang === "no preference" || rawLang === "global mix" ? [] : [taste.languagePreference];
    const languageOpenness: "strict" | "flexible" | "open" =
      languages.length === 0 ? "open" : "flexible";

    // Map hidden-gems to niche for scoring
    const discoveryStyle =
      taste.discoveryStyle === "hidden-gems" ? "niche" : taste.discoveryStyle;

    // Score and rank
    const { results: recommendations, debugLog } = buildRecommendations(
      {
        queryVector,
        languages,
        languageOpenness,
        discoveryStyle,
        blockedSongs: [],
        blockedArtists: aggregate.avoidArtists,
        recentlyShownSongIds: [],
        genreScores: Object.fromEntries([
          ...taste.genres.map((g) => [g, 0.8]),
          ...taste.dislikes.map((d) => [d, -0.8]),
        ]),
        likedArtists: taste.favoriteArtists,
        storyIntentTags,
        antiTags,
      },
      candidates
    );

    return NextResponse.json({
      songs: recommendations.slice(0, 12),
      totalCandidates: candidates.length,
      debugLog,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/recommend error:", message);
    return NextResponse.json({ error: "Recommendation failed", detail: message }, { status: 500 });
  }
}
