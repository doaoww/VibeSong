import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { insertFeedback } from "../../../lib/db/trackFeedback";
import { buildTasteVector, type EmotionalVector } from "../../../lib/emotionalVector";
import { upsertEmotionalVector } from "../../../lib/db/userTaste";
import { supabase } from "../../../lib/supabase";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres?: string[];
  previewUrl?: string | null;
  artwork?: string | null;
  emotionalVector?: EmotionalVector;
}

interface Body {
  saved?: SeedSong[];
  skipped?: SeedSong[];
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body: Body = await req.json();
  const saved = Array.isArray(body.saved) ? body.saved : [];
  const skipped = Array.isArray(body.skipped) ? body.skipped : [];

  // Build emotional taste vector from swipes (falls back to genre inference if no explicit vectors)
  if (saved.length + skipped.length > 0) {
    const tasteVector = buildTasteVector(saved, skipped);
    await upsertEmotionalVector(user.id, tasteVector).catch((e) =>
      console.error("[seed-feedback] upsertEmotionalVector failed:", e)
    );
  }

  // Mark onboarding complete. language/avoid-list preferences are persisted
  // separately by OnboardingFlow's Steps 1-3 (via POST /api/taste) before the
  // swipe step ever runs — this route no longer owns those fields (they were
  // dropped from user_taste by the onboarding-v2 migration; writing them here
  // would fail against the current schema and silently skip setup_complete).
  const { error: prefsError } = await supabase.from("user_taste").upsert({
    user_id: user.id,
    setup_complete: true,
    updated_at: new Date().toISOString(),
  });
  if (prefsError) console.error("[seed-feedback] upsert setup_complete failed:", prefsError);

  await Promise.allSettled([
    ...saved.map((track) =>
      insertFeedback(user.id, "saved", {
        title: track.title,
        artist: track.artist,
        genres: track.genres ?? [],
        artwork: track.artwork ?? undefined,
        previewUrl: track.previewUrl ?? undefined,
        previewProvider: track.previewUrl ? "itunes" : undefined,
      })
    ),
    ...skipped.map((track) =>
      insertFeedback(user.id, "skipped", {
        title: track.title,
        artist: track.artist,
        genres: track.genres ?? [],
        artwork: track.artwork ?? undefined,
        previewUrl: track.previewUrl ?? undefined,
        previewProvider: track.previewUrl ? "itunes" : undefined,
      })
    ),
  ]);

  return NextResponse.json({ ok: true });
}
