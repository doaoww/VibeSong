/**
 * Backfills lyrical_address for every catalog song tagged before this field
 * existed (lyrical_address IS NULL — distinct from an explicit 'unclear' GPT
 * read, see supabase/pov-signal-migration.sql). Safe to re-run: only touches
 * songs where lyrical_address is still NULL.
 *
 * Requires supabase/pov-signal-migration.sql to already be applied, including
 * the list_catalog extension added in Task 8 (otherwise the RPC won't return
 * lyrical_address and the script treats every song as unclassified).
 * Run against a live dev server:
 *   npm run dev                                    (terminal 1)
 *   node scripts/backfill-lyrical-address.mjs       (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "vibesong-admin-2026";
const PAGE_SIZE = 200;

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

async function classify(title, artist) {
  const res = await fetch(`${BASE_URL}/api/admin/songs/classify-lyrical-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ title, artist }),
  });
  if (!res.ok) throw new Error(`classify failed for "${title}" by ${artist}: ${res.status}`);
  const { lyrical_address } = await res.json();
  return lyrical_address;
}

async function patchSong(id, lyrical_address) {
  const res = await fetch(`${BASE_URL}/api/admin/songs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ lyrical_address }),
  });
  if (!res.ok) throw new Error(`PATCH failed for song ${id}: ${res.status}`);
}

async function main() {
  const songs = await fetchAllSongs();
  const pending = songs.filter((s) => s.lyrical_address === null || s.lyrical_address === undefined);
  console.log(`${songs.length} total songs, ${pending.length} need lyrical_address backfill.`);

  let done = 0;
  for (const song of pending) {
    try {
      const value = await classify(song.title, song.artist);
      await patchSong(song.id, value);
      done++;
      console.log(`[${done}/${pending.length}] "${song.title}" by ${song.artist} -> ${value}`);
    } catch (err) {
      console.error(`Skipping "${song.title}" by ${song.artist}:`, err.message);
    }
  }
  console.log(`Backfill complete: ${done}/${pending.length} songs classified.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
