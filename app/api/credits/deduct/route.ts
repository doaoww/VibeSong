import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { deductCredit } from "../../../../lib/db/profiles";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const result = await deductCredit(session.user.id);
  return NextResponse.json(result);
}
