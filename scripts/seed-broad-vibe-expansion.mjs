/**
 * VibeSong broad vibe expansion seeder -- pop, indie-pop, R&B, dance,
 * afrobeats, and recognizable mood staples for more balanced matching.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-broad-vibe-expansion.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- MODERN POP / MAIN CHARACTER ----------------------------------------
  { title: "Good Luck, Babe!", artist: "Chappell Roan" },
  { title: "HOT TO GO!", artist: "Chappell Roan" },
  { title: "Pink Pony Club", artist: "Chappell Roan" },
  { title: "Red Wine Supernova", artist: "Chappell Roan" },
  { title: "BIRDS OF A FEATHER", artist: "Billie Eilish" },
  { title: "CHIHIRO", artist: "Billie Eilish" },
  { title: "LUNCH", artist: "Billie Eilish" },
  { title: "WILDFLOWER", artist: "Billie Eilish" },
  { title: "Please Please Please", artist: "Sabrina Carpenter" },
  { title: "Taste", artist: "Sabrina Carpenter" },
  { title: "Feather", artist: "Sabrina Carpenter" },
  { title: "greedy", artist: "Tate McRae" },
  { title: "exes", artist: "Tate McRae" },
  { title: "Sports car", artist: "Tate McRae" },
  { title: "Houdini", artist: "Dua Lipa" },
  { title: "Training Season", artist: "Dua Lipa" },
  { title: "Dance The Night", artist: "Dua Lipa" },
  { title: "Flowers", artist: "Miley Cyrus" },
  { title: "Jaded", artist: "Miley Cyrus" },
  { title: "End of the World", artist: "Miley Cyrus" },

  // -- EMOTIONAL / SINGER-SONGWRITER --------------------------------------
  { title: "Lose Control", artist: "Teddy Swims" },
  { title: "The Door", artist: "Teddy Swims" },
  { title: "Bad Dreams", artist: "Teddy Swims" },
  { title: "Beautiful Things", artist: "Benson Boone" },
  { title: "Mystical Magical", artist: "Benson Boone" },
  { title: "Sorry I'm Here For Someone Else", artist: "Benson Boone" },
  { title: "Too Sweet", artist: "Hozier" },
  { title: "Take Me to Church", artist: "Hozier" },
  { title: "Stick Season", artist: "Noah Kahan" },
  { title: "Dial Drunk", artist: "Noah Kahan" },
  { title: "Northern Attitude", artist: "Noah Kahan" },
  { title: "From The Start", artist: "Laufey" },
  { title: "Lover Girl", artist: "Laufey" },
  { title: "My Love Mine All Mine", artist: "Mitski" },

  // -- R&B / ALT RAP -------------------------------------------------------
  { title: "Come Down", artist: "Anderson .Paak" },
  { title: "Saturn", artist: "SZA" },
  { title: "Broken Clocks", artist: "SZA" },
  { title: "The Weekend", artist: "SZA" },
  { title: "Paint The Town Red", artist: "Doja Cat" },
  { title: "Agora Hills", artist: "Doja Cat" },

  // -- AFROBEATS / GLOBAL POP ---------------------------------------------
  { title: "Water", artist: "Tyla" },
  { title: "Truth or Dare", artist: "Tyla" },
  { title: "ART", artist: "Tyla" },
  { title: "Me & U", artist: "Tems" },
  { title: "Love Me JeJe", artist: "Tems" },

  // -- DANCE / INDIE THROWBACK --------------------------------------------
  { title: "Jungle", artist: "Fred again.." },
  { title: "Marea (we've lost dancing)", artist: "Fred again.. & The Blessed Madonna" },
  { title: "About You", artist: "The 1975" },
  { title: "Daddy Issues", artist: "The Neighbourhood" },
  { title: "Sweet Disposition", artist: "The Temper Trap" },
  { title: "Young Folks", artist: "Peter Bjorn and John" },
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
  console.log(`\nVibeSong Broad Vibe Expansion Seeder`);
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
