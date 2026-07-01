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
const url = env.SUPABASE_CATALOG_URL;
const key = env.SUPABASE_CATALOG_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_CATALOG_URL / SUPABASE_CATALOG_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Step 1: raw HTTP ping — checks if the host is reachable at all
console.log("1. Raw HTTP ping to Supabase host...");
try {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.log("   OK  HTTP status:", res.status);
} catch (e) {
  console.error("   FAIL network error:", e.message);
  console.log("\n   --> Cannot reach Supabase at all. Possible causes:");
  console.log("       - Supabase platform outage (check status.supabase.com)");
  console.log("       - Firewall / VPN blocking the connection");
  console.log("       - Wrong SUPABASE_URL");
  process.exit(1);
}

// Step 2: RPC list_catalog
const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log("2. Calling list_catalog RPC...");
const { data: ping, error: pingErr } = await supabase.rpc("list_catalog", { p_limit: 1, p_offset: 0 });
if (pingErr) {
  console.error("   FAIL:", pingErr.message, pingErr.code ?? "");
  console.log("\n   --> RPC exists in DB but PostgREST can't see it yet.");
  console.log("       Run in SQL Editor:  NOTIFY pgrst, 'reload schema';");
  process.exit(1);
}
console.log("   OK  list_catalog works, rows:", ping?.length ?? 0);

// Step 3: create_song RPC
console.log("3. Calling create_song RPC...");
const testVector = "[0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5]";
const { data: newId, error: insertErr } = await supabase.rpc("create_song", {
  p_title: "__test__",
  p_artist: "__test__",
  p_album: null,
  p_year: null,
  p_duration_seconds: null,
  p_language: "English",
  p_popularity_tier: 3,
  p_emotional_vector: testVector,
  p_energy: 0.5,
  p_genre_tags: [],
  p_aesthetic_tags: [],
  p_mood_tags: [],
  p_story_intent_tags: [],
  p_modern_aesthetic_tags: [],
  p_itunes_preview_url: null,
  p_artwork_url: null,
  p_apple_music_url: null,
  p_youtube_id: null,
});

if (insertErr) {
  console.error("   FAIL:", insertErr.message, insertErr.code ?? "");
} else {
  console.log("   OK  create_song works, new id:", newId);
  await supabase.rpc("delete_song", { p_id: newId });
  console.log("   Cleaned up test row.");
  console.log("\nAll good! The admin panel should work now.");
}
