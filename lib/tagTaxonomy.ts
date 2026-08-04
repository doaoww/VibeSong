// Canonical tag vocabularies for song catalog matching categories.
// GPT may only select from these lists — never invent new values.
// Expanding a list here is cheap; letting GPT free-form tags is not.

export const STORY_INTENT_TAGS = [
  "post-breakup confidence",
  "expensive sadness",
  "soft revenge",
  "she'll regret losing you",
  "cold Russian melancholy",
  "toxic but iconic",
  "quiet luxury",
  "main character walk",
  "private story energy",
  "clean girl morning",
  "lonely but pretty",
  "night-luxe",
  "cinematic soft flex",
  "modern romantic",
  "not basic TikTok",
  "Slavic sad girl",
  "hot girl summer",
  "dark feminine",
  "cool girl car selfie",
  "dark academia moment",
  "healing era",
  "confident comeback",
  "bittersweet nostalgia",
  "chaotic but cute",
  "gym flex",
  "night drive alone",
  "hustle grind",
  "rap swagger",
  "rock grit",
  "stoic heartbreak",
  "streetwear energy",
  "game day",
] as const;

export const MODERN_AESTHETIC_TAGS = [
  "quiet luxury",
  "coquette",
  "indie sleaze",
  "dark academia",
  "slavic underground",
  "clean girl",
  "old money",
  "soft grunge",
  "bedroom pop",
  "dark feminine",
  "night luxe",
  "mob wife",
  "pinterest girl",
  "russian indie",
  "alt girl",
  "French chic",
  "Scandi minimal",
  "Latin heat",
  "Japanese minimalist",
  "K-pop glossy",
] as const;

export const MOOD_TAGS = [
  "melancholic",
  "euphoric",
  "chaotic",
  "cozy",
  "nostalgic",
  "dreamy",
  "calm",
  "serene",
] as const;

export const STORY_CONTEXT_TAGS = [
  "mirror selfie",
  "sunset",
  "night drive",
  "cafe",
  "car selfie",
  "gym",
  "beach",
  "city walk",
  "party",
  "outfit check",
  "travel",
  "group photo",
  "workout",
  "sports",
  "study grind",
] as const;

export const STORY_INTENT_TAGS_SET: Set<string> = new Set(STORY_INTENT_TAGS);
export const MODERN_AESTHETIC_TAGS_SET: Set<string> = new Set(MODERN_AESTHETIC_TAGS);
export const MOOD_TAGS_SET: Set<string> = new Set(MOOD_TAGS);
export const STORY_CONTEXT_TAGS_SET: Set<string> = new Set(STORY_CONTEXT_TAGS);

export interface CanonicalSplit {
  accepted: string[];
  rejected: string[];
}

/** Splits GPT's proposed tags into those present in the canonical set and those that aren't. */
export function splitByCanonical(proposed: string[], canonical: Set<string>): CanonicalSplit {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const tag of proposed) {
    if (canonical.has(tag)) accepted.push(tag);
    else rejected.push(tag);
  }
  return { accepted, rejected };
}

export const ANTI_TAG_CANDIDATES_SET: Set<string> = new Set([
  ...STORY_INTENT_TAGS,
  ...MODERN_AESTHETIC_TAGS,
  ...MOOD_TAGS,
]);

/** Cleans a proposed string array from GPT: keeps only non-empty trimmed strings. */
export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Internal-only gender/POV signal — used to softly deprioritize (never
 * exclude) a song whose lyrical address clearly conflicts with a photo's
 * subject. "male"/"female" describe who the song's lyrics are written
 * from/addressed to on the song side, and how a photo's subject reads on
 * the photo side — the same four values on both sides keeps the mismatch
 * check a plain equality comparison. Always safe to default to "unclear":
 * that value never triggers a penalty.
 */
export type PovSignal = "male" | "female" | "neutral" | "unclear";

export const POV_SIGNALS: readonly PovSignal[] = ["male", "female", "neutral", "unclear"];

const POV_SIGNALS_SET: Set<string> = new Set(POV_SIGNALS);

/** Coerces any GPT output to a valid PovSignal, defaulting to the safe no-op value. */
export function coercePovSignal(value: unknown): PovSignal {
  return typeof value === "string" && POV_SIGNALS_SET.has(value) ? (value as PovSignal) : "unclear";
}
