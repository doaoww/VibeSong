import { NextRequest, NextResponse } from "next/server";
import { curateCatalog } from "../../../../lib/curator";

export const runtime = "nodejs";
// Up to MAX_NEW_SONGS_PER_RUN sequential autoTagSong calls (iTunes + Last.fm +
// GPT-4o each, throttled ~2s apart) can take several minutes; the default
// serverless function timeout is too short for that.
export const maxDuration = 300;

function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await curateCatalog();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
