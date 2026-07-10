/**
 * VibeSong Russian vibey-only seeder -- melancholic indie, lo-fi rock-pop,
 * dark synth, poetic rap, and soft night-drive Russian-language tracks.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-russian-vibey-only.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- MELANCHOLIC INDIE / LO-FI ROCK -------------------------------------
  { title: "Старое кино", artist: "Peremotka" },
  { title: "Здравствуй", artist: "Peremotka" },
  { title: "Ты и твоя тень", artist: "Увула" },
  { title: "Тёмно-оранжевый закат", artist: "Papin Olimpos" },
  { title: "Динозаврики", artist: "Papin Olimpos" },
  { title: "Спам", artist: "Dajte Tank (!)" },
  { title: "Мы", artist: "Dajte Tank (!)" },
  { title: "Люди", artist: "Dajte Tank (!)" },
  { title: "Оркестр", artist: "Komsomol'sk" },
  { title: "Выше домов", artist: "Сироткин" },
  { title: "Планы на это лето", artist: "Сироткин" },

  // -- SOFT ROMANTIC / DREAMY ---------------------------------------------
  { title: "Я и твой кот", artist: "Svidanie" },
  { title: "Случайная любовь", artist: "Svidanie" },
  { title: "Возможно", artist: "Мы" },
  { title: "Остров", artist: "Мы" },
  { title: "Огонёк", artist: "Luna" },
  { title: "Зима в сердце", artist: "Moya Mishel" },

  // -- DARK SYNTH / POST-PUNK ---------------------------------------------
  { title: "Зло", artist: "Electroforez" },
  { title: "Русская принцесса", artist: "Electroforez" },
  { title: "Мёртв внутри (feat. Molchat Doma)", artist: "Electroforez" },
  { title: "Закладка", artist: "Ploho" },
  { title: "Горький опыт", artist: "Ploho" },
  { title: "Культ тела", artist: "Буерак" },

  // -- NEW WAVE / ALT POP --------------------------------------------------
  { title: "Зима", artist: "ooes" },
  { title: "Права", artist: "ooes" },
  { title: "Ночь", artist: "ooes" },
  { title: "Втюрилась", artist: "Dora" },

  // -- NIGHT DRIVE / SAD RAP ----------------------------------------------
  { title: "Патрон", artist: "Miyagi & Andy Panda" },
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
  console.log(`\nVibeSong Russian Vibey-Only Seeder`);
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
