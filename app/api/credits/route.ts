import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { getOrCreateProfile } from "../../../lib/db/profiles";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const profile = await getOrCreateProfile(session.user.id);
  return NextResponse.json({ credits: profile.credits });
}
