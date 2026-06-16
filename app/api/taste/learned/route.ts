import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getFeedback } from "../../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile } from "../../../../lib/tasteProfile";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const [saved, skipped] = await Promise.all([
    getFeedback(session.user.id, "saved", 300),
    getFeedback(session.user.id, "skipped", 300),
  ]);

  return NextResponse.json(buildAggregateTasteProfile(saved, skipped));
}
