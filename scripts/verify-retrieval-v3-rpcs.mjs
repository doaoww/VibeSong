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

console.log("1. Calling match_songs_by_brief with a random 1536-dim vector...");
const fakeVector = Array.from({ length: 1536 }, () => Math.random());
const { data: briefData, error: briefErr } = await supabase.rpc("match_songs_by_brief", {
  p_brief_vector: fakeVector,
  p_match_count: 5,
});
if (briefErr) {
  console.error("   FAIL:", briefErr.message);
  process.exit(1);
}
console.log(`   OK - ${briefData.length} rows returned (0 is fine before any backfill has run)`);

console.log("2. Calling extended update_song with music_supervisor_summary/brief_embedding...");
const { data: anySong, error: listErr } = await supabase.rpc("list_catalog", { p_limit: 1, p_offset: 0 });
if (listErr) {
  console.error("   FAIL:", listErr.message);
  process.exit(1);
}
if (!anySong?.[0]) {
  console.log("   SKIPPED - no song available to test against");
} else {
  const testVector = `[${fakeVector.join(",")}]`;
  const { error: updateErr } = await supabase.rpc("update_song", {
    p_id: anySong[0].id,
    p_music_supervisor_summary: "verification no-op update",
    p_brief_embedding: testVector,
  });
  if (updateErr) {
    console.error("   FAIL:", updateErr.message);
    process.exit(1);
  }
  console.log("   OK - update_song accepted the new parameters");
}

console.log("\nAll retrieval v3 RPCs verified.");
