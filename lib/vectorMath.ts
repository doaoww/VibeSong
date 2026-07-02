import type { EmotionalVector } from "./emotionalVector";
import { VECTOR_KEYS as _VECTOR_KEYS } from "./emotionalVector";

export { VECTOR_KEYS } from "./emotionalVector";

const VECTOR_KEYS = _VECTOR_KEYS;

export function vectorToArray(v: EmotionalVector): number[] {
  // VECTOR_KEYS is an outer-realm Array, so .map returns an outer-realm Array too.
  return VECTOR_KEYS.map((k) => v[k]);
}

export function arrayToVector(a: number[]): EmotionalVector {
  const result = {} as EmotionalVector;
  VECTOR_KEYS.forEach((k, i) => { result[k] = a[i] ?? 0; });
  return result;
}

/**
 * Clamp a vibe boost within the photo dimension's tolerance window.
 * The requested vibe can shift the photo direction but cannot override it.
 * target_dim = clamp(photo_dim + vibe_boost, photo_dim - 0.25, photo_dim + 0.35)
 */
export function applyVibeCap(photoDim: number, vibeBoost: number): number {
  const raw = photoDim + vibeBoost;
  return Math.max(photoDim - 0.25, Math.min(photoDim + 0.35, raw));
}

/**
 * Build the final query vector from photo + taste + optional vibe signals.
 * boosts: partial map of dimension name → boost value from vibe parsing.
 * If vibeVec is null, uses a confidence-weighted 2-signal blend (photoWeight
 * ranges 0.2-0.7 as photoConfidence goes 0-1, mirroring blendVectors in
 * lib/emotionalVector.ts so the query vector and the persisted taste profile
 * use the same trust-the-photo-more-when-confident principle).
 * With vibeVec, uses the fixed 3-signal blend (photoConfidence unused there —
 * the requested-vibe feature is not yet live).
 */
export function blendQueryVector(
  photoArr: number[],
  tasteArr: number[],
  vibeArr: number[] | null,
  boosts: Partial<Record<keyof EmotionalVector, number>>,
  photoConfidence: number
): number[] {
  if (!vibeArr) {
    const photoWeight = 0.2 + Math.max(0, Math.min(1, photoConfidence)) * 0.5;
    const tasteWeight = 1 - photoWeight;
    return photoArr.map((p, i) => p * photoWeight + tasteArr[i] * tasteWeight);
  }
  return photoArr.map((p, i) => {
    const key = VECTOR_KEYS[i];
    const blended = p * 0.40 + tasteArr[i] * 0.25 + vibeArr[i] * 0.35;
    const boost = boosts[key];
    if (boost !== undefined) {
      return applyVibeCap(p, boost);
    }
    return blended;
  });
}

/** Cosine similarity between two equal-length arrays. Returns 0 for zero vectors. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
