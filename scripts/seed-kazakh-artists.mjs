/**
 * VibeSong Kazakh scene seeder — Kazakhstani pop/indie/hip-hop artists
 * requested by the product owner. Track titles verified via web search
 * (not guessed) since this scene isn't well covered by default knowledge.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-kazakh-artists.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // ── Dequine ──────────────────────────────────────────────────────────────
  { title: "Fresh&Clean", artist: "Dequine" },
  { title: "Wind", artist: "Dequine" },
  { title: "Matcha Tea", artist: "Dequine" },
  { title: "Deja Vu", artist: "Dequine" },
  { title: "18", artist: "Dequine, M'Dee" },

  // ── Moldanazar ───────────────────────────────────────────────────────────
  { title: "Ozin Gana", artist: "Moldanazar" },
  { title: "Senin Zhanynda", artist: "Moldanazar" },
  { title: "Mahabbatym", artist: "Moldanazar" },
  { title: "Alystama", artist: "Moldanazar" },

  // ── Ayau ─────────────────────────────────────────────────────────────────
  { title: "sensiz?", artist: "Ayau" },
  { title: "sybyrlaiyn <3", artist: "Ayau" },
  { title: "SÜI", artist: "Ayau" },
  { title: "QOO", artist: "Ayau" },
  { title: "kõzder", artist: "Ayau" },

  // ── Ayree ────────────────────────────────────────────────────────────────
  { title: "Шоу", artist: "Ayree" },
  { title: "Кешір мені", artist: "Ayree" },
  { title: "Мен сені сүйем", artist: "Ayree" },
  { title: "Не уходи", artist: "Ayree" },
  { title: "Vibe", artist: "Ayree" },

  // ── Darkhan Juzz ─────────────────────────────────────────────────────────
  { title: "Uıde", artist: "Darkhan Juzz" },
  { title: "Sheker", artist: "Darkhan Juzz" },
  { title: "Everest", artist: "Darkhan Juzz" },
  { title: "Ең сұлу", artist: "Darkhan Juzz" },
  { title: "Қалдырма мені", artist: "Darkhan Juzz" },

  // ── Aro ──────────────────────────────────────────────────────────────────
  { title: "Танцуем под ламбаду", artist: "Aro" },
  { title: "Бейтаныс әуен", artist: "Aro" },
  { title: "Aiğyr", artist: "Aro" },
  { title: "S.Ó.Seni", artist: "Aro" },

  // ── Dudeontheguitar ──────────────────────────────────────────────────────
  { title: "kelmid", artist: "dudeontheguitar" },
  { title: "tereze", artist: "dudeontheguitar" },
  { title: "shyq", artist: "dudeontheguitar" },
  { title: "baq", artist: "dudeontheguitar, jeltoksan." },
  { title: "zhanbyrly kun", artist: "dudeontheguitar" },

  // ── M'Dee ────────────────────────────────────────────────────────────────
  { title: "Одержимость", artist: "M'Dee" },
  { title: "Ночь каждой пятницы", artist: "M'Dee" },
  { title: "Побудь со мной", artist: "M'Dee" },

  // ── Ninety One (story-worthy/moodier picks, not full discography) ───────
  { title: "Bayau", artist: "Ninety One" },
  { title: "Jurek", artist: "Ninety One" },
  { title: "Órik", artist: "Ninety One" },
  { title: "Mooz", artist: "Ninety One" },

  // ── Shiza ────────────────────────────────────────────────────────────────
  { title: "Shym", artist: "Shiza" },
  { title: "Muza", artist: "Shiza" },
  { title: "Camry", artist: "Shiza" },
  { title: "Bas", artist: "Shiza" },
  { title: "Old school", artist: "Shiza" },
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
  console.log(`\nVibeSong Kazakh Scene Seeder`);
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
