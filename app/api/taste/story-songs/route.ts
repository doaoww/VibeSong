import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { importSongsIntoTaste } from "../../../../lib/taste/importSongs";

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

  const result = await importSongsIntoTaste(user.id, songs, { batchSize: 3 });

  return NextResponse.json({
    resolved: result.resolved,
  });
}
