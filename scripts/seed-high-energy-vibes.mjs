/**
 * VibeSong high-energy seeder -- club rush, rap confidence, rock adrenaline,
 * festival electronic, Latin motion, and Afro-pop movement.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-high-energy-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- POP / CLUB RUSH -----------------------------------------------------
  { title: "Blinding Lights", artist: "The Weeknd" },
  { title: "Bad Romance", artist: "Lady Gaga" },
  { title: "Poker Face", artist: "Lady Gaga" },
  { title: "Toxic", artist: "Britney Spears" },
  { title: "TiK ToK", artist: "Kesha" },
  { title: "Where Have You Been", artist: "Rihanna" },
  { title: "Give Me Everything (feat. Ne-Yo, Afrojack & Nayer)", artist: "Pitbull" },
  { title: "Don't Start Now", artist: "Dua Lipa" },
  { title: "Chandelier", artist: "Sia" },
  { title: "Midnight Sky", artist: "Miley Cyrus" },
  { title: "Sweet Nothing (feat. Florence Welch)", artist: "Calvin Harris" },
  { title: "Rather Be (feat. Jess Glynne)", artist: "Clean Bandit" },

  // -- RAP / SWAGGER ENERGY -----------------------------------------------
  { title: "Without Me", artist: "Eminem" },
  { title: "The Real Slim Shady", artist: "Eminem" },
  { title: "6 Foot 7 Foot (feat. Cory Gunz)", artist: "Lil Wayne" },
  { title: "A Milli", artist: "Lil Wayne" },
  { title: "Started From the Bottom", artist: "Drake" },
  { title: "God's Plan", artist: "Drake" },
  { title: "Work Out", artist: "J. Cole" },
  { title: "Plain Jane", artist: "A$AP Ferg" },
  { title: "m.A.A.d city (feat. MC Eiht)", artist: "Kendrick Lamar" },
  { title: "Shutdown", artist: "Skepta" },
  { title: "Vossi Bop", artist: "Stormzy" },

  // -- ROCK / PUNK / ADRENALINE -------------------------------------------
  { title: "Reptilia", artist: "The Strokes" },
  { title: "Tick Tick Boom", artist: "The Hives" },
  { title: "Go With the Flow", artist: "Queens of the Stone Age" },
  { title: "Out of the Black", artist: "Royal Blood" },
  { title: "Knights of Cydonia", artist: "Muse" },
  { title: "Still Into You", artist: "Paramore" },
  { title: "Fat Lip", artist: "Sum 41" },
  { title: "Sugar, We're Goin Down", artist: "Fall Out Boy" },
  { title: "All My Life", artist: "Foo Fighters" },
  { title: "The Kids Aren't Alright", artist: "The Offspring" },
  { title: "Highway to Hell", artist: "AC/DC" },
  { title: "Psychosocial", artist: "Slipknot" },
  { title: "Duality", artist: "Slipknot" },

  // -- ELECTRONIC / FESTIVAL / BASS ---------------------------------------
  { title: "Firestarter", artist: "The Prodigy" },
  { title: "Breathe", artist: "The Prodigy" },
  { title: "Genesis", artist: "Justice" },
  { title: "Galvanize", artist: "The Chemical Brothers" },
  { title: "Hey Boy Hey Girl", artist: "The Chemical Brothers" },
  { title: "Right Here, Right Now", artist: "Fatboy Slim" },
  { title: "Where’s Your Head At", artist: "Basement Jaxx" },
  { title: "Satisfaction", artist: "Benny Benassi & The Biz" },
  { title: "Titanium (feat. Sia)", artist: "David Guetta" },
  { title: "Piece Of Your Heart", artist: "MEDUZA & Goodboys" },
  { title: "Rumble", artist: "Skrillex, Fred again.. & Flowdan" },

  // -- LATIN / AFRO / GLOBAL MOVEMENT -------------------------------------
  { title: "Dura", artist: "Daddy Yankee" },
  { title: "X", artist: "Nicky Jam & J Balvin" },
  { title: "Salió el Sol", artist: "Don Omar" },
  { title: "Lean On (feat. MØ & DJ Snake)", artist: "Major Lazer" },
  { title: "Light It Up (feat. Nyla & Fuse ODG) [Remix]", artist: "Major Lazer" },
  { title: "She Wolf", artist: "Shakira" },
  { title: "Ojuelegba", artist: "Wizkid" },
  { title: "KU LO SA", artist: "Oxlade" },
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
  console.log(`\nVibeSong High Energy Vibes Seeder`);
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
