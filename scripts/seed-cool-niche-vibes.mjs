/**
 * VibeSong cool niche seeder -- leftfield rap, alternative R&B, weird club,
 * future garage, post-punk, noise-rock, and stylish outsider indie.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-cool-niche-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- LEFTFIELD RAP / UNDERGROUND COOL -----------------------------------
  { title: "Guillotine", artist: "Death Grips" },
  { title: "Venom", artist: "Little Simz" },
  { title: "Point and Kill (feat. Obongjayar)", artist: "Little Simz" },
  { title: "Anita", artist: "Smino" },
  { title: "Wild Irish Roses", artist: "Smino" },

  // -- ALT R&B / LEFTFIELD POP --------------------------------------------
  { title: "Are You Looking Up", artist: "Mk.gee" },
  { title: "Alesis", artist: "Mk.gee" },
  { title: "ROCKMAN", artist: "Mk.gee" },
  { title: "The Dress", artist: "Dijon" },
  { title: "Many Times", artist: "Dijon" },
  { title: "Rodeo Clown", artist: "Dijon" },
  { title: "Blood On Me", artist: "Sampha" },
  { title: "Spirit 2.0", artist: "Sampha" },
  { title: "Only", artist: "Sampha" },
  { title: "Jasmine (Demo)", artist: "Jai Paul" },
  { title: "Charcoal Baby", artist: "Blood Orange" },
  { title: "You're Not Good Enough", artist: "Blood Orange" },
  { title: "Best to You (feat. Empress Of)", artist: "Blood Orange" },
  { title: "Gospel For a New Century", artist: "Yves Tumor" },
  { title: "Jackie", artist: "Yves Tumor" },
  { title: "Noid", artist: "Yves Tumor" },
  { title: "Contact", artist: "Kelela" },
  { title: "LMK", artist: "Kelela" },
  { title: "Happy Ending", artist: "Kelela" },
  { title: "How To Fight", artist: "Eartheater" },
  { title: "Scripture", artist: "Eartheater" },
  { title: "family and friends", artist: "Oklou" },
  { title: "galore", artist: "Oklou" },

  // -- WEIRD CLUB / FUTURE GARAGE / ELECTRONIC ----------------------------
  { title: "Ghost Hardware", artist: "Burial" },
  { title: "Near Dark", artist: "Burial" },
  { title: "Shell of Light", artist: "Burial" },
  { title: "Apricots", artist: "Bicep" },
  { title: "Aura", artist: "Bicep" },
  { title: "LesAlpx", artist: "Floating Points" },
  { title: "Birth4000", artist: "Floating Points" },
  { title: "Immaterial", artist: "SOPHIE" },
  { title: "Faceshopping", artist: "SOPHIE" },
  { title: "Ponyboy", artist: "SOPHIE" },
  { title: "Time", artist: "Arca" },
  { title: "Prada", artist: "Arca" },
  { title: "Rakata", artist: "Arca" },
  { title: "Desafío", artist: "Arca" },
  { title: "Cleo", artist: "Shygirl" },
  { title: "Baianá", artist: "Nia Archives" },
  { title: "Forbidden Feelingz", artist: "Nia Archives" },
  { title: "Crowded Roomz", artist: "Nia Archives" },

  // -- POST-PUNK / NOISE-ROCK / OUTSIDER INDIE ----------------------------
  { title: "Easy Easy", artist: "King Krule" },
  { title: "Seaforth", artist: "King Krule" },
  { title: "Alone, Omen 3", artist: "King Krule" },
  { title: "Jackie Down The Line", artist: "Fontaines D.C." },
  { title: "Boys In The Better Land", artist: "Fontaines D.C." },
  { title: "Never Fight a Man With a Perm", artist: "IDLES" },
  { title: "Dancer", artist: "IDLES & LCD Soundsystem" },
  { title: "BLACKOUT", artist: "Turnstile" },
  { title: "HOLIDAY", artist: "Turnstile" },
  { title: "MYSTERY", artist: "Turnstile" },
  { title: "UNDERWATER BOI", artist: "Turnstile" },
  { title: "Sports", artist: "Viagra Boys" },
  { title: "Houseplants", artist: "Squid" },
  { title: "Narrator", artist: "Squid & Martha Skye Murphy" },
  { title: "John L", artist: "black midi" },
  { title: "Sunglasses", artist: "Black Country, New Road" },
  { title: "Concorde", artist: "Black Country, New Road" },
  { title: "The Place Where He Inserted the Blade", artist: "Black Country, New Road" },
  { title: "Hunter", artist: "Have a Nice Life" },
  { title: "Girls", artist: "The Dare" },
  { title: "Good Time", artist: "The Dare" },
  { title: "Under Your Spell", artist: "Snow Strippers" },
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
  console.log(`\nVibeSong Cool Niche Vibes Seeder`);
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
