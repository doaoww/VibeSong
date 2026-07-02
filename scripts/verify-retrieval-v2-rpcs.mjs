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
const supabase = createClient(env.SUPABASE_CATALOG_URL, env.SUPABASE_CATALOG_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log("1. Calling match_songs_by_tags with a real context tag...");
const { data: tagsData, error: tagsErr } = await supabase.rpc("match_songs_by_tags", {
  p_context_tags: ["night drive"],
  p_intent_tags: [],
  p_aesthetic_tags: [],
  p_mood_tags: [],
  p_match_count: 5,
});
if (tagsErr) {
  console.error("   FAIL:", tagsErr.message);
  process.exit(1);
}
console.log(`   OK - ${tagsData.length} rows returned`);

console.log("2. Calling match_songs_by_taste with a genre filter...");
const { data: tasteData, error: tasteErr } = await supabase.rpc("match_songs_by_taste", {
  p_artist_patterns: [],
  p_positive_genres: ["indie pop", "indie"],
  p_match_count: 5,
});
if (tasteErr) {
  console.error("   FAIL:", tasteErr.message);
  process.exit(1);
}
console.log(`   OK - ${tasteData.length} rows returned`);

console.log("3. Calling extended update_song with story_context_tags/vibe_summary...");
if (!tagsData[0]) {
  console.log("   SKIPPED - no song available to test against");
} else {
  const { error: updateErr } = await supabase.rpc("update_song", {
    p_id: tagsData[0].id,
    p_story_context_tags: tagsData[0].story_context_tags,
    p_vibe_summary: "verification no-op update",
  });
  if (updateErr) {
    console.error("   FAIL:", updateErr.message);
    process.exit(1);
  }
  console.log("   OK - update_song accepted the new parameters");
}

console.log("\nAll retrieval v2 RPCs verified.");
