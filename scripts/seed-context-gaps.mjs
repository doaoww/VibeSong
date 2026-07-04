/**
 * VibeSong context-gap seeder — targets story_context_tags that are
 * underrepresented relative to catalog size (checked via direct DB query,
 * 829 songs total): beach (39), cafe (19), gym (23), travel (22),
 * outfit check (22), group photo (4 — biggest gap by far).
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-context-gaps.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // ── BEACH / SEA / SUMMER ─────────────────────────────────────────────────
  { title: "Kokomo", artist: "The Beach Boys" },
  { title: "Surfin' U.S.A.", artist: "The Beach Boys" },
  { title: "Riptide", artist: "Vance Joy" },
  { title: "Cool for the Summer", artist: "Demi Lovato" },
  { title: "California Gurls", artist: "Katy Perry" },
  { title: "Malibu", artist: "Miley Cyrus" },
  { title: "Ocean", artist: "Martin Garrix & Khalid" },
  { title: "Sun Is Shining", artist: "Bob Marley" },
  { title: "Under the Boardwalk", artist: "The Drifters" },
  { title: "Tequila Sunrise", artist: "Eagles" },
  { title: "Here Comes the Sun", artist: "The Beatles" },
  { title: "Waves", artist: "Mr Probz" },

  // ── CAFE / COZY MORNING ──────────────────────────────────────────────────
  { title: "Banana Pancakes", artist: "Jack Johnson" },
  { title: "Put Your Records On", artist: "Corinne Bailey Rae" },
  { title: "Don't Know Why", artist: "Norah Jones" },
  { title: "Skinny Love", artist: "Bon Iver" },
  { title: "Heartbeats", artist: "José González" },
  { title: "Flightless Bird, American Mouth", artist: "Iron & Wine" },
  { title: "Sunday Morning", artist: "Maroon 5" },
  { title: "Best Part", artist: "Daniel Caesar feat. H.E.R." },

  // ── GYM / WORKOUT ────────────────────────────────────────────────────────
  { title: "Stronger", artist: "Kanye West" },
  { title: "Can't Hold Us", artist: "Macklemore & Ryan Lewis" },
  { title: "Eye of the Tiger", artist: "Survivor" },
  { title: "Believer", artist: "Imagine Dragons" },
  { title: "Thunderstruck", artist: "AC/DC" },
  { title: "HUMBLE.", artist: "Kendrick Lamar" },
  { title: "Turn Down for What", artist: "DJ Snake & Lil Jon" },
  { title: "Stronger (What Doesn't Kill You)", artist: "Kelly Clarkson" },

  // ── TRAVEL / ROAD TRIP ───────────────────────────────────────────────────
  { title: "On the Road Again", artist: "Willie Nelson" },
  { title: "I'm Gonna Be (500 Miles)", artist: "The Proclaimers" },
  { title: "Life Is a Highway", artist: "Rascal Flatts" },
  { title: "Take Me Home, Country Roads", artist: "John Denver" },
  { title: "Africa", artist: "Toto" },
  { title: "Ho Hey", artist: "The Lumineers" },
  { title: "Home", artist: "Edward Sharpe & The Magnetic Zeros" },
  { title: "Fly Away", artist: "Lenny Kravitz" },

  // ── OUTFIT CHECK / FASHION ───────────────────────────────────────────────
  { title: "Fashion!", artist: "Lady Gaga" },
  { title: "Style", artist: "Taylor Swift" },
  { title: "New Rules", artist: "Dua Lipa" },
  { title: "Levitating", artist: "Dua Lipa" },
  { title: "Physical", artist: "Dua Lipa" },
  { title: "Formation", artist: "Beyoncé" },
  { title: "Cool Kids", artist: "Echosmith" },

  // ── GROUP PHOTO / SQUAD ──────────────────────────────────────────────────
  { title: "Friends", artist: "Marshmello & Anne-Marie" },
  { title: "Best Day of My Life", artist: "American Authors" },
  { title: "Good Time", artist: "Owl City & Carly Rae Jepsen" },
  { title: "Can't Stop the Feeling!", artist: "Justin Timberlake" },
  { title: "Shut Up and Dance", artist: "Walk the Moon" },
  { title: "24K Magic", artist: "Bruno Mars" },
  { title: "Uptown Funk", artist: "Mark Ronson feat. Bruno Mars" },
  { title: "I Gotta Feeling", artist: "The Black Eyed Peas" },
  { title: "Yeah!", artist: "Usher feat. Lil Jon & Ludacris" },
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
        `[${index}/${total}] ✓ ${s.artist} — ${s.title} | ${s.language} | tier ${s.popularity_tier} | context: ${(s.story_context_tags || []).join(", ")}`
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
  console.log(`\nVibeSong Context-Gap Seeder`);
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
