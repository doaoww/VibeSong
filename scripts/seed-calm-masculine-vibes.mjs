/**
 * VibeSong calm masculine-vibes seeder -- quiet confidence, late-night R&B,
 * soft heartbreak, acoustic recovery, and calm road-trip songs.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-calm-masculine-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- LATE-NIGHT R&B / SOFT HEARTBREAK -----------------------------------
  { title: "Moon River", artist: "Frank Ocean" },
  { title: "Self Control", artist: "Frank Ocean" },
  { title: "White Ferrari", artist: "Frank Ocean" },
  { title: "Provider", artist: "Frank Ocean" },
  { title: "Call Out My Name", artist: "The Weeknd" },
  { title: "Die For You", artist: "The Weeknd" },
  { title: "Out of Time", artist: "The Weeknd" },
  { title: "Die For You", artist: "Joji" },
  { title: "YUKON (INTERLUDE)", artist: "Joji" },
  { title: "Will He", artist: "Joji" },
  { title: "Here With Me", artist: "d4vd" },
  { title: "Romantic Homicide", artist: "d4vd" },
  { title: "Evergreen (You Didn’t Deserve Me At All)", artist: "Omar Apollo" },
  { title: "Useless", artist: "Omar Apollo" },
  { title: "Heartbreak Anniversary", artist: "GIVĒON" },
  { title: "LIKE I WANT YOU", artist: "GIVĒON" },
  { title: "Exchange", artist: "Bryson Tiller" },
  { title: "R e s e n t m e n t", artist: "PARTYNEXTDOOR" },
  { title: "Break from Toronto", artist: "PARTYNEXTDOOR" },
  { title: "Let Me Know", artist: "Brent Faiyaz" },
  { title: "Jackie Brown", artist: "Brent Faiyaz" },
  { title: "Always", artist: "Daniel Caesar" },
  { title: "Superpowers", artist: "Daniel Caesar" },
  { title: "Sure Thing", artist: "Miguel" },

  // -- QUIET RAP / INNER MONOLOGUE ----------------------------------------
  { title: "Good News", artist: "Mac Miller" },
  { title: "Come Back to Earth", artist: "Mac Miller" },
  { title: "Sober", artist: "Childish Gambino" },
  { title: "Like Him (feat. Lola Young)", artist: "Tyler, The Creator" },
  { title: "Coffee Bean", artist: "Travis Scott" },
  { title: "Love Yourz", artist: "J. Cole" },
  { title: "LOVE. (feat. Zacari)", artist: "Kendrick Lamar" },

  // -- ACOUSTIC / COUNTRY RECOVERY ----------------------------------------
  { title: "Sun to Me", artist: "Zach Bryan" },
  { title: "From Austin", artist: "Zach Bryan" },
  { title: "Lady May", artist: "Tyler Childers" },
  { title: "All Your'n", artist: "Tyler Childers" },
  { title: "Either Way", artist: "Chris Stapleton" },
  { title: "Fire Away", artist: "Chris Stapleton" },
  { title: "The Stable Song", artist: "Gregory Alan Isakov" },
  { title: "San Luis", artist: "Gregory Alan Isakov" },
  { title: "Blood Bank", artist: "Bon Iver" },
  { title: "For Emma", artist: "Bon Iver" },
  { title: "Promise", artist: "Ben Howard" },
  { title: "Old Pine", artist: "Ben Howard" },
  { title: "State Lines", artist: "Novo Amor" },
  { title: "Carry You", artist: "Novo Amor" },
  { title: "Work Song", artist: "Hozier" },
  { title: "Shrike", artist: "Hozier" },
  { title: "Such Great Heights", artist: "Iron & Wine" },
  { title: "Stay Alive", artist: "José González" },
  { title: "All My Days", artist: "Alexi Murdoch" },

  // -- CALM ROCK / NIGHT DRIVE --------------------------------------------
  { title: "Only Ones Who Know", artist: "Arctic Monkeys" },
  { title: "No. 1 Party Anthem", artist: "Arctic Monkeys" },
  { title: "You Get Me So High", artist: "The Neighbourhood" },
  { title: "Softcore", artist: "The Neighbourhood" },
  { title: "The Scientist", artist: "Coldplay" },
  { title: "Sparks", artist: "Coldplay" },
  { title: "No Surprises", artist: "Radiohead" },
  { title: "Nude", artist: "Radiohead" },
  { title: "Sextape", artist: "Deftones" },
  { title: "Cry", artist: "Cigarettes After Sex" },
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
  console.log(`\nVibeSong Calm Masculine Vibes Seeder`);
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
