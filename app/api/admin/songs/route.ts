import { NextRequest, NextResponse } from "next/server";
import { autoTagSong } from "../../../../lib/autoTag";
import { DuplicateSongError, findSongByTitleArtist, insertSong, listSongs } from "../../../../lib/db/songs";

export const runtime = "nodejs";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.headers.get("x-admin-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const songs = await listSongs();
    return NextResponse.json({ songs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, artist } = await req.json();
  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist required" }, { status: 400 });
  }

  try {
    const existing = await findSongByTitleArtist(title, artist);
    if (existing) {
      return NextResponse.json(
        { error: `"${existing.title}" by "${existing.artist}" is already in the catalog`, existingId: existing.id },
        { status: 409 }
      );
    }

    const tagged = await autoTagSong(title, artist);
    const { id } = await insertSong(tagged);
    return NextResponse.json({ id, song: tagged });
  } catch (err) {
    if (err instanceof DuplicateSongError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
