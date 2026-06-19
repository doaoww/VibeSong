export interface EmotionalVector {
  dreamy: number;
  nostalgia: number;
  energy: number;
  cinematic: number;
  darkness: number;
  confidence: number;
  intimacy: number;
  danceability: number;
  electronic: number;
  acoustic: number;
}

export const ZERO_VECTOR: EmotionalVector = {
  dreamy: 0, nostalgia: 0, energy: 0, cinematic: 0, darkness: 0,
  confidence: 0, intimacy: 0, danceability: 0, electronic: 0, acoustic: 0,
};

export const VECTOR_KEYS = Object.keys(ZERO_VECTOR) as Array<keyof EmotionalVector>;

export function addVectors(a: EmotionalVector, b: EmotionalVector, scale = 1): EmotionalVector {
  const result = { ...a };
  for (const key of VECTOR_KEYS) {
    result[key] = a[key] + b[key] * scale;
  }
  return result;
}

export function normalizeVector(v: EmotionalVector): EmotionalVector {
  const max = Math.max(...VECTOR_KEYS.map((k) => v[k]), 0.01);
  const result = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    result[key] = Math.min(1, v[key] / max);
  }
  return result;
}

export function buildTasteVector(
  saved: Array<{ emotionalVector?: Partial<EmotionalVector> }>,
  skipped: Array<{ emotionalVector?: Partial<EmotionalVector> }>
): EmotionalVector {
  let vec = { ...ZERO_VECTOR };
  for (const song of saved) {
    if (!song.emotionalVector) continue;
    for (const key of VECTOR_KEYS) {
      vec[key] += (song.emotionalVector[key] ?? 0);
    }
  }
  for (const song of skipped) {
    if (!song.emotionalVector) continue;
    for (const key of VECTOR_KEYS) {
      vec[key] -= (song.emotionalVector[key] ?? 0) * 0.2;
    }
  }
  for (const key of VECTOR_KEYS) {
    vec[key] = Math.max(0, vec[key]);
  }
  return normalizeVector(vec);
}

export function blendVectors(
  tasteVec: EmotionalVector,
  photoVec: EmotionalVector,
  photoConfidence: number
): EmotionalVector {
  const photoWeight = 0.2 + Math.min(1, Math.max(0, photoConfidence)) * 0.5;
  const tasteWeight = 1 - photoWeight;
  const result = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    result[key] = Math.min(1, tasteVec[key] * tasteWeight + photoVec[key] * photoWeight);
  }
  return result;
}

export function invertVector(v: EmotionalVector): EmotionalVector {
  const result = { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) {
    result[key] = Math.round((1 - v[key]) * 100) / 100;
  }
  return result;
}

export function emotionalVectorToPromptString(v: EmotionalVector): string {
  return VECTOR_KEYS.map((k) => `${k}: ${v[k].toFixed(2)}`).join(" | ");
}

export function isValidEmotionalVector(v: unknown): v is EmotionalVector {
  if (!v || typeof v !== "object") return false;
  return VECTOR_KEYS.every((k) => typeof (v as Record<string, unknown>)[k] === "number");
}
