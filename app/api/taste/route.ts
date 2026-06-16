import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getUserTaste, upsertUserTaste } from "../../../lib/db/userTaste";
import { normalizeTaste } from "../../../lib/matching";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const taste = await getUserTaste(session.user.id);
  return NextResponse.json(taste);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const body = await req.json();
  const taste = normalizeTaste(body);
  await upsertUserTaste(session.user.id, taste);
  return NextResponse.json(taste);
}
