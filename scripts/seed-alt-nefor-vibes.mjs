/**
 * VibeSong alt/nefor seeder -- emo, post-hardcore, nu-metal, goth,
 * post-punk, industrial, and outsider alternative anthems.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-alt-nefor-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- EMO / POST-HARDCORE / SCENE ----------------------------------------
  { title: "Bulls in the Bronx", artist: "Pierce The Veil" },
  { title: "Caraphernelia", artist: "Pierce The Veil" },
  { title: "If You Can't Hang", artist: "Sleeping With Sirens" },
  { title: "If I'm James Dean, You're Audrey Hepburn", artist: "Sleeping With Sirens" },
  { title: "Dear Maria, Count Me In", artist: "All Time Low" },
  { title: "Weightless", artist: "All Time Low" },
  { title: "Dance, Dance", artist: "Fall Out Boy" },
  { title: "Thnks fr th Mmrs", artist: "Fall Out Boy" },
  { title: "I'm Not Okay (I Promise)", artist: "My Chemical Romance" },
  { title: "Teenagers", artist: "My Chemical Romance" },
  { title: "Famous Last Words", artist: "My Chemical Romance" },
  { title: "Decode", artist: "Paramore" },
  { title: "crushcrushcrush", artist: "Paramore" },
  { title: "That's What You Get", artist: "Paramore" },
  { title: "Ignorance", artist: "Paramore" },

  // -- METALCORE / NU-METAL / HEAVY ALT ----------------------------------
  { title: "Sleepwalking", artist: "Bring Me The Horizon" },
  { title: "Shadow Moses", artist: "Bring Me The Horizon" },
  { title: "Drown", artist: "Bring Me The Horizon" },
  { title: "Throne", artist: "Bring Me The Horizon" },
  { title: "Teardrops", artist: "Bring Me The Horizon" },
  { title: "My Own Summer (Shove It)", artist: "Deftones" },
  { title: "Digital Bath", artist: "Deftones" },
  { title: "Rosemary", artist: "Deftones" },
  { title: "Diamond Eyes", artist: "Deftones" },
  { title: "Freak On a Leash", artist: "Korn" },
  { title: "Coming Undone", artist: "Korn" },
  { title: "Blind", artist: "Korn" },
  { title: "Falling Away from Me", artist: "Korn" },
  { title: "Before I Forget", artist: "Slipknot" },
  { title: "Wait and Bleed", artist: "Slipknot" },
  { title: "Snuff", artist: "Slipknot" },
  { title: "Aerials", artist: "System Of A Down" },
  { title: "Lonely Day", artist: "System Of A Down" },
  { title: "Bring Me To Life", artist: "Evanescence" },
  { title: "Going Under", artist: "Evanescence" },

  // -- GOTH / POST-PUNK / INDUSTRIAL --------------------------------------
  { title: "Boys Don't Cry", artist: "The Cure" },
  { title: "Just Like Heaven", artist: "The Cure" },
  { title: "A Forest", artist: "The Cure" },
  { title: "Love Will Tear Us Apart", artist: "Joy Division" },
  { title: "Disorder", artist: "Joy Division" },
  { title: "Cities In Dust", artist: "Siouxsie & The Banshees" },
  { title: "Spellbound", artist: "Siouxsie & The Banshees" },
  { title: "The Perfect Drug", artist: "Nine Inch Nails" },
  { title: "Sweet Dreams (Are Made Of This)", artist: "Marilyn Manson" },
  { title: "Every You Every Me", artist: "Placebo" },
  { title: "The Bitter End", artist: "Placebo" },
  { title: "Special Needs", artist: "Placebo" },

  // -- ALTERNATIVE CLASSICS / OUTSIDER ANTHEMS ----------------------------
  { title: "Karma Police", artist: "Radiohead" },
  { title: "Paranoid Android", artist: "Radiohead" },
  { title: "Where Is My Mind?", artist: "Pixies" },
  { title: "Debaser", artist: "Pixies" },
  { title: "Song 2", artist: "Blur" },
  { title: "Loser", artist: "Beck" },
  { title: "1979", artist: "The Smashing Pumpkins" },
  { title: "Bullet With Butterfly Wings", artist: "The Smashing Pumpkins" },
  { title: "Zombie", artist: "The Cranberries" },
  { title: "Linger", artist: "The Cranberries" },
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
  console.log(`\nVibeSong Alt/Nefor Vibes Seeder`);
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
