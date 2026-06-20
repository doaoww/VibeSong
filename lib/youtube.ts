import type { CandidateTrack } from "./matching";

export interface YouTubeTrack {
  title: string;
  artist: string;
  reason: string;
  genres?: string[];
  matchScore: number;
  finalScore?: number;
  photoFitScore?: number;
  tasteFitScore?: number;
  discoveryFitScore?: number;
  obviousnessPenalty?: number;
  viralMomentSeconds: number;
  youtubeId: string;
  thumbnail: string;
  youtubeUrl: string;
  previewProvider: "youtube";
}

export type GPTTrack = CandidateTrack;

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

// Module-level cache persists across requests within the same Vercel function instance.
// Avoids burning YouTube quota (100 units/search, 10k units/day free) on repeated lookups.
interface YtCacheEntry { result: YouTubeTrack | null; expiresAt: number }
const ytCache = new Map<string, YtCacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
function ytCacheKey(track: GPTTrack): string {
  return `${track.title.toLowerCase().trim()}|${track.artist.toLowerCase().trim()}`;
}

const SKIP_TERMS = [
  "live",
  "concert",
  "tour",
  "festival",
  "performance",
  "cover",
  "remix",
  "acoustic",
  "karaoke",
  "clip",
  "trailer",
  "scene",
  "intro",
  "reaction",
  "shorts",
  "short",
  "sped up",
  "slowed",
  "edit",
  "teaser",
  "behind the scenes",
];

function shouldSkip(title: string, originalTitle: string): boolean {
  const lower = title.toLowerCase();
  const origLower = originalTitle.toLowerCase();
  return SKIP_TERMS.some((term) => lower.includes(term) && !origLower.includes(term));
}

function isOfficialChannel(channelTitle: string): boolean {
  const lower = channelTitle.toLowerCase();
  return lower.includes("vevo") || lower.includes("official") || lower.includes("records") || lower.includes("music") || lower.includes("topic");
}

function qualityScore(title: string, channelTitle: string): number {
  const lowerTitle = title.toLowerCase();
  const lowerChannel = channelTitle.toLowerCase();
  let score = 0;
  if (lowerChannel.includes("topic")) score += 8;
  if (lowerTitle.includes("official audio")) score += 7;
  if (lowerChannel.includes("vevo")) score += 5;
  if (lowerChannel.includes("official")) score += 4;
  if (lowerTitle.includes("lyrics")) score += 1;
  if (lowerTitle.includes("music video")) score -= 2;
  return score;
}

function durationToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || "0") * 3600 +
    parseInt(match[2] || "0") * 60 +
    parseInt(match[3] || "0")
  );
}

async function searchYouTube(query: string, maxResults = 8): Promise<string[]> {
  // order=relevance so YouTube matches the specific artist+title, NOT the most globally popular video.
  // Dropping videoCategoryId=10 — it biases toward major-label chart content.
  const url =
    `${YOUTUBE_API}/search?part=snippet` +
    `&q=${encodeURIComponent(query)}` +
    `&type=video` +
    `&order=relevance` +
    `&maxResults=${maxResults}` +
    `&key=${process.env.YOUTUBE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((i: { id: { videoId: string } }) => i.id.videoId);
}

export async function searchYouTubeTrack(
  track: GPTTrack
): Promise<YouTubeTrack | null> {
  const key = ytCacheKey(track);
  const cached = ytCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  // Try three query strategies in order
  const queries = [
    `${track.artist} ${track.title} official audio`,
    `${track.artist} ${track.title}`,
    `${track.title} lyrics`,
  ];

  for (const query of queries) {
    const ids = await searchYouTube(query);
    if (!ids.length) continue;

    const detailRes = await fetch(
      `${YOUTUBE_API}/videos?part=contentDetails,snippet&id=${ids.join(",")}&key=${process.env.YOUTUBE_API_KEY}`
    );
    if (!detailRes.ok) continue;

    const detailData = await detailRes.json();
    const items: Array<{
      id: string;
      contentDetails: { duration: string };
      snippet: { title: string; channelTitle: string; thumbnails: { high?: { url: string }; default?: { url: string } } };
    }> = detailData.items || [];

    // Prefer clean audio/topic results while keeping YouTube relevance as the base order.
    items.sort((a, b) => {
      const aOfficial = isOfficialChannel(a.snippet.channelTitle) ? 1 : 0;
      const bOfficial = isOfficialChannel(b.snippet.channelTitle) ? 1 : 0;
      const aScore = qualityScore(a.snippet.title, a.snippet.channelTitle) + aOfficial;
      const bScore = qualityScore(b.snippet.title, b.snippet.channelTitle) + bOfficial;
      return bScore - aScore;
    });

    for (const item of items) {
      const seconds = durationToSeconds(item.contentDetails.duration);
      // Accept 60s–480s (1 min to 8 min)
      if (seconds < 60 || seconds > 480) continue;
      if (shouldSkip(item.snippet.title, track.title)) continue;

      const result: YouTubeTrack = {
        title: track.title,
        artist: track.artist,
        reason: track.reason,
        genres: track.genres,
        matchScore: track.matchScore ?? Math.round(track.finalScore ?? 75),
        finalScore: track.finalScore,
        photoFitScore: track.photoFitScore,
        tasteFitScore: track.tasteFitScore,
        discoveryFitScore: track.discoveryFitScore,
        obviousnessPenalty: track.obviousnessPenalty,
        viralMomentSeconds: track.viralMomentSeconds ?? 0,
        youtubeId: item.id,
        thumbnail:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.default?.url ||
          "",
        youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
        previewProvider: "youtube",
      };
      ytCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL });
      return result;
    }
  }

  ytCache.set(key, { result: null, expiresAt: Date.now() + CACHE_TTL });
  return null;
}
