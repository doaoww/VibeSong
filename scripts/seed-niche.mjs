/**
 * VibeSong niche catalog seeder — adds underground/niche Stories-aesthetic tracks.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   BASE_URL=http://localhost:3001 node scripts/seed-niche.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // ── SHOEGAZE / DREAM POP ─────────────────────────────────────────────────
  { title: "Sugar for the Pill", artist: "Slowdive" },
  { title: "Archie, Marry Me", artist: "Alvvays" },
  { title: "Skin Game", artist: "DIIV" },
  { title: "Cutting My Fingers Off", artist: "Turnover" },
  { title: "Bent Nail", artist: "Nothing" },
  { title: "Falling", artist: "Julee Cruise" },
  { title: "Bloodhail", artist: "Have a Nice Life" },
  { title: "Silver Souvenirs", artist: "Julien Baker" },

  // ── HYPERPOP / GLITCH ────────────────────────────────────────────────────
  { title: "money machine", artist: "100 gecs" },
  { title: "astrid", artist: "glaive" },
  { title: "fine 2 me", artist: "ericdoa" },
  { title: "Mine", artist: "Slayyyter" },
  { title: "Flamboyant", artist: "Dorian Electra" },
  { title: "Flamingo", artist: "Kero Kero Bonito" },
  { title: "Locket", artist: "underscores" },
  { title: "self doubt", artist: "osquinn" },

  // ── RUSSIAN UNDERGROUND ──────────────────────────────────────────────────
  { title: "Розовое вино", artist: "Cream Soda" },
  { title: "Иначе", artist: "Скриптонит" },
  { title: "Слишком много любви", artist: "ЛСП" },
  { title: "Панелька", artist: "Хаски" },
  { title: "Сычи", artist: "Пасош" },
  { title: "Юность", artist: "GONE.Fludd" },
  { title: "Розовые очки", artist: "SODA LUV" },
  { title: "Сомбре", artist: "Три Дня Дождя" },

  // ── BEDROOM POP ──────────────────────────────────────────────────────────
  { title: "Everytime", artist: "boy pablo" },
  { title: "Lovers Rock", artist: "TV Girl" },
  { title: "Lo Que Siento", artist: "Cuco" },
  { title: "Fruity", artist: "Chloe Moriondo" },
  { title: "Yam Yam", artist: "No Vacation" },
  { title: "Locket", artist: "Crumb" },
  { title: "Prom Queen", artist: "Beach Bunny" },
  { title: "Punching Bag", artist: "Wallice" },

  // ── DARK TECHNO / EBM ────────────────────────────────────────────────────
  { title: "Pain", artist: "Boy Harsher" },
  { title: "Slaughterhouse", artist: "HEALTH" },
  { title: "Contortion", artist: "Sextile" },
  { title: "Hand to Phone", artist: "ADULT." },
  { title: "Drown You Out", artist: "Author & Punisher" },
  { title: "Complex", artist: "Perturbator" },
  { title: "Turbo Killer", artist: "Carpenter Brut" },
  { title: "Sundown", artist: "Boy Harsher" },
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
  console.log(`\nVibeSong Niche Catalog Seeder`);
  console.log(`Adding ${SONGS.length} niche songs to ${BASE_URL}`);

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
