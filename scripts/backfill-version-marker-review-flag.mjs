/**
 * Retroactively flags existing catalog songs whose title carries a
 * live/instrumental/karaoke/cover/remix/tribute qualifier in parentheses or
 * brackets (e.g. "But You (Live at Club Locomotiv)") -- the same check
 * lib/autoTag.ts's hasVersionMarkerQualifier() now applies at insertion time,
 * applied here to the songs that predate that fix. Only touches rows where
 * needs_review is currently false (an already-flagged or already
 * manually-approved song is left alone).
 *
 * Requires supabase/needs-review-flag-migration.sql to already be applied --
 * without it, update_song silently ignores the unrecognized p_flag_for_review
 * parameter and this script is a no-op.
 *
 * Safe to re-run: only PATCHes songs currently needs_review=false that still
 * match the pattern.
 *
 * Run against a live dev server:
 *   npm run dev                                          (terminal 1)
 *   node scripts/backfill-version-marker-review-flag.mjs  (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "vibesong-admin-2026";
const PAGE_SIZE = 500;

const VERSION_MARKER_TERMS = [
  "live",
  "instrumental",
  "karaoke",
  "acoustic",
  "cover",
  "remix",
  "tribute",
  "originally performed",
  "made famous by",
  "in the style of",
];

// Mirrors lib/autoTag.ts's hasVersionMarkerQualifier() exactly.
function hasVersionMarkerQualifier(title) {
  const qualifiers = title.match(/[([]([^)\]]*)[)\]]/g) ?? [];
  return qualifiers.some((qualifier) => {
    const lower = qualifier.toLowerCase();
    return VERSION_MARKER_TERMS.some((term) => lower.includes(term));
  });
}

async function fetchAllSongs() {
  const all = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${BASE_URL}/api/admin/songs?limit=${PAGE_SIZE}&offset=${offset}`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!res.ok) throw new Error(`GET /api/admin/songs failed: ${res.status}`);
    const { songs } = await res.json();
    all.push(...songs);
    if (songs.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

async function flagForReview(id) {
  const res = await fetch(`${BASE_URL}/api/admin/songs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ flagForReview: true }),
  });
  if (!res.ok) throw new Error(`PATCH failed for song ${id}: ${res.status}`);
}

async function main() {
  const songs = await fetchAllSongs();
  const pending = songs.filter((s) => hasVersionMarkerQualifier(s.title) && !s.needs_review);
  console.log(`${songs.length} total songs, ${pending.length} need the version-marker review flag.`);

  let done = 0;
  for (const song of pending) {
    try {
      await flagForReview(song.id);
      done++;
      console.log(`[${done}/${pending.length}] flagged "${song.title}" by ${song.artist}`);
    } catch (err) {
      console.error(`Skipping "${song.title}" by ${song.artist}:`, err.message);
    }
  }
  console.log(`Backfill complete: ${done}/${pending.length} songs flagged for review.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
