import { NextRequest, NextResponse } from "next/server";
import { autoTagSong } from "../../../../lib/autoTag";
import { insertSong, listSongs } from "../../../../lib/db/songs";

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
    const tagged = await autoTagSong(title, artist);
    const { id } = await insertSong(tagged);
    return NextResponse.json({ id, song: tagged });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
