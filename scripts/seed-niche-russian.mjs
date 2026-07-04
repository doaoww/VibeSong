/**
 * VibeSong niche Russian/CIS scene seeder — underground indie/alt artists
 * in the vein of ZOLOTO's "непроизошло" (melancholic, lyrical, lo-fi rock-pop).
 * Track titles verified via web search, not guessed.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-niche-russian.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // ── ZOLOTO ───────────────────────────────────────────────────────────────
  { title: "непроизошло", artist: "ZOLOTO" },
  { title: "Улицы ждали", artist: "ZOLOTO" },
  { title: "Грустно на афтепати", artist: "ZOLOTO" },

  // ── Три дня дождя ────────────────────────────────────────────────────────
  { title: "Прощание", artist: "Три дня дождя" },
  { title: "Отпускай", artist: "Три дня дождя" },

  // ── CREAM SODA ───────────────────────────────────────────────────────────
  { title: "Не выдумывай", artist: "CREAM SODA" },

  // ── Буерак ───────────────────────────────────────────────────────────────
  { title: "Страсть к курению", artist: "Буерак" },
  { title: "Неважно", artist: "Буерак" },

  // ── IOWA ─────────────────────────────────────────────────────────────────
  { title: "Улыбайся", artist: "IOWA" },
  { title: "Маршрутка", artist: "IOWA" },
  { title: "Простая песня", artist: "IOWA" },
  { title: "Мне хорошо одной, и в этом вся суть", artist: "IOWA" },

  // ── Хадн Дадн ────────────────────────────────────────────────────────────
  { title: "Мы сегодня дома", artist: "Хадн Дадн" },

  // ── Пошлая Молли ─────────────────────────────────────────────────────────
  { title: "Нон Стоп", artist: "Пошлая Молли" },

  // ── SALUKI ───────────────────────────────────────────────────────────────
  { title: "Понт", artist: "SALUKI" },

  // ── MAYOT ────────────────────────────────────────────────────────────────
  { title: "Наши фотки", artist: "MAYOT, LOVV66" },
  { title: "до сих пор", artist: "MAYOT" },
  { title: "ОБА", artist: "MAYOT" },

  // ── Pyrokinesis ──────────────────────────────────────────────────────────
  { title: "Танцуй, полумесяц", artist: "Pyrokinesis" },
  { title: "Дедлайны", artist: "Pyrokinesis" },
  { title: "Культура", artist: "Pyrokinesis" },

  // ── Нервы ────────────────────────────────────────────────────────────────
  { title: "Кофе мой друг", artist: "Нервы" },
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
  console.log(`\nVibeSong Niche Russian Scene Seeder`);
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
