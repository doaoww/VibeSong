import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { addCredits } from "../../../../lib/db/profiles";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { amount } = await req.json();
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 }
    );
  }
  const credits = await addCredits(session.user.id, amount);
  return NextResponse.json({ credits });
}
