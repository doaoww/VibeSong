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
] as const;

export const MOOD_TAGS = [
  "melancholic",
  "euphoric",
  "chaotic",
  "cozy",
  "nostalgic",
  "dreamy",
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
