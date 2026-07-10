/**
 * VibeSong English trending now seeder -- current charting English-language
 * pop, country, rap, R&B, indie-pop, and UK dance tracks.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-english-trending-now.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- CHART POP / ALT-POP -------------------------------------------------
  { title: "Rein Me In", artist: "Sam Fender & Olivia Dean" },
  { title: "American Girls", artist: "Harry Styles" },
  { title: "The Cure", artist: "Olivia Rodrigo" },
  { title: "Drop Dead", artist: "Olivia Rodrigo" },
  { title: "Man I Need", artist: "Olivia Dean" },
  { title: "Earrings", artist: "Malcolm Todd" },
  { title: "Boston", artist: "Stella Lefty" },
  { title: "Ordinary", artist: "Alex Warren" },
  { title: "Midnight Sun", artist: "Zara Larsson" },
  { title: "My Body Isn't Ready", artist: "sombr" },
  { title: "Homewrecker", artist: "sombr" },
  { title: "Fever Dream", artist: "Alex Warren" },
  { title: "Where Is My Husband!", artist: "RAYE" },
  { title: "Hit The Wall", artist: "Gracie Abrams" },
  { title: "So Easy (To Fall In Love)", artist: "Olivia Dean" },
  { title: "Daisies", artist: "Justin Bieber" },
  { title: "Yukon", artist: "Justin Bieber" },

  // -- RAP / R&B -----------------------------------------------------------
  { title: "Janice STFU", artist: "Drake" },
  { title: "What Did I Miss?", artist: "Drake" },
  { title: "Cinderella (feat. Ty Dolla $ign)", artist: "Mac Miller" },
  { title: "Love Me Not", artist: "Ravyn Lenae" },
  { title: "Anxiety", artist: "Doechii" },
  { title: "The Giver", artist: "Chappell Roan" },
  { title: "Outside", artist: "Cardi B" },
  { title: "Folded", artist: "Kehlani" },

  // -- COUNTRY / CROSSOVER -------------------------------------------------
  { title: "Choosin' Texas", artist: "Ella Langley" },
  { title: "Be Her", artist: "Ella Langley" },
  { title: "All The Way", artist: "BigXthaPlug & Bailey Zimmerman" },
  { title: "I Ain't Comin' Back", artist: "Morgan Wallen & Post Malone" },
  { title: "I Got Better", artist: "Morgan Wallen" },
  { title: "What I Want", artist: "Morgan Wallen & Tate McRae" },
  { title: "Just in Case", artist: "Morgan Wallen" },

  // -- UK DANCE / CLUB -----------------------------------------------------
  { title: "Free Your Mind", artist: "Prospa & Cloonee" },
  { title: "On 2Nite", artist: "Silva Bumpa" },
  { title: "Talk To You (feat. 54 Ultra)", artist: "ANOTR" },
  { title: "Blessings", artist: "Calvin Harris & Clementine Douglas" },

  // -- EXTRA CURRENT POP ---------------------------------------------------
  { title: "Babydoll", artist: "Dominic Fike" },
  { title: "I Just Might", artist: "Bruno Mars" },
  { title: "Risk It All", artist: "Bruno Mars" },
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
  console.log(`\nVibeSong English Trending Now Seeder`);
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
