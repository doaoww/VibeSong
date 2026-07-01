/**
 * VibeSong recognizable Stories seeder.
 *
 * Run while the dev server is live:
 *   npm run dev
 *   npm run seed:stories
 *
 * Optional:
 *   npm run seed:stories -- --dry-run
 *   BASE_URL=http://localhost:3001 npm run seed:stories
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SONGS = [
  { title: "Do For Love", artist: "2Pac" },
  { title: "CUFF IT", artist: "Beyonce" },
  { title: "Style", artist: "Taylor Swift" },
  { title: "Pink + White", artist: "Frank Ocean" },
  { title: "Sweater Weather", artist: "The Neighbourhood" },
  { title: "Flashing Lights", artist: "Kanye West" },
  { title: "Summertime Sadness", artist: "Lana Del Rey" },
  { title: "I Wanna Be Yours", artist: "Arctic Monkeys" },
  { title: "Good Days", artist: "SZA" },
  { title: "Starboy", artist: "The Weeknd" },
  { title: "Money Trees", artist: "Kendrick Lamar" },
  { title: "Passionfruit", artist: "Drake" },
  { title: "Needed Me", artist: "Rihanna" },
  { title: "goosebumps", artist: "Travis Scott" },
  { title: "See You Again", artist: "Tyler, The Creator" },
  { title: "Self Care", artist: "Mac Miller" },
  { title: "Ribs", artist: "Lorde" },
  { title: "L$D", artist: "A$AP Rocky" },
  { title: "ocean eyes", artist: "Billie Eilish" },
  { title: "Apocalypse", artist: "Cigarettes After Sex" },
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function normalize(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function songKey(song) {
  return `${normalize(song.artist)}::${normalize(song.title)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingCreateSongRpc(reason) {
  return (
    reason.includes("Could not find the function public.create_song") ||
    reason.includes("schema cache")
  );
}

function readArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
    delayMs: Number(process.env.SEED_DELAY_MS || 1800),
  };
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function addSong({ baseUrl, adminSecret, song, index, total }) {
  const { res, data } = await fetchJson(`${baseUrl}/api/admin/songs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": adminSecret,
    },
    body: JSON.stringify(song),
  });

  if (!res.ok) {
    const reason = data.error || `${res.status} ${res.statusText}`;
    if (isMissingCreateSongRpc(reason)) {
      throw new Error(
        "Supabase is missing the updated create_song RPC. Apply supabase/songs-schema.sql and supabase/songs-rpc.sql in the Supabase SQL editor, then rerun this seed."
      );
    }
    console.error(`[${index}/${total}] FAIL ${song.artist} - ${song.title}: ${reason}`);
    return false;
  }

  const tagged = data.song || {};
  const confidence =
    typeof tagged.final_confidence === "number" ? tagged.final_confidence.toFixed(2) : "n/a";
  const review = tagged.needs_review ? "needs review" : "ok";
  const tags = (tagged.story_intent_tags || []).slice(0, 2).join(", ");
  console.log(
    `[${index}/${total}] OK ${song.artist} - ${song.title} | confidence ${confidence} | ${review}${tags ? ` | ${tags}` : ""}`
  );
  return true;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const { dryRun, delayMs } = readArgs();
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const adminSecret =
    process.env.ADMIN_SECRET ||
    process.env.NEXT_PUBLIC_ADMIN_SECRET ||
    "vibesong-admin-2026";

  console.log("\nVibeSong Recognizable Stories Seeder");
  console.log(`Songs: ${SONGS.length}`);
  console.log(`Target: ${baseUrl}`);

  if (dryRun) {
    for (const [index, song] of SONGS.entries()) {
      console.log(`[${index + 1}/${SONGS.length}] ${song.artist} - ${song.title}`);
    }
    return;
  }

  const { res: ping, data: catalog } = await fetchJson(`${baseUrl}/api/admin/songs`, {
    headers: { "x-admin-secret": adminSecret },
  });

  if (!ping.ok) {
    const reason = catalog.error || `${ping.status} ${ping.statusText}`;
    throw new Error(`Cannot reach admin catalog at ${baseUrl}: ${reason}`);
  }

  const existingSongs = Array.isArray(catalog.songs) ? catalog.songs : [];
  const existing = new Set(existingSongs.map(songKey));
  const pending = SONGS.filter((song) => !existing.has(songKey(song)));

  console.log(`Existing catalog songs: ${existingSongs.length}`);
  console.log(`Already present: ${SONGS.length - pending.length}`);
  console.log(`To add: ${pending.length}\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < pending.length; i++) {
    const started = Date.now();
    const success = await addSong({
      baseUrl,
      adminSecret,
      song: pending[i],
      index: i + 1,
      total: pending.length,
    });

    if (success) ok += 1;
    else fail += 1;

    const wait = Math.max(0, delayMs - (Date.now() - started));
    if (wait > 0 && i < pending.length - 1) await sleep(wait);
  }

  console.log(`\nDone. Added ${ok}, failed ${fail}, skipped ${SONGS.length - pending.length}.`);
  console.log(`Catalog: ${baseUrl}/admin`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
