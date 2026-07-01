/**
 * VibeSong trending seeder — songs actually trending on Instagram Reels
 * right now (July 2026), sourced via web search, not guessed.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   BASE_URL=http://localhost:3001 node scripts/seed-trending.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  { title: "That Should Be Me", artist: "Justin Bieber" },
  { title: "I Knew It, I Knew You", artist: "Taylor Swift" },
  { title: "Game Time", artist: "Future & Tyla" },
  { title: "Dai Dai", artist: "Shakira & Burna Boy" },
  { title: "Golden Brown (Slowed Down Version)", artist: "The Stranglers" },
  { title: "Young Hearts Run Free (45 Version)", artist: "Candi Staton" },
  { title: "Summer on the Inside", artist: "warner case, Jean Tonique & Max Kaluza" },
  { title: "Shape of a Woman", artist: "Lady Gaga" },
  { title: "Glamorous Life", artist: "Lady Gaga" },
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
  console.log(`\nVibeSong Trending Catalog Seeder`);
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
