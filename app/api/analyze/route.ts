import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";
import { getSupabaseUser } from "../../../lib/supabase/server";
import {
  blendVectors,
  type EmotionalVector,
  ZERO_VECTOR,
} from "../../../lib/emotionalVector";
import {
  getEmotionalVector,
  getAllContextVectors,
  upsertContextVector,
  type MomentType,
} from "../../../lib/db/userTaste";
import { vectorToArray } from "../../../lib/vectorMath";
import type { ExifData } from "../../../store/useAppStore";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `You are a photo vibe analyst. Your job is to understand the emotional and aesthetic character of a photo so that songs can be matched to it from a database.

ABSOLUTE RULE: Analyze ANY image. Abstract images, memes, dark photos, screenshots — everything has visual energy. Never refuse. Only return JSON.

PHOTO ANALYSIS — READ THE MOMENT:
Understand WHAT IS HAPPENING and HOW THE PERSON FEELS, not just aesthetics.

- A broken nail / chaos → frustration, high energy, LOW valence
- A gym selfie → confidence, hustle, HIGH energy
- A sunset / nature → nostalgic, peaceful, LOW energy
- A mirror selfie → read face + body language carefully
- Memes, screenshots → read the emotional energy, not the content
- HUMOR & IRONY: If this would be posted with 😭💀💅 "send help" "not me" — that IS the energy. High energy, chaotic, NOT serene.

vibeCaption = 3–6 words capturing the exact cultural moment: "chaos but make it cute" | "main character moment" | "expensive and cold" | "she's fine (she's not)"

Return ONLY valid JSON, no markdown:
{
  "scene": {
    "setting": "string",
    "timeOfDay": "morning|afternoon|evening|night|unknown",
    "season": "spring|summer|autumn|winter|unknown",
    "weather": "string",
    "activity": "string",
    "cameraMood": "string"
  },
  "people": {
    "count": 0,
    "visibleEmotions": ["string"],
    "socialVibe": "string",
    "activity": "string"
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
    "mood": "string"
  },
  "vibeMetrics": {
    "intimacy": 0.0,
    "confidence": 0.0,
    "nostalgia": 0.0,
    "movement": 0.0
  },
  "vibeCaption": "string",
  "vibeTags": ["string", "string", "string"],
  "momentType": "reflective-solo|social|nature-escape|urban|romance|high-energy|unknown",
  "photoConfidence": 0.85,
  "photoVector": {
    "dreamy": 0.0, "nostalgia": 0.0, "energy": 0.0, "cinematic": 0.0,
    "darkness": 0.0, "confidence": 0.0, "intimacy": 0.0,
    "danceability": 0.0, "electronic": 0.0, "acoustic": 0.0
  }
}
NUMBER RULES:
- energy, valence, brightness, intensity, vibeMetrics fields: floats 0.0–1.0
- photoConfidence: float 0.0–1.0
- photoVector fields: all floats 0.0–1.0
- vibeTags: exactly 3`;

function buildPrompt(exifBlock: string): string {
  return BASE_SYSTEM_PROMPT + exifBlock;
}

function buildExifBlock(exif: ExifData | null): string {
  if (!exif) return "";
  const parts: string[] = [];
  if (exif.capturedHour !== undefined) {
    const period =
      exif.capturedHour >= 22 || exif.capturedHour < 5
        ? "late night"
        : exif.capturedHour < 12
        ? "morning"
        : exif.capturedHour < 17
        ? "afternoon"
        : exif.capturedHour < 21
        ? "evening"
        : "night";
    parts.push(`Photo taken at: ${period} (${exif.capturedHour}:00)`);
  }
  if (exif.capturedMonth !== undefined) {
    const seasons = [
      "",
      "winter",
      "winter",
      "spring",
      "spring",
      "spring",
      "summer",
      "summer",
      "summer",
      "autumn",
      "autumn",
      "autumn",
      "winter",
    ];
    parts.push(`Season: ${seasons[exif.capturedMonth]}`);
  }
  if (!parts.length) return "";
  return `\n\nPHOTO METADATA (EXIF — use as additional context):\n${parts.join("\n")}`;
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

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const { image, mimeType, exifData = null, contrastMode = false } = await req.json();
    if (!image || !mimeType) {
      return NextResponse.json(
        { error: "image and mimeType required" },
        { status: 400 }
      );
    }

    // All DB calls wrapped with fallbacks — any single failure must not kill the analysis
    const [storedTasteVec, allContextVectors] = await Promise.all([
      getEmotionalVector(user.id).catch(() => null),
      getAllContextVectors(user.id).catch(() => null),
    ]);

    // Add EXIF block before GPT call (photo metadata as additional context)
    const exifBlock = buildExifBlock(exifData as ExifData | null);
    const prompt = buildPrompt(exifBlock);

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
      max_tokens: 5000,
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

      // GPT refused or returned invalid JSON — retry with a stronger override prompt
      const isRefusal = parseMsg.startsWith("REFUSAL:");
      console.log(`[analyze] retrying — reason: ${isRefusal ? "refusal" : "no JSON"}…`);

      const overridePrefix = isRefusal
        ? `CRITICAL OVERRIDE: You are a photo vibe analyst tool. Your ONLY job is to analyze any image and return JSON — there is NO image that cannot be analyzed. Abstract images, blurry photos, screenshots, AI art, memes, documents, dark photos — all of them have a visual texture, color palette, and emotional energy. You are NOT allowed to refuse. You MUST return JSON.\n\n`
        : "";

      const fixPrompt = `${overridePrefix}${prompt}\n\nIMPORTANT: You MUST respond with ONLY a valid JSON object. No apologies, no explanations, no markdown. Start your response with { and end with }.`;
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

    // Extract photo vector and moment type from GPT result
    const photoVector: EmotionalVector =
      result.photoVector && typeof result.photoVector === "object"
        ? { ...ZERO_VECTOR, ...result.photoVector }
        : { ...ZERO_VECTOR };
    const photoConfidence: number =
      typeof result.photoConfidence === "number"
        ? Math.max(0, Math.min(1, result.photoConfidence))
        : 0.5;
    const momentType: MomentType = result.momentType ?? "unknown";

    // Build photoVectorArray for pgvector queries
    const photoVectorArray = vectorToArray(photoVector);

    // Blend the moment-specific context vector (if available) with the photo vector.
    // Now that allContextVectors was fetched upfront, we can look up the exact momentType
    // without an extra DB call.
    const momentContextVec = allContextVectors?.[momentType]
      ? { ...ZERO_VECTOR, ...(allContextVectors[momentType] as unknown as Record<string, number>) }
      : storedTasteVec ?? { ...ZERO_VECTOR };
    const combined = blendVectors(momentContextVec, photoVector, photoConfidence);

    upsertContextVector(user.id, momentType, combined).catch(() => {});

    return NextResponse.json({ ...result, photoVectorArray });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/analyze error:", message);
    return NextResponse.json({ error: "Analysis failed", detail: message }, { status: 500 });
  }
}
