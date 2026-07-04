/**
 * VibeSong trending seeder — songs actually trending on Instagram Reels
 * right now (July 2026), sourced via web search, not guessed.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   BASE_URL=http://localhost:3001 node scripts/seed-trending.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  { title: "That Should Be Me", artist: "Justin Bieber" },
  { title: "I Knew It, I Knew You", artist: "Taylor Swift" },
  { title: "Game Time", artist: "Future & Tyla" },
  { title: "Dai Dai", artist: "Shakira & Burna Boy" },
  { title: "Golden Brown (Slowed Down Version)", artist: "The Stranglers" },
  { title: "Young Hearts Run Free (45 Version)", artist: "Candi Staton" },
  { title: "Summer on the Inside", artist: "warner case, Jean Tonique & Max Kaluza" },
  { title: "Shape of a Woman", artist: "Lady Gaga" },
  { title: "Glamorous Life", artist: "Lady Gaga" },

  // ── Added: second trending pass (TikTok + Instagram Reels, July 2026) ────
  { title: "How You Like Me Now", artist: "The Heavy" },
  { title: "Self Aware", artist: "Temper City" },
  { title: "PRESSURE!", artist: "Nyck Caution" },
  { title: "Cheerleader", artist: "OMI" },
  { title: "Stupid Song", artist: "Olivia Rodrigo" },
  { title: "Careless Whisper", artist: "George Michael" },
  { title: "Respect", artist: "Aretha Franklin" },
  { title: "Bed on Fire", artist: "G Flip" },
  { title: "Sunny", artist: "Boney M. & R3HAB" },
  { title: "Look at My Life", artist: "Gracie Abrams" },
  { title: "The Time of My Life", artist: "Benson Boone" },
  { title: "BAD", artist: "ATEEZ" },
  { title: "Can't Knock the Hustle", artist: "Jay-Z" },
  { title: "Mary Jane's Last Dance", artist: "Tom Petty and the Heartbreakers" },
  { title: "Material Lover", artist: "Sienna Spiro" },
  { title: "Go Go Juice", artist: "Sabrina Carpenter" },
  { title: "One Less Lonely Girl", artist: "Justin Bieber" },
  { title: "The One That Got Away", artist: "Katy Perry" },
  { title: "Money Maker", artist: "Ludacris feat. Pharrell" },
  { title: "Lucky", artist: "Britney Spears" },
  { title: "This Is the Life", artist: "Hannah Montana" },
  { title: "Everything Hallelujah", artist: "Justin Bieber" },
  { title: "June 27th", artist: "Yungstar" },
  { title: "Nobody (Remix)", artist: "Trim feat. Monaleo" },
  { title: "Ghetto Love Story", artist: "BabyChiefDoit" },

  // ── Added: third trending pass (TikTok dance trend + gym hype + throwback Reels audio) ──
  { title: "Maps", artist: "Maroon 5" },
  { title: "Espresso", artist: "Sabrina Carpenter" },
  { title: "Apple", artist: "Charli xcx" },
  { title: "Melisa I'm Drunk and Outside", artist: "Afroplugs" },
  { title: "Remember the Name", artist: "Fort Minor" },
  { title: "All I Do Is Win", artist: "DJ Khaled" },
  { title: "Lose Yourself", artist: "Eminem" },
  { title: "Till I Collapse", artist: "Eminem" },
  { title: "Dreams and Nightmares", artist: "Meek Mill" },
  { title: "Power", artist: "Kanye West" },
  { title: "Hannah Montana", artist: "DaBaby, Ice Spice & NLE Choppa" },
  { title: "The Winner Takes It All", artist: "ABBA" },
  { title: "Human Nature", artist: "Michael Jackson" },
  { title: "I'm Every Woman", artist: "Chaka Khan" },
  { title: "Run the World (Girls)", artist: "Beyoncé" },
  { title: "Con la Misma Piedra", artist: "Julio Iglesias" },
  { title: "Baby", artist: "Justin Bieber" },
  { title: "Disparate Youth", artist: "Santigold" },
  { title: "Vogue", artist: "Madonna" },
  { title: "La Isla Bonita", artist: "Madonna" },
  { title: "Every Breath You Take", artist: "The Police" },
  { title: "Bittersweet Symphony", artist: "The Verve" },
  { title: "Big Girls Don't Cry", artist: "Fergie" },
  { title: "Maui Wowie", artist: "Kid Cudi" },
  { title: "This Is What Autumn Feels Like", artist: "JVKE" },
  { title: "Rocky Mountain Way", artist: "Joe Walsh" },
  { title: "Hate That I Made You Love Me", artist: "Ariana Grande" },
  { title: "Aperture", artist: "Harry Styles" },
  { title: "Wi$h Li$t", artist: "Taylor Swift" },
];

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
        `[${index}/${total}] ✓ ${s.artist} — ${s.title} | ${s.language} | tier ${s.popularity_tier} | tags: ${(s.story_intent_tags || []).slice(0, 2).join(", ")}`
      );
      return true;
    } else {
      console.error(`[${index}/${total}] ✗ ${song.artist} — ${song.title}: ${data.error}`);
      return false;
    }
  } catch (err) {
    console.error(`[${index}/${total}] ✗ ${song.artist} — ${song.title}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`\nVibeSong Trending Catalog Seeder`);
  console.log(`Adding ${SONGS.length} songs to ${BASE_URL}`);

  try {
    const ping = await fetch(`${BASE_URL}/api/admin/songs`, {
      headers: { "x-admin-secret": ADMIN_SECRET },
    });
    if (!ping.ok) throw new Error(`Admin API returned ${ping.status}`);
    const existing = await ping.json();
    console.log(`✓ Server reachable. Existing songs in catalog: ${existing.songs?.length ?? 0}\n`);
  } catch (err) {
    console.error(`✗ Cannot reach dev server at ${BASE_URL}: ${err.message}`);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < SONGS.length; i++) {
    const song = SONGS[i];
    const before = Date.now();
    const success = await addSong(song, i + 1, SONGS.length);
    if (success) ok++; else fail++;
    const elapsed = Date.now() - before;
    const wait = Math.max(0, 2000 - elapsed);
    if (wait > 0) await sleep(wait);
  }

  console.log(`\n✓ Done. ${ok} added, ${fail} failed.`);
  console.log(`Check your catalog at ${BASE_URL}/admin`);
}

main().catch(console.error);
