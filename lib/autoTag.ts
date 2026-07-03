import openai from "./openai";
import type { EmotionalVector } from "./emotionalVector";
import { ZERO_VECTOR } from "./emotionalVector";
import {
  STORY_INTENT_TAGS,
  MODERN_AESTHETIC_TAGS,
  MOOD_TAGS,
  STORY_CONTEXT_TAGS,
  STORY_INTENT_TAGS_SET,
  MODERN_AESTHETIC_TAGS_SET,
  MOOD_TAGS_SET,
  STORY_CONTEXT_TAGS_SET,
  splitByCanonical,
  normalizeStringArray,
} from "./tagTaxonomy";
import { NullLyricsProvider } from "./lyrics";
import type { LyricsProvider } from "./lyrics";
import { parseMusicSupervisorBrief, buildBriefText } from "./musicSupervisorBrief";
import { embedText } from "./embeddings";

export type ConfidenceLevel = "known_track" | "known_artist_only" | "metadata_inference" | "uncertain";

const CONFIDENCE_LEVEL_SCORES: Record<ConfidenceLevel, number> = {
  known_track: 0.9,
  known_artist_only: 0.6,
  metadata_inference: 0.4,
  uncertain: 0.25,
};

/** Maps GPT's categorical self-assessment to a fixed numeric score — never trusts a raw self-reported number. */
export function mapConfidenceLevel(level: string): number {
  return CONFIDENCE_LEVEL_SCORES[level as ConfidenceLevel] ?? CONFIDENCE_LEVEL_SCORES.uncertain;
}

export interface SourceConfidenceResult {
  score: number;
  evidenceSources: string[];
}

/**
 * Deterministic confidence from what evidence was actually available.
 * Lyrics deliberately do not contribute yet — NullLyricsProvider is a no-op seam.
 */
export function computeSourceConfidence(
  matchType: "exact" | "fallback" | "none",
  lastfmTags: string[],
  durationSeconds: number | null,
  year: number | null
): SourceConfidenceResult {
  let score = 0;
  const evidenceSources: string[] = [];

  if (matchType === "exact") {
    score += 0.4;
    evidenceSources.push("itunes_exact");
  } else if (matchType === "fallback") {
    score += 0.2;
    evidenceSources.push("itunes_fallback");
  }

  if (lastfmTags.length > 0) {
    score += 0.3;
    evidenceSources.push("lastfm_tags");
  }

  if (durationSeconds !== null && year !== null) {
    score += 0.15;
    evidenceSources.push("metadata_complete");
  }

  return { score: Math.max(0, Math.min(1, score)), evidenceSources };
}

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
  story_context_tags: string[];
  discarded_tags: string[];
  vibe_summary: string;
  music_supervisor_summary: string;
  brief_embedding: number[];
  confidence_level: ConfidenceLevel;
  confidence_reason: string;
  gpt_confidence: number;
  source_confidence: number;
  final_confidence: number;
  needs_review: boolean;
  evidence_sources: string[];
  tagging_version: string;
  itunes_preview_url: string | null;
  artwork_url: string | null;
  apple_music_url: string | null;
  youtube_id: string | null;
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

interface ItunesLookupResult {
  track: ItunesTrack | null;
  matchType: "exact" | "fallback" | "none";
}

function normalizeMatchValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function fetchItunesMeta(title: string, artist: string): Promise<ItunesLookupResult> {
  const q = encodeURIComponent(`${title} ${artist}`);
  const url = `https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=5`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { track: null, matchType: "none" };
    const data = await res.json();
    const results: ItunesTrack[] = data?.results ?? [];
    const normalizedTitle = normalizeMatchValue(title);
    const normalizedArtist = normalizeMatchValue(artist);
    const exact = results.find((r) => {
      const returnedTitle = normalizeMatchValue(r.trackName ?? "");
      const returnedArtist = normalizeMatchValue(r.artistName ?? "");
      return returnedTitle === normalizedTitle && returnedArtist === normalizedArtist;
    });
    if (exact) return { track: exact, matchType: "exact" };
    if (results[0]) return { track: results[0], matchType: "fallback" };
    return { track: null, matchType: "none" };
  } catch {
    return { track: null, matchType: "none" };
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
  "language": "the actual vocal language (e.g. Russian, English, Korean, Kazakh) ONLY if you recognize this specific track well enough to know it; use \"Instrumental\" only if you are confident it has no vocals; if you do not actually know this song, use \"Unknown\" — never guess Instrumental as a default for an unfamiliar track",
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
  "mood_tags": ["2-4 tags, ONLY from this list: ${MOOD_TAGS.join(", ")}"],
  "story_intent_tags": ["2-5 tags, ONLY from this list: ${STORY_INTENT_TAGS.join(", ")}"],
  "modern_aesthetic_tags": ["2-5 tags, ONLY from this list: ${MODERN_AESTHETIC_TAGS.join(", ")}"],
  "story_context_tags": ["2-5 tags, ONLY from this list: ${STORY_CONTEXT_TAGS.join(", ")}"],
  "vibe_summary": "1-2 short sentences in natural language describing this song's feeling/story",
  "musicSupervisorBrief": {
    "narrative": "1-2 sentences: what this song is about, the story or feeling it carries",
    "emotionalSubtext": "1 sentence: what's underneath the surface mood, if anything — irony, contrast, restraint",
    "restraint": "understated | balanced | expressive",
    "context": "1 sentence: what kind of moment or photo a music supervisor would reach for this song for",
    "direction": "1-2 sentences: what this song emotionally delivers — energy character, sonic space",
    "avoid": "0-1 sentence, optional: what this song should NOT be paired with — leave empty string if nothing is worth flagging"
  },
  "confidence_level": "one of: known_track, known_artist_only, metadata_inference, uncertain — how well do you actually know THIS SPECIFIC SONG, not just the artist's general style",
  "confidence_reason": "one short sentence justifying the confidence_level"
}

Be precise. Every value matters for song matching quality. Never invent tags outside the given lists — pick the closest canonical option instead.`;
}

export interface ParsedTagResponse {
  language: string;
  popularity_tier: number;
  emotional_vector: EmotionalVector;
  genre_tags: string[];
  aesthetic_tags: string[];
  mood_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  story_context_tags: string[];
  discarded_tags: string[];
  vibe_summary: string;
  music_supervisor_summary: string;
  confidence_level: ConfidenceLevel;
  confidence_reason: string;
}

const VALID_CONFIDENCE_LEVELS = new Set<string>(["known_track", "known_artist_only", "metadata_inference", "uncertain"]);

export function parseGptTagResponse(raw: string): ParsedTagResponse {
  const fallback: ParsedTagResponse = {
    language: "Unknown",
    popularity_tier: 3,
    emotional_vector: { ...ZERO_VECTOR },
    genre_tags: [],
    aesthetic_tags: [],
    mood_tags: [],
    story_intent_tags: [],
    modern_aesthetic_tags: [],
    story_context_tags: [],
    discarded_tags: [],
    vibe_summary: "",
    music_supervisor_summary: "",
    confidence_level: "uncertain",
    confidence_reason: "",
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

    const proposedMood = normalizeStringArray(parsed.mood_tags);
    const proposedStoryIntent = normalizeStringArray(parsed.story_intent_tags);
    const proposedModernAesthetic = normalizeStringArray(parsed.modern_aesthetic_tags);
    const proposedStoryContext = normalizeStringArray(parsed.story_context_tags);

    const moodSplit = splitByCanonical(proposedMood, MOOD_TAGS_SET);
    const storyIntentSplit = splitByCanonical(proposedStoryIntent, STORY_INTENT_TAGS_SET);
    const modernAestheticSplit = splitByCanonical(proposedModernAesthetic, MODERN_AESTHETIC_TAGS_SET);
    const storyContextSplit = splitByCanonical(proposedStoryContext, STORY_CONTEXT_TAGS_SET);

    const confidenceLevelRaw = typeof parsed.confidence_level === "string" ? parsed.confidence_level : "uncertain";
    const confidence_level: ConfidenceLevel = VALID_CONFIDENCE_LEVELS.has(confidenceLevelRaw)
      ? (confidenceLevelRaw as ConfidenceLevel)
      : "uncertain";

    return {
      language: typeof parsed.language === "string" ? parsed.language : "Unknown",
      popularity_tier:
        typeof parsed.popularity_tier === "number" ? Math.round(parsed.popularity_tier) : 3,
      emotional_vector,
      genre_tags: normalizeStringArray(parsed.genre_tags),
      aesthetic_tags: normalizeStringArray(parsed.aesthetic_tags),
      mood_tags: moodSplit.accepted,
      story_intent_tags: storyIntentSplit.accepted,
      modern_aesthetic_tags: modernAestheticSplit.accepted,
      story_context_tags: storyContextSplit.accepted,
      discarded_tags: [
        ...moodSplit.rejected,
        ...storyIntentSplit.rejected,
        ...modernAestheticSplit.rejected,
        ...storyContextSplit.rejected,
      ],
      vibe_summary: typeof parsed.vibe_summary === "string" ? parsed.vibe_summary : "",
      music_supervisor_summary: buildBriefText(parseMusicSupervisorBrief(parsed.musicSupervisorBrief)),
      confidence_level,
      confidence_reason: typeof parsed.confidence_reason === "string" ? parsed.confidence_reason : "",
    };
  } catch {
    return fallback;
  }
}

export async function autoTagSong(
  title: string,
  artist: string,
  lyricsProvider: LyricsProvider = new NullLyricsProvider()
): Promise<AutoTagResult> {
  const [itunesLookup, lastfmTags] = await Promise.all([
    fetchItunesMeta(title, artist),
    fetchLastfmTags(title, artist),
  ]);
  const itunesMeta = itunesLookup.track;

  const prompt = buildGptTagPrompt(title, artist, lastfmTags);
  let rawGpt = "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
      temperature: 0,
    });
    rawGpt = res.choices[0].message.content ?? "";
  } catch (err) {
    console.error("[autoTag] GPT failed:", err);
  }

  const gptData = parseGptTagResponse(rawGpt);

  const briefEmbedding = gptData.music_supervisor_summary
    ? await embedText(gptData.music_supervisor_summary)
    : [];

  const durationSeconds = itunesMeta?.trackTimeMillis
    ? Math.round(itunesMeta.trackTimeMillis / 1000)
    : null;
  const year = itunesMeta?.releaseDate ? new Date(itunesMeta.releaseDate).getFullYear() : null;

  // Reserved seam — always null today, does not affect source_confidence.
  await lyricsProvider.fetchLyrics(title, artist);

  const { score: source_confidence, evidenceSources: evidence_sources } = computeSourceConfidence(
    itunesLookup.matchType,
    lastfmTags,
    durationSeconds,
    year
  );
  const gpt_confidence = mapConfidenceLevel(gptData.confidence_level);
  const final_confidence = Math.min(gpt_confidence, source_confidence);

  return {
    title: itunesMeta?.trackName ?? title,
    artist: itunesMeta?.artistName ?? artist,
    album: itunesMeta?.collectionName ?? null,
    year,
    duration_seconds: durationSeconds,
    language: gptData.language,
    popularity_tier: gptData.popularity_tier,
    emotional_vector: gptData.emotional_vector,
    genre_tags: gptData.genre_tags,
    aesthetic_tags: gptData.aesthetic_tags,
    mood_tags: gptData.mood_tags,
    story_intent_tags: gptData.story_intent_tags,
    modern_aesthetic_tags: gptData.modern_aesthetic_tags,
    story_context_tags: gptData.story_context_tags,
    discarded_tags: gptData.discarded_tags,
    vibe_summary: gptData.vibe_summary,
    music_supervisor_summary: gptData.music_supervisor_summary,
    brief_embedding: briefEmbedding,
    confidence_level: gptData.confidence_level,
    confidence_reason: gptData.confidence_reason,
    gpt_confidence,
    source_confidence,
    final_confidence,
    needs_review: final_confidence < 0.6,
    evidence_sources,
    tagging_version: "v1",
    itunes_preview_url: itunesMeta?.previewUrl ?? null,
    artwork_url: itunesMeta?.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
    apple_music_url: itunesMeta?.trackViewUrl ?? null,
    youtube_id: null,
    energy: gptData.emotional_vector.energy,
  };
}
