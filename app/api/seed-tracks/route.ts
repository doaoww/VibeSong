import { NextRequest, NextResponse } from "next/server";
import type { EmotionalVector } from "../../../lib/emotionalVector";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  emotionalVector: EmotionalVector;
}

const SEED_POOL: SeedSong[] = [
  // Alternative Hip-Hop
  { title: "EARFQUAKE", artist: "Tyler the Creator", genres: ["alternative hip-hop", "neo-soul"],
    emotionalVector: { dreamy: 0.72, nostalgia: 0.38, energy: 0.52, cinematic: 0.58, darkness: 0.30, confidence: 0.68, intimacy: 0.80, danceability: 0.54, electronic: 0.48, acoustic: 0.18 } },
  { title: "HUMBLE.", artist: "Kendrick Lamar", genres: ["hip-hop", "conscious rap"],
    emotionalVector: { dreamy: 0.08, nostalgia: 0.20, energy: 0.92, cinematic: 0.70, darkness: 0.62, confidence: 1.00, intimacy: 0.10, danceability: 0.72, electronic: 0.40, acoustic: 0.02 } },
  { title: "Redbone", artist: "Childish Gambino", genres: ["psychedelic soul", "funk"],
    emotionalVector: { dreamy: 0.62, nostalgia: 0.72, energy: 0.42, cinematic: 0.50, darkness: 0.38, confidence: 0.58, intimacy: 0.72, danceability: 0.64, electronic: 0.28, acoustic: 0.40 } },
  { title: "Self Care", artist: "Mac Miller", genres: ["alternative hip-hop", "lo-fi"],
    emotionalVector: { dreamy: 0.80, nostalgia: 0.62, energy: 0.30, cinematic: 0.62, darkness: 0.72, confidence: 0.50, intimacy: 0.70, danceability: 0.32, electronic: 0.42, acoustic: 0.32 } },
  { title: "Money Trees", artist: "Kendrick Lamar", genres: ["hip-hop", "jazz rap"],
    emotionalVector: { dreamy: 0.44, nostalgia: 0.60, energy: 0.55, cinematic: 0.72, darkness: 0.50, confidence: 0.78, intimacy: 0.40, danceability: 0.55, electronic: 0.20, acoustic: 0.35 } },
  { title: "SICKO MODE", artist: "Travis Scott", genres: ["trap", "hip-hop"],
    emotionalVector: { dreamy: 0.30, nostalgia: 0.10, energy: 0.95, cinematic: 0.80, darkness: 0.75, confidence: 0.90, intimacy: 0.08, danceability: 0.78, electronic: 0.70, acoustic: 0.02 } },
  { title: "No Role Modelz", artist: "J. Cole", genres: ["hip-hop", "rap"],
    emotionalVector: { dreamy: 0.20, nostalgia: 0.45, energy: 0.70, cinematic: 0.55, darkness: 0.40, confidence: 0.85, intimacy: 0.30, danceability: 0.65, electronic: 0.30, acoustic: 0.15 } },
  // R&B / Neo-Soul
  { title: "Kill Bill", artist: "SZA", genres: ["alternative R&B", "pop"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.48, energy: 0.42, cinematic: 0.65, darkness: 0.58, confidence: 0.62, intimacy: 0.78, danceability: 0.45, electronic: 0.35, acoustic: 0.30 } },
  { title: "Get You", artist: "Daniel Caesar", genres: ["R&B", "soul"],
    emotionalVector: { dreamy: 0.70, nostalgia: 0.55, energy: 0.25, cinematic: 0.48, darkness: 0.20, confidence: 0.50, intimacy: 0.92, danceability: 0.30, electronic: 0.22, acoustic: 0.62 } },
  { title: "Ivy", artist: "Frank Ocean", genres: ["indie R&B", "alternative R&B"],
    emotionalVector: { dreamy: 0.85, nostalgia: 0.90, energy: 0.18, cinematic: 0.75, darkness: 0.45, confidence: 0.42, intimacy: 0.88, danceability: 0.18, electronic: 0.20, acoustic: 0.70 } },
  { title: "Starboy", artist: "The Weeknd", genres: ["dark R&B", "synth-pop"],
    emotionalVector: { dreamy: 0.40, nostalgia: 0.22, energy: 0.72, cinematic: 0.78, darkness: 0.80, confidence: 0.82, intimacy: 0.38, danceability: 0.75, electronic: 0.82, acoustic: 0.05 } },
  { title: "Focus", artist: "H.E.R.", genres: ["R&B", "soul"],
    emotionalVector: { dreamy: 0.60, nostalgia: 0.40, energy: 0.35, cinematic: 0.45, darkness: 0.28, confidence: 0.55, intimacy: 0.85, danceability: 0.38, electronic: 0.30, acoustic: 0.55 } },
  { title: "Superstar", artist: "Jhené Aiko", genres: ["R&B", "neo-soul"],
    emotionalVector: { dreamy: 0.82, nostalgia: 0.50, energy: 0.20, cinematic: 0.40, darkness: 0.25, confidence: 0.40, intimacy: 0.90, danceability: 0.22, electronic: 0.25, acoustic: 0.65 } },
  // Pop
  { title: "bad guy", artist: "Billie Eilish", genres: ["dark pop", "electropop"],
    emotionalVector: { dreamy: 0.48, nostalgia: 0.18, energy: 0.58, cinematic: 0.70, darkness: 0.85, confidence: 0.78, intimacy: 0.42, danceability: 0.62, electronic: 0.88, acoustic: 0.05 } },
  { title: "drivers license", artist: "Olivia Rodrigo", genres: ["pop", "indie pop"],
    emotionalVector: { dreamy: 0.65, nostalgia: 0.72, energy: 0.22, cinematic: 0.68, darkness: 0.55, confidence: 0.35, intimacy: 0.80, danceability: 0.18, electronic: 0.18, acoustic: 0.78 } },
  { title: "Golden", artist: "Harry Styles", genres: ["pop", "indie rock"],
    emotionalVector: { dreamy: 0.75, nostalgia: 0.62, energy: 0.48, cinematic: 0.52, darkness: 0.10, confidence: 0.72, intimacy: 0.62, danceability: 0.55, electronic: 0.20, acoustic: 0.55 } },
  { title: "Royals", artist: "Lorde", genres: ["indie pop", "art pop"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.40, energy: 0.38, cinematic: 0.75, darkness: 0.52, confidence: 0.70, intimacy: 0.50, danceability: 0.40, electronic: 0.55, acoustic: 0.30 } },
  { title: "positions", artist: "Ariana Grande", genres: ["pop", "R&B"],
    emotionalVector: { dreamy: 0.60, nostalgia: 0.20, energy: 0.55, cinematic: 0.40, darkness: 0.12, confidence: 0.65, intimacy: 0.75, danceability: 0.68, electronic: 0.60, acoustic: 0.18 } },
  // Indie / Alternative
  { title: "Do I Wanna Know?", artist: "Arctic Monkeys", genres: ["indie rock", "alternative rock"],
    emotionalVector: { dreamy: 0.50, nostalgia: 0.55, energy: 0.60, cinematic: 0.72, darkness: 0.62, confidence: 0.75, intimacy: 0.55, danceability: 0.52, electronic: 0.30, acoustic: 0.40 } },
  { title: "The Less I Know The Better", artist: "Tame Impala", genres: ["psychedelic pop", "indie rock"],
    emotionalVector: { dreamy: 0.90, nostalgia: 0.70, energy: 0.55, cinematic: 0.65, darkness: 0.28, confidence: 0.58, intimacy: 0.62, danceability: 0.72, electronic: 0.60, acoustic: 0.25 } },
  { title: "Take Me To Church", artist: "Hozier", genres: ["indie rock", "soul"],
    emotionalVector: { dreamy: 0.42, nostalgia: 0.50, energy: 0.65, cinematic: 0.88, darkness: 0.72, confidence: 0.80, intimacy: 0.70, danceability: 0.35, electronic: 0.10, acoustic: 0.68 } },
  { title: "Bags", artist: "Clairo", genres: ["bedroom pop", "indie pop"],
    emotionalVector: { dreamy: 0.88, nostalgia: 0.75, energy: 0.15, cinematic: 0.45, darkness: 0.30, confidence: 0.30, intimacy: 0.90, danceability: 0.18, electronic: 0.20, acoustic: 0.80 } },
  { title: "Loving Is Easy", artist: "Rex Orange County", genres: ["indie pop", "bedroom pop"],
    emotionalVector: { dreamy: 0.80, nostalgia: 0.65, energy: 0.32, cinematic: 0.42, darkness: 0.08, confidence: 0.48, intimacy: 0.78, danceability: 0.40, electronic: 0.22, acoustic: 0.70 } },
  { title: "Motion Sickness", artist: "Phoebe Bridgers", genres: ["indie folk", "indie rock"],
    emotionalVector: { dreamy: 0.65, nostalgia: 0.78, energy: 0.40, cinematic: 0.70, darkness: 0.60, confidence: 0.42, intimacy: 0.72, danceability: 0.28, electronic: 0.15, acoustic: 0.75 } },
  // Electronic
  { title: "Get Lucky", artist: "Daft Punk", genres: ["nu-disco", "house"],
    emotionalVector: { dreamy: 0.40, nostalgia: 0.50, energy: 0.75, cinematic: 0.38, darkness: 0.08, confidence: 0.72, intimacy: 0.42, danceability: 0.90, electronic: 0.85, acoustic: 0.05 } },
  { title: "Chances", artist: "KAYTRANADA", genres: ["electronic", "house"],
    emotionalVector: { dreamy: 0.48, nostalgia: 0.30, energy: 0.72, cinematic: 0.40, darkness: 0.15, confidence: 0.65, intimacy: 0.55, danceability: 0.88, electronic: 0.90, acoustic: 0.02 } },
  { title: "Los Angeles", artist: "The Midnight", genres: ["synthwave", "retrowave"],
    emotionalVector: { dreamy: 0.85, nostalgia: 0.88, energy: 0.52, cinematic: 0.90, darkness: 0.40, confidence: 0.60, intimacy: 0.65, danceability: 0.55, electronic: 0.92, acoustic: 0.05 } },
  { title: "Latch", artist: "Disclosure", genres: ["UK garage", "house"],
    emotionalVector: { dreamy: 0.45, nostalgia: 0.22, energy: 0.70, cinematic: 0.38, darkness: 0.18, confidence: 0.60, intimacy: 0.62, danceability: 0.85, electronic: 0.88, acoustic: 0.05 } },
  // K-Pop
  { title: "Spring Day", artist: "BTS", genres: ["K-pop", "indie pop"],
    emotionalVector: { dreamy: 0.80, nostalgia: 0.85, energy: 0.35, cinematic: 0.75, darkness: 0.35, confidence: 0.50, intimacy: 0.70, danceability: 0.38, electronic: 0.40, acoustic: 0.45 } },
  { title: "Celebrity", artist: "IU", genres: ["K-pop", "dream pop"],
    emotionalVector: { dreamy: 0.82, nostalgia: 0.60, energy: 0.42, cinematic: 0.55, darkness: 0.10, confidence: 0.65, intimacy: 0.68, danceability: 0.50, electronic: 0.45, acoustic: 0.42 } },
  { title: "Attention", artist: "NewJeans", genres: ["K-pop", "R&B"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.48, energy: 0.55, cinematic: 0.42, darkness: 0.15, confidence: 0.62, intimacy: 0.65, danceability: 0.72, electronic: 0.55, acoustic: 0.25 } },
  { title: "LOVE DIVE", artist: "IVE", genres: ["K-pop", "dance pop"],
    emotionalVector: { dreamy: 0.50, nostalgia: 0.28, energy: 0.72, cinematic: 0.55, darkness: 0.20, confidence: 0.80, intimacy: 0.50, danceability: 0.82, electronic: 0.70, acoustic: 0.08 } },
  // Latin
  { title: "Me Porto Bonito", artist: "Bad Bunny", genres: ["reggaeton", "dembow"],
    emotionalVector: { dreamy: 0.22, nostalgia: 0.15, energy: 0.88, cinematic: 0.35, darkness: 0.22, confidence: 0.90, intimacy: 0.50, danceability: 0.95, electronic: 0.65, acoustic: 0.05 } },
  { title: "LA FAMA", artist: "Rosalía", genres: ["flamenco pop", "experimental pop"],
    emotionalVector: { dreamy: 0.60, nostalgia: 0.55, energy: 0.48, cinematic: 0.80, darkness: 0.42, confidence: 0.82, intimacy: 0.60, danceability: 0.55, electronic: 0.45, acoustic: 0.55 } },
  { title: "Tití Me Preguntó", artist: "Bad Bunny", genres: ["reggaeton", "Latin trap"],
    emotionalVector: { dreamy: 0.18, nostalgia: 0.20, energy: 0.90, cinematic: 0.40, darkness: 0.28, confidence: 0.88, intimacy: 0.42, danceability: 0.92, electronic: 0.62, acoustic: 0.05 } },
  // Afrobeats
  { title: "Last Last", artist: "Burna Boy", genres: ["afrobeats", "dancehall"],
    emotionalVector: { dreamy: 0.38, nostalgia: 0.45, energy: 0.72, cinematic: 0.42, darkness: 0.30, confidence: 0.75, intimacy: 0.55, danceability: 0.88, electronic: 0.45, acoustic: 0.30 } },
  { title: "Essence", artist: "Wizkid", genres: ["afropop", "R&B"],
    emotionalVector: { dreamy: 0.58, nostalgia: 0.40, energy: 0.65, cinematic: 0.45, darkness: 0.12, confidence: 0.72, intimacy: 0.70, danceability: 0.85, electronic: 0.40, acoustic: 0.35 } },
  // Soul / Folk
  { title: "River", artist: "Leon Bridges", genres: ["soul", "R&B"],
    emotionalVector: { dreamy: 0.55, nostalgia: 0.82, energy: 0.28, cinematic: 0.62, darkness: 0.22, confidence: 0.55, intimacy: 0.78, danceability: 0.35, electronic: 0.08, acoustic: 0.85 } },
  { title: "Holocene", artist: "Bon Iver", genres: ["indie folk", "ambient"],
    emotionalVector: { dreamy: 0.92, nostalgia: 0.88, energy: 0.12, cinematic: 0.95, darkness: 0.40, confidence: 0.28, intimacy: 0.82, danceability: 0.10, electronic: 0.15, acoustic: 0.90 } },
  // Pop-Punk / Rock
  { title: "misery business", artist: "Paramore", genres: ["pop-punk", "rock"],
    emotionalVector: { dreamy: 0.12, nostalgia: 0.35, energy: 0.95, cinematic: 0.55, darkness: 0.50, confidence: 0.90, intimacy: 0.20, danceability: 0.60, electronic: 0.30, acoustic: 0.35 } },
  { title: "brutal", artist: "Olivia Rodrigo", genres: ["pop-punk", "alternative"],
    emotionalVector: { dreamy: 0.18, nostalgia: 0.42, energy: 0.88, cinematic: 0.50, darkness: 0.58, confidence: 0.82, intimacy: 0.28, danceability: 0.58, electronic: 0.28, acoustic: 0.40 } },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchPreview(
  title: string,
  artist: string
): Promise<{ previewUrl: string | null; artwork: string | null }> {
  const term = encodeURIComponent(`${title} ${artist}`);
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&media=music&limit=5`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const results: Array<{ previewUrl?: string; artworkUrl100?: string }> = data.results ?? [];
    const match = results.find((r) => r.previewUrl) ?? results[0];
    if (!match) return { previewUrl: null, artwork: null };
    return {
      previewUrl: match.previewUrl ?? null,
      artwork: match.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
    };
  } catch {
    return { previewUrl: null, artwork: null };
  }
}

async function resolveSongs(excludeTitles: string[]) {
  const excludeSet = new Set(excludeTitles.map((t) => t.toLowerCase()));
  const pool = excludeSet.size > 0
    ? SEED_POOL.filter((s) => !excludeSet.has(s.title.toLowerCase()))
    : SEED_POOL;

  // Pick enough candidates to get 10 with previews despite iTunes failures
  const candidates = shuffle(pool).slice(0, Math.min(pool.length, 16));
  const resolved = await Promise.all(
    candidates.map(async (song) => {
      const { previewUrl, artwork } = await fetchPreview(song.title, song.artist);
      return { ...song, previewUrl, artwork };
    })
  );
  const withPreviews = resolved.filter((s) => s.previewUrl).slice(0, 10);
  const withoutPreviews = resolved.filter((s) => !s.previewUrl);
  return [...withPreviews, ...withoutPreviews].slice(0, 10);
}

export async function GET() {
  const final = await resolveSongs([]);
  return NextResponse.json(final);
}

// POST: load more songs excluding already-seen titles
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : [];
  const final = await resolveSongs(exclude);
  return NextResponse.json(final);
}
