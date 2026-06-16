export interface YouTubeTrack {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
  viralMomentSeconds: number;
  youtubeId: string;
  thumbnail: string;
  youtubeUrl: string;
}

export interface GPTTrack {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
  viralMomentSeconds?: number;
}

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

const SKIP_TERMS = ["live", "concert", "tour", "festival", "performance", "cover", "remix", "acoustic", "karaoke"];

function shouldSkip(title: string, originalTitle: string): boolean {
  const lower = title.toLowerCase();
  const origLower = originalTitle.toLowerCase();
  return SKIP_TERMS.some((term) => lower.includes(term) && !origLower.includes(term));
}

function isOfficialChannel(channelTitle: string): boolean {
  const lower = channelTitle.toLowerCase();
  return lower.includes("vevo") || lower.includes("official") || lower.includes("records") || lower.includes("music");
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

    // Prefer official/VEVO channels but keep YouTube's relevance order otherwise
    items.sort((a, b) => {
      const aOfficial = isOfficialChannel(a.snippet.channelTitle) ? 1 : 0;
      const bOfficial = isOfficialChannel(b.snippet.channelTitle) ? 1 : 0;
      return bOfficial - aOfficial;
    });

    for (const item of items) {
      const seconds = durationToSeconds(item.contentDetails.duration);
      // Accept 60s–480s (1 min to 8 min)
      if (seconds < 60 || seconds > 480) continue;
      if (shouldSkip(item.snippet.title, track.title)) continue;

      return {
        title: track.title,
        artist: track.artist,
        reason: track.reason,
        matchScore: track.matchScore,
        viralMomentSeconds: track.viralMomentSeconds ?? 0,
        youtubeId: item.id,
        thumbnail:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.default?.url ||
          "",
        youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
      };
    }
  }

  return null;
}
