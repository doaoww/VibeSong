/**
 * VibeSong leftfield scenes seeder -- niche catalog batch for darkwave,
 * shoegaze/slowcore, trip-hop, IDM, global alt, experimental R&B, and ambient.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-leftfield-scenes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- DARKWAVE / POST-PUNK ------------------------------------------------
  { title: "Gallowdance", artist: "Lebanon Hanover" },
  { title: "Kasvetli Kutlama", artist: "She Past Away" },
  { title: "Dot in the Sky", artist: "Drab Majesty" },
  { title: "Confetti", artist: "Cold Cave" },
  { title: "Sulk", artist: "TR/ST" },
  { title: "Circles", artist: "The Soft Moon" },
  { title: "Lovers From The Past", artist: "Mareux" },
  { title: "Club de Vampiros", artist: "French Police" },
  { title: "Spell Strike", artist: "Provoker" },

  // -- SHOEGAZE / SLOWCORE -------------------------------------------------
  { title: "When the Sun Hits", artist: "Slowdive" },
  { title: "Only Shallow", artist: "my bloody valentine" },
  { title: "Heaven or Las Vegas", artist: "Cocteau Twins" },
  { title: "Sweetness and Light", artist: "Lush" },
  { title: "Stars Will Fall", artist: "Duster" },
  { title: "Lullaby", artist: "Low" },
  { title: "Fear of Flying", artist: "Bowery Electric" },
  { title: "Harsh Realm", artist: "Widowspeak" },

  // -- TRIP-HOP / DOWNTEMPO -----------------------------------------------
  { title: "6 Underground", artist: "Sneaker Pimps" },
  { title: "Hell Is Round the Corner", artist: "Tricky" },
  { title: "Rabbit In Your Headlights", artist: "UNKLE" },
  { title: "Midnight in a Perfect World", artist: "DJ Shadow" },
  { title: "The Sea", artist: "Morcheeba" },
  { title: "Destiny", artist: "Zero 7" },
  { title: "2 Wicky", artist: "Hooverphonic" },
  { title: "Gorecki", artist: "Lamb" },

  // -- LEFTFIELD ELECTRONIC / IDM -----------------------------------------
  { title: "Archangel", artist: "Burial" },
  { title: "Roygbiv", artist: "Boards of Canada" },
  { title: "Avril 14th", artist: "Aphex Twin" },
  { title: "Two Thousand and Seventeen", artist: "Four Tet" },
  { title: "Emerald Rush", artist: "Jon Hopkins" },
  { title: "Glue", artist: "Bicep" },
  { title: "Melt!", artist: "Kelly Lee Owens" },
  { title: "A New Error", artist: "Moderat" },

  // -- GLOBAL ALT / DESERT GROOVE -----------------------------------------
  { title: "Sastanaqqam", artist: "Tinariwen" },
  { title: "Afrique Victime", artist: "Mdou Moctar" },
  { title: "Habib Galbi", artist: "A-WA" },
  { title: "Ya Rayah", artist: "Rachid Taha" },
  { title: "Tiger Phone Card", artist: "Dengue Fever" },
  { title: "Time (You and I)", artist: "Khruangbin" },

  // -- EXPERIMENTAL POP / ALT R&B -----------------------------------------
  { title: "Kerosene!", artist: "Yves Tumor" },
  { title: "Boys at School", artist: "SPELLLING" },
  { title: "Frontline", artist: "Kelela" },
  { title: "Gladly", artist: "Tirzah" },
  { title: "Fellowship", artist: "serpentwithfeet" },
  { title: "Daddy", artist: "Lafawndah" },
  { title: "Human", artist: "Sevdaliza" },
  { title: "Crushing", artist: "Eartheater" },

  // -- AMBIENT / MODERN COMPOSITION ---------------------------------------
  { title: "Inspirit", artist: "Julianna Barwick" },
  { title: "Glass", artist: "Hania Rani" },
  { title: "Looped", artist: "Kiasmos" },
  { title: "Recovery", artist: "Rival Consoles" },
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
  console.log(`\nVibeSong Leftfield Scenes Seeder`);
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
