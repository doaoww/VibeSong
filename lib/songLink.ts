export interface LinkableSong {
  appleMusicUrl?: string;
  youtubeUrl?: string;
  youtubeId?: string;
  previewUrl?: string;
}

/**
 * Resolves a URL to open for a saved song, in priority order: Apple Music,
 * an already-resolved YouTube URL (legacy field — the current catalog-based
 * recommend flow in app/app/page.tsx never sets it), a YouTube watch URL
 * built from youtubeId (the field that flow actually populates), then the
 * iTunes preview audio file as a last resort. Returns null when none of
 * these exist, so callers can render a non-interactive row instead of a
 * dead "#" link.
 */
export function resolveSongLink(song: LinkableSong): string | null {
  if (song.appleMusicUrl) return song.appleMusicUrl;
  if (song.youtubeUrl) return song.youtubeUrl;
  if (song.youtubeId) return `https://www.youtube.com/watch?v=${song.youtubeId}`;
  if (song.previewUrl) return song.previewUrl;
  return null;
}
