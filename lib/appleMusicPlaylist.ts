export interface AppleMusicPlaylistTrack {
  title: string;
  artist: string;
}

export interface AppleMusicPlaylistResult {
  tracks: AppleMusicPlaylistTrack[];
  truncated: boolean;
  totalFound: number;
}

export class InvalidUrlError extends Error {
  constructor(message = "That does not look like an Apple Music playlist link.") {
    super(message);
    this.name = "InvalidUrlError";
  }
}

export class ParseError extends Error {
  constructor(message = "Could not read tracks from that Apple Music playlist.") {
    super(message);
    this.name = "ParseError";
  }
}

const PLAYLIST_LIMIT = 30;

function assertAppleMusicPlaylistUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new InvalidUrlError();
  }

  if (url.hostname !== "music.apple.com" || !url.pathname.includes("/playlist/")) {
    throw new InvalidUrlError();
  }

  return url;
}

/**
 * The page also ships a `<script type="application/ld+json">` block with a
 * clean MusicPlaylist.track[] list, but each entry only has a title — no
 * artist field at all (verified against two live playlists while planning
 * this feature: an editorial one and a user-created one). Artist names only
 * exist in this second blob, which is Apple's internal Vue SSR
 * component-tree state, not a documented format — every track object that
 * has it also carries a sibling `title` string, so walking for that pair is
 * the only way to get {title, artist} together.
 */
function extractServerDataBlock(html: string): string | null {
  const match = html.match(
    /<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/
  );
  return match ? match[1] : null;
}

function walkForTracks(node: unknown, seen: Set<string>, out: AppleMusicPlaylistTrack[]): void {
  if (Array.isArray(node)) {
    for (const item of node) walkForTracks(item, seen, out);
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  if (typeof record.title === "string" && typeof record.artistName === "string") {
    const title = record.title.trim();
    const artist = record.artistName.trim();
    if (title && artist) {
      const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ title, artist });
      }
    }
  }

  for (const value of Object.values(record)) {
    walkForTracks(value, seen, out);
  }
}

function parseTracksFromHtml(html: string): AppleMusicPlaylistResult {
  const block = extractServerDataBlock(html);
  if (!block) throw new ParseError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    throw new ParseError();
  }

  const tracks: AppleMusicPlaylistTrack[] = [];
  walkForTracks(parsed, new Set<string>(), tracks);
  if (tracks.length === 0) throw new ParseError();

  return {
    tracks: tracks.slice(0, PLAYLIST_LIMIT),
    truncated: tracks.length > PLAYLIST_LIMIT,
    totalFound: tracks.length,
  };
}

export async function parseAppleMusicPlaylist(url: string): Promise<AppleMusicPlaylistResult> {
  const playlistUrl = assertAppleMusicPlaylistUrl(url);
  const res = await fetch(playlistUrl.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new ParseError(`Apple Music returned ${res.status}.`);
  }

  return parseTracksFromHtml(await res.text());
}
