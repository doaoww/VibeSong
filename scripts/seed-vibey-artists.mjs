/**
 * VibeSong "vibey artists" seeder — deep cuts for curator-picked indie/dreamy
 * artists (list supplied by product owner: closest-vibe core, night vibe,
 * female dreamy indie, "Pinterest core", cinematic/expensive sound, plus an
 * explicit top-10 list). Checked against the live catalog first — artists
 * already well covered (The Neighbourhood, Arctic Monkeys, Lana Del Rey,
 * Daughter) are skipped; this batch fills the ones that were thin or absent.
 * Run while dev server is live:
 *   npm run dev          (terminal 1)
 *   node scripts/seed-vibey-artists.mjs   (terminal 2)
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_SECRET = "vibesong-admin-2026";

const SONGS = [
  // ── The Marías ───────────────────────────────────────────────────────────
  { title: "No One Noticed", artist: "The Marías" },
  { title: "Un Millón", artist: "The Marías" },
  { title: "Heavy", artist: "The Marías" },
  { title: "Little by Little", artist: "The Marías" },

  // ── Cigarettes After Sex ─────────────────────────────────────────────────
  { title: "K.", artist: "Cigarettes After Sex" },
  { title: "Crush", artist: "Cigarettes After Sex" },
  { title: "Heavenly", artist: "Cigarettes After Sex" },
  { title: "Christian Girls", artist: "Cigarettes After Sex" },

  // ── Men I Trust ──────────────────────────────────────────────────────────
  { title: "Tailwhip", artist: "Men I Trust" },
  { title: "All Night", artist: "Men I Trust" },
  { title: "Say, Can You Hear", artist: "Men I Trust" },
  { title: "I Hope to Be Around", artist: "Men I Trust" },

  // ── Mild Orange ──────────────────────────────────────────────────────────
  { title: "Some Feeling", artist: "Mild Orange" },
  { title: "Foreign Life", artist: "Mild Orange" },
  { title: "Falling Water", artist: "Mild Orange" },
  { title: "Danger!", artist: "Mild Orange" },

  // ── Crumb ────────────────────────────────────────────────────────────────
  { title: "BNR", artist: "Crumb" },
  { title: "Trophy", artist: "Crumb" },
  { title: "Part III", artist: "Crumb" },
  { title: "Fall Down", artist: "Crumb" },

  // ── Still Woozy ──────────────────────────────────────────────────────────
  { title: "Goodie Bag", artist: "Still Woozy" },
  { title: "Habit", artist: "Still Woozy" },
  { title: "Window", artist: "Still Woozy" },
  { title: "Lucy", artist: "Still Woozy" },

  // ── Vacations ────────────────────────────────────────────────────────────
  { title: "Telepathy", artist: "Vacations" },
  { title: "Nightwalk", artist: "Vacations" },
  { title: "Waiting on Something", artist: "Vacations" },

  // ── Chase Atlantic ───────────────────────────────────────────────────────
  { title: "Swim", artist: "Chase Atlantic" },
  { title: "Friends", artist: "Chase Atlantic" },
  { title: "Slidin'", artist: "Chase Atlantic" },
  { title: "Numb to the Feeling", artist: "Chase Atlantic" },

  // ── DPR IAN ──────────────────────────────────────────────────────────────
  { title: "Do Better", artist: "DPR IAN" },
  { title: "Sooner", artist: "DPR IAN" },
  { title: "Cheese & Wine", artist: "DPR IAN" },
  { title: "Bittersweet", artist: "DPR IAN" },

  // ── Joji ─────────────────────────────────────────────────────────────────
  { title: "Glimpse of Us", artist: "Joji" },
  { title: "Slow Dancing in the Dark", artist: "Joji" },
  { title: "SANCTUARY", artist: "Joji" },
  { title: "Yeah Right", artist: "Joji" },

  // ── KESHI ────────────────────────────────────────────────────────────────
  { title: "Like I Need U", artist: "Keshi" },
  { title: "Blue", artist: "Keshi" },
  { title: "Beside You", artist: "Keshi" },
  { title: "Right Here", artist: "Keshi" },

  // ── Daniel Caesar ────────────────────────────────────────────────────────
  { title: "Japanese Denim", artist: "Daniel Caesar" },
  { title: "Valentina", artist: "Daniel Caesar" },
  { title: "Xtina", artist: "Daniel Caesar" },

  // ── Brent Faiyaz ─────────────────────────────────────────────────────────
  { title: "Rehab (Winter in Paris)", artist: "Brent Faiyaz" },
  { title: "Trust", artist: "Brent Faiyaz" },
  { title: "Dead Man Walking", artist: "Brent Faiyaz" },
  { title: "All Mine", artist: "Brent Faiyaz" },

  // ── 070 Shake ────────────────────────────────────────────────────────────
  { title: "Guilty Conscience", artist: "070 Shake" },
  { title: "Nice to Have", artist: "070 Shake" },
  { title: "Come Around", artist: "070 Shake" },

  // ── RINI ─────────────────────────────────────────────────────────────────
  { title: "Painkiller", artist: "RINI" },
  { title: "Summer Skin", artist: "RINI" },
  { title: "GO!", artist: "RINI" },

  // ── Faye Webster ─────────────────────────────────────────────────────────
  { title: "Right Side of My Neck", artist: "Faye Webster" },
  { title: "In a Good Way", artist: "Faye Webster" },
  { title: "A Dream With a Baseball Player", artist: "Faye Webster" },

  // ── Luna Li ──────────────────────────────────────────────────────────────
  { title: "Alone but Not Lonely", artist: "Luna Li" },
  { title: "Star Feels", artist: "Luna Li" },
  { title: "In My Head", artist: "Luna Li" },

  // ── Japanese Breakfast ───────────────────────────────────────────────────
  { title: "Be Sweet", artist: "Japanese Breakfast" },
  { title: "Kokomo, IN", artist: "Japanese Breakfast" },
  { title: "Paprika", artist: "Japanese Breakfast" },

  // ── Suki Waterhouse ──────────────────────────────────────────────────────
  { title: "Moves", artist: "Suki Waterhouse" },
  { title: "Good Looking", artist: "Suki Waterhouse" },
  { title: "To Love", artist: "Suki Waterhouse" },

  // ── Biig Piig ────────────────────────────────────────────────────────────
  { title: "Feels Right", artist: "Biig Piig" },
  { title: "This Is What They Meant", artist: "Biig Piig" },

  // ── Steve Lacy ───────────────────────────────────────────────────────────
  { title: "Buttons", artist: "Steve Lacy" },
  { title: "Helmet", artist: "Steve Lacy" },

  // ── Rex Orange County ────────────────────────────────────────────────────
  { title: "Best Friend", artist: "Rex Orange County" },
  { title: "Sunflower", artist: "Rex Orange County" },
  { title: "Corduroy Dreams", artist: "Rex Orange County" },

  // ── Wallows ──────────────────────────────────────────────────────────────
  { title: "Are You Bored Yet?", artist: "Wallows" },
  { title: "Pictures of Girls", artist: "Wallows" },
  { title: "Hard to Believe", artist: "Wallows" },
  { title: "Uncomfortable", artist: "Wallows" },

  // ── Dayglow ──────────────────────────────────────────────────────────────
  { title: "Can I Call You Tonight?", artist: "Dayglow" },
  { title: "Close to You", artist: "Dayglow" },
  { title: "Woke Up", artist: "Dayglow" },

  // ── Current Joys ─────────────────────────────────────────────────────────
  { title: "A Fire in Which I Burn", artist: "Current Joys" },
  { title: "Days I Wanna Die", artist: "Current Joys" },
  { title: "Tokyo", artist: "Current Joys" },

  // ── Mac DeMarco ──────────────────────────────────────────────────────────
  { title: "Freaking Out the Neighborhood", artist: "Mac DeMarco" },
  { title: "Ode to Viceroy", artist: "Mac DeMarco" },

  // ── Her's ────────────────────────────────────────────────────────────────
  { title: "What Once Was", artist: "Her's" },
  { title: "Cool With You (Weird Together)", artist: "Her's" },

  // ── Eyedress ─────────────────────────────────────────────────────────────
  { title: "Jealous", artist: "Eyedress" },
  { title: "Something About You", artist: "Eyedress" },

  // ── BANKS ────────────────────────────────────────────────────────────────
  { title: "Gimme", artist: "BANKS" },
  { title: "Beggin for Thread", artist: "BANKS" },
  { title: "This Is What It Feels Like", artist: "BANKS" },

  // ── Rhye ─────────────────────────────────────────────────────────────────
  { title: "Open", artist: "Rhye" },
  { title: "The Fall", artist: "Rhye" },
  { title: "Please", artist: "Rhye" },

  // ── London Grammar ───────────────────────────────────────────────────────
  { title: "Strong", artist: "London Grammar" },
  { title: "Hey Now", artist: "London Grammar" },
  { title: "Non Believer", artist: "London Grammar" },

  // ── The xx ───────────────────────────────────────────────────────────────
  { title: "Intro", artist: "The xx" },
  { title: "Angels", artist: "The xx" },
  { title: "Islands", artist: "The xx" },
  { title: "Crystalised", artist: "The xx" },
  { title: "On Hold", artist: "The xx" },
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
  console.log(`\nVibeSong "Vibey Artists" Seeder`);
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
