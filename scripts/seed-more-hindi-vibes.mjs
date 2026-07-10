/**
 * VibeSong Hindi vibes seeder -- Bollywood romance, heartbreak, wedding
 * energy, indie acoustic, classics, and devotional/cinematic Hindi moods.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-more-hindi-vibes.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- BOLLYWOOD ROMANCE / SOFT MAIN CHARACTER ----------------------------
  { title: "Tum Hi Ho", artist: "Mithoon & Arijit Singh" },
  { title: "Channa Mereya", artist: "Pritam & Arijit Singh" },
  { title: "Agar Tum Saath Ho", artist: "Alka Yagnik & Arijit Singh" },
  { title: "Tujh Mein Rab Dikhta Hai", artist: "Roop Kumar Rathod" },
  { title: "Kal Ho Naa Ho", artist: "Sonu Nigam" },
  { title: "Main Agar Kahoon", artist: "Sonu Nigam & Shreya Ghoshal" },
  { title: "Pehla Nasha", artist: "Udit Narayan & Sadhana Sargam" },
  { title: "Tera Ban Jaunga", artist: "Akhil Sachdeva & Tulsi Kumar" },
  { title: "Ranjha", artist: "Jasleen Royal & B. Praak" },
  { title: "Raataan Lambiyan", artist: "Tanishk Bagchi, Jubin Nautiyal & Asees Kaur" },
  { title: "Bolna", artist: "Tanishk Bagchi, Arijit Singh & Asees Kaur" },
  { title: "Samjhawan", artist: "Jawad Ahmed, Sharib Toshi, Arijit Singh & Shreya Ghoshal" },

  // -- HEARTBREAK / LONGING / CINEMATIC SAD -------------------------------
  { title: "Tera Yaar Hoon Main", artist: "Arijit Singh" },
  { title: "Hamari Adhuri Kahani (Title Track)", artist: "Jeet Gannguli & Arijit Singh" },
  { title: "Janam Janam", artist: "Pritam, Antara Mitra & Arijit Singh" },
  { title: "Gerua", artist: "Pritam, Arijit Singh & Antara Mitra" },
  { title: "Ae Dil Hai Mushkil (Title Track)", artist: "Pritam & Arijit Singh" },
  { title: "Bulleya", artist: "Pritam, Amit Mishra & Shilpa Rao" },
  { title: "Bekhayali", artist: "Sachet Tandon" },
  { title: "Tujhe Kitna Chahne Lage", artist: "Arijit Singh" },
  { title: "Apna Bana Le", artist: "Sachin-Jigar & Arijit Singh" },
  { title: "O Bedardeya", artist: "Pritam & Arijit Singh" },
  { title: "Tere Hawaale", artist: "Pritam, Arijit Singh & Shilpa Rao" },
  { title: "Ve Kamleya", artist: "Pritam, Arijit Singh, Shreya Ghoshal, Shadab Faridi, Altamash Faridi & Amitabh Bhattacharya" },

  // -- WEDDING / DANCE / CONFIDENT DESI ENERGY ----------------------------
  { title: "Param Sundari", artist: "A. R. Rahman & Shreya Ghoshal" },
  { title: "Kala Chashma", artist: "Amar Arshi, Badshah, Neha Kakkar & Indeep Bakshi" },
  { title: "Kar Gayi Chull", artist: "Badshah, Amaal Mallik, Fazilpuria, Sukriti Kakar & Neha Kakkar" },
  { title: "The Breakup Song", artist: "Pritam, Arijit Singh, Badshah, Jonita Gandhi & Nakash Aziz" },
  { title: "London Thumakda", artist: "Labh Janjua, Sonu Kakkar & Neha Kakkar" },
  { title: "Gallan Goodiyaan", artist: "Yashita Sharma, Manish Kumar Tipu, Farhan Akhtar, Shankar Mahadevan & Sukhwinder Singh" },
  { title: "Badtameez Dil", artist: "Benny Dayal & Shefali Alvares" },
  { title: "Balam Pichkari", artist: "Vishal Dadlani & Shalmali Kholgade" },
  { title: "Ghungroo", artist: "Vishal & Shekhar, Arijit Singh & Shilpa Rao" },
  { title: "Nashe Si Chadh Gayi", artist: "Vishal & Shekhar, Arijit Singh & Caralisa Monteiro" },
  { title: "Jhoome Jo Pathaan", artist: "Vishal & Shekhar, Arijit Singh, Sukriti Kakar, Vishal Dadlani & Shekhar Ravjiani" },
  { title: "Besharam Rang (From \"Pathaan\")", artist: "Vishal & Shekhar, Shilpa Rao, Caralisa Monteiro, Vishal Dadlani, Shekhar Ravjiani & Kumaar" },
  { title: "Malhari", artist: "Sanjay Leela Bhansali, Vishal Dadlani & Prashant Ingole" },

  // -- HINDI INDIE / ACOUSTIC / YOUNG LOVE --------------------------------
  { title: "Kho Gaye Hum Kahan", artist: "Jasleen Royal & Prateek Kuhad" },
  { title: "Kasoor", artist: "Prateek Kuhad" },
  { title: "Alag Aasmaan", artist: "Anuv Jain" },
  { title: "Gul", artist: "Anuv Jain" },
  { title: "Baarishein", artist: "Anuv Jain" },
  { title: "Husn", artist: "Anuv Jain" },
  { title: "Iktara", artist: "Amit Trivedi, Kavita Seth & Amitabh Bhattacharya" },
  { title: "Zinda", artist: "Amit Trivedi" },
  { title: "Ilahi", artist: "Pritam & Arijit Singh" },
  { title: "Safarnama", artist: "Lucky Ali" },

  // -- CLASSIC / DEVOTIONAL / TIMELESS HINDI ------------------------------
  { title: "Lag Ja Gale Se Phir (From \"Woh Kaun Thi?\")", artist: "Lata Mangeshkar" },
  { title: "Ajeeb Dastan Hai Yeh", artist: "Lata Mangeshkar" },
  { title: "Yeh Sham Mastani", artist: "Kishore Kumar" },
  { title: "Pal Pal Dil Ke Paas", artist: "Kishore Kumar" },
  { title: "Mere Sapnon Ki Rani", artist: "Kishore Kumar" },
  { title: "Ek Ladki Ko Dekha", artist: "Kumar Sanu" },
  { title: "Tujhe Dekha To", artist: "Lata Mangeshkar & Kumar Sanu" },
  { title: "Chaiyya Chaiyya", artist: "Sukhwinder Singh & Sapna Awasthi" },
  { title: "Mitwa", artist: "Caralisa Monteiro, Shafqat Amanat Ali, Shankar Mahadevan & Shankar Ehsaan Loy" },
  { title: "Maa", artist: "Shankar Mahadevan" },
  { title: "Kun Faya Kun", artist: "A. R. Rahman, Javed Ali & Mohit Chauhan" },
  { title: "Namo Namo", artist: "Amit Trivedi" },
  { title: "O Rangrez", artist: "Shankar Ehsaan Loy, Shreya Ghoshal & Javed Bashir" },
  { title: "Laal Ishq", artist: "Sanjay Leela Bhansali, Arijit Singh & Siddharth-Garima" },
  { title: "Aayat", artist: "Sanjay Leela Bhansali, Shreyas Puranik, Arijit Singh, Mujtaba Aziz Naza, Shadab Faridi, Altamash Faridi & Farhan Sabri" },
  { title: "Manwa Laage", artist: "Shreya Ghoshal & Arijit Singh" },
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
  console.log(`\nVibeSong More Hindi Vibes Seeder`);
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
