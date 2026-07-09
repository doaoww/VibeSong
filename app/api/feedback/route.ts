import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getAllFeedback, insertFeedback, type FeedbackAction, type FeedbackRowWithAction } from "../../../lib/db/trackFeedback";
import type { Track } from "../../../store/useAppStore";

export const runtime = "nodejs";

function isFeedbackAction(value: unknown): value is FeedbackAction {
  return value === "saved" || value === "skipped";
}

function toTrack(row: FeedbackRowWithAction): Track {
  const action = row.action;
  const timestamp = new Date(row.createdAt).getTime();
  return {
    title: row.title,
    artist: row.artist,
    reason: row.reason ?? "",
    matchScore: row.matchScore ?? 0,
    thumbnail: row.thumbnail ?? "",
    artwork: row.artwork,
    appleMusicUrl: row.appleMusicUrl,
    youtubeUrl: row.youtubeUrl,
    youtubeId: row.youtubeId,
    previewUrl: row.previewUrl,
    previewProvider: row.previewProvider,
    sourceImage: row.sourceImage,
    savedAt: action === "saved" ? timestamp : undefined,
    skippedAt: action === "skipped" ? timestamp : undefined,
  };
}

function feedbackKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|||${artist.trim().toLowerCase()}`;
}

export async function GET() {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Rows come back newest-first, so the first row seen per title+artist is
  // the most recent action for that song — that's the one that should win.
  const rows = await getAllFeedback(user.id, 400);
  const latestByTrack = new Map<string, FeedbackRowWithAction>();
  for (const row of rows) {
    const key = feedbackKey(row.title, row.artist);
    if (!latestByTrack.has(key)) latestByTrack.set(key, row);
  }
  const latest = [...latestByTrack.values()];

  return NextResponse.json({
    saved: latest.filter((r) => r.action === "saved").map(toTrack),
    skipped: latest.filter((r) => r.action === "skipped").map(toTrack),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json();
  if (!isFeedbackAction(body.action) || !body.track?.title || !body.track?.artist) {
    return NextResponse.json(
      { error: "action and track.title/artist required" },
      { status: 400 }
    );
  }

  await insertFeedback(user.id, body.action, {
    title: body.track.title,
    artist: body.track.artist,
    reason: body.track.reason,
    matchScore: body.track.matchScore,
    genres: Array.isArray(body.genres) ? body.genres : [],
    artwork: body.track.artwork,
    thumbnail: body.track.thumbnail,
    appleMusicUrl: body.track.appleMusicUrl,
    youtubeUrl: body.track.youtubeUrl,
    youtubeId: body.track.youtubeId,
    previewUrl: body.track.previewUrl,
    previewProvider: body.track.previewProvider,
    sourceImage: body.sourceImage,
  });

  return NextResponse.json({ ok: true });
}
