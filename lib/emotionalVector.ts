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

// Maps genre keywords → emotional traits so we can build a taste vector
// even when songs don't have explicit emotionalVector attached (e.g. seed pool songs)
const GENRE_VECTORS: Array<{ keywords: string[]; vec: Partial<EmotionalVector> }> = [
  { keywords: ["r&b", "soul", "neo-soul"], vec: { intimacy: 0.8, dreamy: 0.6, energy: 0.3, acoustic: 0.4 } },
  { keywords: ["hip-hop", "rap", "trap", "drill"], vec: { energy: 0.85, confidence: 0.85, danceability: 0.7, darkness: 0.4 } },
  { keywords: ["lo-fi", "ambient", "chillwave"], vec: { dreamy: 0.9, acoustic: 0.6, energy: 0.1, intimacy: 0.5 } },
  { keywords: ["pop", "synth-pop", "dance-pop"], vec: { danceability: 0.75, energy: 0.65, confidence: 0.55 } },
  { keywords: ["indie", "indie pop", "indie rock", "bedroom pop"], vec: { dreamy: 0.75, acoustic: 0.65, intimacy: 0.55 } },
  { keywords: ["electronic", "edm", "house", "techno", "hyperpop"], vec: { electronic: 0.9, energy: 0.85, danceability: 0.85 } },
  { keywords: ["jazz", "bossa nova"], vec: { intimacy: 0.75, acoustic: 0.8, dreamy: 0.5 } },
  { keywords: ["alternative", "rock", "punk", "grunge"], vec: { energy: 0.75, confidence: 0.65, darkness: 0.5 } },
  { keywords: ["afrobeats", "afropop", "afro"], vec: { danceability: 0.9, energy: 0.8, confidence: 0.7 } },
  { keywords: ["k-pop", "j-pop"], vec: { danceability: 0.85, energy: 0.8, confidence: 0.75 } },
  { keywords: ["classical", "orchestral", "film score", "cinematic"], vec: { cinematic: 0.85, acoustic: 0.8, dreamy: 0.5 } },
  { keywords: ["country", "folk", "acoustic"], vec: { acoustic: 0.8, nostalgia: 0.75, intimacy: 0.55 } },
  { keywords: ["dancehall", "reggae", "reggaeton"], vec: { danceability: 0.85, energy: 0.7, confidence: 0.65 } },
  { keywords: ["metal", "heavy metal", "hardcore"], vec: { energy: 1.0, darkness: 0.85, confidence: 0.8 } },
  { keywords: ["dark pop", "dark wave"], vec: { darkness: 0.75, energy: 0.5, electronic: 0.55 } },
  { keywords: ["nostalgic", "throwback", "retro", "2000s", "90s"], vec: { nostalgia: 0.9, dreamy: 0.4 } },
  { keywords: ["gospel", "spiritual"], vec: { confidence: 0.75, energy: 0.65, intimacy: 0.5 } },
];

export function genresToVector(genres: string[]): EmotionalVector {
  const lower = genres.map((g) => g.toLowerCase());
  let vec = { ...ZERO_VECTOR };
  let hits = 0;
  for (const mapping of GENRE_VECTORS) {
    if (mapping.keywords.some((kw) => lower.some((g) => g.includes(kw)))) {
      for (const key of VECTOR_KEYS) {
        vec[key] += mapping.vec[key] ?? 0;
      }
      hits++;
    }
  }
  if (hits === 0) return { ...ZERO_VECTOR };
  for (const key of VECTOR_KEYS) vec[key] /= hits;
  return vec;
}

export function buildTasteVector(
  saved: Array<{ emotionalVector?: Partial<EmotionalVector>; genres?: string[] }>,
  skipped: Array<{ emotionalVector?: Partial<EmotionalVector>; genres?: string[] }>
): EmotionalVector {
  let vec = { ...ZERO_VECTOR };
  for (const song of saved) {
    // Use explicit vector if present, otherwise infer from genres
    const sv = song.emotionalVector ?? (song.genres?.length ? genresToVector(song.genres) : null);
    if (!sv) continue;
    for (const key of VECTOR_KEYS) vec[key] += sv[key] ?? 0;
  }
  for (const song of skipped) {
    const sv = song.emotionalVector ?? (song.genres?.length ? genresToVector(song.genres) : null);
    if (!sv) continue;
    for (const key of VECTOR_KEYS) vec[key] -= (sv[key] ?? 0) * 0.2;
  }
  for (const key of VECTOR_KEYS) vec[key] = Math.max(0, vec[key]);
  return normalizeVector(vec);
}

export function blendVectors(
  tasteVec: EmotionalVector,
  photoVec: EmotionalVector,
  photoConfidence: number
): EmotionalVector {
  const photoWeight = 0.4 + Math.min(1, Math.max(0, photoConfidence)) * 0.5;
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
