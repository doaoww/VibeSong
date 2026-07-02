/**
 * Backfills story_context_tags/vibe_summary on catalog songs tagged before
 * those columns existed (~327 of 600 as of 2026-07-02). Re-runs the existing
 * autoTagSong() pipeline and writes the result via the extended update_song
 * RPC (Task 6/7). It does not touch song IDs or any other existing data.
 *
 * Run: node scripts/backfill-story-context-tags.mjs
 */
import dns from "node:dns";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createClient } from "@supabase/supabase-js";

dns.setDefaultResultOrder("ipv4first");

const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const moduleCache = new Map();

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

const supabase = createClient(env.SUPABASE_CATALOG_URL, env.SUPABASE_CATALOG_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log(`Backfill PID: ${process.pid}`);

function resolveLocalModule(fromDir, specifier) {
  const resolved = resolve(fromDir, specifier);
  const candidates = extname(resolved)
    ? [resolved]
    : [`${resolved}.ts`, `${resolved}.js`, resolve(resolved, "index.ts"), resolve(resolved, "index.js")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return resolved;
}

function loadTsModule(path) {
  const resolvedPath = resolve(path);
  const cached = moduleCache.get(resolvedPath);
  if (cached) return cached.exports;

  const source = readFileSync(resolvedPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  moduleCache.set(resolvedPath, cjsModule);

  function localRequire(id) {
    if (id.startsWith(".")) {
      return loadTsModule(resolveLocalModule(dirname(resolvedPath), id));
    }
    return baseRequire(id);
  }

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: localRequire,
    console,
    process,
    URL,
    URLSearchParams,
    AbortSignal,
    fetch,
    Array,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(output, context, { filename: resolvedPath });
  return cjsModule.exports;
}

const { autoTagSong } = loadTsModule(resolve(projectRoot, "lib/autoTag.ts"));

let all = [];
let offset = 0;
while (true) {
  const { data, error } = await supabase.rpc("list_catalog", { p_limit: 500, p_offset: offset });
  if (error) {
    console.error("list_catalog failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  all = all.concat(data);
  offset += 500;
  if (data.length < 500) break;
}

const missing = all.filter((s) => (s.story_context_tags ?? []).length === 0);
console.log(`${missing.length} of ${all.length} songs missing story_context_tags - backfilling...`);

let done = 0;
for (const song of missing) {
  try {
    const tagged = await autoTagSong(song.title, song.artist);
    const { error } = await supabase.rpc("update_song", {
      p_id:                    song.id,
      p_language:              song.language ?? null,
      p_popularity_tier:       song.popularity_tier ?? null,
      p_genre_tags:            song.genre_tags ?? null,
      p_aesthetic_tags:        song.aesthetic_tags ?? null,
      p_mood_tags:             song.mood_tags ?? null,
      p_story_intent_tags:     song.story_intent_tags ?? null,
      p_modern_aesthetic_tags: song.modern_aesthetic_tags ?? null,
      p_story_context_tags:    tagged.story_context_tags,
      p_vibe_summary:          tagged.vibe_summary,
      p_approve:               false,
    });
    if (error) throw new Error(error.message);
    done++;
    console.log(
      `[${done}/${missing.length}] ${song.title} - ${song.artist}: ${
        tagged.story_context_tags.join(", ") || "(none)"
      }`
    );
  } catch (err) {
    console.error(`FAILED: ${song.title} - ${song.artist}:`, err instanceof Error ? err.message : err);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

console.log(`Backfill complete: ${done}/${missing.length} updated.`);
