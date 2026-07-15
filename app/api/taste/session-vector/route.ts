import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { getEmotionalVector, upsertEmotionalVector } from "../../../../lib/db/userTaste";
import { computeSessionTasteVector } from "../../../../lib/sessionTaste";
import { arrayToVector } from "../../../../lib/vectorMath";
import { VECTOR_KEYS, ZERO_VECTOR, type EmotionalVector } from "../../../../lib/emotionalVector";

export const runtime = "nodejs";

interface SessionTrackInput {
  emotionalVector?: number[] | null;
}

function isSessionTrackInput(value: unknown): value is SessionTrackInput {
  return typeof value === "object" && value !== null;
}

// Blends this session's revealed taste into the user's persistent taste
// vector rather than overwriting it, so one session's swipes nudge future
// matches instead of replacing everything the user has shown across past
// visits — a noisy or unusually-themed single session can't wipe out
// established taste.
function blendPersistentVector(existing: EmotionalVector | null, session: EmotionalVector): EmotionalVector {
  const blended = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    blended[key] = existing ? existing[key] * 0.7 + session[key] * 0.3 : session[key];
  }
  return blended;
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json();
  const saved: SessionTrackInput[] = Array.isArray(body.saved) ? body.saved.filter(isSessionTrackInput) : [];
  const skipped: SessionTrackInput[] = Array.isArray(body.skipped) ? body.skipped.filter(isSessionTrackInput) : [];

  const sessionVectorArr = computeSessionTasteVector(saved, skipped);
  if (!sessionVectorArr) {
    // No saves this session (or none with a usable emotionalVector) — nothing
    // to learn from, leave the persistent taste vector untouched.
    return NextResponse.json({ ok: true, updated: false });
  }

  const existingVector = await getEmotionalVector(user.id).catch(() => null);
  const sessionVector = arrayToVector(sessionVectorArr);
  const blended = blendPersistentVector(existingVector, sessionVector);

  await upsertEmotionalVector(user.id, blended);

  return NextResponse.json({ ok: true, updated: true });
}
