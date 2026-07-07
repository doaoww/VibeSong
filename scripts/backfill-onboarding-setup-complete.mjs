/**
 * One-time backfill for the bug fixed in SongSwipeOnboarding.tsx (finish()
 * used to skip POST /api/seed-feedback — the only call that flips
 * user_taste.setup_complete to true — whenever a user finished onboarding
 * with 0 swipes, e.g. seed-tracks returned an empty catalog for their
 * language/artist picks, or the request failed).
 *
 * Those accounts are stuck with setup_complete=false in the DB forever,
 * masked only by a local "onboardingDone" flag — so any new device, cleared
 * storage, or in-app browser (Instagram/TikTok) sends them through the
 * auth gate + full onboarding again.
 *
 * This finds user_taste rows with setup_complete=false that already show
 * real progress (non-default language/artist/avoid-list data — only
 * reachable after finishing onboarding steps 1-3) and flips them to true.
 * Rows with no such data are left untouched — those users genuinely
 * abandoned onboarding early and should still see it next time.
 *
 * Dry run (default): node scripts/backfill-onboarding-setup-complete.mjs
 * Apply for real:     node scripts/backfill-onboarding-setup-complete.mjs --apply
 */
import dns from "node:dns";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

dns.setDefaultResultOrder("ipv4first");

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
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const apply = process.argv.includes("--apply");

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase
  .from("user_taste")
  .select("user_id, favorite_artists, languages, genre_scores, avoided_story_tags, favorite_story_songs")
  .eq("setup_complete", false);

if (error) {
  console.error("Failed to query user_taste:", error.message);
  process.exit(1);
}

const hasProgress = (row) =>
  (row.favorite_artists?.length ?? 0) > 0 ||
  (row.languages?.length ?? 0) > 0 ||
  Object.keys(row.genre_scores ?? {}).length > 0 ||
  (row.avoided_story_tags?.length ?? 0) > 0 ||
  (row.favorite_story_songs?.length ?? 0) > 0;

const stuck = (data ?? []).filter(hasProgress);

console.log(`${data?.length ?? 0} rows with setup_complete=false, ${stuck.length} show real onboarding progress.`);

if (stuck.length === 0) {
  console.log("Nothing to backfill.");
  process.exit(0);
}

for (const row of stuck) {
  console.log(`  ${row.user_id} — artists:${row.favorite_artists?.length ?? 0} langs:${row.languages?.length ?? 0} genreScores:${Object.keys(row.genre_scores ?? {}).length} avoidTags:${row.avoided_story_tags?.length ?? 0}`);
}

if (!apply) {
  console.log("\nDry run only — re-run with --apply to update these rows.");
  process.exit(0);
}

const { error: updateError, count } = await supabase
  .from("user_taste")
  .update({ setup_complete: true, updated_at: new Date().toISOString() }, { count: "exact" })
  .in("user_id", stuck.map((r) => r.user_id))
  .eq("setup_complete", false);

if (updateError) {
  console.error("Update failed:", updateError.message);
  process.exit(1);
}

console.log(`Updated ${count ?? stuck.length} row(s).`);
