/**
 * VibeSong Uzbek language gap seeder -- fills the onboarding language option
 * that currently has no usable catalog pool.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-uzbek-language-gap.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- UZBEK POP / CLASSICS -----------------------------------------------
  { title: "O'zbek O'g'lon", artist: "Rayhon" },
  { title: "O'zbek", artist: "Rayhon" },
  { title: "Onamga aytmang", artist: "Yulduz Usmonova" },
  { title: "O'zbekcha Gapir", artist: "Yulduz Usmonova & Malik" },
  { title: "Bilmadim", artist: "Yulduz Usmonova" },
  { title: "Bebaho", artist: "Yulduz Usmonova" },
  { title: "Eh Ko'chalar", artist: "Yulduz Usmonova" },
  { title: "Korgim Kelar", artist: "Sevara Nazarkhan" },
  { title: "Asragin meni", artist: "Konsta & Sevara Nazarkhan" },

  // -- UZBEK ROMANCE / SAD / NIGHT DRIVE ----------------------------------
  { title: "O'ylamading", artist: "Munisa Rizayeva & Konsta" },
  { title: "Bom-bom", artist: "Munisa Rizayeva & Rashid Holiqov" },
  { title: "Alamim Bor (Live)", artist: "Munisa Rizayeva" },
  { title: "Toshkent-Samarqand", artist: "Shohruhxon & Lola Yuldasheva" },
  { title: "Sog'indi Yurak", artist: "Dilso'z & Sardor Rahimxon" },
  { title: "Menchali", artist: "Rayhon & Sardor Rahimxon" },
  { title: "Janim", artist: "Manzura & Sardor Rahimxon" },

  // -- UZBEK MALE VOCALS / FOLK-POP ---------------------------------------
  { title: "Yurak", artist: "Shohruhxon" },
  { title: "Chaqirsam", artist: "Jaloliddin Ahmadaliyev" },
  { title: "Yor Bizdan Ketdi", artist: "Jaloliddin Ahmadaliyev" },
  { title: "Tuproq Bo'lasan", artist: "Jaloliddin Ahmadaliyev" },
  { title: "Xoqon yagona", artist: "Jaloliddin Ahmadaliyev" },
  { title: "Janze", artist: "Xamdam Sobirov" },
  { title: "Guli", artist: "Xamdam Sobirov" },
  { title: "Sevgisi Arzonim", artist: "Xamdam Sobirov" },
  { title: "Ey Do'stim", artist: "Doston Ergashev" },
  { title: "Yanaram", artist: "Doston Ergashev" },

  // -- UZBEK PARTY / BAND / WEDDING ENERGY --------------------------------
  { title: "Hamma Harakatda", artist: "VIA Marokand" },
  { title: "Million", artist: "VIA Marokand" },
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
  console.log(`\nVibeSong Uzbek Language Gap Seeder`);
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
