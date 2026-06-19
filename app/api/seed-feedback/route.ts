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

interface OnboardingPrefs {
  languagePreference?: string;
  dislikes?: string[];
}

interface Body {
  saved?: SeedSong[];
  skipped?: SeedSong[];
  prefs?: OnboardingPrefs;
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body: Body = await req.json();
  const saved = Array.isArray(body.saved) ? body.saved : [];
  const skipped = Array.isArray(body.skipped) ? body.skipped : [];
  const prefs = body.prefs ?? {};

  // Build emotional taste vector from swipes
  const hasSomeVectors = [...saved, ...skipped].some((s) => s.emotionalVector);
  if (hasSomeVectors) {
    const tasteVector = buildTasteVector(saved, skipped);
    await upsertEmotionalVector(user.id, tasteVector).catch((e) =>
      console.error("[seed-feedback] upsertEmotionalVector failed:", e)
    );
  }

  // Save prefs + mark onboarding complete
  const { error: prefsError } = await supabase.from("user_taste").upsert({
    user_id: user.id,
    language_preference: prefs.languagePreference ?? "No preference",
    dislikes: prefs.dislikes ?? [],
    setup_complete: true,
    updated_at: new Date().toISOString(),
  });
  if (prefsError) console.error("[seed-feedback] upsert prefs failed:", prefsError);

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
