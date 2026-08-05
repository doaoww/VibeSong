/**
 * Backfills song_generation for every catalog song tagged before this field
 * existed (song_generation IS NULL — distinct from an explicit 'unclear' GPT
 * read, see supabase/song-generation-migration.sql). Safe to re-run: only
 * touches songs where song_generation is still NULL.
 *
 * Requires supabase/song-generation-migration.sql to already be applied.
 * Run against a live dev server:
 *   npm run dev                                    (terminal 1)
 *   node scripts/backfill-song-generation.mjs       (terminal 2)
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
  const res = await fetch(`${BASE_URL}/api/admin/songs/classify-generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ title, artist }),
  });
  if (!res.ok) throw new Error(`classify failed for "${title}" by ${artist}: ${res.status}`);
  const { song_generation } = await res.json();
  return song_generation;
}

async function patchSong(id, song_generation) {
  const res = await fetch(`${BASE_URL}/api/admin/songs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET },
    body: JSON.stringify({ song_generation }),
  });
  if (!res.ok) throw new Error(`PATCH failed for song ${id}: ${res.status}`);
}

async function main() {
  const songs = await fetchAllSongs();
  const pending = songs.filter((s) => s.song_generation === null || s.song_generation === undefined);
  console.log(`${songs.length} total songs, ${pending.length} need song_generation backfill.`);

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
