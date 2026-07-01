import { NextRequest, NextResponse } from "next/server";
import { listSongs } from "../../../lib/db/songs";
import type { EmotionalVector } from "../../../lib/emotionalVector";
import { arrayToVector } from "../../../lib/vectorMath";

export const runtime = "nodejs";

interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  previewUrl: string | null;
  artwork: string | null;
  emotionalVector?: EmotionalVector;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function resolveSongs(
  excludeTitles: string[],
  languages: string[],
  likedArtists: string[]
): Promise<SeedSong[]> {
  const excludeSet = new Set(excludeTitles.map((t) => t.toLowerCase()));
  // Fetch the whole catalog (currently ~300 songs, ordered by created_at DESC
  // in list_catalog). A limit of 200 would silently drop the oldest ~100
  // songs, which skews language/artist availability for whichever rows
  // happen to sort past the cutoff (verified against the live catalog: with
  // limit 200, 3 of 5 preview-having Russian tracks were excluded).
  const catalog = await listSongs(500, 0);
  const withPreview = catalog.filter(
    (s) => s.itunes_preview_url && !excludeSet.has(s.title.toLowerCase())
  );

  const normalizedLangs = languages.map((l) => l.toLowerCase());
  const matchesLanguage = (lang: string) =>
    normalizedLangs.length === 0 ||
    lang.toLowerCase() === "instrumental" ||
    normalizedLangs.some((l) => lang.toLowerCase().includes(l) || l.includes(lang.toLowerCase()));

  const preferred = withPreview.filter((s) => matchesLanguage(s.language));
  const rest = withPreview.filter((s) => !matchesLanguage(s.language));

  const isLikedArtist = (artist: string) =>
    likedArtists.some((a) => a.toLowerCase() === artist.toLowerCase());

  // Liked-artist songs first (within the language-filtered set), then the
  // rest of the language-filtered pool, then out-of-language fallback so
  // there's always something to show.
  const byArtist = [...preferred].sort(
    (a, b) => Number(isLikedArtist(b.artist)) - Number(isLikedArtist(a.artist))
  );
  const likedGroup = byArtist.filter((s) => isLikedArtist(s.artist));
  const restOfPreferred = shuffle(byArtist.filter((s) => !isLikedArtist(s.artist)));

  const ordered = [...likedGroup, ...restOfPreferred, ...shuffle(rest)];

  return ordered.slice(0, 10).map((s) => ({
    title: s.title,
    artist: s.artist,
    genres: s.genre_tags,
    previewUrl: s.itunes_preview_url,
    artwork: s.artwork_url,
    emotionalVector: s.emotional_vector ? arrayToVector(s.emotional_vector) : undefined,
  }));
}

export async function GET(req: NextRequest) {
  const language = req.nextUrl.searchParams.get("language") ?? "";
  const final = await resolveSongs([], language ? [language] : [], []);
  return NextResponse.json(final);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const exclude: string[] = Array.isArray(body.exclude) ? body.exclude : [];
  const languages: string[] = Array.isArray(body.languages)
    ? body.languages
    : typeof body.language === "string" && body.language
    ? [body.language]
    : [];
  const likedArtists: string[] = Array.isArray(body.likedArtists) ? body.likedArtists : [];
  const final = await resolveSongs(exclude, languages, likedArtists);
  return NextResponse.json(final);
}
