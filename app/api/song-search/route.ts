import { NextRequest, NextResponse } from "next/server";
import { searchCatalogByText } from "../../../lib/db/songs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ songs: [] });
  try {
    const songs = await searchCatalogByText(query, 8);
    return NextResponse.json({ songs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
