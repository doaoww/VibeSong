/**
 * VibeSong more Russian cool tracks seeder -- Russian-language classics,
 * indie, post-punk, rap, pop drama, night-drive, and nostalgic party tracks.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-more-russian-cool.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // -- RUSSIAN ROCK / CLASSIC NOSTALGIA -----------------------------------
  { title: "Полковнику никто не пишет", artist: "Bi-2" },
  { title: "Серебро", artist: "Bi-2" },
  { title: "Медведица", artist: "Mumiy Troll" },
  { title: "Утекай", artist: "Mumiy Troll" },
  { title: "Невеста", artist: "Mumiy Troll" },
  { title: "Прогулки по воде", artist: "Nautilus Pompilius" },
  { title: "Крылья", artist: "Nautilus Pompilius" },
  { title: "Скованные одной цепью", artist: "Nautilus Pompilius" },
  { title: "Как на войне", artist: "Agatha Christie" },
  { title: "Опиум для никого", artist: "Agatha Christie" },
  { title: "Что такое осень", artist: "DDT" },
  { title: "Это всё", artist: "DDT" },
  { title: "Кукла колдуна", artist: "Korol i Shut" },
  { title: "Лесник", artist: "Korol i Shut" },
  { title: "Воины света", artist: "Lyapis Trubetskoy" },

  // -- POST-PUNK / DARK RUSSIAN NIGHT -------------------------------------
  { title: "Звезды", artist: "Molchat Doma" },
  { title: "Танцевать", artist: "Molchat Doma" },
  { title: "Тоска", artist: "Molchat Doma" },
  { title: "Все идет по плану", artist: "Grazhdanskaya Oborona" },
  { title: "Моя оборона", artist: "Grazhdanskaya Oborona" },

  // -- INDIE / SOFT SAD / POETIC ------------------------------------------
  { title: "Кометы", artist: "polnalyubvi" },
  { title: "Девочка и море", artist: "polnalyubvi" },
  { title: "Выдыхай", artist: "Noize MC" },
  { title: "Вселенная бесконечна?", artist: "Noize MC" },
  { title: "Нимфоманка", artist: "Monetochka" },
  { title: "Глаза (Прилипли)", artist: "Komsomol'sk" },
  { title: "Бейся сердце, время биться", artist: "Сироткин" },

  // -- RAP / NIGHT DRIVE / CONFIDENCE -------------------------------------
  { title: "Космос (feat. Charusha)", artist: "Skryptonite" },
  { title: "Сансара (feat. Диана Арбенина, Александр Ф. Скляр, Сергей Бобунец, Sunsay, Скриптонит & Ант)", artist: "Basta" },
  { title: "Выпускной (Медлячок)", artist: "Basta" },
  { title: "Медуза", artist: "MATRANG" },
  { title: "Птичка", artist: "HammAli & Navai" },
  { title: "Пустите меня на танцпол", artist: "HammAli & Navai" },
  { title: "Горы по колено", artist: "Max Korzh" },

  // -- POP / PARTY / GLAM DRAMA -------------------------------------------
  { title: "Никаких больше вечеринок", artist: "Cream Soda" },
  { title: "Плачу на техно", artist: "CREAM SODA & Khleb" },
  { title: "18 мне уже", artist: "Ruki Vverkh" },
  { title: "Нас не догонят", artist: "t.A.T.u." },
  { title: "Я сошла с ума", artist: "t.A.T.u." },
  { title: "Прованс", artist: "Elka" },
  { title: "Около тебя", artist: "Elka" },
  { title: "Грустный дэнс", artist: "Artik & Asti" },
  { title: "Неделимы", artist: "Artik & Asti" },
  { title: "Туманы", artist: "Max Barskih" },
  { title: "Beverly Hills", artist: "Zivert" },
  { title: "Credo", artist: "Zivert" },
  { title: "Попытка № 5", artist: "VIA Gra" },
  { title: "Беги от меня", artist: "Gosti Iz Budushchego" },

  // -- RETRO POP / RADIO FAVORITES ----------------------------------------
  { title: "Районы-кварталы", artist: "Zveri" },
  { title: "До скорой встречи", artist: "Zveri" },
  { title: "Знаешь ли ты", artist: "MakSim" },
  { title: "Отпускаю", artist: "MakSim" },
  { title: "Улетаю", artist: "A'Studio" },
  { title: "Ева", artist: "Vintazh & Red Max" },
  { title: "Плохая девочка (feat. Елена Корикова)", artist: "Vintazh" },
  { title: "Режиссер", artist: "Gradusy" },
  { title: "Голая", artist: "Gradusy" },
  { title: "Самый дорогой человек", artist: "Nervy" },
  { title: "Батареи", artist: "Nervy" },
  { title: "Оружие", artist: "Pizza" },
  { title: "Улыбка", artist: "Pizza" },
  { title: "Мало тебя", artist: "Serebro" },
  { title: "Тополиный пух", artist: "Ivanushki International" },
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
  console.log(`\nVibeSong More Russian Cool Tracks Seeder`);
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
