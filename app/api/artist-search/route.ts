import { NextRequest, NextResponse } from "next/server";
import { searchArtists } from "../../../lib/itunes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  const artists = await searchArtists(query);
  return NextResponse.json({ artists });
}
