/**
 * VibeSong Russian + global vibes seeder -- Russian/CIS first, then Ukrainian,
 * Turkish, Arabic, Japanese, Korean, Hindi/Punjabi, and Brazilian/Portuguese
 * tracks with strong mood fit.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-russian-global-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- RUSSIAN / CIS NIGHT DRIVE ------------------------------------------
  { title: "Кино", artist: "MACAN" },
  { title: "ASPHALT 8", artist: "MACAN" },
  { title: "I AM", artist: "MACAN" },
  { title: "Комета", artist: "JONY" },
  { title: "Аллея", artist: "JONY" },
  { title: "Титры", artist: "JONY" },
  { title: "Ты и я", artist: "Xcho" },
  { title: "Memories", artist: "Xcho & MACAN" },
  { title: "X.O", artist: "The Limba & ANDRO" },
  { title: "Секрет", artist: "The Limba" },
  { title: "25", artist: "Markul" },
  { title: "Моряк", artist: "FEDUK" },
  { title: "Хлопья летят наверх", artist: "FEDUK" },
  { title: "Астронавт", artist: "ATL" },

  // -- UKRAINIAN / SLAVIC INDIE ------------------------------------------
  { title: "Касета", artist: "SadSvit" },
  { title: "Силуети", artist: "SadSvit & СТРУКТУРА ЩАСТЯ" },
  { title: "Обійми", artist: "Okean Elzy" },
  { title: "Без бою", artist: "Okean Elzy" },
  { title: "У мене немає дому", artist: "Один в каное" },
  { title: "Плакала", artist: "KAZKA" },
  { title: "Журавлі", artist: "The Hardkiss" },
  { title: "Teresa & Maria", artist: "alyona alyona & Jerry Heil" },

  // -- TURKISH / ANATOLIAN VIBES ------------------------------------------
  { title: "Antidepresan", artist: "Mert Demir & Mabel Matiz" },
  { title: "Aşkın Olayım", artist: "Simge" },
  { title: "Belki (Akustik)", artist: "Dedublüman" },
  { title: "Seni Dert Etmeler", artist: "Madrigal" },
  { title: "Ne Farkeder", artist: "Yüzyüzeyken Konuşuruz" },
  { title: "Senden Daha Güzel", artist: "Duman" },

  // -- ARABIC / MENA ALT ---------------------------------------------------
  { title: "Ghareeb Alay", artist: "Elyanna & Balti" },
  { title: "Ganeni", artist: "Elyanna" },
  { title: "Roman", artist: "Mashrou' Leila" },
  { title: "Ghaba", artist: "Marwan Pablo" },
  { title: "Kan Lak Ma'aya", artist: "Cairokee & Umm Kulthum" },

  // -- JAPANESE / KOREAN ---------------------------------------------------
  { title: "Shinunoga E-Wa", artist: "Fujii Kaze" },
  { title: "NIGHT DANCER", artist: "imase" },
  { title: "Odoriko", artist: "Vaundy" },
  { title: "Bling-Bang-Bang-Born", artist: "Creepy Nuts" },
  { title: "Show", artist: "Ado" },
  { title: "Bansanka", artist: "tuki." },
  { title: "Drama", artist: "aespa" },
  { title: "Baddie", artist: "IVE" },
  { title: "EASY", artist: "LE SSERAFIM" },
  { title: "Standing Next to You", artist: "Jung Kook" },

  // -- HINDI / PUNJABI / DESI ---------------------------------------------
  { title: "Maan Meri Jaan", artist: "King" },
  { title: "Kesariya", artist: "Pritam, Arijit Singh & Amitabh Bhattacharya" },
  { title: "Heeriye", artist: "Jasleen Royal & Arijit Singh" },
  { title: "Satranga", artist: "Arijit Singh, Shreyas Puranik & Siddharth-Garima" },
  { title: "Excuses", artist: "AP Dhillon, Gurinder Gill & Intense" },
  { title: "With You", artist: "AP Dhillon" },

  // -- BRAZILIAN / PORTUGUESE ---------------------------------------------
  { title: "Anos Luz", artist: "Matuê" },
  { title: "Sagrado Profano", artist: "Luísa Sonza & KayBlack" },
];

// ─── RUNNER ────────────────────────────────────────────────────────────────

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
  console.log(`\nVibeSong Russian + Global Vibes Seeder`);
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
