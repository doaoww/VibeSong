/**
 * VibeSong more masculine-vibes seeder -- legacy hip-hop, gym confidence,
 * stoic heartbreak, rock grit, outlaw country, dark club, and global flex.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-more-masculine-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- LEGACY HIP-HOP / CONFIDENCE ----------------------------------------
  { title: "Many Men (Wish Death)", artist: "50 Cent" },
  { title: "In da Club", artist: "50 Cent" },
  { title: "Patiently Waiting (feat. Eminem)", artist: "50 Cent" },
  { title: "Ruff Ryders Anthem", artist: "DMX" },
  { title: "Hate It or Love It (feat. 50 Cent)", artist: "The Game" },
  { title: "Still D.R.E. (feat. Snoop Dogg)", artist: "Dr. Dre" },
  { title: "Forgot About Dre (feat. Eminem)", artist: "Dr. Dre" },
  { title: "Who Am I (What’s My Name)?", artist: "Snoop Dogg" },
  { title: "The World Is Yours", artist: "Nas" },
  { title: "C.R.E.A.M. (Cash Rules Everything Around Me) [Radio Edit]", artist: "Wu-Tang Clan" },
  { title: "Dirt Off Your Shoulder", artist: "JAY-Z" },
  { title: "No Church in the Wild (feat. Frank Ocean)", artist: "Kanye West & JAY-Z" },

  // -- MODERN RAP / NIGHT FLEX --------------------------------------------
  { title: "Praise The Lord (Da Shine) [feat. Skepta]", artist: "A$AP Rocky" },
  { title: "Man of the Year", artist: "ScHoolboy Q" },
  { title: "Norf Norf", artist: "Vince Staples" },
  { title: "Ultimate", artist: "Denzel Curry" },
  { title: "Drip Too Hard", artist: "Lil Baby & Gunna" },
  { title: "Hot (feat. Gunna)", artist: "Young Thug" },
  { title: "Creepin'", artist: "Metro Boomin, The Weeknd & 21 Savage" },
  { title: "Fighting My Demons", artist: "Ken Carson" },
  { title: "Heartless", artist: "The Weeknd" },
  { title: "After Hours", artist: "The Weeknd" },
  { title: "Roses (Imanbek Remix)", artist: "SAINt JHN" },
  { title: "Pursuit of Happiness (Nightmare) [feat. MGMT & Ratatat]", artist: "Kid Cudi" },
  { title: "90210 (feat. Kacy Hill)", artist: "Travis Scott" },
  { title: "FEEL.", artist: "Kendrick Lamar" },
  { title: "Am I Dreaming", artist: "Metro Boomin, A$AP Rocky & Roisee" },

  // -- STOIC R&B / HEARTBREAK ---------------------------------------------
  { title: "Don't", artist: "Bryson Tiller" },
  { title: "Right My Wrongs", artist: "Bryson Tiller" },
  { title: "Adorn", artist: "Miguel" },
  { title: "Recognize (feat. Drake)", artist: "PARTYNEXTDOOR" },
  { title: "Come and See Me", artist: "PARTYNEXTDOOR & Drake" },

  // -- ROCK / METAL / ROAD GRIT -------------------------------------------
  { title: "Back In Black", artist: "AC/DC" },
  { title: "Sweet Child O' Mine", artist: "Guns N' Roses" },
  { title: "Welcome To The Jungle", artist: "Guns N' Roses" },
  { title: "Paranoid", artist: "Black Sabbath" },
  { title: "Immigrant Song", artist: "Led Zeppelin" },
  { title: "Whole Lotta Love", artist: "Led Zeppelin" },
  { title: "Like a Stone", artist: "Audioslave" },
  { title: "Black Hole Sun", artist: "Soundgarden" },
  { title: "Interstate Love Song", artist: "Stone Temple Pilots" },
  { title: "Higher", artist: "Creed" },
  { title: "How You Remind Me", artist: "Nickelback" },
  { title: "Can't Stop", artist: "Red Hot Chili Peppers" },
  { title: "My Hero", artist: "Foo Fighters" },

  // -- COUNTRY / OUTLAW / HARD RESET --------------------------------------
  { title: "God's Gonna Cut You Down", artist: "Johnny Cash" },
  { title: "Hurt", artist: "Johnny Cash" },
  { title: "Folsom Prison Blues", artist: "Johnny Cash" },
  { title: "Starting Over", artist: "Chris Stapleton" },
  { title: "Broken Halos", artist: "Chris Stapleton" },
  { title: "'Til You Can't", artist: "Cody Johnson" },
  { title: "Sleeping on the Blacktop", artist: "Colter Wall" },
  { title: "The Devil Wears a Suit and Tie", artist: "Colter Wall" },
  { title: "Burn, Burn, Burn", artist: "Zach Bryan" },

  // -- GLOBAL MALE ENERGY --------------------------------------------------
  { title: "LUNA", artist: "Feid & ATL Jacob" },
  { title: "El Azul", artist: "Junior H & Peso Pluma" },
  { title: "A Mí", artist: "Rels B" },
];

// -- RUNNER ---------------------------------------------------------------

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
        `[${index}/${total}] OK ${s.artist} - ${s.title} | ${s.language} | tier ${s.popularity_tier} | tags: ${(s.story_intent_tags || []).slice(0, 2).join(", ")}`
      );
      return true;
    } else {
      console.error(`[${index}/${total}] FAIL ${song.artist} - ${song.title}: ${data.error}`);
      return false;
    }
  } catch (err) {
    console.error(`[${index}/${total}] FAIL ${song.artist} - ${song.title}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`\nVibeSong More Masculine Vibes Seeder`);
  console.log(`Adding ${SONGS.length} songs to ${BASE_URL}`);

  try {
    const ping = await fetch(`${BASE_URL}/api/admin/songs`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!ping.ok) throw new Error(`Admin API returned ${ping.status}`);
    const existing = await ping.json();
    console.log(`OK Server reachable. Existing songs in catalog: ${existing.songs?.length ?? 0}\n`);
  } catch (err) {
    console.error(`FAIL Cannot reach dev server at ${BASE_URL}: ${err.message}`);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < SONGS.length; i++) {
    const song = SONGS[i];
    const before = Date.now();
    const success = await addSong(song, i + 1, SONGS.length);
    if (success) ok++;
    else fail++;
    const elapsed = Date.now() - before;
    const wait = Math.max(0, 2000 - elapsed);
    if (wait > 0) await sleep(wait);
  }

  console.log(`\nDone. ${ok} added, ${fail} failed.`);
  console.log(`Check your catalog at ${BASE_URL}/admin`);
}

main().catch(console.error);
