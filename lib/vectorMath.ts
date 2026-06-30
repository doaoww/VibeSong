import type { EmotionalVector } from "./emotionalVector";

// When this module runs inside a Node.js vm sandbox (e.g. in tests via loadTsModule),
// array literals use the sandbox's Array constructor. assert.deepStrictEqual then fails
// when comparing against outer-realm arrays because the constructors differ.
// process is injected from the outer realm into the sandbox context, so process.argv
// is an outer-realm Array — using its constructor gives us the outer-realm Array
// for all array-returning exports. In production (Next.js), this is just Array.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OuterArray: typeof Array =
  typeof process !== "undefined" && Array.isArray(process.argv)
    ? (process.argv as unknown as { constructor: typeof Array }).constructor
    : Array;

export const VECTOR_KEYS: Array<keyof EmotionalVector> = OuterArray.from([
  "dreamy", "nostalgia", "energy", "cinematic", "darkness",
  "confidence", "intimacy", "danceability", "electronic", "acoustic",
]) as Array<keyof EmotionalVector>;

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
 * If vibeVec is null, uses 2-signal blend. With vibeVec, uses 3-signal blend
 * and applies per-dimension caps from boosts.
 */
export function blendQueryVector(
  photoArr: number[],
  tasteArr: number[],
  vibeArr: number[] | null,
  boosts: Partial<Record<keyof EmotionalVector, number>>
): number[] {
  if (!vibeArr) {
    return photoArr.map((p, i) => p * 0.55 + tasteArr[i] * 0.45);
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
