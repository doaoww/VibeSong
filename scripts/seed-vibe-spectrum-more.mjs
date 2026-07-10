/**
 * VibeSong vibe spectrum seeder -- a wider emotional spread across dark
 * cinematic, dreamy, club, road/gym, sad, global, and classic moods.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-vibe-spectrum-more.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- DARK CINEMATIC / VILLAIN ARC ---------------------------------------
  { title: "Me and the Devil", artist: "Soap&Skin" },
  { title: "Easy", artist: "Son Lux" },
  { title: "No Rest For the Wicked", artist: "Lykke Li" },
  { title: "Pursuit", artist: "Gesaffelstein" },
  { title: "Bad Kingdom", artist: "Moderat" },
  { title: "In the Room Where You Sleep", artist: "Dead Man's Bones" },
  { title: "Tear You Apart", artist: "She Wants Revenge" },
  { title: "In This Shirt", artist: "The Irrepressibles" },
  { title: "Bad Ritual", artist: "Timber Timbre" },

  // -- DREAMY / SOFT-FOCUS NIGHT ------------------------------------------
  { title: "On the Sea", artist: "Beach House" },
  { title: "Wait", artist: "M83" },
  { title: "Friday Morning", artist: "Khruangbin" },
  { title: "Feel It All Around", artist: "Washed Out" },
  { title: "Master of None", artist: "Beach House" },
  { title: "Dreams Tonite", artist: "Alvvays" },
  { title: "Sweet", artist: "Cigarettes After Sex" },
  { title: "Hydrocodone", artist: "Cuco" },

  // -- CLUB / ELECTRONIC / AFTERHOURS -------------------------------------
  { title: "So U Kno", artist: "Overmono" },
  { title: "Innerbloom", artist: "RÜFÜS DU SOL" },
  { title: "On My Knees", artist: "RÜFÜS DU SOL" },
  { title: "Loud Places (feat. Romy)", artist: "Jamie xx" },
  { title: "Can't Do Without You", artist: "Caribou" },
  { title: "Opus", artist: "Eric Prydz" },
  { title: "Atlas", artist: "Bicep" },
  { title: "Cola", artist: "CamelPhat & Elderbrook" },
  { title: "Final Credits", artist: "Midland" },
  { title: "Hyperreal (feat. KUČKA)", artist: "Flume" },

  // -- ROAD / GYM / ALT-ROCK ENERGY ---------------------------------------
  { title: "Hysteria", artist: "Muse" },
  { title: "Supermassive Black Hole", artist: "Muse" },
  { title: "Figure It Out", artist: "Royal Blood" },
  { title: "Lonely Boy", artist: "The Black Keys" },
  { title: "No One Knows", artist: "Queens of the Stone Age" },
  { title: "Amsterdam", artist: "Nothing But Thieves" },
  { title: "Wolf Like Me", artist: "TV On The Radio" },
  { title: "My Number", artist: "Foals" },
  { title: "Spanish Sahara", artist: "Foals" },
  { title: "Supersonic", artist: "Oasis" },

  // -- POST-BREAKUP / BEAUTIFUL SADNESS -----------------------------------
  { title: "Liability", artist: "Lorde" },
  { title: "I Know the End", artist: "Phoebe Bridgers" },
  { title: "Retrograde", artist: "James Blake" },
  { title: "Paint", artist: "The Paper Kites" },
  { title: "Where's My Love", artist: "SYML" },
  { title: "Kyoto", artist: "Phoebe Bridgers" },
  { title: "I Bet on Losing Dogs", artist: "Mitski" },
  { title: "Fourth of July", artist: "Sufjan Stevens" },

  // -- FRENCH / SPANISH MOOD COLOR ----------------------------------------
  { title: "La symphonie des éclairs", artist: "Zaho de Sagazan" },
  { title: "On brûlera", artist: "Pomme" },
  { title: "La grenade", artist: "Clara Luciani" },
  { title: "Bruxelles je t'aime", artist: "Angèle" },
  { title: "Hasta la Raíz", artist: "Natalia Lafourcade" },
  { title: "Crimen", artist: "Gustavo Cerati" },
  { title: "Tu Falta De Querer", artist: "Mon Laferte" },
  { title: "Disfruto", artist: "Carla Morrison" },
  { title: "Nunca Es Suficiente", artist: "Natalia Lafourcade" },
  { title: "Eres", artist: "Café Tacvba" },
  { title: "To My Love", artist: "Bomba Estéreo" },
  { title: "Nuestra Canción (feat. Vicente García)", artist: "Monsieur Periné" },

  // -- GLOBAL / MENA / TURKISH / JAPANESE / KOREAN ------------------------
  { title: "Şımarık", artist: "Tarkan" },
  { title: "Ali Cabbar", artist: "Emir Can İğrek" },
  { title: "Habibi", artist: "Tamino" },
  { title: "From Gaza, With Love", artist: "Saint Levant" },
  { title: "Mohabbat", artist: "Arooj Aftab" },
  { title: "Shim el Yasmine", artist: "Mashrou' Leila" },
  { title: "SPECIALZ", artist: "King Gnu" },
  { title: "LEFT RIGHT", artist: "XG" },
  { title: "Indigo Night", artist: "Tamino" },
  { title: "Dudu", artist: "Tarkan" },
  { title: "ETA", artist: "NewJeans" },
  { title: "MASCARA", artist: "XG" },

  // -- TIMELESS CINEMATIC / CLASSIC SIGNALS -------------------------------
  { title: "Wicked Game", artist: "Chris Isaak" },
  { title: "Sweet Dreams (Are Made of This)", artist: "Eurythmics" },
  { title: "The Chain", artist: "Fleetwood Mac" },
  { title: "Bang Bang (My Baby Shot Me Down)", artist: "Nancy Sinatra" },
  { title: "Take Me Out", artist: "Franz Ferdinand" },
  { title: "Gimme Shelter", artist: "The Rolling Stones" },
  { title: "House of the Rising Sun", artist: "The Animals" },
  { title: "Psycho Killer", artist: "Talking Heads" },
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
  console.log(`\nVibeSong Vibe Spectrum More Seeder`);
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
