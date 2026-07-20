"use client";

// Server-side freshness (lib/recommend.ts's freshnessPenalty) only knows
// about songs the user explicitly saved or skipped (see
// resolveRecentlyShownSongIds) — a song just glanced at across several
// uploads, never swiped, gets no penalty at all. For a song with a
// structurally generic emotional_vector/tags (scores well against almost
// any photo — see the "pocket locket"/"The King" investigation), that means
// it can win a slot on every single request regardless of the photo. This
// client-side session log covers the gap: every song actually shown gets
// remembered here and sent back on the next request, independent of
// whether the user ever swipes on it.
const LS_KEY = "vibesong_recently_shown_songs";
const MAX_TRACKED = 60;

export function getRecentlyShownSongIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function addRecentlyShownSongIds(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  const existing = getRecentlyShownSongIds();
  const merged = [...ids, ...existing.filter((id) => !ids.includes(id))].slice(0, MAX_TRACKED);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {}
}
