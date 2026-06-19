import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
}

const SEED_POOL: SeedSong[] = [
  // Alternative Hip-Hop
  { title: "EARFQUAKE", artist: "Tyler the Creator", genres: ["alternative hip-hop", "neo-soul"] },
  { title: "HUMBLE.", artist: "Kendrick Lamar", genres: ["hip-hop", "conscious rap"] },
  { title: "Redbone", artist: "Childish Gambino", genres: ["psychedelic soul", "funk"] },
  { title: "Self Care", artist: "Mac Miller", genres: ["alternative hip-hop", "lo-fi"] },
  { title: "Money Trees", artist: "Kendrick Lamar", genres: ["hip-hop", "jazz rap"] },
  { title: "SICKO MODE", artist: "Travis Scott", genres: ["trap", "hip-hop"] },
  { title: "No Role Modelz", artist: "J. Cole", genres: ["hip-hop", "rap"] },
  // R&B / Neo-Soul
  { title: "Kill Bill", artist: "SZA", genres: ["alternative R&B", "pop"] },
  { title: "Get You", artist: "Daniel Caesar", genres: ["R&B", "soul"] },
  { title: "Ivy", artist: "Frank Ocean", genres: ["indie R&B", "alternative R&B"] },
  { title: "Starboy", artist: "The Weeknd", genres: ["dark R&B", "synth-pop"] },
  { title: "Focus", artist: "H.E.R.", genres: ["R&B", "soul"] },
  { title: "Superstar", artist: "Jhené Aiko", genres: ["R&B", "neo-soul"] },
  // Pop
  { title: "bad guy", artist: "Billie Eilish", genres: ["dark pop", "electropop"] },
  { title: "drivers license", artist: "Olivia Rodrigo", genres: ["pop", "indie pop"] },
  { title: "Golden", artist: "Harry Styles", genres: ["pop", "indie rock"] },
  { title: "Royals", artist: "Lorde", genres: ["indie pop", "art pop"] },
  { title: "positions", artist: "Ariana Grande", genres: ["pop", "R&B"] },
  // Indie / Alternative
  { title: "Do I Wanna Know?", artist: "Arctic Monkeys", genres: ["indie rock", "alternative rock"] },
  { title: "The Less I Know The Better", artist: "Tame Impala", genres: ["psychedelic pop", "indie rock"] },
  { title: "Take Me To Church", artist: "Hozier", genres: ["indie rock", "soul"] },
  { title: "Bags", artist: "Clairo", genres: ["bedroom pop", "indie pop"] },
  { title: "Loving Is Easy", artist: "Rex Orange County", genres: ["indie pop", "bedroom pop"] },
  { title: "Motion Sickness", artist: "Phoebe Bridgers", genres: ["indie folk", "indie rock"] },
  // Electronic
  { title: "Get Lucky", artist: "Daft Punk", genres: ["nu-disco", "house"] },
  { title: "Chances", artist: "KAYTRANADA", genres: ["electronic", "house"] },
  { title: "Los Angeles", artist: "The Midnight", genres: ["synthwave", "retrowave"] },
  { title: "Latch", artist: "Disclosure", genres: ["UK garage", "house"] },
  // K-Pop
  { title: "Spring Day", artist: "BTS", genres: ["K-pop", "indie pop"] },
  { title: "Celebrity", artist: "IU", genres: ["K-pop", "dream pop"] },
  { title: "Attention", artist: "NewJeans", genres: ["K-pop", "R&B"] },
  { title: "LOVE DIVE", artist: "IVE", genres: ["K-pop", "dance pop"] },
  // Latin
  { title: "Me Porto Bonito", artist: "Bad Bunny", genres: ["reggaeton", "dembow"] },
  { title: "LA FAMA", artist: "Rosalía", genres: ["flamenco pop", "experimental pop"] },
  { title: "Tití Me Preguntó", artist: "Bad Bunny", genres: ["reggaeton", "Latin trap"] },
  // Afrobeats
  { title: "Last Last", artist: "Burna Boy", genres: ["afrobeats", "dancehall"] },
  { title: "Essence", artist: "Wizkid", genres: ["afropop", "R&B"] },
  // Soul / Folk
  { title: "River", artist: "Leon Bridges", genres: ["soul", "R&B"] },
  { title: "Holocene", artist: "Bon Iver", genres: ["indie folk", "ambient"] },
  // Pop-Punk / Rock
  { title: "misery business", artist: "Paramore", genres: ["pop-punk", "rock"] },
  { title: "brutal", artist: "Olivia Rodrigo", genres: ["pop-punk", "alternative"] },
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

export async function GET() {
  // Shuffle and grab 14 — some may have no preview, we want at least 10
  const candidates = shuffle(SEED_POOL).slice(0, 14);

  const resolved = await Promise.all(
    candidates.map(async (song) => {
      const { previewUrl, artwork } = await fetchPreview(song.title, song.artist);
      return { ...song, previewUrl, artwork };
    })
  );

  const withPreviews = resolved.filter((s) => s.previewUrl).slice(0, 10);
  // If not enough previews, include the rest without audio up to 10 total
  const withoutPreviews = resolved.filter((s) => !s.previewUrl);
  const final = [...withPreviews, ...withoutPreviews].slice(0, 10);

  return NextResponse.json(final);
}
