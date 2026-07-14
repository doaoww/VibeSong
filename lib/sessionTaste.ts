import { buildTasteVector } from "./emotionalVector.ts";
import { arrayToVector, vectorToArray, cosine } from "./vectorMath.ts";

export interface SessionTrack {
  emotionalVector?: number[] | null;
}

function hasUsableVector(track: SessionTrack): track is SessionTrack & { emotionalVector: number[] } {
  return Array.isArray(track.emotionalVector) && track.emotionalVector.length === 10;
}

/**
 * Folds this session's saved/skipped tracks into a single taste vector,
 * reusing the already-tested buildTasteVector (likes add, skips subtract at
 * 0.2, clamped non-negative, normalized). Returns null until at least one
 * track has been saved — the live re-rank stays off (server ranking only)
 * until there's a real signal to learn from.
 */
export function computeSessionTasteVector(
  saved: SessionTrack[],
  skipped: SessionTrack[]
): number[] | null {
  const validSaved = saved.filter(hasUsableVector);
  if (validSaved.length === 0) return null;

  const toTasteInput = (tracks: SessionTrack[]) =>
    tracks.filter(hasUsableVector).map((t) => ({ emotionalVector: arrayToVector(t.emotionalVector) }));

  const taste = buildTasteVector(toTasteInput(saved), toTasteInput(skipped));
  return vectorToArray(taste);
}

export interface ScoredTrack {
  emotionalVector?: number[] | null;
  finalScore?: number;
}

/**
 * Re-scores tracks against the live session taste vector: 60% original
 * server score, 40% cosine similarity to the session vector, sorted
 * descending. Tracks without an emotionalVector fall back to 60% of their
 * base score (similarity term contributes 0) rather than being excluded.
 */
export function scoreRemainingTracks<T extends ScoredTrack>(
  tracks: T[],
  sessionVector: number[]
): Array<T & { liveScore: number }> {
  return tracks
    .map((track) => {
      const base = typeof track.finalScore === "number" ? track.finalScore : 0;
      const sim = hasUsableVector(track)
        ? Math.max(0, Math.min(1, cosine(sessionVector, track.emotionalVector)))
        : 0;
      const liveScore = Math.round(Math.max(0, Math.min(100, base * 0.6 + sim * 100 * 0.4)));
      return { ...track, liveScore };
    })
    .sort((a, b) => b.liveScore - a.liveScore);
}
