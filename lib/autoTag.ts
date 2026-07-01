import openai from "./openai";
import type { EmotionalVector } from "./emotionalVector";
import { ZERO_VECTOR } from "./emotionalVector";

export interface AutoTagResult {
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  duration_seconds: number | null;
  language: string;
  popularity_tier: number;
  emotional_vector: EmotionalVector;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  itunes_preview_url: string | null;
  artwork_url: string | null;
  apple_music_url: string | null;
  energy: number;
}

interface ItunesTrack {
  trackName: string;
  artistName: string;
  collectionName: string;
  releaseDate: string;
  trackTimeMillis: number;
  previewUrl: string;
  artworkUrl100: string;
  trackViewUrl: string;
}

async function fetchItunesMeta(title: string, artist: string): Promise<ItunesTrack | null> {
  const q = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=5`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const results: ItunesTrack[] = data?.results ?? [];
    return (
      results.find(
        (r) =>
          r.trackName?.toLowerCase().includes(title.toLowerCase()) ||
          r.artistName?.toLowerCase().includes(artist.toLowerCase())
      ) ??
      results[0] ??
      null
    );
  } catch {
    return null;
  }
}

async function fetchLastfmTags(title: string, artist: string): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "track.getTopTags");
  url.searchParams.set("track", title);
  url.searchParams.set("artist", artist);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const tags = data?.toptags?.tag ?? [];
    return tags
      .slice(0, 8)
      .map((t: { name: string }) => t.name)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function buildGptTagPrompt(title: string, artist: string, lastfmTags: string[]): string {
  return `You are a music analyst building a structured profile for a song database.

Song: "${title}" by ${artist}
Last.fm community tags: ${lastfmTags.length > 0 ? lastfmTags.join(", ") : "none"}

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "language": "the actual vocal language (e.g. Russian, English, Korean) or Instrumental",
  "popularity_tier": 1-5 where 1=underground/niche, 3=moderate, 5=mainstream/globally known,
  "emotional_vector": {
    "dreamy": 0.0-1.0,
    "nostalgia": 0.0-1.0,
    "energy": 0.0-1.0,
    "cinematic": 0.0-1.0,
    "darkness": 0.0-1.0,
    "confidence": 0.0-1.0,
    "intimacy": 0.0-1.0,
    "danceability": 0.0-1.0,
    "electronic": 0.0-1.0,
    "acoustic": 0.0-1.0
  },
  "genre_tags": ["1-3 specific genre strings for this exact song"],
  "aesthetic_tags": ["2-4 aesthetic words: dark, dreamy, raw, euphoric, nostalgic, etc."],
  "mood_tags": ["2-4 mood words: melancholic, euphoric, chaotic, cozy, etc."],
  "story_intent_tags": ["2-4 from this list only: post-breakup confidence, expensive sadness, soft revenge, she'll regret losing you, cold Russian melancholy, toxic but iconic, quiet luxury, main character walk, private story energy, clean girl morning, lonely but pretty, night-luxe, cinematic soft flex, modern romantic, not basic TikTok, Slavic sad girl, hot girl summer, dark feminine, cool girl car selfie, dark academia moment, healing era, confident comeback, bittersweet nostalgia, chaotic but cute"],
  "modern_aesthetic_tags": ["1-3 aesthetic movement tags: quiet luxury, dark academia, Slavic underground, bedroom pop intimacy, etc."]
}

Be precise. Every value matters for song matching quality.`;
}

export function parseGptTagResponse(raw: string): {
  language: string;
  popularity_tier: number;
  emotional_vector: EmotionalVector;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
} {
  const fallback = {
    language: "Unknown",
    popularity_tier: 3,
    emotional_vector: { ...ZERO_VECTOR },
    genre_tags: [] as string[],
    aesthetic_tags: [] as string[],
    mood_tags: [] as string[],
    story_intent_tags: [] as string[],
    modern_aesthetic_tags: [] as string[],
  };

  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) return fallback;
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

    const ev = parsed.emotional_vector ?? {};
    const emotional_vector: EmotionalVector = {
      dreamy: Number(ev.dreamy ?? 0),
      nostalgia: Number(ev.nostalgia ?? 0),
      energy: Number(ev.energy ?? 0),
      cinematic: Number(ev.cinematic ?? 0),
      darkness: Number(ev.darkness ?? 0),
      confidence: Number(ev.confidence ?? 0),
      intimacy: Number(ev.intimacy ?? 0),
      danceability: Number(ev.danceability ?? 0),
      electronic: Number(ev.electronic ?? 0),
      acoustic: Number(ev.acoustic ?? 0),
    };

    return {
      language: typeof parsed.language === "string" ? parsed.language : "Unknown",
      popularity_tier:
        typeof parsed.popularity_tier === "number" ? Math.round(parsed.popularity_tier) : 3,
      emotional_vector,
      genre_tags: Array.isArray(parsed.genre_tags) ? parsed.genre_tags.filter(Boolean) : [],
      aesthetic_tags: Array.isArray(parsed.aesthetic_tags)
        ? parsed.aesthetic_tags.filter(Boolean)
        : [],
      mood_tags: Array.isArray(parsed.mood_tags) ? parsed.mood_tags.filter(Boolean) : [],
      story_intent_tags: Array.isArray(parsed.story_intent_tags)
        ? parsed.story_intent_tags.filter(Boolean)
        : [],
      modern_aesthetic_tags: Array.isArray(parsed.modern_aesthetic_tags)
        ? parsed.modern_aesthetic_tags.filter(Boolean)
        : [],
    };
  } catch {
    return fallback;
  }
}

export async function autoTagSong(title: string, artist: string): Promise<AutoTagResult> {
  const [itunesMeta, lastfmTags] = await Promise.all([
    fetchItunesMeta(title, artist),
    fetchLastfmTags(title, artist),
  ]);

  const prompt = buildGptTagPrompt(title, artist, lastfmTags);
  let rawGpt = "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0,
    });
    rawGpt = res.choices[0].message.content ?? "";
  } catch (err) {
    console.error("[autoTag] GPT failed:", err);
  }

  const gptData = parseGptTagResponse(rawGpt);

  return {
    title: itunesMeta?.trackName ?? title,
    artist: itunesMeta?.artistName ?? artist,
    album: itunesMeta?.collectionName ?? null,
    year: itunesMeta?.releaseDate ? new Date(itunesMeta.releaseDate).getFullYear() : null,
    duration_seconds: itunesMeta?.trackTimeMillis
      ? Math.round(itunesMeta.trackTimeMillis / 1000)
      : null,
    language: gptData.language,
    popularity_tier: gptData.popularity_tier,
    emotional_vector: gptData.emotional_vector,
    genre_tags: gptData.genre_tags,
    aesthetic_tags: gptData.aesthetic_tags,
    mood_tags: gptData.mood_tags,
    story_intent_tags: gptData.story_intent_tags,
    modern_aesthetic_tags: gptData.modern_aesthetic_tags,
    itunes_preview_url: itunesMeta?.previewUrl ?? null,
    artwork_url: itunesMeta?.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
    apple_music_url: itunesMeta?.trackViewUrl ?? null,
    energy: gptData.emotional_vector.energy,
  };
}
