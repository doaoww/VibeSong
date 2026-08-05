/**
 * VibeSong niche genre gap seeder -- hyperpop, phonk, drill, amapiano,
 * jersey club, jungle, lo-fi, modern jazz/funk, metal, and latin trap.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-niche-genre-gap-fill.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- HYPERPOP / DIGICORE -----------------------------------------------
  { title: "Vyzee", artist: "SOPHIE" },
  { title: "Bipp", artist: "SOPHIE" },
  { title: "51129", artist: "food house, Gupi & Fraxiom" },
  { title: "Sole", artist: "food house, Gupi & Fraxiom" },
  { title: "Nono", artist: "food house, Gupi & Fraxiom" },
  { title: "Cops and robbers", artist: "underscores" },
  { title: "Locals (Girls like us)", artist: "underscores & gabby start" },
  { title: "Your favorite sidekick (feat. 8485)", artist: "underscores" },
  { title: "Census Designated", artist: "Jane Remover" },
  { title: "Kodak Moment", artist: "Jane Remover" },
  { title: "Royal Blue Walls", artist: "Jane Remover" },

  // -- PHONK / DARK DRIVE -------------------------------------------------
  { title: "Your Name", artist: "DVRST" },
  { title: "Still Breathing", artist: "DVRST" },
  { title: "Every Night", artist: "DVRST & Øneheart" },
  { title: "Chase", artist: "KSLV Noh" },
  { title: "Disaster", artist: "KSLV Noh" },
  { title: "Lunatic", artist: "KSLV Noh" },
  { title: "Pimp Slap", artist: "KSLV Noh" },
  { title: "Scrapyard", artist: "KSLV Noh" },

  // -- DRILL / UK RAP -----------------------------------------------------
  { title: "Welcome To The Party", artist: "Pop Smoke" },
  { title: "Element", artist: "Pop Smoke" },
  { title: "Got It On Me", artist: "Pop Smoke" },
  { title: "Big Drip", artist: "Fivio Foreign" },
  { title: "Story Time", artist: "Fivio Foreign" },
  { title: "Ain't It Different (feat. AJ Tracey & Stormzy)", artist: "Headie One" },

  // -- AMAPIANO / AFROBEATS DEEPER CUTS ----------------------------------
  { title: "Sponono (feat. Wizkid, Burna Boy, Cassper Nyovest & Madumane)", artist: "Kabza De Small" },
  { title: "Lorch (feat. Semi Tee, Miano & Kammu Dee)", artist: "Kabza De Small & DJ Maphorisa" },
  { title: "Khuza Gogo (feat. Mpura, AmaAvenger & M.J)", artist: "DBN Gogo, Blaqnick & MasterBlaq" },
  { title: "Tanzania (feat. Sino Msolo & BoiBizza) [Mixed]", artist: "Uncle Waffles & Tony Duardo" },
  { title: "Ke Star (feat. Virgo Deep) [Remix]", artist: "Focalistic & Davido" },
  { title: "Champion Sound", artist: "Davido & Focalistic" },

  // -- JERSEY CLUB / JUNGLE / INTERNET DANCE -----------------------------
  { title: "Tic Tac (feat. Lambo)", artist: "UNIIQU3" },
  { title: "Jersey Anthem (We're From Jersey)", artist: "Dj Sliink" },
  { title: "Vibrate", artist: "Dj Sliink" },
  { title: "Break From Jersey", artist: "Dj Sliink" },
  { title: "Conveniency", artist: "Nia Archives" },
  { title: "Off Wiv Ya Headz", artist: "Nia Archives" },
  { title: "Part Of Me", artist: "Nia Archives" },
  { title: "Sunrise Bang Ur Head Against Tha Wall", artist: "Nia Archives" },
  { title: "Pain", artist: "PinkPantheress" },
  { title: "Break It Off", artist: "PinkPantheress" },
  { title: "I must apologise", artist: "PinkPantheress" },
  { title: "Attracted To You", artist: "PinkPantheress" },
  { title: "Just for me", artist: "PinkPantheress" },

  // -- LO-FI / JAZZ RAP / BEATS ------------------------------------------
  { title: "Aruarian Dance", artist: "Nujabes" },
  { title: "Luv(sic.), Pt. 3 [feat. Shing02]", artist: "Nujabes" },
  { title: "Lady Brown (feat. Cise Starr)", artist: "Nujabes" },
  { title: "Counting Stars", artist: "Nujabes" },
  { title: "Workinonit", artist: "J Dilla" },
  { title: "Waves", artist: "J Dilla" },
  { title: "Stop", artist: "J Dilla" },
  { title: "So Far To Go (Instrumental)", artist: "J Dilla" },
  { title: "Learn", artist: "Knxwledge" },
  { title: "Dont Be Afraid", artist: "Knxwledge" },
  { title: "Thats Allwekando.", artist: "Knxwledge" },
  { title: "Watch Over", artist: "Idealism" },
  { title: "Ikigai", artist: "Idealism" },
  { title: "Dont Say a Word", artist: "Idealism" },
  { title: "Another Perspective", artist: "Idealism" },

  // -- MODERN JAZZ / FUNK / METAL / LATIN TRAP ---------------------------
  { title: "Time Moves Slow", artist: "BADBADNOTGOOD & Samuel T. Herring" },
  { title: "Beside April (feat. Arthur Verocai)", artist: "BADBADNOTGOOD" },
  { title: "Black Classical Music (feat. Venna & Charlie Stacey)", artist: "Yussef Dayes" },
  { title: "Dean Town", artist: "Vulfpeck" },
  { title: "Them Changes", artist: "Thundercat" },
  { title: "Jax", artist: "Cory Wong" },
  { title: "Circle With Me", artist: "Spiritbox" },
  { title: "Two-Way Mirror", artist: "Loathe" },
  { title: "Counting Worms", artist: "Knocked Loose" },
  { title: "Stranded", artist: "Gojira" },
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
  console.log(`\nVibeSong Niche Genre Gap Fill Seeder`);
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
