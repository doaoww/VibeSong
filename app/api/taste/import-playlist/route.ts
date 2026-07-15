import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { InvalidUrlError, ParseError, parseAppleMusicPlaylist } from "../../../../lib/appleMusicPlaylist";
import { importSongsIntoTaste } from "../../../../lib/taste/importSongs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";

  try {
    const playlist = await parseAppleMusicPlaylist(url);
    const result = await importSongsIntoTaste(user.id, playlist.tracks, { batchSize: 5 });

    return NextResponse.json({
      resolved: result.resolved,
      truncated: playlist.truncated,
      skipped: result.skipped,
    });
  } catch (err) {
    if (err instanceof InvalidUrlError) {
      return NextResponse.json(
        {
          code: "invalid_url",
          error: "That doesn't look like an Apple Music playlist link - paste songs instead.",
        },
        { status: 422 }
      );
    }

    if (err instanceof ParseError) {
      return NextResponse.json(
        {
          code: "parse_error",
          error: "Couldn't read that playlist - paste songs instead.",
        },
        { status: 422 }
      );
    }

    throw err;
  }
}
