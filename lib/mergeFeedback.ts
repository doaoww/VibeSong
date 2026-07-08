// Matches lib/recommend.ts's feedbackKey convention: track_feedback rows have
// no song id, only title/artist, so identity has to go through a normalized
// title+artist key.
function feedbackKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}|||${artist.trim().toLowerCase()}`;
}

/**
 * Merges a freshly-fetched server list into local state without discarding
 * local-only entries. saveTrack/skipTrack POST to /api/feedback without
 * awaiting the result, so a GET fired immediately after (e.g. navigating to
 * /library right after a save) can race ahead of that write landing in the
 * database — replacing local state outright would make the just-saved track
 * disappear until the next refresh. The server's copy always wins when both
 * have the same track.
 */
export function mergeFeedbackTracks<T extends { title: string; artist: string }>(
  local: T[],
  server: T[]
): T[] {
  const serverKeys = new Set(server.map((t) => feedbackKey(t.title, t.artist)));
  const localOnly = local.filter((t) => !serverKeys.has(feedbackKey(t.title, t.artist)));
  return [...server, ...localOnly];
}
