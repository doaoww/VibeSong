import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getUserTaste, getEmotionalVector } from "../../../lib/db/userTaste";
import { getFeedback } from "../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile } from "../../../lib/tasteProfile";
import { searchCatalog, searchCatalogByTags, searchCatalogByTaste, searchCatalogByBrief, searchCatalogByLanguage, getSongsByIds, type CatalogSong } from "../../../lib/db/songs";
import { blendQueryVector } from "../../../lib/vectorMath";
import { buildRecommendations, resolveRecentlyShownSongIds, applyArtistDiversityCap, capFavoriteSongs, sampleFavoriteSongIds } from "../../../lib/recommend";
import { normalizeTaste } from "../../../lib/matching";
import {
  gateAntiTags,
  gateEnergyBounds,
  mergeGenreScores,
  mergeLikedArtists,
  type EnergyBounds,
} from "../../../lib/matchSignals";
import type { EmotionalVector } from "../../../lib/emotionalVector";
import { VECTOR_KEYS, ZERO_VECTOR } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

function resolveEnergyBounds(input: unknown): EnergyBounds {
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const min = obj.min;
    const max = obj.max;
    if (
      typeof min === "number" &&
      typeof max === "number" &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min >= 0 &&
      max <= 1 &&
      min <= max
    ) {
      return { min, max };
    }
  }
  return { min: 0, max: 1 };
}

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
    const photoConfidence: number =
      typeof body.photoConfidence === "number" ? Math.max(0, Math.min(1, body.photoConfidence)) : 0.5;
    const sceneContextTags: string[] = body.sceneContextTags ?? [];
    const aestheticTags: string[] = body.aestheticTags ?? [];
    const moodTags: string[] = body.moodTags ?? [];
    const photoAntiTags: string[] = body.photoAntiTags ?? [];
    const musicDirection: { genres: string[]; references: string[]; avoid: string[] } =
      body.musicDirection ?? { genres: [], references: [], avoid: [] };
    const briefPoolEnabled = process.env.ENABLE_BRIEF_POOL === "true";
    // Treat an empty array the same as missing: /api/analyze returns
    // photoBriefEmbedding: [] whenever GPT omitted musicBrief or embedText
    // failed, and [] is truthy in JS — without this check it would reach
    // searchCatalogByBrief([], ...) and match_songs_by_brief's vector(1536)
    // param, which errors on a zero-length array and 500s the whole request
    // instead of degrading briefFit to 0 like every other missing-embedding case.
    const photoBriefEmbeddingRaw: number[] | null =
      Array.isArray(body.photoBriefEmbedding) && body.photoBriefEmbedding.length > 0
        ? body.photoBriefEmbedding
        : null;
    const photoBriefEmbedding = briefPoolEnabled ? photoBriefEmbeddingRaw : null;

    if (!photoVectorArray || photoVectorArray.length !== 10) {
      return NextResponse.json({ error: "photoVectorArray (10 numbers) required" }, { status: 400 });
    }

    const [storedTaste, storedVector, savedFeedback, skippedFeedback] = await Promise.all([
      getUserTaste(user.id).catch(() => null),
      getEmotionalVector(user.id).catch(() => null),
      getFeedback(user.id, "saved", 200).catch(() => []),
      getFeedback(user.id, "skipped", 200).catch(() => []),
    ]);

    const taste = normalizeTaste(storedTaste ?? null);
    const aggregate = buildAggregateTasteProfile(savedFeedback, skippedFeedback);

    const tasteVector = storedVector ?? ZERO_VECTOR;
    const tasteArr: number[] = VECTOR_KEYS.map((k) => (storedVector ? tasteVector[k] : 0.5));

    // Only an actual requested-vibe signal (vibeBoosts) should trigger the fixed
    // 3-signal blend. storyIntentTags is now populated from the photo's own
    // matchSignals on every request (Task 10) and must not be mistaken for a
    // requested vibe — doing so silently disabled the confidence-aware 2-signal
    // blend (Task 4) on every request, since an empty vibeBoosts degenerates the
    // 3-signal formula to a fixed photo*0.75 + taste*0.25 regardless of confidence.
    const hasVibe = Object.keys(vibeBoosts).length > 0;
    const vibeArr = hasVibe
      ? VECTOR_KEYS.map((k, i) => {
          const boost = vibeBoosts[k as keyof EmotionalVector] ?? 0;
          const photoDim = photoVectorArray[i];
          return Math.max(photoDim - 0.25, Math.min(photoDim + 0.35, photoDim + boost));
        })
      : null;

    const queryVector = blendQueryVector(photoVectorArray, tasteArr, vibeArr, vibeBoosts, photoConfidence);

    const gatedPhotoAntiTags = gateAntiTags(photoAntiTags, photoConfidence);
    const energyBounds = gateEnergyBounds(resolveEnergyBounds(body.energyBounds), photoVectorArray[2], photoConfidence);
    const mergedGenreScores = mergeGenreScores(
      taste.genreScores,
      musicDirection.genres,
      musicDirection.avoid,
      photoConfidence
    );
    const mergedLikedArtists = mergeLikedArtists(taste.favoriteArtists, musicDirection.references);

    const artistPatterns = mergedLikedArtists.map((a) => `%${a}%`);
    const positiveGenres = Object.entries(mergedGenreScores)
      .filter(([, score]) => score > 0.3)
      .map(([genre]) => genre);

    const eligibleFavoriteSongIds = sampleFavoriteSongIds(taste.favoriteStorySongs, 6);

    const [vectorPool, storyPool, contextPool, tastePool, briefPool, languagePool, favoriteSongPool] = await Promise.all([
      searchCatalog(queryVector, 25),
      searchCatalogByTags({ intentTags: storyIntentTags, aestheticTags, moodTags }, 25),
      searchCatalogByTags({ contextTags: sceneContextTags }, 20),
      searchCatalogByTaste({ artistPatterns, positiveGenres }, 20),
      photoBriefEmbedding ? searchCatalogByBrief(photoBriefEmbedding, 25) : Promise.resolve([] as CatalogSong[]),
      taste.languages.length > 0
        ? searchCatalogByLanguage(taste.languages, queryVector, 25)
        : Promise.resolve([] as CatalogSong[]),
      eligibleFavoriteSongIds.length > 0
        ? getSongsByIds(eligibleFavoriteSongIds)
        : Promise.resolve([] as CatalogSong[]),
    ]);

    const poolMap = new Map<string, CatalogSong>();
    for (const song of [...vectorPool, ...storyPool, ...contextPool, ...tastePool, ...briefPool, ...languagePool, ...favoriteSongPool]) {
      if (!poolMap.has(song.id)) poolMap.set(song.id, song);
    }
    const candidates = Array.from(poolMap.values());

    const discoveryStyle = taste.discoveryStyle === "hidden-gems" ? "niche" : taste.discoveryStyle;

    // track_feedback doesn't store song id (see lib/db/trackFeedback.ts), so we
    // match previously saved/skipped tracks back to this request's candidates by
    // title+artist to stop repeatedly surfacing the same song across sessions.
    const recentlyShownSongIds = resolveRecentlyShownSongIds(candidates, [...savedFeedback, ...skippedFeedback]);

    const { results: recommendations, debugLog } = buildRecommendations(
      {
        queryVector,
        languages: taste.languages,
        languageOpenness: taste.languageOpenness,
        discoveryStyle,
        blockedSongs: [],
        blockedArtists: aggregate.avoidArtists,
        recentlyShownSongIds,
        genreScores: mergedGenreScores,
        likedArtists: mergedLikedArtists,
        favoriteSongIds: eligibleFavoriteSongIds,
        storyIntentTags,
        hardAntiTags: [...antiTags, ...taste.avoidedStoryTags],
        softAntiTags: gatedPhotoAntiTags,
        photoConfidence,
        sceneContextTags,
        aestheticTags,
        moodTags,
        energyBounds,
        photoBriefEmbedding,
      },
      candidates
    );

    const poolStats = {
      vectorPoolCount: vectorPool.length,
      storyPoolCount: storyPool.length,
      contextPoolCount: contextPool.length,
      tastePoolCount: tastePool.length,
      briefPoolCount: briefPool.length,
      briefPoolEnabled,
      languagePoolCount: languagePool.length,
      favoriteSongPoolCount: favoriteSongPool.length,
      mergedCandidateCount: candidates.length,
      removedByRulesCount: debugLog.filter((e) => e.rulesRemoved).length,
    };
    console.log("[recommend] pool stats:", JSON.stringify(poolStats));

    return NextResponse.json({
      songs: applyArtistDiversityCap(capFavoriteSongs(recommendations, eligibleFavoriteSongIds, 2), 12),
      totalCandidates: candidates.length,
      debugLog,
      poolStats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/recommend error:", message);
    return NextResponse.json({ error: "Recommendation failed", detail: message }, { status: 500 });
  }
}
