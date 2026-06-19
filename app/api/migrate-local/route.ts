import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getOrCreateProfile, markMigrated } from "../../../lib/db/profiles";
import { upsertUserTaste } from "../../../lib/db/userTaste";
import { insertFeedback } from "../../../lib/db/trackFeedback";
import { normalizeTaste } from "../../../lib/matching";
import type { Track } from "../../../store/useAppStore";

export const runtime = "nodejs";

interface MigrateBody {
  userTaste?: Record<string, unknown> | null;
  savedSongs?: Track[];
  skippedSongs?: Track[];
  credits?: number | null;
}

function toFeedbackTrack(track: Track) {
  return {
    title: track.title,
    artist: track.artist,
    reason: track.reason,
    matchScore: track.matchScore,
    artwork: track.artwork,
    thumbnail: track.thumbnail,
    appleMusicUrl: track.appleMusicUrl,
    youtubeUrl: track.youtubeUrl,
    youtubeId: track.youtubeId,
    previewUrl: track.previewUrl,
    previewProvider: track.previewProvider,
    sourceImage: track.sourceImage,
  };
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(user.id);
  if (profile.migratedLocalData) {
    return NextResponse.json({ migrated: false, alreadyDone: true });
  }

  const body: MigrateBody = await req.json();

  if (body.userTaste && typeof body.userTaste === "object") {
    const taste = normalizeTaste(body.userTaste);
    if (taste.setupComplete) {
      await upsertUserTaste(user.id, taste);
    }
  }

  const saved = Array.isArray(body.savedSongs) ? body.savedSongs : [];
  const skipped = Array.isArray(body.skippedSongs) ? body.skippedSongs : [];

  await Promise.allSettled([
    ...saved.map((track) =>
      insertFeedback(user.id, "saved", toFeedbackTrack(track))
    ),
    ...skipped.map((track) =>
      insertFeedback(user.id, "skipped", toFeedbackTrack(track))
    ),
  ]);

  await markMigrated(
    user.id,
    typeof body.credits === "number" ? body.credits : null
  );

  return NextResponse.json({ migrated: true });
}
