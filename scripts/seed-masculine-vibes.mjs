/**
 * VibeSong masculine-vibes seeder -- gym, night drive, swagger, stoic
 * heartbreak, rock grit, rap flex, and country recovery moments.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-masculine-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- RAP FLEX / GYM ------------------------------------------------------
  { title: "DNA.", artist: "Kendrick Lamar" },
  { title: "Not Like Us", artist: "Kendrick Lamar" },
  { title: "All the Stars", artist: "Kendrick Lamar, SZA" },
  { title: "Like That", artist: "Future, Metro Boomin, Kendrick Lamar" },
  { title: "Mask Off", artist: "Future" },
  { title: "March Madness", artist: "Future" },
  { title: "SICKO MODE", artist: "Travis Scott" },
  { title: "FE!N (feat. Playboi Carti)", artist: "Travis Scott" },
  { title: "HIGHEST IN THE ROOM", artist: "Travis Scott" },
  { title: "redrum", artist: "21 Savage" },
  { title: "Knife Talk (feat. 21 Savage & Project Pat)", artist: "Drake" },
  { title: "Nonstop", artist: "Drake" },
  { title: "Jimmy Cooks (feat. 21 Savage)", artist: "Drake" },
  { title: "Dior", artist: "Pop Smoke" },
  { title: "Invincible", artist: "Pop Smoke" },
  { title: "Breathe", artist: "Yeat" },
  { title: "BAND4BAND", artist: "Central Cee & Lil Baby" },

  // -- ROCK GRIT / NIGHT DRIVE --------------------------------------------
  { title: "R U Mine?", artist: "Arctic Monkeys" },
  { title: "Do I Wanna Know?", artist: "Arctic Monkeys" },
  { title: "505", artist: "Arctic Monkeys" },
  { title: "Everlong", artist: "Foo Fighters" },
  { title: "The Pretender", artist: "Foo Fighters" },
  { title: "Mr. Brightside", artist: "The Killers" },
  { title: "Seven Nation Army", artist: "The White Stripes" },
  { title: "Change (In the House of Flies)", artist: "Deftones" },
  { title: "Be Quiet and Drive (Far Away)", artist: "Deftones" },
  { title: "Faint", artist: "Linkin Park" },
  { title: "Bleed It Out", artist: "Linkin Park" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana" },

  // -- COUNTRY / STOIC HEARTBREAK -----------------------------------------
  { title: "White Horse", artist: "Chris Stapleton" },
  { title: "You Proof", artist: "Morgan Wallen" },
  { title: "Sand In My Boots", artist: "Morgan Wallen" },
  { title: "TRUCK BED", artist: "HARDY" },
  { title: "Need A Favor", artist: "Jelly Roll" },
  { title: "Save Me (with Lainey Wilson)", artist: "Jelly Roll" },
  { title: "Oklahoma Smokeshow", artist: "Zach Bryan" },
  { title: "Pink Skies", artist: "Zach Bryan" },

  // -- DARK POP / LATE NIGHT ----------------------------------------------
  { title: "The Hills", artist: "The Weeknd" },
  { title: "Starboy (feat. Daft Punk)", artist: "The Weeknd" },
  { title: "Reminder", artist: "The Weeknd" },
  { title: "Circles", artist: "Post Malone" },
  { title: "Chemical", artist: "Post Malone" },
];

// ─── RUNNER ────────────────────────────────────────────────────────────────

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
  console.log(`\nVibeSong Masculine Vibes Seeder`);
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
