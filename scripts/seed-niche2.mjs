/**
 * VibeSong niche catalog seeder, batch 2 — new aesthetic lanes not yet covered:
 * indie sleaze revival, K-indie/R&B, French touch, UK garage, Latin alt, emo revival.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   BASE_URL=http://localhost:3001 node scripts/seed-niche2.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // ── INDIE SLEAZE / 2000s DANCE-PUNK REVIVAL ─────────────────────────────
  { title: "Gold Lion", artist: "Yeah Yeah Yeahs" },
  { title: "House of Jealous Lovers", artist: "The Rapture" },
  { title: "Golden Skans", artist: "Klaxons" },
  { title: "Space and the Woods", artist: "Late of the Pier" },
  { title: "D.A.N.C.E.", artist: "Justice" },
  { title: "ADD SUV", artist: "Uffie" },
  { title: "Rock On", artist: "Digitalism" },

  // ── K-INDIE / K R&B ──────────────────────────────────────────────────────
  { title: "instagram", artist: "DEAN" },
  { title: "Beautiful", artist: "Crush" },
  { title: "Rain", artist: "Hoody" },
  { title: "POP", artist: "pH-1" },
  { title: "Andercover", artist: "DPR LIVE" },
  { title: "No Make Up", artist: "Zion.T" },
  { title: "You", artist: "Colde" },

  // ── FRENCH TOUCH / DREAM POP ─────────────────────────────────────────────
  { title: "Vanille Fraise", artist: "L'Impératrice" },
  { title: "Territory", artist: "The Blaze" },
  { title: "Bouquet Final", artist: "Yelle" },
  { title: "Amour Plastique", artist: "Videoclub" },
  { title: "I Follow You", artist: "Melody's Echo Chamber" },
  { title: "Gimme", artist: "Weval" },

  // ── UK GARAGE / 2-STEP NOSTALGIA ─────────────────────────────────────────
  { title: "Movin' Too Fast", artist: "Artful Dodger" },
  { title: "Sincere", artist: "MJ Cole" },
  { title: "Saved My Life", artist: "Todd Edwards" },

  // ── LATIN ALT / DREAMY REGGAETON ─────────────────────────────────────────
  { title: "Fiebre", artist: "Bad Gyal" },
  { title: "Con Otra", artist: "Cazzu" },
  { title: "Colibria", artist: "Nicola Cruz" },
  { title: "Fiesta", artist: "Bomba Estéreo" },

  // ── EMO REVIVAL / POP-PUNK NOSTALGIA ─────────────────────────────────────
  { title: "In Bloom", artist: "Neck Deep" },
  { title: "Full Circle", artist: "Movements" },
  { title: "Covet", artist: "Basement" },
  { title: "Roam the Room", artist: "Citizen" },
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
  console.log(`\nVibeSong Niche Catalog Seeder — Batch 2`);
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
