import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { autoTagSong } from "../../../../lib/autoTag";
import { insertSong } from "../../../../lib/db/songs";
import { getUserTaste, upsertUserTaste, getEmotionalVector, upsertEmotionalVector } from "../../../../lib/db/userTaste";
import { addVectors, normalizeVector, ZERO_VECTOR } from "../../../../lib/emotionalVector";

export const runtime = "nodejs";

interface StorySongInput {
  title: string;
  artist: string;
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawSongs: StorySongInput[] = Array.isArray(body.songs) ? body.songs.slice(0, 3) : [];
  const songs = rawSongs.filter((s) => s?.title?.trim() && s?.artist?.trim());
  if (songs.length === 0) {
    return NextResponse.json({ resolved: [] });
  }

  // Resolve in parallel — do not make the user wait 3x a single tagging call.
  const settled = await Promise.allSettled(
    songs.map(async (song) => {
      const tagged = await autoTagSong(song.title, song.artist);
      const { id } = await insertSong(tagged);
      return { id, tagged };
    })
  );

  const resolved = settled
    .filter((r): r is PromiseFulfilledResult<{ id: string; tagged: Awaited<ReturnType<typeof autoTagSong>> }> => r.status === "fulfilled")
    .map((r) => r.value);

  if (resolved.length === 0) {
    return NextResponse.json({ resolved: [] });
  }

  // Fold resolved songs into the taste profile: strong weight (0.8 per song,
  // same magnitude as a "Perfect" feedback rating), positive genre scores.
  const [existingTaste, existingVector] = await Promise.all([
    getUserTaste(user.id).catch(() => null),
    getEmotionalVector(user.id).catch(() => null),
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
    upsertEmotionalVector(user.id, normalizeVector(vector)),
    upsertUserTaste(user.id, {
      ...(existingTaste ?? {
        favoriteArtists: [], defaultMood: "", discoveryStyle: "balanced",
        languages: [], languageOpenness: "flexible", energyPreference: "depends",
        aestheticTags: [], avoidedStoryTags: [], setupComplete: false,
      }),
      genreScores,
      favoriteStorySongs,
    } as Parameters<typeof upsertUserTaste>[1]),
  ]);

  return NextResponse.json({
    resolved: resolved.map(({ id, tagged }) => ({
      id,
      title: tagged.title,
      artist: tagged.artist,
      artworkUrl: tagged.artwork_url,
    })),
  });
}
