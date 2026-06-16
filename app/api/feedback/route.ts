import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getFeedback, insertFeedback, type FeedbackAction } from "../../../lib/db/trackFeedback";
import type { Track } from "../../../store/useAppStore";

export const runtime = "nodejs";

function isFeedbackAction(value: unknown): value is FeedbackAction {
  return value === "saved" || value === "skipped";
}

function toTrack(
  row: Awaited<ReturnType<typeof getFeedback>>[number],
  action: FeedbackAction
): Track {
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const [savedRows, skippedRows] = await Promise.all([
    getFeedback(session.user.id, "saved", 200),
    getFeedback(session.user.id, "skipped", 200),
  ]);
  return NextResponse.json({
    saved: savedRows.map((row) => toTrack(row, "saved")),
    skipped: skippedRows.map((row) => toTrack(row, "skipped")),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json();
  if (!isFeedbackAction(body.action) || !body.track?.title || !body.track?.artist) {
    return NextResponse.json(
      { error: "action and track.title/artist required" },
      { status: 400 }
    );
  }

  await insertFeedback(session.user.id, body.action, {
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
