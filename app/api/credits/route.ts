import { NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getOrCreateProfile } from "../../../lib/db/profiles";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const profile = await getOrCreateProfile(user.id);
  return NextResponse.json(
    { credits: profile.credits },
    { headers: { "Cache-Control": "no-store" } }
  );
}
