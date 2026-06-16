export type DiscoveryStyle = "hidden-gems" | "niche" | "balanced" | "popular-ok";
export type EnergyPreference = "calm" | "medium" | "high" | "depends";

export interface UserTaste {
  genres: string[];
  favoriteArtists: string[];
  defaultMood: string;
  discoveryStyle: DiscoveryStyle;
  dislikes: string[];
  languagePreference: string;
  energyPreference: EnergyPreference;
  setupComplete: boolean;
}

export interface CandidateTrack {
  title: string;
  artist: string;
  reason: string;
  genres?: string[];
  language?: string;
  matchScore?: number;
  viralMomentSeconds?: number;
  photoFitScore?: number;
  tasteFitScore?: number;
  discoveryFitScore?: number;
  obviousnessPenalty?: number;
  finalScore?: number;
}

export interface ResolvedTrack extends CandidateTrack {
  matchScore: number;
  finalScore: number;
  previewUrl?: string;
  previewProvider?: "itunes" | "youtube";
  artwork?: string;
  appleMusicUrl?: string;
  youtubeId?: string;
  youtubeUrl?: string;
  thumbnail: string;
}

const DEFAULT_TASTE: UserTaste = {
  genres: [],
  favoriteArtists: [],
  defaultMood: "",
  discoveryStyle: "balanced",
  dislikes: [],
  languagePreference: "No preference",
  energyPreference: "depends",
  setupComplete: true,
};

const DISCOVERY_STYLES: DiscoveryStyle[] = [
  "hidden-gems",
  "niche",
  "balanced",
  "popular-ok",
];

const ENERGY_PREFERENCES: EnergyPreference[] = ["calm", "medium", "high", "depends"];

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function toScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function isDiscoveryStyle(value: unknown): value is DiscoveryStyle {
  return typeof value === "string" && DISCOVERY_STYLES.includes(value as DiscoveryStyle);
}

function isEnergyPreference(value: unknown): value is EnergyPreference {
  return typeof value === "string" && ENERGY_PREFERENCES.includes(value as EnergyPreference);
}

export function normalizeTaste(input: unknown): UserTaste {
  if (!input || typeof input !== "object") return DEFAULT_TASTE;
  const raw = input as Record<string, unknown>;

  return {
    genres: cleanArray(raw.genres),
    favoriteArtists: cleanArray(raw.favoriteArtists),
    defaultMood: cleanString(raw.defaultMood),
    discoveryStyle: isDiscoveryStyle(raw.discoveryStyle)
      ? raw.discoveryStyle
      : DEFAULT_TASTE.discoveryStyle,
    dislikes: cleanArray(raw.dislikes),
    languagePreference: cleanString(raw.languagePreference) || DEFAULT_TASTE.languagePreference,
    energyPreference: isEnergyPreference(raw.energyPreference)
      ? raw.energyPreference
      : DEFAULT_TASTE.energyPreference,
    setupComplete:
      typeof raw.setupComplete === "boolean" ? raw.setupComplete : DEFAULT_TASTE.setupComplete,
  };
}

export function getDiscoveryInstructions(style: DiscoveryStyle): string {
  switch (style) {
    case "hidden-gems":
      return "Prioritize known or respected artists, but choose less obvious album cuts, B-sides, cult favorites, or fan-loved tracks. Penalize the artist's most overused songs.";
    case "niche":
      return "Prioritize smaller artists, underground scenes, regional subcultures, and tasteful discoveries. Popular songs should be rare unless the fit is extraordinary.";
    case "popular-ok":
      return "Popular songs are allowed when they fit the photo and taste extremely well, but avoid lazy default picks and overused short-form-video songs.";
    case "balanced":
    default:
      return "Return a balanced stack: a few familiar hidden gems, several niche discoveries, and one or two bolder wildcards.";
  }
}

function weightsFor(style: DiscoveryStyle) {
  switch (style) {
    case "hidden-gems":
      return { photo: 0.35, taste: 0.3, discovery: 0.25, penalty: 1.4 };
    case "niche":
      return { photo: 0.34, taste: 0.28, discovery: 0.28, penalty: 1.6 };
    case "popular-ok":
      return { photo: 0.45, taste: 0.35, discovery: 0.12, penalty: 0.55 };
    case "balanced":
    default:
      return { photo: 0.4, taste: 0.35, discovery: 0.15, penalty: 1 };
  }
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

function fuzzyIncludesAny(value: string, list: string[]): boolean {
  const normalized = normalizeForMatch(value);
  if (!normalized) return false;
  return list.some((entry) => {
    const normalizedEntry = normalizeForMatch(entry);
    if (!normalizedEntry) return false;
    return normalized.includes(normalizedEntry) || normalizedEntry.includes(normalized);
  });
}

/**
 * Server-side guard so avoid-listed artists/genres and quiz dislikes are
 * actually downweighted, instead of relying entirely on GPT following the
 * prompt's avoid instructions.
 */
export function applyAvoidPenalties(
  candidates: CandidateTrack[],
  options: { avoidArtists: string[]; avoidGenres: string[]; dislikes: string[] }
): CandidateTrack[] {
  const { avoidArtists, avoidGenres, dislikes } = options;
  if (!avoidArtists.length && !avoidGenres.length && !dislikes.length) {
    return candidates;
  }

  return candidates.map((track) => {
    const artistHit = avoidArtists.some(
      (artist) => normalizeForMatch(artist) === normalizeForMatch(track.artist)
    );
    const genreHit = (track.genres ?? []).some(
      (genre) => fuzzyIncludesAny(genre, avoidGenres) || fuzzyIncludesAny(genre, dislikes)
    );

    if (!artistHit && !genreHit) return track;

    const bumpedPenalty = Math.max(track.obviousnessPenalty ?? 0, artistHit ? 35 : 28);
    return { ...track, obviousnessPenalty: bumpedPenalty };
  });
}

// The quiz's language options are casual scene/region labels, not strict
// language codes -- map each to the words GPT is likely to report in a
// track's "language" field.
const LANGUAGE_PREFERENCE_ALIASES: Record<string, string[]> = {
  english: ["english"],
  "korean / k-pop": ["korean"],
  latin: ["spanish", "portuguese", "latin"],
  russian: ["russian"],
  uzbek: ["uzbek"],
};

const NO_LANGUAGE_PREFERENCE = new Set(["no preference", "global mix"]);

/**
 * Server-side guard so a stated language/region preference is actually
 * enforced, instead of being a line of prompt text GPT may or may not
 * follow. No-ops for "No preference" / "Global mix".
 */
export function applyLanguagePenalty(
  candidates: CandidateTrack[],
  languagePreference: string
): CandidateTrack[] {
  const normalizedPreference = normalizeForMatch(languagePreference);
  if (NO_LANGUAGE_PREFERENCE.has(normalizedPreference)) return candidates;

  const accepted = LANGUAGE_PREFERENCE_ALIASES[normalizedPreference];
  if (!accepted) return candidates;

  return candidates.map((track) => {
    if (!track.language) return track;
    const trackLanguage = normalizeForMatch(track.language);
    if (trackLanguage === "instrumental") return track;
    const matches = accepted.some(
      (word) => trackLanguage.includes(word) || word.includes(trackLanguage)
    );
    if (matches) return track;

    return {
      ...track,
      obviousnessPenalty: Math.max(track.obviousnessPenalty ?? 0, 22),
    };
  });
}

export function normalizeCandidateScores(
  candidates: CandidateTrack[],
  discoveryStyle: DiscoveryStyle = "balanced"
): Array<CandidateTrack & { matchScore: number; finalScore: number }> {
  const weights = weightsFor(discoveryStyle);

  return candidates
    .map((track) => {
      const photoFitScore = clamp(toScore(track.photoFitScore, track.matchScore ?? 75), 0, 100);
      const tasteFitScore = clamp(toScore(track.tasteFitScore, 75), 0, 100);
      const discoveryFitScore = clamp(toScore(track.discoveryFitScore, 70), 0, 100);
      const obviousnessPenalty = clamp(toScore(track.obviousnessPenalty, 0), 0, 40);
      const calculated =
        photoFitScore * weights.photo +
        tasteFitScore * weights.taste +
        discoveryFitScore * weights.discovery -
        obviousnessPenalty * weights.penalty;
      const finalScore = clamp(
        typeof track.finalScore === "number" ? (calculated + track.finalScore) / 2 : calculated,
        61,
        97
      );

      return {
        ...track,
        photoFitScore,
        tasteFitScore,
        discoveryFitScore,
        obviousnessPenalty,
        finalScore,
        matchScore: Math.round(finalScore),
        viralMomentSeconds: Math.max(0, Math.round(track.viralMomentSeconds ?? 0)),
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

export function scoreResolvedTrack(
  track: ResolvedTrack,
  discoveryStyle: DiscoveryStyle = "balanced"
): ResolvedTrack {
  const previewQualityScore =
    track.previewProvider === "itunes" && track.previewUrl
      ? 8
      : track.previewProvider === "youtube" && track.youtubeId
      ? 3
      : 0;
  const styleBonus = discoveryStyle === "popular-ok" ? 1 : 0;
  const finalScore = clamp((track.finalScore ?? track.matchScore) + previewQualityScore + styleBonus, 61, 99);

  return {
    ...track,
    finalScore,
    matchScore: Math.round(finalScore),
  };
}
