/**
 * VibeSong curated seeder — user-picked "dreamy luxury / quiet luxury / editorial"
 * aesthetic batch. Dupes already in the catalog were filtered out beforehand.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   BASE_URL=http://localhost:3001 node scripts/seed-curated.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // ── DREAMY / LUXURY ──────────────────────────────────────────────────────
  { title: "Spring Into Summer", artist: "Lizzy McAlpine" },
  { title: "Harvey", artist: "Her's" },
  { title: "French Exit", artist: "TV Girl" },
  { title: "Moon Undah Water", artist: "Puma Blue" },
  { title: "Like the Movies", artist: "Laufey" },

  // ── FASHION GIRL / VOGUE ENERGY ──────────────────────────────────────────
  { title: "Sexy to Someone", artist: "Clairo" },
  { title: "Apple", artist: "Charli xcx" },
  { title: "Sally, When The Wine Runs Out", artist: "ROLE MODEL" },
  { title: "Silver Soul", artist: "Beach House" },

  // ── QUIET LUXURY / PINTEREST ──────────────────────────────────────────────
  { title: "Glue Song", artist: "beabadoobee" },
  { title: "A House in Nebraska", artist: "Ethel Cain" },
  { title: "Cherry Wine (Live)", artist: "Hozier" },
  { title: "The Night We Met", artist: "Lord Huron" },

  // ── COOL GIRL / EDITORIAL ─────────────────────────────────────────────────
  { title: "Nangs", artist: "Tame Impala" },

  // ── BEAUTY / COLOR ANALYSIS ───────────────────────────────────────────────
  { title: "Naked in Manhattan", artist: "Chappell Roan" },
  { title: "Sunsetz", artist: "Cigarettes After Sex" },
  { title: "Mystery of Love", artist: "Sufjan Stevens" },
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function addSong(song, index, total) {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/songs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": ADMIN_SECRET,
      },
      body: JSON.stringify(song),
    });
    const data = await res.json();
    if (res.ok) {
      const s = data.song;
      console.log(
        `[${index}/${total}] ✓ ${s.artist} — ${s.title} | ${s.language} | tier ${s.popularity_tier} | tags: ${(s.story_intent_tags || []).slice(0, 2).join(", ")}`
      );
      return true;
    } else {
      console.error(`[${index}/${total}] ✗ ${song.artist} — ${song.title}: ${data.error}`);
      return false;
    }
  } catch (err) {
    console.error(`[${index}/${total}] ✗ ${song.artist} — ${song.title}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`\nVibeSong Curated Seeder`);
  console.log(`Adding ${SONGS.length} songs to ${BASE_URL}`);

  try {
    const ping = await fetch(`${BASE_URL}/api/admin/songs`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!ping.ok) throw new Error(`Admin API returned ${ping.status}`);
    const existing = await ping.json();
    console.log(`✓ Server reachable. Existing songs in catalog: ${existing.songs?.length ?? 0}\n`);
  } catch (err) {
    console.error(`✗ Cannot reach dev server at ${BASE_URL}: ${err.message}`);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < SONGS.length; i++) {
    const song = SONGS[i];
    const before = Date.now();
    const success = await addSong(song, i + 1, SONGS.length);
    if (success) ok++; else fail++;
    const elapsed = Date.now() - before;
    const wait = Math.max(0, 2000 - elapsed);
    if (wait > 0) await sleep(wait);
  }

  console.log(`\n✓ Done. ${ok} added, ${fail} failed.`);
  console.log(`Check your catalog at ${BASE_URL}/admin`);
}

main().catch(console.error);
