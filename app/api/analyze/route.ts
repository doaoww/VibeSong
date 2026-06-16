import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";
import {
  applyAvoidPenalties,
  applyLanguagePenalty,
  getDiscoveryInstructions,
  normalizeCandidateScores,
  normalizeTaste,
  type CandidateTrack,
  type UserTaste,
} from "../../../lib/matching";
import { auth } from "../../../auth";
import { getUserTaste } from "../../../lib/db/userTaste";
import { getFeedback } from "../../../lib/db/trackFeedback";
import { buildAggregateTasteProfile, type AggregateTasteProfile } from "../../../lib/tasteProfile";

export const runtime = "nodejs";

const BASE_SYSTEM_PROMPT = `You are a music curator with deep knowledge of every genre, subculture, and scene -- not a mainstream playlist algorithm. Your job is to find songs that genuinely fit BOTH the photo and the listener's taste.

PHOTO ANALYSIS RULES:
- Look closely for people, their visible emotions, posture, facial expression, relationship/social vibe, activity, setting, time of day, weather, fashion, camera feel, lighting, colors, and aesthetic.
- Convert the image into music supervision language: energy, valence, intimacy, confidence, nostalgia, movement, texture, and scene.
- If people are present, the emotional/social reading matters as much as the background.
- If no people are present, infer mood from scene, color, light, composition, and object context.

SONG SELECTION RULES:
- Songs must be REAL tracks that exist on YouTube/Spotify (verifiable artist + title)
- Prefer 2018-2026 but allow timeless tracks if they perfectly match the vibe
- DO NOT default to chart-topping mainstream hits -- anyone can do that
- DO pick cult favorites, critically acclaimed albums, scene anthems, deep cuts, and genre-defining tracks that most people haven't heard but fans would immediately recognize
- Avoid: Levitating, Blinding Lights, Watermelon Sugar, Shape of You, or any song that has been in every ad/reel for 3 years
- Each recommendation must feel like a friend with great taste specifically chose it for THIS photo
- viralMomentSeconds = the timestamp (seconds) of the most emotionally resonant moment of the track
- Famous artists are allowed. Lazy obvious songs are not. A deep cut from a known artist can be excellent.

SCORING RULES:
- photoFitScore: 0-100, how well the song matches the exact image.
- tasteFitScore: 0-100, how likely this user is to personally like it.
- discoveryFitScore: 0-100, how well it matches the user's desired discovery style.
- obviousnessPenalty: 0-40, how lazy/overused/obvious the song choice is.
- finalScore: 61-97, balanced total after scores and penalty.
- Every finalScore should be realistic, not all 90+.

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
    "mood": "string",
    "tracks": [
      {
        "title": "string",
        "artist": "string",
        "genres": ["string", "string"],
        "language": "string -- the language the vocals are actually sung in (e.g. English, Korean, Spanish, Russian, Uzbek), or Instrumental if there are no vocals",
        "reason": "string -- 1 sentence: exactly why THIS song's texture/mood fits THIS specific photo and user taste",
        "matchScore": 94,
        "photoFitScore": 92,
        "tasteFitScore": 88,
        "discoveryFitScore": 85,
        "obviousnessPenalty": 4,
        "finalScore": 89,
        "viralMomentSeconds": 62
      }
    ]
  },
  "vibeMetrics": {
    "intimacy": 0.0,
    "confidence": 0.0,
    "nostalgia": 0.0,
    "movement": 0.0
  },
  "vibeCaption": "string",
  "vibeTags": ["string", "string", "string"]
}
NUMBER RULES:
- matchScore/finalScore/photoFitScore/tasteFitScore/discoveryFitScore: INTEGER 0-100. NEVER decimal.
- obviousnessPenalty: INTEGER 0-40. Use it for overused songs, meme songs, lazy chart defaults, or tracks that are too obvious for the photo.
- viralMomentSeconds: INTEGER seconds (e.g. 62, 45, 30).
- energy, valence, brightness, intensity: floats 0.0–1.0.

PER-TRACK GENRES:
- Each track's "genres" array is THAT SPECIFIC SONG's genres, not the overall photo vibe. Be specific (e.g. "lo-fi soul" not "R&B"), 1-3 entries.
- This matters: we use it to learn what the listener actually saves vs skips over time, so it must reflect the real song, not the photo.

Generate exactly 24 candidate tracks. Use a mix of familiar hidden gems, taste-adjacent tracks, niche discoveries, and photo-perfect wildcards. vibeTags: exactly 3. NO lazy overplayed hits.`;

function buildTasteBlock(taste: UserTaste): string {
  return `

USER TASTE PROFILE (this is the most important personalization signal):
- Genres they love: ${taste.genres.join(", ") || "not specified"}
- Favorite artists: ${taste.favoriteArtists.join(", ") || "not specified"}
- Use your own knowledge of these artists' sound and scene to find sonic twins and adjacent acts -- don't limit yourself to a fixed list.
- Their mood preference: ${taste.defaultMood || "not specified"}
- Discovery style: ${taste.discoveryStyle}
- Discovery instructions: ${getDiscoveryInstructions(taste.discoveryStyle)}
- Avoid these when possible: ${taste.dislikes.join(", ") || "not specified"}
- Language/region preference: ${taste.languagePreference}
- Energy preference: ${taste.energyPreference}

TASTE OVERRIDE RULES:
1. At least half of candidates must fit the user's genres, favorite artists, or adjacent scenes.
2. At least 4 candidates should be by exact favorite artists or close sonic twins if that does not clash with the photo.
3. Go deep into their genres: album cuts, B-sides, cult classics, critical darlings, and scene favorites.
4. If dislikes conflict with a candidate, increase obviousnessPenalty or remove it.
5. Still make sure nothing clashes with the photo. A chill evening photo should not get aggressive trap unless user taste and visual energy strongly support it.
6. The goal: recommendations that make the user say "how did it know I'd like this?"`;
}

function buildAggregateTasteBlock(profile: AggregateTasteProfile): string {
  const hasSignal =
    profile.learnedGenres.length > 0 ||
    profile.avoidGenres.length > 0 ||
    profile.learnedArtists.length > 0 ||
    profile.avoidArtists.length > 0;
  if (!hasSignal) return "";

  return `

LEARNED TASTE SIGNALS (from this user's save/skip history across all past matches):
- Genres they keep saving: ${profile.learnedGenres.join(", ") || "none yet"}
- Genres they keep skipping, avoid these: ${profile.avoidGenres.join(", ") || "none"}
- Artists they keep saving: ${profile.learnedArtists.join(", ") || "none yet"}
- Artists they keep skipping, avoid these: ${profile.avoidArtists.join(", ") || "none"}

Treat this as a strong signal, refined over many past matches -- stronger than a single quiz answer.`;
}

function buildPrompt(taste: UserTaste, aggregate: AggregateTasteProfile): string {
  const hasTaste =
    taste.setupComplete &&
    (taste.genres.length > 0 ||
      taste.favoriteArtists.length > 0 ||
      taste.defaultMood ||
      taste.discoveryStyle !== "balanced" ||
      taste.dislikes.length > 0 ||
      taste.languagePreference !== "No preference" ||
      taste.energyPreference !== "depends");

  return (
    BASE_SYSTEM_PROMPT +
    (hasTaste ? buildTasteBlock(taste) : "") +
    buildAggregateTasteBlock(aggregate)
  );
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

function normalizeScores(
  result: { musicDNA?: { tracks?: CandidateTrack[] } },
  taste: UserTaste,
  aggregate: AggregateTasteProfile
) {
  if (!result?.musicDNA?.tracks) return;
  const avoided = applyAvoidPenalties(result.musicDNA.tracks, {
    avoidArtists: aggregate.avoidArtists,
    avoidGenres: aggregate.avoidGenres,
    dislikes: taste.dislikes,
  });
  const penalized = applyLanguagePenalty(avoided, taste.languagePreference);
  result.musicDNA.tracks = normalizeCandidateScores(
    penalized,
    taste.discoveryStyle
  ).slice(0, 12);
  console.log(
    "[analyze] matchScores:",
    result.musicDNA.tracks.map(
      (t) => `${String(t.title)}: ${t.matchScore}`
    )
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const { image, mimeType } = await req.json();
    if (!image || !mimeType) {
      return NextResponse.json(
        { error: "image and mimeType required" },
        { status: 400 }
      );
    }

    const storedTaste = await getUserTaste(session.user.id);
    const taste = normalizeTaste(storedTaste ?? null);

    const [savedFeedback, skippedFeedback] = await Promise.all([
      getFeedback(session.user.id, "saved", 300),
      getFeedback(session.user.id, "skipped", 300),
    ]);
    const aggregate = buildAggregateTasteProfile(savedFeedback, skippedFeedback);

    const prompt = buildPrompt(taste, aggregate);

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

    normalizeScores(result, taste, aggregate);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("/api/analyze error:", message);
    return NextResponse.json({ error: "Analysis failed", detail: message }, { status: 500 });
  }
}
