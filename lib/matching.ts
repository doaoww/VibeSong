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
