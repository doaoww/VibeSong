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
  favoriteSongIds: string[];       // taste.favoriteStorySongs — user's own picked/imported songs
  storyIntentTags: string[];       // from photo matchSignals + (future) requested vibe
  hardAntiTags: string[];          // requested vibe + onboarding avoid-list — always excludes, never confidence-gated
  softAntiTags: string[];          // from photo matchSignals — confidence-scaled penalty, not a hard block
  photoConfidence: number;         // gates contextFit/vibeAestheticFit/storyFit contributions
  sceneContextTags: string[];      // from photo matchSignals.scene_context_tags
  aestheticTags: string[];         // from photo matchSignals.modern_aesthetic_tags
  moodTags: string[];              // from photo matchSignals.mood_tags
  energyBounds: { min: number; max: number };
  photoBriefEmbedding: number[] | null;  // null when ENABLE_BRIEF_POOL is off or the photo has no brief text
}

export interface ScoreComponents {
  photoFit: number;
  tasteFit: number;
  storyFit: number;
  contextFit: number;
  vibeAestheticFit: number;
  noveltyFit: number;
  qualityBonus: number;
  favoriteSongBonus: number;
  briefFit: number;
  briefSimilarity: number;
  languagePenalty: number;
  freshnessPenalty: number;
  mainstreamPenalty: number;
  needsReviewPenalty: number;
  softAntiTagPenalty: number;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Plain .includes() treated "pop" as a match inside fused-word genres like
// "hyperpop"/"britpop"/"electropop" (unrelated genres that just happen to end
// in the same letters), silently cancelling real taste signal for those songs
// or wrongly inheriting a boost/avoid meant for mainstream pop. \b boundaries
// still allow legitimate hyphen/space-separated matches ("indie pop", "k-pop"
// against "pop") since those genuinely contain "pop" as a separate word.
function wordBoundaryIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(haystack);
}

function genreOverlapScore(songGenres: string[], genreScores: Record<string, number>): number {
  if (!songGenres.length || !Object.keys(genreScores).length) return 0;
  let total = 0;
  for (const genre of songGenres) {
    const normalized = genre.toLowerCase();
    for (const [key, score] of Object.entries(genreScores)) {
      const normalizedKey = key.toLowerCase();
      if (wordBoundaryIncludes(normalized, normalizedKey) || wordBoundaryIncludes(normalizedKey, normalized)) {
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
  const partial = likedArtists.some((a) => {
    const normalizedLiked = a.toLowerCase();
    return wordBoundaryIncludes(normalized, normalizedLiked) || wordBoundaryIncludes(normalizedLiked, normalized);
  });
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

// track_feedback rows only store title/artist, not song id (see lib/db/trackFeedback.ts),
// so matching recently-shown candidates back to their catalog id has to go through
// a normalized title+artist key rather than a direct id lookup.
function feedbackKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|||${artist.trim().toLowerCase()}`;
}

export function resolveRecentlyShownSongIds(
  candidates: { id: string; title: string; artist: string }[],
  feedback: { title: string; artist: string }[]
): string[] {
  const seen = new Set(feedback.map((f) => feedbackKey(f.title, f.artist)));
  return candidates.filter((song) => seen.has(feedbackKey(song.title, song.artist))).map((song) => song.id);
}

// capFavoriteSongs (below) only bounds how many favorite slots land in one
// response — it doesn't stop the same favorite from winning one of those
// slots on nearly every request. A song like a 22-track Apple Music import
// containing one moderate, non-extreme emotional_vector plus broad generic
// tags ("dreamy", "nostalgic", "modern romantic") will score decently
// against almost *any* photo, so if all 22 favorites compete every time,
// that one song wins its slot practically every request regardless of the
// photo — reproduced directly: "pocket locket" showing up on "almost every
// photo". Fix: only a random subset of the user's favorites is even
// eligible to compete on a given request, so a structurally-generic
// favorite is in the running some of the time, not all of the time.
export function sampleFavoriteSongIds(favoriteSongIds: string[], maxEligible = 6): string[] {
  if (favoriteSongIds.length <= maxEligible) return favoriteSongIds;
  const pool = [...favoriteSongIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, maxEligible);
}

// Guards against a user's favorite/imported songs (see favoriteSongPool in
// app/api/recommend/route.ts) crowding out photo-relevant results: those
// songs are unconditionally injected into the candidate pool on *every*
// request regardless of the photo, plus get a flat +8 favoriteSongBonus, so
// with enough imported favorites (e.g. a 22-song Apple Music import) they
// can dominate nearly every result set instead of surfacing occasionally.
// Demotes excess favorites to the back (not removed) so they can still
// backfill if there aren't enough other candidates.
export function capFavoriteSongs<T extends { id: string }>(
  sorted: T[],
  favoriteSongIds: string[],
  maxFavorites = 2
): T[] {
  if (favoriteSongIds.length === 0) return sorted;
  const favoriteSet = new Set(favoriteSongIds);
  let favoriteCount = 0;
  const picked: T[] = [];
  const overflow: T[] = [];

  for (const item of sorted) {
    if (favoriteSet.has(item.id)) {
      if (favoriteCount < maxFavorites) {
        favoriteCount++;
        picked.push(item);
      } else {
        overflow.push(item);
      }
    } else {
      picked.push(item);
    }
  }

  return [...picked, ...overflow];
}

// Guards against an artist that's over-represented in the catalog (broad
// emotional-vector coverage across many songs) winning most slots in every
// user's results just by having more chances to be the closest vector match --
// scoring alone can't fix this since photoFit is artist-agnostic by design.
export function applyArtistDiversityCap<T extends { artist: string }>(
  sorted: T[],
  limit: number,
  maxPerArtist = 2
): T[] {
  const counts = new Map<string, number>();
  const picked: T[] = [];
  const overflow: T[] = [];

  for (const item of sorted) {
    const key = item.artist.trim().toLowerCase();
    const count = counts.get(key) ?? 0;
    if (count < maxPerArtist) {
      counts.set(key, count + 1);
      picked.push(item);
    } else {
      overflow.push(item);
    }
    if (picked.length >= limit) break;
  }

  if (picked.length < limit) {
    picked.push(...overflow.slice(0, limit - picked.length));
  }

  return picked;
}

export function buildRecommendations(
  req: RecommendRequest,
  candidates: CatalogSong[]
): { results: RecommendResult[]; debugLog: DebugEntry[] } {
  const debugLog: DebugEntry[] = [];
  const queryEnergy = req.queryVector[2]; // energy is index 2 in VECTOR_KEYS order
  // Floored at 0.3, not 0.2: GPT's energy_bounds are consistently narrow in
  // practice (half-width ~0.1-0.15 on typical photos), so a 0.2 floor made this
  // tolerance collapse to a near-constant 0.2 on almost every request — tighter
  // than the fixed 0.5 tolerance it replaced, over-filtering candidates instead
  // of the intended photo-aware behavior.
  const energyTolerance = Math.max(0.3, (req.energyBounds.max - req.energyBounds.min) / 2);
  const confFactor = 0.5 + Math.max(0, Math.min(1, req.photoConfidence)) * 0.5;

  const scored: RecommendResult[] = [];

  for (const song of candidates) {
    // ── Rules Layer ──────────────────────────────────────────────────────────

    // 0. Guard: skip songs without emotional_vector (cannot score). An empty
    // array is truthy in JS and must be checked explicitly — cosine() over a
    // zero-length vector produces NaN (not 0), which then flows into
    // finalScore and sorts unpredictably instead of being excluded.
    if (!song.emotional_vector || song.emotional_vector.length === 0) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "no_emotional_vector",
      });
      continue;
    }

    // 0.5. Guard: confidence too low to trust these tags — bypassed once an admin
    // has manually reviewed/corrected the tags (tag_source set via the Approve
    // action in /admin), since a human judgment call outweighs GPT's self-rating.
    const manuallyReviewed = song.tag_source === "manual" || song.tag_source === "auto_plus_manual";
    if (
      !manuallyReviewed &&
      song.final_confidence !== null &&
      song.final_confidence !== undefined &&
      song.final_confidence < 0.35
    ) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "confidence_too_low",
      });
      continue;
    }

    // 0.6. Guard: language filtering is core to matching, so an unresolved
    // language always blocks recommendation — never bypassed by manual tag
    // review alone. Clears automatically once an admin sets a real language.
    if (song.language === "Unknown") {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "language_unknown",
      });
      continue;
    }

    // 1. Language filter — hard block for both "strict" and "flexible" so a
    // song in a language the user never selected can't slip through just by
    // scoring well on everything else (a -30 penalty alone was reliably beaten
    // by strong photoFit/tasteFit/qualityBonus combinations, e.g. "Satranga"
    // repeatedly outranking matched-language songs for users who never picked
    // Hindi). Only "open" (explicit opt-in to any language) skips this.
    if (
      req.languageOpenness !== "open" &&
      req.languages.length > 0 &&
      !languageMatches(song.language, req.languages)
    ) {
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

    // 4. Energy compatibility gap - tolerance derives from the photo's own
    // energy_bounds, floored at 0.3 so an overly narrow GPT read can't over-filter.
    if (Math.abs(song.energy - queryEnergy) > energyTolerance) {
      debugLog.push({
        id: song.id,
        title: song.title,
        artist: song.artist,
        rulesRemoved: true,
        removedReason: "energy_gap",
      });
      continue;
    }

    // 5. Hard anti-tags — explicit requested-vibe/onboarding avoid-list, never confidence-gated
    const songTagPool = [
      ...song.story_intent_tags,
      ...song.mood_tags,
      ...song.aesthetic_tags,
    ].map((t) => t.toLowerCase());
    if (req.hardAntiTags.length > 0) {
      const hasHardAntiTag = req.hardAntiTags.some((at) =>
        songTagPool.some((t) => t.includes(at.toLowerCase()))
      );
      if (hasHardAntiTag) {
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
    // genreScore was *15 (tasteFit max 30) — within an already photo-vetted
    // candidate set, photoFit barely varies (they're all top-N nearest
    // neighbors already), so genre overlap with the user's *historical*
    // swipe-learned genre_scores ended up deciding the ranking more than the
    // photo did. Reproduced directly: for a cozy/dreamy photo, mainstream
    // picks matching the user's general r&b/dance/synthpop taste (Justin
    // Bieber, Benson Boone, Kacey Musgraves) outranked genuinely on-vibe
    // folk/indie-folk picks (Iron & Wine, Clairo, Gregory Alan Isakov) whose
    // specific genres just weren't in that taste history. Lowered so genre
    // still nudges ranking without outweighing what THIS photo looks like.
    const tasteFit = genreScore * 8 + artistScore * 10 + aestheticMatch * 5;

    const storyTagMatches = req.storyIntentTags.filter((t) =>
      song.story_intent_tags.map((s) => s.toLowerCase()).includes(t.toLowerCase())
    ).length;
    const storyFit = Math.min(3, storyTagMatches) * 7 * confFactor;

    const contextTagMatches = song.story_context_tags.filter((t) =>
      req.sceneContextTags.map((s) => s.toLowerCase()).includes(t.toLowerCase())
    ).length;
    const contextFit = Math.min(2, contextTagMatches) * 6 * confFactor;

    const photoAestheticOrMood = [...req.aestheticTags, ...req.moodTags].map((t) => t.toLowerCase());
    const songAestheticOrMood = [...song.modern_aesthetic_tags, ...song.mood_tags].map((t) => t.toLowerCase());
    const aestheticOrMoodMatches = songAestheticOrMood.filter((t) => photoAestheticOrMood.includes(t)).length;
    const vibeAestheticFit = Math.min(2, aestheticOrMoodMatches) * 5 * confFactor;

    const briefSimilarity =
      req.photoBriefEmbedding && song.brief_embedding && song.brief_embedding.length
        ? cosine(req.photoBriefEmbedding, song.brief_embedding)
        : 0;
    const briefFit = briefSimilarity * 20;
    const noveltyFit = discoveryScore(song.popularity_tier, req.discoveryStyle) * 10;
    const qualityBonus = song.quality_score * 5;
    // Flat, not dominant: a favorited/imported song still has to clear the hard
    // filters above (language, energy, anti-tags) like any other candidate, and
    // this alone shouldn't let a poor photo/mood fit always win — it's sized
    // similarly to noveltyFit's max, well under a strong photoFit/tasteFit swing.
    const favoriteSongBonus = req.favoriteSongIds.includes(song.id) ? 8 : 0;

    // Penalties
    // languagePenalty is always 0 now: mismatches are hard-filtered above
    // (rule 1) for "strict"/"flexible", and "open" means no preference to
    // penalize against. Field kept in ScoreComponents for debug-log shape
    // stability.
    const languagePenalty = 0;
    const freshnessPenalty = req.recentlyShownSongIds.includes(song.id) ? -20 : 0;
    // "balanced" still mildly deprioritizes mainstream (users never opted into it
    // either), just lighter than the niche/hidden-gems penalty; "popular-ok" opts
    // out entirely per its name. Tier 5 ("globally known", not just tier 4's
    // "mainstream") gets a steeper penalty than tier 4: global anthems (e.g.
    // Taylor Swift "The Man", Dua Lipa "Dance The Night") reliably carry broad
    // viral story_intent_tags like "confident comeback"/"main character walk"
    // that overlap almost any energetic photo's GPT-derived tags, so a flat
    // -5/-10 was cheap to outscore with a 2-3 tag storyFit hit (up to +21) —
    // niche photos kept surfacing the same global pop anthems over genuinely
    // niche tier-1/2 songs with an equally strong but untagged vibe fit.
    const mainstreamPenalty =
      song.popularity_tier > 3
        ? req.discoveryStyle === "niche" || req.discoveryStyle === "hidden-gems"
          ? song.popularity_tier === 5
            ? -22
            : -10
          : req.discoveryStyle === "balanced"
            ? song.popularity_tier === 5
              ? -13
              : -5
            : 0
        : 0;
    const needsReviewPenalty = song.needs_review ? -12 : 0;
    // Photo-derived anti-tags (e.g. "euphoric"/"chaotic" flagged against a calm
    // photo) are a soft, confidence-scaled penalty rather than a hard block —
    // GPT's read can be wrong, so a moderate-confidence anti-tag should nudge
    // scoring, not silently disqualify the song outright.
    const softAntiTagMatches = req.softAntiTags.filter((at) =>
      songTagPool.some((t) => t.includes(at.toLowerCase()))
    ).length;
    const softAntiTagPenalty = -Math.min(2, softAntiTagMatches) * 15 * confFactor;

    const raw =
      photoFit + tasteFit + storyFit + contextFit + vibeAestheticFit + briefFit + noveltyFit + qualityBonus + favoriteSongBonus;
    const finalScore = Math.max(
      0,
      Math.min(
        100,
        raw + languagePenalty + freshnessPenalty + mainstreamPenalty + needsReviewPenalty + softAntiTagPenalty
      )
    );

    const components: ScoreComponents = {
      photoFit: Math.round(photoFit * 10) / 10,
      tasteFit: Math.round(tasteFit * 10) / 10,
      storyFit: Math.round(storyFit * 10) / 10,
      contextFit: Math.round(contextFit * 10) / 10,
      vibeAestheticFit: Math.round(vibeAestheticFit * 10) / 10,
      noveltyFit: Math.round(noveltyFit * 10) / 10,
      qualityBonus: Math.round(qualityBonus * 10) / 10,
      favoriteSongBonus: Math.round(favoriteSongBonus * 10) / 10,
      briefFit: Math.round(briefFit * 10) / 10,
      briefSimilarity: Math.round(briefSimilarity * 1000) / 1000,
      languagePenalty,
      freshnessPenalty,
      mainstreamPenalty,
      needsReviewPenalty,
      softAntiTagPenalty: Math.round(softAntiTagPenalty * 10) / 10,
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
