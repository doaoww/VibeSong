import { NextRequest, NextResponse } from "next/server";
import { classifyGeneration } from "../../../../../lib/autoTag";

export const runtime = "nodejs";

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return !!secret && req.headers.get("x-admin-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { title, artist } = await req.json();
  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist required" }, { status: 400 });
  }
  const song_generation = await classifyGeneration(title, artist);
  return NextResponse.json({ song_generation });
}
