/**
 * VibeSong French/Spanish now seeder -- popular current and still-streamed
 * French, Spanish, and Latin tracks. Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-french-spanish-now.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- FRENCH POP / RAP NOW -----------------------------------------------
  { title: "Melodrama", artist: "Disiz & Theodora" },
  { title: "Sex Model", artist: "PLK & Theodora" },
  { title: "SPA", artist: "GIMS & Theodora" },
  { title: "Sois pas timide", artist: "GIMS" },
  { title: "Ninao", artist: "GIMS" },
  { title: "Tant pis pour elle", artist: "Charlotte Cardin" },
  { title: "Mauvais Garçon", artist: "Helena" },
  { title: "What You Want", artist: "Angèle & Justice" },
  { title: "La recette", artist: "Jeck & Carla" },
  { title: "Solide", artist: "Ronisia" },
  { title: "REGARDE !", artist: "Monroe & Violin Phonix" },
  { title: "NUMBER ONE (feat. Minz)", artist: "Himra" },
  { title: "Belle", artist: "GIMS, Dadju & Slimane" },
  { title: "Spider", artist: "GIMS & DYSTINCT" },
  { title: "Position", artist: "Franglish" },
  { title: "Casanova", artist: "Soolking & Gazo" },

  // -- SPANISH / LATIN NOW -------------------------------------------------
  { title: "Ayer La Vi (BPA26)", artist: "Juan Magán & Omar Montes" },
  { title: "La Graciosa", artist: "Quevedo & Elvis Crespo" },
  { title: "Mentira", artist: "Daniela Blasco" },
  { title: "El Baifo", artist: "Quevedo" },
  { title: "Ni Borracho", artist: "Quevedo" },
  { title: "Al Golpito", artist: "Quevedo & Nueva Línea" },
  { title: "6 de febrero", artist: "Aitana" },
  { title: "Cuando hables con él", artist: "Aitana" },
  { title: "NUEVAYoL", artist: "Bad Bunny" },
  { title: "WELTiTA", artist: "Bad Bunny & Chuwi" },
  { title: "Zoo", artist: "Shakira" },
  { title: "Si Antes Te Hubiera Conocido", artist: "Karol G" },
  { title: "Mi Refe", artist: "Beéle & Ovy On the Drums" },
  { title: "La Diabla", artist: "Xavi" },
  { title: "Si No Quieres No", artist: "Luis R Conriquez & Neton Vega" },
  { title: "Santa", artist: "Rvssian, Rauw Alejandro & Ayra Starr" },
  { title: "La Bachata", artist: "Manuel Turizo" },
  { title: "Columbia", artist: "Quevedo" },
  { title: "Playa del Inglés", artist: "Quevedo & Myke Towers" },
  { title: "Gran Vía", artist: "Quevedo & Aitana" },
  { title: "La Última", artist: "Quevedo" },
  { title: "La Curiosidad", artist: "Jay Wheeler, DJ Nelson & Myke Towers" },
  { title: "Hey Mor (feat. Feid)", artist: "Ozuna" },
  { title: "Tutu", artist: "Camilo & Pedro Capó" },
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
  console.log(`\nVibeSong French/Spanish Now Seeder`);
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
