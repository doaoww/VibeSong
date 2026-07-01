import { cosine } from "./vectorMath";
import type { CatalogSong } from "./db/songs";

export interface RecommendRequest {
  queryVector: number[];           // 10 dimensions, already blended
  languages: string[];
  languageOpenness: "strict" | "flexible" | "open";
  discoveryStyle: "hidden-gems" | "niche" | "balanced" | "popular-ok";
  blockedSongs: string[];
  blockedArtists: string[];
  recentlyShownSongIds: string[];  // freshness — don't repeat last 5 sessions
  genreScores: Record<string, number>;
  likedArtists: string[];
  storyIntentTags: string[];       // from requested vibe parsing
  antiTags: string[];              // from requested vibe parsing
}

export interface ScoreComponents {
  photoFit: number;
  tasteFit: number;
  storyFit: number;
  noveltyFit: number;
  qualityBonus: number;
  languagePenalty: number;
  freshnessPenalty: number;
  mainstreamPenalty: number;
  finalScore: number;
}

export interface RecommendResult extends CatalogSong {
  scoreComponents: ScoreComponents;
}

export interface DebugEntry {
  id: string;
  title: string;
  artist: string;
  rulesRemoved: boolean;
  removedReason?: string;
  scoreComponents?: ScoreComponents;
}

function normalizeLanguage(lang: string): string {
  return lang.trim().toLowerCase();
}

function languageMatches(songLang: string, userLangs: string[]): boolean {
  if (songLang === "Instrumental") return true;
  const normalized = normalizeLanguage(songLang);
  return userLangs.some(
    (l) => normalized.includes(normalizeLanguage(l)) || normalizeLanguage(l).includes(normalized)
  );
}

function genreOverlapScore(songGenres: string[], genreScores: Record<string, number>): number {
  if (!songGenres.length || !Object.keys(genreScores).length) return 0;
  let total = 0;
  for (const genre of songGenres) {
    const normalized = genre.toLowerCase();
    for (const [key, score] of Object.entries(genreScores)) {
      if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
        total += score;
      }
    }
  }
  return Math.max(0, Math.min(1, total / songGenres.length));
}

function artistProximityScore(songArtist: string, likedArtists: string[]): number {
  if (!likedArtists.length) return 0;
  const normalized = songArtist.toLowerCase();
  const exact = likedArtists.some((a) => a.toLowerCase() === normalized);
  if (exact) return 1.0;
  const partial = likedArtists.some(
    (a) => normalized.includes(a.toLowerCase()) || a.toLowerCase().includes(normalized)
  );
  return partial ? 0.5 : 0;
}

function discoveryScore(popularityTier: number, discoveryStyle: string): number {
  switch (discoveryStyle) {
    case "hidden-gems":
    case "niche":
      return popularityTier <= 2 ? 1.0 : popularityTier <= 3 ? 0.5 : 0.1;
    case "popular-ok":
      return popularityTier >= 3 ? 1.0 : 0.7;
    case "balanced":
    default:
      return popularityTier === 3 ? 1.0 : popularityTier <= 2 ? 0.8 : 0.6;
  }
}

export function buildRecommendations(
  req: RecommendRequest,
  candidates: CatalogSong[]
): { results: RecommendResult[]; debugLog: DebugEntry[] } {
  const debugLog: DebugEntry[] = [];
  const queryEnergy = req.queryVector[2]; // energy is index 2 in VECTOR_KEYS order

  const scored: RecommendResult[] = [];

  for (const song of candidates) {
    // ── Rules Layer ──────────────────────────────────────────────────────────

    // 0. Guard: skip songs without emotional_vector (cannot score)
    if (!song.emotional_vector) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "no_emotional_vector",
      });
      continue;
    }

    // 1. Language filter (strict)
    if (req.languageOpenness === "strict" && !languageMatches(song.language, req.languages)) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "language_mismatch",
      });
      continue;
    }

    // 2. Hard blocks — song id
    if (req.blockedSongs.includes(song.id)) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "hard_block",
      });
      continue;
    }

    // 3. Hard blocks — artist
    if (req.blockedArtists.some((a) => a.toLowerCase() === song.artist.toLowerCase())) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "hard_block",
      });
      continue;
    }

    // 4. Energy compatibility gap
    if (Math.abs(song.energy - queryEnergy) > 0.5) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "energy_gap",
      });
      continue;
    }

    // 5. Anti-tags from requested vibe
    if (req.antiTags.length > 0) {
      const allTags = [
        ...song.story_intent_tags,
        ...song.mood_tags,
        ...song.aesthetic_tags,
      ].map((t) => t.toLowerCase());
      const hasAntiTag = req.antiTags.some((at) =>
        allTags.some((t) => t.includes(at.toLowerCase()))
      );
      if (hasAntiTag) {
        debugLog.push({
          id: song.id,
          title: song.title,
          artist: song.artist,
          rulesRemoved: true,
          removedReason: "anti_tag",
        });
        continue;
      }
    }

    // ── Scoring Layer ────────────────────────────────────────────────────────

    const photoFit = cosine(req.queryVector, song.emotional_vector) * 40;

    const genreScore = genreOverlapScore(song.genre_tags, req.genreScores);
    const artistScore = artistProximityScore(song.artist, req.likedArtists);
    const aestheticMatch = song.aesthetic_tags.length > 0 ? 0.5 : 0; // basic presence signal
    const tasteFit = genreScore * 15 + artistScore * 10 + aestheticMatch * 5;

    const storyTagMatches = req.storyIntentTags.filter((t) =>
      song.story_intent_tags.map((s) => s.toLowerCase()).includes(t.toLowerCase())
    ).length;
    const storyFit = Math.min(3, storyTagMatches) * 7;

    const noveltyFit = discoveryScore(song.popularity_tier, req.discoveryStyle) * 10;
    const qualityBonus = song.quality_score * 5;

    // Penalties
    const languagePenalty =
      req.languageOpenness === "flexible" && !languageMatches(song.language, req.languages)
        ? -15
        : 0;
    const freshnessPenalty = req.recentlyShownSongIds.includes(song.id) ? -20 : 0;
    const mainstreamPenalty =
      (req.discoveryStyle === "niche" || req.discoveryStyle === "hidden-gems") &&
      song.popularity_tier > 3
        ? -10
        : 0;

    const raw = photoFit + tasteFit + storyFit + noveltyFit + qualityBonus;
    const finalScore = Math.max(
      0,
      Math.min(100, raw + languagePenalty + freshnessPenalty + mainstreamPenalty)
    );

    const components: ScoreComponents = {
      photoFit: Math.round(photoFit * 10) / 10,
      tasteFit: Math.round(tasteFit * 10) / 10,
      storyFit,
      noveltyFit: Math.round(noveltyFit * 10) / 10,
      qualityBonus: Math.round(qualityBonus * 10) / 10,
      languagePenalty,
      freshnessPenalty,
      mainstreamPenalty,
      finalScore: Math.round(finalScore * 10) / 10,
    };

    debugLog.push({
      id: song.id,
      title: song.title,
      artist: song.artist,
      rulesRemoved: false,
      scoreComponents: components,
    });
    scored.push({ ...song, scoreComponents: components });
  }

  console.log("[recommend] debug log:", JSON.stringify(debugLog, null, 2));

  return { results: scored.sort((a, b) => b.scoreComponents.finalScore - a.scoreComponents.finalScore), debugLog };
}
