/**
 * VibeSong stylish rap seeder -- A$AP Rocky fashion rap, cloudy night-drive
 * trap, Uzi/Travis swagger, UK grime, and sharp modern lyrical flex.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-stylish-rap-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- A$AP / FASHION RAP CORE --------------------------------------------
  { title: "Sundress", artist: "A$AP Rocky" },
  { title: "Everyday (feat. Rod Stewart, Miguel & Mark Ronson)", artist: "A$AP Rocky" },
  { title: "A$AP Forever REMIX (feat. Moby, T.I. & Kid Cudi)", artist: "A$AP Rocky" },
  { title: "D.M.B.", artist: "A$AP Rocky" },
  { title: "Multiply (feat. Juicy J)", artist: "A$AP Rocky" },
  { title: "Canal St. (feat. Bones)", artist: "A$AP Rocky" },
  { title: "Excuse Me", artist: "A$AP Rocky" },
  { title: "Electric Body (feat. ScHoolboy Q)", artist: "A$AP Rocky" },
  { title: "M'$ (feat. Lil Wayne)", artist: "A$AP Rocky" },
  { title: "Fine Whine (feat. Joe Fox x Future x M.I.A.)", artist: "A$AP Rocky" },
  { title: "Holy Ghost (feat. Joe Fox)", artist: "A$AP Rocky" },
  { title: "Pharsyde (feat. Joe Fox)", artist: "A$AP Rocky" },
  { title: "Kids Turned Out Fine", artist: "A$AP Rocky" },
  { title: "Tony Tone", artist: "A$AP Rocky" },
  { title: "Jukebox Joints (feat. Joe Fox x Kanye West)", artist: "A$AP Rocky" },
  { title: "F**k Sleep (feat. FKA twigs)", artist: "A$AP Rocky" },
  { title: "Brotha Man (feat. French Montana)", artist: "A$AP Rocky" },
  { title: "RAF (feat. A$AP Rocky, Playboi Carti, Quavo, Lil Uzi Vert & Frank Ocean)", artist: "A$AP Mob" },
  { title: "Telephone Calls (feat. A$AP Rocky, Tyler, The Creator, Playboi Carti & Yung Gleesh)", artist: "A$AP Mob" },
  { title: "Yamborghini High (feat. Juicy J)", artist: "A$AP Mob" },
  { title: "Work REMIX (feat. A$AP Rocky, French Montana, Trinidad James & ScHoolboy Q)", artist: "A$AP Ferg" },
  { title: "Shabba (feat. A$AP Rocky)", artist: "A$AP Ferg" },
  { title: "New Level (feat. Future)", artist: "A$AP Ferg" },

  // -- UZI / RAGE / MELODIC FLEX ------------------------------------------
  { title: "XO Tour Llif3", artist: "Lil Uzi Vert" },
  { title: "20 Min", artist: "Lil Uzi Vert" },
  { title: "Just Wanna Rock", artist: "Lil Uzi Vert" },
  { title: "The Way Life Goes (feat. Oh Wonder)", artist: "Lil Uzi Vert" },

  // -- TRAVIS / DON / METRO NIGHT DRIVE -----------------------------------
  { title: "BUTTERFLY EFFECT", artist: "Travis Scott" },
  { title: "Antidote", artist: "Travis Scott" },
  { title: "STARGAZING", artist: "Travis Scott" },
  { title: "YOSEMITE", artist: "Travis Scott" },
  { title: "CAN'T SAY", artist: "Travis Scott" },
  { title: "NO BYSTANDERS", artist: "Travis Scott" },
  { title: "I KNOW ?", artist: "Travis Scott" },
  { title: "No Idea", artist: "Don Toliver" },
  { title: "Cardigan", artist: "Don Toliver" },
  { title: "Private Landing (feat. Justin Bieber & Future)", artist: "Don Toliver" },
  { title: "Too Many Nights (feat. Don Toliver)", artist: "Metro Boomin & Future" },
  { title: "Trance", artist: "Metro Boomin, Travis Scott & Young Thug" },
  { title: "Superhero (Heroes & Villains)", artist: "Metro Boomin, Future & Chris Brown" },

  // -- FUTURE / DARK CONFIDENCE -------------------------------------------
  { title: "Low Life (feat. The Weeknd)", artist: "Future" },
  { title: "Thought It Was a Drought", artist: "Future" },
  { title: "Stick Talk", artist: "Future" },
  { title: "Solo", artist: "Future" },
  { title: "WAIT FOR U (feat. Drake & Tems)", artist: "Future" },
  { title: "Type Shit", artist: "Future, Metro Boomin, Travis Scott & Playboi Carti" },

  // -- CUDI / UK GRIME / COOL OUTSIDER RAP --------------------------------
  { title: "Mr. Rager", artist: "Kid Cudi" },
  { title: "Erase Me (feat. Kanye West)", artist: "Kid Cudi & Kanye West" },
  { title: "Solo Dolo, Pt. III", artist: "Kid Cudi" },
  { title: "Just What I Am (feat. King Chip)", artist: "Kid Cudi" },
  { title: "That's Not Me (feat. Jme)", artist: "Skepta" },
  { title: "It Ain't Safe (feat. Young Lord)", artist: "Skepta" },
  { title: "Ladbroke Grove", artist: "AJ Tracey" },

  // -- MODERN LYRICAL FLEX -------------------------------------------------
  { title: "Surround Sound (feat. 21 Savage & Baby Tate)", artist: "JID" },
  { title: "151 Rum", artist: "JID" },
  { title: "Never", artist: "JID" },
  { title: "Walkin", artist: "Denzel Curry" },
  { title: "RICKY", artist: "Denzel Curry" },
  { title: "CLOUT COBAIN | CLOUT CO13A1N", artist: "Denzel Curry" },
  { title: "Temptation", artist: "Joey Bada$$" },
  { title: "Devastated", artist: "Joey Bada$$" },
  { title: "Paper Trail$", artist: "Joey Bada$$" },
  { title: "N95", artist: "Kendrick Lamar" },
  { title: "Family Ties", artist: "Baby Keem & Kendrick Lamar" },
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
  console.log(`\nVibeSong Stylish Rap Vibes Seeder`);
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
