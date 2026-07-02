import {
  STORY_CONTEXT_TAGS_SET,
  STORY_INTENT_TAGS_SET,
  MODERN_AESTHETIC_TAGS_SET,
  MOOD_TAGS_SET,
  ANTI_TAG_CANDIDATES_SET,
  splitByCanonical,
  normalizeStringArray,
} from "./tagTaxonomy.ts";

export interface MusicDirection {
  genres: string[];
  references: string[];
  avoid: string[];
}

export interface EnergyBounds {
  min: number;
  max: number;
}

export interface MatchSignals {
  scene_context_tags: string[];
  story_intent_tags: string[];
  modern_aesthetic_tags: string[];
  mood_tags: string[];
  anti_tags: string[];
  music_direction: MusicDirection;
  energy_bounds: EnergyBounds;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function safeEnergyBounds(photoEnergy: number): EnergyBounds {
  return { min: clamp01(photoEnergy - 0.25), max: clamp01(photoEnergy + 0.25) };
}

function parseMusicDirection(raw: unknown): MusicDirection {
  if (!raw || typeof raw !== "object") return { genres: [], references: [], avoid: [] };
  const obj = raw as Record<string, unknown>;
  return {
    genres: normalizeStringArray(obj.genres),
    references: normalizeStringArray(obj.references),
    avoid: normalizeStringArray(obj.avoid),
  };
}

function parseEnergyBounds(raw: unknown, photoEnergy: number): EnergyBounds {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const min = obj.min;
    const max = obj.max;
    if (
      typeof min === "number" &&
      typeof max === "number" &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min >= 0 &&
      max <= 1 &&
      min <= max
    ) {
      return { min, max };
    }
  }
  return safeEnergyBounds(photoEnergy);
}

/**
 * Validates GPT's photo-analysis matchSignals block: closed-vocabulary tags
 * are checked against the catalog's own taxonomy (lib/tagTaxonomy.ts) so a
 * hallucinated tag can never reach retrieval or scoring.
 */
export function parseMatchSignals(raw: unknown, photoEnergy: number): MatchSignals {
  if (!raw || typeof raw !== "object") {
    return {
      scene_context_tags: [],
      story_intent_tags: [],
      modern_aesthetic_tags: [],
      mood_tags: [],
      anti_tags: [],
      music_direction: { genres: [], references: [], avoid: [] },
      energy_bounds: safeEnergyBounds(photoEnergy),
    };
  }
  const parsed = raw as Record<string, unknown>;

  return {
    scene_context_tags: splitByCanonical(normalizeStringArray(parsed.scene_context_tags), STORY_CONTEXT_TAGS_SET).accepted,
    story_intent_tags: splitByCanonical(normalizeStringArray(parsed.story_intent_tags), STORY_INTENT_TAGS_SET).accepted,
    modern_aesthetic_tags: splitByCanonical(normalizeStringArray(parsed.modern_aesthetic_tags), MODERN_AESTHETIC_TAGS_SET).accepted,
    mood_tags: splitByCanonical(normalizeStringArray(parsed.mood_tags), MOOD_TAGS_SET).accepted,
    anti_tags: splitByCanonical(normalizeStringArray(parsed.anti_tags), ANTI_TAG_CANDIDATES_SET).accepted,
    music_direction: parseMusicDirection(parsed.music_direction),
    energy_bounds: parseEnergyBounds(parsed.energy_bounds, photoEnergy),
  };
}
