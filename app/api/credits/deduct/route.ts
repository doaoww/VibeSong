import { NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { deductCredit } from "../../../../lib/db/profiles";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const result = await deductCredit(user.id);
  return NextResponse.json(result);
}
