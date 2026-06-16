import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";
import { getSpotifyTopData } from "../../../lib/spotify";

export const runtime = "nodejs";

function parseGPTJson(raw: string) {
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

export async function POST(req: NextRequest) {
  try {
    const { vibeProfile, accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json(
        { error: "accessToken required" },
        { status: 400 }
      );
    }

    const { topArtists, topTracks } = await getSpotifyTopData(accessToken);

    const prompt = `Original photo analysis:
${JSON.stringify(vibeProfile, null, 2)}

User's favorite artists: ${topArtists.join(", ")}
User's favorite tracks: ${topTracks.slice(0, 10).join(", ")}

Refine the track recommendations to match BOTH the photo vibe AND the user's personal taste. Prioritize artists similar to their favorites. Keep the same JSON format.
Return ONLY the updated tracks array as JSON (array of objects with title, artist, reason, matchScore).`;

    let tracks;
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      });
      tracks = parseGPTJson(res.choices[0].message.content || "");
    } catch {
      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      });
      tracks = parseGPTJson(retry.choices[0].message.content || "");
    }

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("/api/enhance error:", err);
    return NextResponse.json({ error: "Enhancement failed" }, { status: 500 });
  }
}
