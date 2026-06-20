import { NextResponse } from "next/server";
import { getSupabaseUser } from "../../../../lib/supabase/server";
import { supabase } from "../../../../lib/supabase";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  await supabase.from("user_taste").upsert({
    user_id: user.id,
    setup_complete: false,
    emotional_vector: null,
    context_vectors: null,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
