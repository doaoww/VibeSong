/**
 * VibeSong universal vibe map seeder -- a broad set of emotional lanes so
 * more users can find a song for nearly any photo, mood, or story moment.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-universal-vibe-map.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- SUNNY / FEEL-GOOD / MAIN CHARACTER ---------------------------------
  { title: "Dog Days Are Over", artist: "Florence + The Machine" },
  { title: "Send Me On My Way", artist: "Rusted Root" },
  { title: "Walking On A Dream", artist: "Empire Of The Sun" },
  { title: "Safe And Sound", artist: "Capital Cities" },
  { title: "Lisztomania", artist: "Phoenix" },
  { title: "1901", artist: "Phoenix" },
  { title: "Sit Next to Me", artist: "Foster The People" },
  { title: "Cigarette Daydreams", artist: "Cage The Elephant" },

  // -- HEALING / ACOUSTIC / SOFT RESET ------------------------------------
  { title: "Rivers and Roads", artist: "The Head and the Heart" },
  { title: "Hey, Ma", artist: "Bon Iver" },
  { title: "Re: Stacks", artist: "Bon Iver" },
  { title: "Naked As We Came", artist: "Iron & Wine" },
  { title: "Crosses", artist: "José González" },
  { title: "Big Black Car", artist: "Gregory Alan Isakov" },
  { title: "Like Real People Do", artist: "Hozier" },
  { title: "All I Want", artist: "Kodaline" },

  // -- LATE-NIGHT R&B / INTIMATE ------------------------------------------
  { title: "Thinkin Bout You", artist: "Frank Ocean" },
  { title: "Novacane", artist: "Frank Ocean" },
  { title: "Swim Good", artist: "Frank Ocean" },
  { title: "Crew (feat. Brent Faiyaz & Shy Glizzy)", artist: "GoldLink" },
  { title: "Poison", artist: "Brent Faiyaz" },
  { title: "Streetcar", artist: "Daniel Caesar" },
  { title: "Get You (feat. Kali Uchis)", artist: "Daniel Caesar" },
  { title: "Best Part (feat. Daniel Caesar)", artist: "H.E.R." },

  // -- RAP CONFIDENCE / CITY DRIVE ----------------------------------------
  { title: "Father Stretch My Hands Pt. 1", artist: "Kanye West" },
  { title: "Can't Tell Me Nothing", artist: "Kanye West" },
  { title: "Day 'n' Nite (Nightmare)", artist: "Kid Cudi" },
  { title: "King Kunta", artist: "Kendrick Lamar" },
  { title: "Alright", artist: "Kendrick Lamar" },
  { title: "MIDDLE CHILD", artist: "J. Cole" },
  { title: "No Role Modelz", artist: "J. Cole" },
  { title: "Lord Pretty Flacko Jodye 2 (LPFJ2)", artist: "A$AP Rocky" },

  // -- DARK DRIFT / PHONK / NIGHT MOTION ----------------------------------
  { title: "After Dark", artist: "Mr.Kitty" },
  { title: "The Perfect Girl", artist: "Mareux" },
  { title: "Nightcall", artist: "Kavinsky" },
  { title: "Roller Mobster", artist: "Carpenter Brut" },
  { title: "Acid Rain", artist: "Lorn" },
  { title: "Future Club", artist: "Perturbator" },
  { title: "Le Perv", artist: "Carpenter Brut" },
  { title: "We're Finally Landing", artist: "HOME" },

  // -- CLUB / RAVE / BIG ROOM ---------------------------------------------
  { title: "Music Sounds Better With You", artist: "Stardust" },
  { title: "Digital Love", artist: "Daft Punk" },
  { title: "Around the World", artist: "Daft Punk" },
  { title: "Strobe", artist: "deadmau5" },
  { title: "Ghosts 'n' Stuff", artist: "deadmau5" },
  { title: "Language", artist: "Porter Robinson" },
  { title: "Shelter", artist: "Porter Robinson & Madeon" },
  { title: "Insomnia", artist: "Faithless" },

  // -- CINEMATIC / SCORE / EPIC QUIET -------------------------------------
  { title: "Day One (Interstellar Theme)", artist: "Hans Zimmer" },
  { title: "Cornfield Chase", artist: "Hans Zimmer" },
  { title: "Una Mattina", artist: "Ludovico Einaudi" },
  { title: "Elegy for the Arctic", artist: "Ludovico Einaudi" },
  { title: "November", artist: "Max Richter, BBC Philharmonic & Rumon Gamba" },
  { title: "Arrival of the Birds", artist: "The Cinematic Orchestra & The London Metropolitan Orchestra" },
  { title: "Your Hand in Mine", artist: "Explosions In the Sky" },
  { title: "Outro", artist: "M83" },

  // -- LATIN / REGGAETON / HOT CONFIDENCE ---------------------------------
  { title: "Felices los 4", artist: "Maluma" },
  { title: "LA CANCIÓN", artist: "J Balvin & Bad Bunny" },
  { title: "Con Calma (feat. Snow)", artist: "Daddy Yankee" },
  { title: "Mi Gente", artist: "J Balvin & Willy William" },
  { title: "Tusa", artist: "KAROL G & Nicki Minaj" },
  { title: "Danza Kuduro (feat. Lucenzo)", artist: "Don Omar" },
  { title: "El Merengue", artist: "Marshmello & Manuel Turizo" },
  { title: "Lo Que Pasó, Pasó", artist: "Daddy Yankee" },

  // -- AFROBEATS / GLOBAL POP / WARMTH ------------------------------------
  { title: "Jerusalema (feat. Nomcebo Zikode)", artist: "Master KG" },
  { title: "Dumebi", artist: "Rema" },
  { title: "Kilometre", artist: "Burna Boy" },
  { title: "Gbona", artist: "Burna Boy" },
  { title: "Sability", artist: "Ayra Starr" },
  { title: "Commas", artist: "Ayra Starr" },
  { title: "People", artist: "Libianca" },
  { title: "Love Nwantiti (ah ah ah) [feat. Joeboy & Kuami Eugene] [Remix]", artist: "CKay" },

  // -- FRENCH / EURO POP / SOFT DRAMA -------------------------------------
  { title: "Santé", artist: "Stromae" },
  { title: "L'enfer", artist: "Stromae" },
  { title: "Tous les mêmes", artist: "Stromae" },
  { title: "Dernière danse", artist: "Indila" },
  { title: "Tourner Dans Le Vide", artist: "Indila" },
  { title: "Djadja", artist: "Aya Nakamura" },
  { title: "Pookie", artist: "Aya Nakamura" },
  { title: "Roi", artist: "VIDEOCLUB" },

  // -- J-POP / K-POP / ANIME ENERGY ---------------------------------------
  { title: "Gunjou", artist: "YOASOBI" },
  { title: "Yoru ni Kakeru", artist: "YOASOBI" },
  { title: "Homura", artist: "LiSA" },
  { title: "Kaikai Kitan", artist: "Eve" },
  { title: "M87", artist: "Kenshi Yonezu" },
  { title: "Supernova", artist: "aespa" },
  { title: "Queencard", artist: "i-dle" },
  { title: "The Feels", artist: "TWICE" },

  // -- RUSSIAN / SLAVIC / NOSTALGIC NIGHT ---------------------------------
  { title: "Владивосток 2000", artist: "Mumiy Troll" },
  { title: "Кукушка", artist: "Kino" },
  { title: "Мама, мы все сошли с ума", artist: "Kino" },
  { title: "Закрой за мной дверь, я ухожу", artist: "Kino" },
  { title: "ИСКАЛА", artist: "Zemfira" },
  { title: "ариведерчи", artist: "Zemfira" },
  { title: "Орбит без сахара", artist: "Splean" },
  { title: "All The Things She Said", artist: "t.A.T.u." },
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
  console.log(`\nVibeSong Universal Vibe Map Seeder`);
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
