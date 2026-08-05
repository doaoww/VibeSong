/**
 * VibeSong mega cool mix seeder -- a large cross-vibe batch of indie,
 * stylish rap, R&B, electronic, Latin/Afrobeats, darkwave, and internet-core.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-mega-cool-mix.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- INDIE / ALT ESSENTIALS ---------------------------------------------
  { title: "Let It Happen", artist: "Tame Impala" },
  { title: "Eventually", artist: "Tame Impala" },
  { title: "Borderline", artist: "Tame Impala" },
  { title: "New Person, Same Old Mistakes", artist: "Tame Impala" },
  { title: "Little Dark Age", artist: "MGMT" },
  { title: "Electric Feel", artist: "MGMT" },
  { title: "Kids", artist: "MGMT" },
  { title: "Time to Pretend", artist: "MGMT" },
  { title: "We Are The People", artist: "Empire Of The Sun" },
  { title: "Alive", artist: "Empire Of The Sun" },
  { title: "Pumped Up Kicks", artist: "Foster The People" },
  { title: "Helena Beat", artist: "Foster The People" },
  { title: "Coming of Age", artist: "Foster The People" },
  { title: "Ain't No Rest for the Wicked", artist: "Cage The Elephant" },
  { title: "Come a Little Closer", artist: "Cage The Elephant" },
  { title: "Trouble", artist: "Cage The Elephant" },
  { title: "Robbers", artist: "The 1975" },
  { title: "The Sound", artist: "The 1975" },
  { title: "Fluorescent Adolescent", artist: "Arctic Monkeys" },
  { title: "Arabella", artist: "Arctic Monkeys" },
  { title: "Why'd You Only Call Me When You're High?", artist: "Arctic Monkeys" },
  { title: "Snap Out of It", artist: "Arctic Monkeys" },
  { title: "Breezeblocks", artist: "alt-J" },
  { title: "Taro", artist: "alt-J" },
  { title: "Left Hand Free", artist: "alt-J" },
  { title: "Heat Waves", artist: "Glass Animals" },
  { title: "Gooey", artist: "Glass Animals" },
  { title: "Youth", artist: "Glass Animals" },
  { title: "Feel Good Inc. (feat. David Jolicoeur, Kelvin Mercer & Vincent Mason)", artist: "Gorillaz & De La Soul" },
  { title: "On Melancholy Hill", artist: "Gorillaz" },
  { title: "Rhinestone Eyes", artist: "Gorillaz" },
  { title: "DARE", artist: "Gorillaz" },
  { title: "Intro", artist: "M83" },
  { title: "Midnight City", artist: "M83" },
  { title: "Oblivion", artist: "M83" },
  { title: "A Real Hero (feat. Electric Youth)", artist: "College" },
  { title: "Resonance", artist: "Home" },
  { title: "Blue Hair", artist: "TV Girl" },
  { title: "Romantic Lover", artist: "Eyedress" },
  { title: "Dark Beach", artist: "Pastel Ghost" },
  { title: "Fate", artist: "Boy Harsher" },
  { title: "Vanished", artist: "Crystal Castles" },
  { title: "Empathy", artist: "Crystal Castles" },

  // -- RAP / ALT RAP / COOL SWAGGER ---------------------------------------
  { title: "Hey Ya!", artist: "Outkast" },
  { title: "So Fresh, So Clean", artist: "Outkast" },
  { title: "Can I Kick It?", artist: "A Tribe Called Quest" },
  { title: "Electric Relaxation", artist: "A Tribe Called Quest" },
  { title: "This Is America", artist: "Childish Gambino" },
  { title: "V. 3005", artist: "Childish Gambino" },
  { title: "IV. Sweatpants (feat. Jason Martin)", artist: "Childish Gambino" },
  { title: "Dang! (feat. Anderson .Paak)", artist: "Mac Miller" },
  { title: "Weekend (feat. Miguel)", artist: "Mac Miller" },
  { title: "Caroline", artist: "Aminé" },
  { title: "REEL IT IN", artist: "Aminé" },
  { title: "Spice Girl", artist: "Aminé" },
  { title: "SUGAR (Remix) [feat. Dua Lipa]", artist: "BROCKHAMPTON" },
  { title: "Big Fish", artist: "Vince Staples" },
  { title: "FUN!", artist: "Vince Staples" },
  { title: "MAGIC", artist: "Vince Staples & Mustard" },
  { title: "Sacrifices (feat. Smino & Saba)", artist: "Dreamville, EARTHGANG & J. Cole" },

  // -- R&B / NEO-SOUL / SOFT COOL -----------------------------------------
  { title: "Special Affair", artist: "The Internet" },
  { title: "Cranes in the Sky", artist: "Solange" },
  { title: "After The Storm (feat. Tyler, The Creator & Bootsy Collins)", artist: "Kali Uchis" },
  { title: "Dead To Me", artist: "Kali Uchis" },
  { title: "Tyrant (feat. Jorja Smith)", artist: "Kali Uchis" },
  { title: "telepatía", artist: "Kali Uchis" },
  { title: "Go Away", artist: "Omar Apollo" },
  { title: "3 Boys", artist: "Omar Apollo" },
  { title: "Skin Tight (feat. Steve Lacy)", artist: "Ravyn Lenae" },
  { title: "Sticky", artist: "Ravyn Lenae" },
  { title: "Venom", artist: "Ravyn Lenae" },
  { title: "When I'm in Your Arms", artist: "Cleo Sol" },
  { title: "Why Don't You", artist: "Cleo Sol" },
  { title: "Sweet Blue", artist: "Cleo Sol" },
  { title: "Tadow", artist: "Masego & FKJ" },
  { title: "Vibin' Out", artist: "FKJ & ((( O )))" },

  // -- HOUSE / ELECTRONIC / GROOVE ----------------------------------------
  { title: "Lite Spots", artist: "KAYTRANADA" },
  { title: "You're the One (feat. Syd)", artist: "KAYTRANADA" },
  { title: "Chemicals", artist: "SG Lewis" },
  { title: "Lifetime", artist: "SG Lewis" },
  { title: "Feed The Fire", artist: "SG Lewis & Lucky Daye" },
  { title: "Back On 74", artist: "Jungle" },
  { title: "Busy Earnin'", artist: "Jungle" },
  { title: "Keep Moving", artist: "Jungle" },
  { title: "Casio", artist: "Jungle" },
  { title: "Tieduprightnow", artist: "Parcels" },
  { title: "Overnight", artist: "Parcels" },
  { title: "Lightenup", artist: "Parcels" },
  { title: "Ani Kuni", artist: "Polo & Pan" },
  { title: "Nanã", artist: "Polo & Pan" },
  { title: "Cirrus", artist: "Bonobo" },
  { title: "Kerala", artist: "Bonobo" },
  { title: "Linked", artist: "Bonobo" },
  { title: "Rosewood", artist: "Bonobo" },
  { title: "Odessa", artist: "Caribou" },
  { title: "Home", artist: "Caribou" },
  { title: "It Makes You Forget (Itgehane)", artist: "Peggy Gou" },
  { title: "I Go", artist: "Peggy Gou" },
  { title: "Starry Night", artist: "Peggy Gou" },
  { title: "Delorean Dynamite", artist: "Todd Terje" },
  { title: "Inspector Norse", artist: "Todd Terje" },

  // -- GLOBAL / LATIN / AFROBEATS -----------------------------------------
  { title: "Neverita", artist: "Bad Bunny" },
  { title: "Vuelve", artist: "Daddy Yankee & Bad Bunny" },
  { title: "Ferxxo 100", artist: "Feid" },
  { title: "Rojo", artist: "J Balvin" },
  { title: "Azul", artist: "J Balvin" },
  { title: "Safari (feat. Pharrell Williams, BIA & Sky)", artist: "J Balvin" },
  { title: "reason", artist: "Omah Lay" },
  { title: "soso", artist: "Omah Lay" },
  { title: "Understand", artist: "Omah Lay" },
  { title: "Peru", artist: "Fireboy DML & Ed Sheeran" },
  { title: "Jealous", artist: "Fireboy DML" },
  { title: "Joha", artist: "Asake" },
  { title: "Peace Be Unto You (PBUY)", artist: "Asake" },
  { title: "Buga (Lo Lo Lo)", artist: "Kizz Daniel & Tekno" },
  { title: "Cough (Odo) [Mixed]", artist: "Kizz Daniel" },
  { title: "Sip (Alcohol)", artist: "Joeboy" },
  { title: "Baby", artist: "Joeboy" },
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
  console.log(`\nVibeSong Mega Cool Mix Seeder`);
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
