/**
 * Backfills music_supervisor_summary/brief_embedding for songs that don't
 * have one yet. Does NOT re-run the full autoTagSong() pipeline — it only
 * generates the music-supervisor brief via generateMusicSupervisorBrief()
 * (lib/autoTag.ts), which is a narrower GPT call than full tagging.
 *
 * Run against everything missing brief_embedding:
 *   node scripts/backfill-music-supervisor-briefs.mjs
 *
 * Run against a curated subset only (Retrieval v3 spec's Layer 6 Stage A
 * pilot — pass a comma-separated list of song ids):
 *   node scripts/backfill-music-supervisor-briefs.mjs --ids=id1,id2,id3
 */
import dns from "node:dns";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createClient } from "@supabase/supabase-js";

dns.setDefaultResultOrder("ipv4first");

// Plain `import("../lib/autoTag.ts")` fails under Node's ESM resolver: the
// lib/*.ts files use extensionless relative imports (e.g. `from "./openai"`),
// which is valid under this project's tsconfig/Next.js bundler resolution
// but not under Node's native ESM loader (ERR_MODULE_NOT_FOUND). Mirroring
// scripts/backfill-story-context-tags.mjs's approach: transpile TS to CJS
// on the fly and resolve extensionless specifiers ourselves.
const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const moduleCache = new Map();

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

const { generateMusicSupervisorBrief } = loadTsModule(resolve(projectRoot, "lib/autoTag.ts"));

const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const requestedIds = idsArg ? idsArg.slice("--ids=".length).split(",").map((s) => s.trim()).filter(Boolean) : null;

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

// NOTE: list_catalog's RETURNS TABLE doesn't project music_supervisor_summary/
// brief_embedding, so this default (no --ids) filter currently can't see prior
// backfill progress and treats every song as missing on every run -- not
// idempotent. Only the --ids= mode (used for the Phase-1 spot-check) is
// unaffected. Fix before running this in default mode against the full
// catalog: extend list_catalog to project (at minimum) a boolean
// has_brief_embedding column, applied via a manual Supabase SQL migration.
const missing = requestedIds
  ? all.filter((s) => requestedIds.includes(s.id))
  : all.filter((s) => !s.music_supervisor_summary || !s.brief_embedding);

console.log(
  requestedIds
    ? `Backfilling ${missing.length} of ${requestedIds.length} requested songs...`
    : `${missing.length} of ${all.length} songs missing music_supervisor_summary/brief_embedding — backfilling...`
);

let done = 0;
for (const song of missing) {
  try {
    const { summary, embedding } = await generateMusicSupervisorBrief(song.title, song.artist);
    if (!embedding.length) {
      console.error(`SKIPPED (empty embedding): ${song.title} — ${song.artist}`);
      continue;
    }
    const { error } = await supabase.rpc("update_song", {
      p_id: song.id,
      p_music_supervisor_summary: summary,
      p_brief_embedding: `[${embedding.join(",")}]`,
    });
    if (error) throw new Error(error.message);
    done++;
    console.log(`[${done}/${missing.length}] ${song.title} — ${song.artist}: ${summary.slice(0, 80)}...`);
  } catch (err) {
    console.error(`FAILED: ${song.title} — ${song.artist}:`, err instanceof Error ? err.message : err);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
console.log(`Backfill complete: ${done}/${missing.length} updated.`);
