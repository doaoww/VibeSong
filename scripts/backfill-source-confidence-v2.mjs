/**
 * Recomputes source_confidence/final_confidence/needs_review for existing
 * catalog rows using the corrected computeSourceConfidence weights
 * (lib/autoTag.ts: itunes_exact 0.4->0.5, itunes_fallback 0.2->0.25).
 *
 * Why this is needed: the old weights made source_confidence structurally
 * incapable of clearing 0.6 for almost any song without a lastfm_tags hit,
 * and Last.fm has near-zero coverage of this catalog's Russian/Kazakh songs
 * (measured 0/62 and 0/9) - so those songs were flagged needs_review (a
 * blanket -12 ranking penalty in lib/recommend.ts) regardless of how
 * confidently GPT identified them. This script re-derives the two numeric
 * fields directly from each row's already-stored evidence_sources +
 * gpt_confidence - no re-tagging, no new API calls.
 *
 * Skips:
 *  - rows with tag_source 'manual' / 'auto_plus_manual' - an admin already
 *    made a deliberate call on these; recomputing from evidence_sources
 *    could silently override that judgment.
 *  - rows with gpt_confidence === null - these predate the confidence
 *    system entirely (all tagging_version "v1", final_confidence already
 *    null, needs_review already false) and there's no gpt_confidence to
 *    combine with a recomputed source_confidence.
 *
 * Run: node scripts/backfill-source-confidence-v2.mjs
 * Add --dry-run to only print the diff without writing.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const env = loadEnvLocal();
const supabase = createClient(env.SUPABASE_CATALOG_URL, env.SUPABASE_CATALOG_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DRY_RUN = process.argv.includes("--dry-run");

// Mirrors the corrected weights in lib/autoTag.ts::computeSourceConfidence.
function recomputeSourceConfidence(evidenceSources) {
  const set = new Set(evidenceSources ?? []);
  let score = 0;
  if (set.has("itunes_exact")) score += 0.5;
  else if (set.has("itunes_fallback")) score += 0.25;
  if (set.has("lastfm_tags")) score += 0.3;
  if (set.has("metadata_complete")) score += 0.15;
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}

async function fetchAllSongs() {
  const pageSize = 500;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, title, artist, language, tag_source, evidence_sources, gpt_confidence, source_confidence, final_confidence, needs_review")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const songs = await fetchAllSongs();
console.log(`Loaded ${songs.length} songs.`);

let skippedManual = 0;
let skippedNoGpt = 0;
let unchanged = 0;
let updated = 0;
const flips = { toReview: 0, toClear: 0 };
const byLanguage = {};

for (const song of songs) {
  if (song.tag_source === "manual" || song.tag_source === "auto_plus_manual") {
    skippedManual++;
    continue;
  }
  if (song.gpt_confidence === null || song.gpt_confidence === undefined) {
    skippedNoGpt++;
    continue;
  }

  const newSource = recomputeSourceConfidence(song.evidence_sources);
  const newFinal = Math.round(Math.min(song.gpt_confidence, newSource) * 100) / 100;
  const newNeedsReview = newFinal < 0.6;

  const changed =
    newSource !== song.source_confidence ||
    newFinal !== song.final_confidence ||
    newNeedsReview !== song.needs_review;

  if (!changed) {
    unchanged++;
    continue;
  }

  if (song.needs_review && !newNeedsReview) flips.toClear++;
  if (!song.needs_review && newNeedsReview) flips.toReview++;
  byLanguage[song.language] = (byLanguage[song.language] ?? 0) + 1;

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}${song.title} - ${song.artist} (${song.language}): ` +
      `source ${song.source_confidence} -> ${newSource}, final ${song.final_confidence} -> ${newFinal}, ` +
      `needs_review ${song.needs_review} -> ${newNeedsReview}`
  );

  if (!DRY_RUN) {
    const { error } = await supabase
      .from("songs")
      .update({ source_confidence: newSource, final_confidence: newFinal, needs_review: newNeedsReview })
      .eq("id", song.id);
    if (error) {
      console.error(`  FAILED to update ${song.id}: ${error.message}`);
      continue;
    }
  }
  updated++;
}

console.log("\n--- Summary ---");
console.log(`Total songs:            ${songs.length}`);
console.log(`Skipped (manual review): ${skippedManual}`);
console.log(`Skipped (no gpt_confidence, pre-v1 rows): ${skippedNoGpt}`);
console.log(`Unchanged:              ${unchanged}`);
console.log(`${DRY_RUN ? "Would update" : "Updated"}:            ${updated}`);
console.log(`  needs_review true -> false: ${flips.toClear}`);
console.log(`  needs_review false -> true: ${flips.toReview}`);
console.log(`Changed rows by language: ${JSON.stringify(byLanguage)}`);
