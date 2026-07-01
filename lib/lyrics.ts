// Seam for a future lyrics signal. No real provider is wired up yet —
// lyrics availability must not affect source_confidence until one is.
export interface LyricsProvider {
  fetchLyrics(title: string, artist: string): Promise<string | null>;
}

export class NullLyricsProvider implements LyricsProvider {
  async fetchLyrics(_title: string, _artist: string): Promise<string | null> {
    return null;
  }
}
