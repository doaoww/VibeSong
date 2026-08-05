/**
 * VibeSong undercovered language gap seeder -- targeted Arabic, Turkish,
 * Japanese, Portuguese, and Punjabi batches for onboarding language coverage.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-undercovered-language-gap-fill.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- ARABIC / MENA ALT-POP / RAP ----------------------------------------
  { title: "Callin' U (Tamally Maak)", artist: "Elyanna" },
  { title: "Sokkar", artist: "Elyanna" },
  { title: "Ana Lahale (feat. Massari)", artist: "Elyanna" },
  { title: "DO YOU LOVE ME? / سنيورة", artist: "Saint Levant & Fares Sokar" },
  { title: "SABAH EL WARD / صباح الورد", artist: "Saint Levant" },
  { title: "KALAMANTINA /  كلمنتينا", artist: "Saint Levant & Marwan Moussa" },
  { title: "NARI NARI NARI / ناري ناري ناري", artist: "Saint Levant" },
  { title: "SAMRA / سمرة", artist: "Saint Levant & Babylone" },
  { title: "WAZIRA / وزيرة", artist: "Saint Levant" },
  { title: "شيراتون", artist: "Marwan Moussa" },
  { title: "بطل عالم", artist: "Marwan Moussa" },
  { title: "Tesla", artist: "Marwan Moussa" },
  { title: "matador", artist: "Marwan Moussa" },
  { title: "Basrah w Atooh", artist: "Cairokee" },
  { title: "Ana Negm", artist: "Cairokee" },
  { title: "James Dean", artist: "Cairokee" },
  { title: "Samurai", artist: "Cairokee" },
  { title: "Fasateen", artist: "Mashrou' Leila" },

  // -- TURKISH PSYCH / RAP / POP -----------------------------------------
  { title: "Goca Dünya", artist: "Altın Gün" },
  { title: "Neredesin Sen", artist: "Altın Gün" },
  { title: "Süpürgesi Yoncadan", artist: "Altın Gün" },
  { title: "Rakiya Su Katamam", artist: "Altın Gün" },
  { title: "Anlatmam Derdimi", artist: "Altın Gün" },
  { title: "Yolcu", artist: "Altın Gün" },
  { title: "İstikrarlı Hayal Hakikattir", artist: "Gaye Su Akyol" },
  { title: "Anadolu Ejderi", artist: "Gaye Su Akyol" },
  { title: "Bir Yaralı Kuştum", artist: "Gaye Su Akyol" },
  { title: "Vurgunum Ama Acelesi Yok", artist: "Gaye Su Akyol" },
  { title: "Laziko", artist: "Gaye Su Akyol" },
  { title: "Felaket", artist: "Ezhel" },
  { title: "AYA", artist: "Murda & Ezhel" },
  { title: "Bi Sonraki Hayatımda Gel", artist: "Murda & Ezhel" },
  { title: "Bul Beni", artist: "Ezhel" },
  { title: "PAPARAZZI", artist: "UZI" },
  { title: "DENE", artist: "UZI" },
  { title: "ZOR", artist: "UZI" },
  { title: "Fırtınadayım", artist: "Mabel Matiz" },
  { title: "Biliyorsun", artist: "Sezen Aksu" },

  // -- JAPANESE ALT / J-POP / INTERNET ENERGY ----------------------------
  { title: "Tokyo Calling", artist: "ATARASHII GAKKO!" },
  { title: "Pineapple Kryptonite", artist: "ATARASHII GAKKO!" },
  { title: "Otonablue", artist: "ATARASHII GAKKO!" },
  { title: "Fly High", artist: "ATARASHII GAKKO!" },
  { title: "Koi Geba", artist: "ATARASHII GAKKO!" },
  { title: "wo ai ni", artist: "WEDNESDAY CAMPANELLA" },
  { title: "Momotaro", artist: "WEDNESDAY CAMPANELLA" },
  { title: "Summer Time Ghost", artist: "WEDNESDAY CAMPANELLA" },
  { title: "Hot Pot Commander", artist: "WEDNESDAY CAMPANELLA" },
  { title: "Edison", artist: "WEDNESDAY CAMPANELLA" },
  { title: "Odo", artist: "Ado" },
  { title: "Tot Musica", artist: "Ado" },
  { title: "Backlight", artist: "Ado" },
  { title: "Usseewa", artist: "Ado" },
  { title: "TAIDADA", artist: "ZUTOMAYO" },
  { title: "Time Left", artist: "ZUTOMAYO" },
  { title: "Obenkyou Shitoiteyo", artist: "ZUTOMAYO" },
  { title: "Hakujitsu", artist: "King Gnu" },

  // -- PORTUGUESE / BRAZILIAN INDIE, SOUL, RAP ---------------------------
  { title: "Solidão de Volta", artist: "Terno Rei" },
  { title: "Yoko", artist: "Terno Rei" },
  { title: "Dia Lindo", artist: "Terno Rei" },
  { title: "Amor-Perfeito", artist: "Terno Rei" },
  { title: "Medo", artist: "Terno Rei" },
  { title: "CAJU", artist: "Liniker" },
  { title: "TUDO", artist: "Liniker" },
  { title: "VELUDO MARROM", artist: "Liniker" },
  { title: "Baby 95", artist: "Liniker" },
  { title: "Presente - A COLORS SHOW", artist: "Liniker" },
  { title: "Acalanto", artist: "Luedji Luna" },
  { title: "Banho de Folhas", artist: "Luedji Luna" },
  { title: "Asas", artist: "Luedji Luna" },
  { title: "Acalanto - A COLORS SHOW", artist: "Luedji Luna" },
  { title: "Me Desculpa Jay Z (feat. 1LUM3)", artist: "Baco Exu do Blues" },
  { title: "Flamingos (feat. Tuyo)", artist: "Baco Exu do Blues" },
  { title: "Hotel Caro", artist: "Baco Exu do Blues & Luísa Sonza" },
  { title: "Bluesman", artist: "Baco Exu do Blues" },
  { title: "Castelos & Ruínas", artist: "BK" },
  { title: "Cacos De Vidro", artist: "BK" },

  // -- PUNJABI / DESI RAP / POP ------------------------------------------
  { title: "Eyes on Me", artist: "Sidhu Moose Wala & The Kidd" },
  { title: "So High", artist: "Sidhu Moose Wala" },
  { title: "Never Fold", artist: "Sidhu Moose Wala" },
  { title: "The Last Ride", artist: "Sidhu Moose Wala" },
  { title: "Barota", artist: "Sidhu Moose Wala & The Kidd" },
  { title: "US (feat. Raja Kumari)", artist: "Sidhu Moose Wala & Raja Kumari" },
  { title: "For A Reason", artist: "Karan Aujla & Ikky" },
  { title: "Wavy", artist: "Karan Aujla & Jay Trak" },
  { title: "Boyfriend", artist: "Karan Aujla & Ikky" },
  { title: "5-7", artist: "Karan Aujla & MXRCI" },
  { title: "At Peace", artist: "Karan Aujla & Ikky" },
  { title: "Softly", artist: "Karan Aujla & Ikky" },
  { title: "Dealer", artist: "Diljit Dosanjh" },
  { title: "G.O.A.T.", artist: "Diljit Dosanjh" },
  { title: "Hass Hass", artist: "Diljit Dosanjh, Sia & Greg Kurstin" },
  { title: "Kinni Kinni", artist: "Diljit Dosanjh" },
  { title: "Insane", artist: "AP Dhillon, Shinda Kahlon, Gurinder Gill & Gminxr" },
  { title: "Dil Nu", artist: "AP Dhillon & Shinda Kahlon" },
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
  console.log(`\nVibeSong Undercovered Language Gap Fill Seeder`);
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
