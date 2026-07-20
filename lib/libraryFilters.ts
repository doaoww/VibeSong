import type { Track } from "../store/useAppStore";
import type { en } from "./translations/en";

export const FILTERS = ["All", "This Week", "Moody", "Hype"] as const;
export type Filter = (typeof FILTERS)[number];

export function filterSongs(songs: Track[], filter: Filter): Track[] {
  if (filter === "All") return songs;
  if (filter === "This Week") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return songs.filter((s) => (s.savedAt || 0) > weekAgo);
  }
  return songs;
}

export function getFilterLabel(filter: Filter, t: typeof en): string {
  switch (filter) {
    case "All": return t.library.filterAll;
    case "This Week": return t.library.filterThisWeek;
    case "Moody": return t.library.filterMoody;
    case "Hype": return t.library.filterHype;
    default: return filter;
  }
}
