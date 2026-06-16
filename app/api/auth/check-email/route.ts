import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const { data } = await supabase
    .schema("next_auth")
    .from("users")
    .select("password_hash")
    .eq("email", email)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ status: "new" });
  }
  if (!data.password_hash) {
    return NextResponse.json({ status: "oauth-only" });
  }
  return NextResponse.json({ status: "has-password" });
}
