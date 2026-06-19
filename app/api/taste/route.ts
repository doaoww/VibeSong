import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../lib/supabase/server";
import { getUserTaste, upsertUserTaste } from "../../../lib/db/userTaste";
import { normalizeTaste } from "../../../lib/matching";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const taste = await getUserTaste(user.id);
  return NextResponse.json(taste);
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = await req.json();
  const taste = normalizeTaste(body);
  await upsertUserTaste(user.id, taste);
  return NextResponse.json(taste);
}
