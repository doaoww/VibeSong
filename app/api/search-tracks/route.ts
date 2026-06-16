import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeTrack, GPTTrack } from "../../../lib/youtube";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tracks } = await req.json();
    if (!Array.isArray(tracks)) {
      return NextResponse.json(
        { error: "tracks array required" },
        { status: 400 }
      );
    }

    const results = await Promise.allSettled(
      tracks.map((t: GPTTrack) => searchYouTubeTrack(t))
    );

    const found = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8);

    if (found.length < 5) {
      return NextResponse.json(
        { error: "Not enough tracks found", found },
        { status: 206 }
      );
    }

    return NextResponse.json(found);
  } catch (err) {
    console.error("/api/search-tracks error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
