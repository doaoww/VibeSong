import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";

export const runtime = "nodejs";

interface UserTaste {
  genres: string[];
  favoriteArtists: string[];
  defaultMood: string;
  setupComplete: boolean;
}

const BASE_SYSTEM_PROMPT = `You are a music curator with deep knowledge of every genre, subculture, and scene — not a mainstream playlist algorithm. Your job is to find songs that genuinely fit the MOOD and ENERGY of this photo, with real emotional and aesthetic precision.

SONG SELECTION RULES:
- Songs must be REAL tracks that exist on YouTube/Spotify (verifiable artist + title)
- Prefer 2018–2025 but allow timeless tracks if they perfectly match the vibe
- DO NOT default to chart-topping mainstream hits — anyone can do that
- DO pick cult favorites, critically acclaimed albums, scene anthems, deep cuts, and genre-defining tracks that most people haven't heard but fans would immediately recognize
- Avoid: Levitating, Blinding Lights, Watermelon Sugar, Shape of You, or any song that has been in every ad/reel for 3 years
- Each recommendation must feel like a friend with great taste specifically chose it for THIS photo
- viralMomentSeconds = the timestamp (seconds) of the most emotionally resonant moment of the track

MATCH SCORE RULES — calculate matchScore per track:
- Start at 60 base score
- +0–20 if song energy/tempo matches photo energy precisely
- +0–10 if the artist's emotional register matches the photo mood
- +0–10 if the genre fits the exact visual aesthetic
- Every track MUST have a DIFFERENT score, ordered highest to lowest
- Realistic spread: 94, 89, 85, 81, 77, 73, 69, 65

Return ONLY valid JSON, no markdown:
{
  "scene": {
    "setting": "string",
    "timeOfDay": "morning|afternoon|evening|night|unknown",
    "season": "spring|summer|autumn|winter|unknown",
    "weather": "string"
  },
  "emotion": {
    "primary": "string",
    "secondary": "string",
    "intensity": 0.0
  },
  "visual": {
    "dominantColors": ["string"],
    "brightness": 0.0,
    "aesthetic": "string"
  },
  "musicDNA": {
    "energy": 0.0,
    "valence": 0.0,
    "tempo": "slow|medium|fast",
    "genres": ["string"],
    "mood": "string",
    "tracks": [
      {
        "title": "string",
        "artist": "string",
        "reason": "string — 1 sentence: exactly why THIS song's texture/mood fits THIS specific photo",
        "matchScore": 94,
        "viralMomentSeconds": 62
      }
    ]
  },
  "vibeCaption": "string",
  "vibeTags": ["string", "string", "string"]
}
NUMBER RULES:
- matchScore: INTEGER 61–97. Every track different. Ordered high→low. Example: 94, 89, 85, 81, 77, 73, 69, 65. NEVER decimal, NEVER repeated.
- viralMomentSeconds: INTEGER seconds (e.g. 62, 45, 30).
- energy, valence, brightness, intensity: floats 0.0–1.0.

Generate exactly 8 tracks. vibeTags: exactly 3. Genres: specific (e.g. "lo-fi soul" not "R&B"). NO overplayed hits.`;

function buildTasteBlock(taste: UserTaste): string {
  const similar: Record<string, string[]> = {
    "Frank Ocean": ["Daniel Caesar", "Steve Lacy", "Brent Faiyaz", "SZA"],
    "The Weeknd": ["6LACK", "Bryson Tiller", "partynextdoor", "Nav"],
    "Drake": ["21 Savage", "Future", "Lil Baby", "Gunna"],
    "Billie Eilish": ["Olivia Rodrigo", "Gracie Abrams", "Lana Del Rey", "Lorde"],
    "Tyler the Creator": ["Odd Future", "Earl Sweatshirt", "Vince Staples", "Brockhampton"],
    "Travis Scott": ["Don Toliver", "SZA", "Kid Cudi", "Playboi Carti"],
    "Kendrick Lamar": ["J. Cole", "Joey Bada$$", "Isaiah Rashad", "Freddie Gibbs"],
    "Harry Styles": ["Conan Gray", "Rex Orange County", "Tom Grennan", "Niall Horan"],
    "Bad Bunny": ["J Balvin", "Rauw Alejandro", "Jhayco", "Mora"],
    "Doja Cat": ["Lizzo", "Nicki Minaj", "Saweetie", "Cardi B"],
  };

  const artistLines = taste.favoriteArtists.map((a) => {
    const normalized = Object.keys(similar).find(
      (k) => k.toLowerCase() === a.toLowerCase()
    );
    const extras = normalized ? ` (similar: ${similar[normalized].join(", ")})` : "";
    return `  - ${a}${extras}`;
  });

  return `

USER TASTE PROFILE (this is the most important personalization signal):
- Genres they love: ${taste.genres.join(", ") || "not specified"}
- Favorite artists: ${taste.favoriteArtists.join(", ") || "not specified"}
- Artists to explore as well: ${artistLines.map(l => l.trim()).join(" | ") || "none"}
- Their mood preference: ${taste.defaultMood || "not specified"}

TASTE OVERRIDE RULES — these override the generic photo-matching approach:
1. MINIMUM 5 of the 8 tracks must be from the user's genres or sonically adjacent to their favorite artists
2. AT LEAST 2 tracks must be by their exact favorite artists or a direct sonic twin (listed above)
3. Go DEEP into their genres — find album cuts, B-sides, cult classics, critical darlings from that scene
4. If they like Frank Ocean → recommend his deep cuts + Daniel Caesar, Steve Lacy, Syd, Cautious Clay
5. If they like The Weeknd → go dark: Partynextdoor, Sonder, 6LACK, dvsn, NAV deep cuts
6. BANNED unless the user listed them: generic pop hits, overplayed radio songs, anything everyone knows
7. Still make sure nothing CLASHES with the photo vibe — a chill evening photo should not get aggressive trap
8. The goal: recommendations that make the user say "how did it know I'd like this?" not "everyone knows this song"`;
}

function buildPrompt(taste: UserTaste | null): string {
  if (!taste || !taste.setupComplete || (taste.genres.length === 0 && taste.favoriteArtists.length === 0)) {
    return BASE_SYSTEM_PROMPT;
  }
  return BASE_SYSTEM_PROMPT + buildTasteBlock(taste);
}

const REFUSAL_PATTERNS = [
  /^i'?m sorry/i,
  /^i can'?t/i,
  /^i cannot/i,
  /^i'?m unable/i,
  /^as an ai/i,
  /^i'?m not able/i,
  /unable to (analyze|process|assist)/i,
  /can'?t (analyze|process|assist)/i,
  /doesn'?t contain (any )?music/i,
  /no (visible |clear )?(image|photo|picture)/i,
];

function parseGPTJson(raw: string) {
  const trimmed = raw.trim();

  // Detect GPT refusals before attempting JSON parse
  if (REFUSAL_PATTERNS.some((p) => p.test(trimmed))) {
    throw new Error("REFUSAL:" + trimmed.slice(0, 120));
  }

  // Strip markdown fences
  let cleaned = trimmed.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  // Extract JSON object if GPT added any preamble
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("NO_JSON:" + cleaned.slice(0, 120));
  }
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

function normalizeScores(result: {
  musicDNA?: { tracks?: Array<{ matchScore: number; [key: string]: unknown }> };
}) {
  if (!result?.musicDNA?.tracks) return;
  result.musicDNA.tracks = result.musicDNA.tracks.map((t) => ({
    ...t,
    matchScore:
      typeof t.matchScore === "number" && t.matchScore < 1
        ? Math.round(t.matchScore * 100)
        : Math.round(t.matchScore),
  }));
  console.log(
    "[analyze] matchScores:",
    result.musicDNA.tracks.map(
      (t: { [key: string]: unknown; matchScore: number }) =>
        `${String(t.title)}: ${t.matchScore}`
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, userTaste } = await req.json();
    if (!image || !mimeType) {
      return NextResponse.json(
        { error: "image and mimeType required" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(userTaste ?? null);

    const callOptions = (temperature?: number) => ({
      model: "gpt-4o" as const,
      ...(temperature !== undefined ? { temperature } : {}),
      messages: [
        {
          role: "user" as const,
          content: [
            { type: "text" as const, text: prompt },
            {
              type: "image_url" as const,
              image_url: { url: `data:${mimeType};base64,${image}` },
            },
          ],
        },
      ],
      max_tokens: 2500,
    });

    // Attempt 1 — default temperature
    let rawContent: string | null = null;
    try {
      const res = await openai.chat.completions.create(callOptions());
      rawContent = res.choices[0].message.content || "";
    } catch (openAiErr) {
      console.error("[analyze] OpenAI attempt 1 failed:", openAiErr);
      // Attempt 2 — retry with temperature 0
      try {
        const retry = await openai.chat.completions.create(callOptions(0));
        rawContent = retry.choices[0].message.content || "";
      } catch (retryErr) {
        console.error("[analyze] OpenAI attempt 2 failed:", retryErr);
        throw retryErr;
      }
    }

    if (!rawContent) {
      throw new Error("OpenAI returned empty response");
    }

    console.log("[analyze] raw GPT output (first 300 chars):", rawContent.slice(0, 300));

    let result;
    try {
      result = parseGPTJson(rawContent);
    } catch (parseErr) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error("[analyze] parse failed. Raw:", rawContent.slice(0, 500));

      // GPT refused the image — return a friendly 422 the frontend can display
      if (parseMsg.startsWith("REFUSAL:")) {
        return NextResponse.json(
          {
            error: "Photo couldn't be analyzed",
            detail: "Try a different photo — a clear scene, landscape, portrait, or aesthetic works best.",
            userFacing: true,
          },
          { status: 422 }
        );
      }

      // No JSON found at all — retry once with an explicit JSON reminder
      console.log("[analyze] retrying with explicit JSON reminder…");
      const fixPrompt = `${prompt}\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object. No apologies, no explanations, no markdown. Start your response with { and end with }.`;
      const fixRes = await openai.chat.completions.create({
        ...callOptions(0),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: fixPrompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } },
            ],
          },
        ],
      });
      const fixRaw = fixRes.choices[0].message.content || "";
      console.log("[analyze] retry raw (first 200):", fixRaw.slice(0, 200));
      result = parseGPTJson(fixRaw);
    }

    normalizeScores(result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/analyze error:", message);
    return NextResponse.json({ error: "Analysis failed", detail: message }, { status: 500 });
  }
}
