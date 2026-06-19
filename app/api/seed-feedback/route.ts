import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { insertFeedback } from "../../../lib/db/trackFeedback";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres?: string[];
  previewUrl?: string | null;
  artwork?: string | null;
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
