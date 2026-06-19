import { NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { getFeedback } from "../../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile } from "../../../../lib/tasteProfile";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const [saved, skipped] = await Promise.all([
    getFeedback(user.id, "saved", 300),
    getFeedback(user.id, "skipped", 300),
  ]);

  return NextResponse.json(buildAggregateTasteProfile(saved, skipped));
}
