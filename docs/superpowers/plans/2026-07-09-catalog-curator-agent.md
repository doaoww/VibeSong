# Catalog Curator Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an autonomous daily agent that discovers trending tracks from Apple's public charts and feeds them through the existing auto-tagging pipeline, so the catalog grows without anyone writing or running a manual `scripts/seed-*.mjs` file.

**Architecture:** A new `lib/curator.ts` module with two pure-ish functions — `fetchTrendingTracks` (Apple RSS candidate source) and `curateCatalog` (cap + dedupe + per-candidate error isolation, reusing `autoTagSong` / `findSongByTitleArtist` / `insertSong` unmodified) — wired into a new `GET /api/cron/curate-catalog` route, triggered once a day by Vercel Cron via a new `vercel.json`.

**Tech Stack:** Next.js App Router route handler (Node runtime), TypeScript, `node --test` with this repo's existing `typescript.transpileModule` + `vm` test-harness convention (see `tests/autoTag.test.mjs`, `tests/songs.test.mjs`) — no jest/vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-09-catalog-curator-agent-design.md` — approved, do not deviate without checking back with the user.
- Do not modify `lib/autoTag.ts` or `lib/db/songs.ts` — `curateCatalog` calls `autoTagSong`, `findSongByTitleArtist`, `insertSong` exactly as they exist today.
- Trending source URL: `https://rss.marketingtools.apple.com/api/v2/{countryCode}/music/most-played/50/songs.json` — verified live 2026-07-09. Do **not** use `rss.applemarketingtools.com` (it 301-redirects to this host).
- Countries: exactly `["us", "ru", "fr", "es", "gb"]`, in that order — order is the priority order candidates are spent against the cap.
- Cap: exactly `MAX_NEW_SONGS_PER_RUN = 15`.
- Throttle: exactly `AUTOTAG_MIN_INTERVAL_MS = 2000`, applied the same way `scripts/seed-catalog.mjs` throttles its runner (elapsed-time-aware wait floor, not a flat added delay) — only for candidates that actually reach `autoTagSong`.
- No approval queue — fully autonomous insertion, per the spec's Non-Goals.
- New route uses `export const runtime = "nodejs";`, matching every other AI/data route in `app/api/`.
- Auth: the cron route checks `Authorization: Bearer <CRON_SECRET>` (Vercel Cron's own convention) — distinct from `/api/admin/songs`'s `x-admin-secret` header. Do not conflate the two.
- Imports are relative (`../../../../lib/...` from a route two directories deeper than `app/api/`), matching `app/api/admin/songs/route.ts` — this codebase has no `@/` path alias.
- Test files load `.ts` lib modules via `typescript.transpileModule` into a `vm` context with a `stubRequire`, per the established pattern — no `ts-node`, no real network/Supabase/OpenAI calls in unit tests.

---

### Task 1: `fetchTrendingTracks` — Apple trending-chart fetcher

**Files:**
- Create: `lib/curator.ts`
- Create: `tests/curator.test.mjs`

**Interfaces:**
- Produces: `TRENDING_COUNTRIES: string[]`, `MAX_NEW_SONGS_PER_RUN: number`, `AUTOTAG_MIN_INTERVAL_MS: number`, `TrendingCandidate { title: string; artist: string }`, `fetchTrendingTracks(countryCode: string): Promise<TrendingCandidate[]>` — all consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `tests/curator.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const stubState = {
  fetchImpl: (..._args) => {
    throw new Error("fetch not stubbed for this test");
  },
};

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require,
    console,
    process,
    fetch: (...args) => stubState.fetchImpl(...args),
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const curator = loadTsModule("lib/curator.ts");

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, async json() { return data; } };
}

test("TRENDING_COUNTRIES matches the language spread used by existing seed scripts", () => {
  assert.deepEqual(curator.TRENDING_COUNTRIES, ["us", "ru", "fr", "es", "gb"]);
});

test("MAX_NEW_SONGS_PER_RUN caps daily GPT spend", () => {
  assert.equal(curator.MAX_NEW_SONGS_PER_RUN, 15);
});

test("fetchTrendingTracks maps Apple feed results into {title, artist} pairs", async () => {
  stubState.fetchImpl = async (url) => {
    assert.ok(url.includes("/us/music/most-played/"));
    return jsonResponse({
      feed: {
        results: [
          { name: "Janice STFU", artistName: "Drake" },
          { name: "Choosin' Texas", artistName: "Ella Langley" },
        ],
      },
    });
  };

  const candidates = await curator.fetchTrendingTracks("us");
  assert.deepEqual(candidates, [
    { title: "Janice STFU", artist: "Drake" },
    { title: "Choosin' Texas", artist: "Ella Langley" },
  ]);
});

test("fetchTrendingTracks caps results at 25 even if the feed returns more", async () => {
  const results = Array.from({ length: 50 }, (_, i) => ({ name: `Song ${i}`, artistName: `Artist ${i}` }));
  stubState.fetchImpl = async () => jsonResponse({ feed: { results } });

  const candidates = await curator.fetchTrendingTracks("us");
  assert.equal(candidates.length, 25);
});

test("fetchTrendingTracks throws a descriptive error on a non-ok response", async () => {
  stubState.fetchImpl = async () => jsonResponse({}, false, 503);
  await assert.rejects(() => curator.fetchTrendingTracks("us"), /fetchTrendingTracks failed for us: 503/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/curator.test.mjs` (or `node --test tests/curator.test.mjs`)
Expected: FAIL — `lib/curator.ts` does not exist yet (`ENOENT`/module load error).

- [ ] **Step 3: Implement `lib/curator.ts`**

Create `lib/curator.ts`:

```ts
export const TRENDING_COUNTRIES = ["us", "ru", "fr", "es", "gb"];
export const MAX_NEW_SONGS_PER_RUN = 15;
export const AUTOTAG_MIN_INTERVAL_MS = 2000;

interface AppleFeedResult {
  name: string;
  artistName: string;
}

interface AppleFeedResponse {
  feed: {
    results: AppleFeedResult[];
  };
}

export interface TrendingCandidate {
  title: string;
  artist: string;
}

export async function fetchTrendingTracks(countryCode: string): Promise<TrendingCandidate[]> {
  const url = `https://rss.marketingtools.apple.com/api/v2/${countryCode}/music/most-played/50/songs.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchTrendingTracks failed for ${countryCode}: ${res.status}`);
  }
  const data = (await res.json()) as AppleFeedResponse;
  return data.feed.results.slice(0, 25).map((r) => ({ title: r.name, artist: r.artistName }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/curator.test.mjs`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/curator.ts tests/curator.test.mjs
git commit -m "feat: add Apple trending-chart fetcher for catalog curator agent"
```

---

### Task 2: `curateCatalog` — cap, dedupe, per-candidate error isolation

**Files:**
- Modify: `lib/curator.ts`
- Modify: `tests/curator.test.mjs`

**Interfaces:**
- Consumes: `TRENDING_COUNTRIES`, `MAX_NEW_SONGS_PER_RUN`, `AUTOTAG_MIN_INTERVAL_MS`, `TrendingCandidate`, `fetchTrendingTracks` (Task 1); `autoTagSong(title: string, artist: string): Promise<AutoTagResult>` from `lib/autoTag.ts`; `findSongByTitleArtist(title: string, artist: string): Promise<{id,title,artist}|null>` and `insertSong(data: AutoTagResult): Promise<{id: string}>` from `lib/db/songs.ts`.
- Produces: `CurateCatalogResult { inserted: {title,artist,id}[]; skipped: number; failed: {title,artist,error}[] }`, `CurateCatalogOptions { minIntervalMs?: number }`, `curateCatalog(options?: CurateCatalogOptions): Promise<CurateCatalogResult>` — consumed by Task 3.

- [ ] **Step 1: Update the test harness to stub `autoTag` and `db/songs`, and write the failing tests**

In `tests/curator.test.mjs`, find:

```js
const require = createRequire(import.meta.url);
const ts = require("typescript");

const stubState = {
  fetchImpl: (..._args) => {
    throw new Error("fetch not stubbed for this test");
  },
};

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require,
    console,
    process,
    fetch: (...args) => stubState.fetchImpl(...args),
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}
```

Replace with:

```js
const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");

const stubState = {
  fetchImpl: (..._args) => {
    throw new Error("fetch not stubbed for this test");
  },
  autoTagSong: async (title, artist) => ({ title, artist }),
  findSongByTitleArtist: async () => null,
  insertSong: async (data) => ({ id: `id-${data.title}` }),
};

function stubRequire(id) {
  if (id.includes("autoTag")) {
    return { autoTagSong: (...args) => stubState.autoTagSong(...args) };
  }
  if (id.includes("db/songs")) {
    return {
      findSongByTitleArtist: (...args) => stubState.findSongByTitleArtist(...args),
      insertSong: (...args) => stubState.insertSong(...args),
    };
  }
  return baseRequire(id);
}

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process,
    fetch: (...args) => stubState.fetchImpl(...args),
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}
```

Then append to the end of `tests/curator.test.mjs`:

```js
function candidateResult(title, artist) {
  return { name: title, artistName: artist };
}

test("curateCatalog stops inserting once MAX_NEW_SONGS_PER_RUN is reached", async () => {
  const many = Array.from({ length: 20 }, (_, i) => candidateResult(`Song ${i}`, `Artist ${i}`));
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) return jsonResponse({ feed: { results: many } });
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  let taggedCount = 0;
  stubState.autoTagSong = async (title, artist) => {
    taggedCount += 1;
    return { title, artist };
  };
  stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.inserted.length, curator.MAX_NEW_SONGS_PER_RUN);
  assert.equal(taggedCount, curator.MAX_NEW_SONGS_PER_RUN);
});

test("curateCatalog skips existing songs without calling autoTagSong", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) {
      return jsonResponse({ feed: { results: [candidateResult("Existing Song", "Existing Artist")] } });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async (title, artist) => {
    if (title === "Existing Song" && artist === "Existing Artist") {
      return { id: "already-there", title, artist };
    }
    return null;
  };
  let taggedCount = 0;
  stubState.autoTagSong = async (title, artist) => {
    taggedCount += 1;
    return { title, artist };
  };

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.skipped, 1);
  assert.equal(result.inserted.length, 0);
  assert.equal(taggedCount, 0, "autoTagSong should never be called for a candidate already in the catalog");
});

test("curateCatalog records a failed candidate and continues with the rest", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) {
      return jsonResponse({
        feed: { results: [candidateResult("Broken Song", "Broken Artist"), candidateResult("Fine Song", "Fine Artist")] },
      });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  stubState.autoTagSong = async (title, artist) => {
    if (title === "Broken Song") throw new Error("iTunes lookup failed");
    return { title, artist };
  };
  stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].title, "Broken Song");
  assert.match(result.failed[0].error, /iTunes lookup failed/);
  assert.equal(result.inserted.length, 1);
  assert.equal(result.inserted[0].title, "Fine Song");
});

test("curateCatalog continues with remaining countries if one country's feed fetch fails", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) throw new Error("network error");
    if (url.includes("/ru/")) {
      return jsonResponse({ feed: { results: [candidateResult("Russian Hit", "Russian Artist")] } });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  stubState.autoTagSong = async (title, artist) => ({ title, artist });
  stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.inserted.length, 1);
  assert.equal(result.inserted[0].title, "Russian Hit");
});

test("curateCatalog throttles calls that reach autoTagSong to at least minIntervalMs apart", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) {
      return jsonResponse({ feed: { results: [candidateResult("Song One", "Artist One"), candidateResult("Song Two", "Artist Two")] } });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  const callTimestamps = [];
  stubState.autoTagSong = async (title, artist) => {
    callTimestamps.push(Date.now());
    return { title, artist };
  };
  stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

  await curator.curateCatalog({ minIntervalMs: 50 });
  assert.equal(callTimestamps.length, 2);
  assert.ok(callTimestamps[1] - callTimestamps[0] >= 45, "second autoTagSong call should wait for the throttle floor");
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `node --test tests/curator.test.mjs`
Expected: FAIL — `curator.curateCatalog is not a function`.

- [ ] **Step 3: Implement `curateCatalog` in `lib/curator.ts`**

In `lib/curator.ts`, add these imports at the top of the file:

```ts
import { autoTagSong } from "./autoTag";
import { findSongByTitleArtist, insertSong } from "./db/songs";
```

Then append to the end of `lib/curator.ts`:

```ts
export interface CurateCatalogResult {
  inserted: { title: string; artist: string; id: string }[];
  skipped: number;
  failed: { title: string; artist: string; error: string }[];
}

export interface CurateCatalogOptions {
  minIntervalMs?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function curateCatalog(options: CurateCatalogOptions = {}): Promise<CurateCatalogResult> {
  const minIntervalMs = options.minIntervalMs ?? AUTOTAG_MIN_INTERVAL_MS;
  const inserted: CurateCatalogResult["inserted"] = [];
  const failed: CurateCatalogResult["failed"] = [];
  let skipped = 0;

  for (const country of TRENDING_COUNTRIES) {
    if (inserted.length >= MAX_NEW_SONGS_PER_RUN) break;

    let candidates: TrendingCandidate[];
    try {
      candidates = await fetchTrendingTracks(country);
    } catch {
      continue; // one country's feed being down shouldn't block the rest
    }

    for (const candidate of candidates) {
      if (inserted.length >= MAX_NEW_SONGS_PER_RUN) break;

      let existing: { id: string; title: string; artist: string } | null;
      try {
        existing = await findSongByTitleArtist(candidate.title, candidate.artist);
      } catch (err) {
        failed.push({ ...candidate, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
      if (existing) {
        skipped += 1;
        continue;
      }

      const before = Date.now();
      try {
        const tagged = await autoTagSong(candidate.title, candidate.artist);
        const { id } = await insertSong(tagged);
        inserted.push({ title: candidate.title, artist: candidate.artist, id });
      } catch (err) {
        failed.push({ ...candidate, error: err instanceof Error ? err.message : String(err) });
      }
      const elapsed = Date.now() - before;
      const wait = Math.max(0, minIntervalMs - elapsed);
      if (wait > 0) await sleep(wait);
    }
  }

  return { inserted, skipped, failed };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/curator.test.mjs`
Expected: PASS — 10 tests passing.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/curator.ts tests/curator.test.mjs
git commit -m "feat: add curateCatalog with cap, dedupe, and per-candidate error isolation"
```

---

### Task 3: Cron route

**Files:**
- Create: `app/api/cron/curate-catalog/route.ts`

**Interfaces:**
- Consumes: `curateCatalog()` from `lib/curator.ts` (Task 2).

- [ ] **Step 1: Implement the route**

Create `app/api/cron/curate-catalog/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { curateCatalog } from "../../../../lib/curator";

export const runtime = "nodejs";
// Up to MAX_NEW_SONGS_PER_RUN sequential autoTagSong calls (iTunes + Last.fm +
// GPT-4o each, throttled ~2s apart) can take several minutes; the default
// serverless function timeout is too short for that.
export const maxDuration = 300;

function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await curateCatalog();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Add a local `CRON_SECRET` and verify manually**

Add a line to `.env.local` (this file is gitignored, same as `ADMIN_SECRET`):

```
CRON_SECRET=vibesong-cron-2026
```

With the dev server running (`npm run dev`), run:

```bash
curl -s -H "Authorization: Bearer vibesong-cron-2026" http://localhost:3000/api/cron/curate-catalog
```

Expected: a JSON response shaped like `{"inserted":[...],"skipped":N,"failed":[...]}` after roughly 30-90 seconds (5 real network calls to Apple's feed, plus real `autoTagSong` calls for any genuinely new chart tracks — this hits real OpenAI/iTunes/Last.fm and will insert real rows into the catalog, same as running a seed script). Also verify `curl -s http://localhost:3000/api/cron/curate-catalog` (no header) returns `{"error":"Unauthorized"}` with a `401`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/curate-catalog/route.ts
git commit -m "feat: add cron route wiring curateCatalog behind CRON_SECRET auth"
```

---

### Task 4: Vercel Cron schedule

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Add the cron config**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/curate-catalog",
      "schedule": "0 4 * * *"
    }
  ]
}
```

This runs once daily at 04:00 UTC. Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` when a `CRON_SECRET` project environment variable is set — that variable must be added in the Vercel dashboard (Project Settings → Environment Variables, Production) before this takes effect; it cannot be set from the repo since `.env*` is gitignored. Vercel Cron Jobs only fire against Production deployments, and on the Hobby plan are limited to once per day regardless of the schedule string — `"0 4 * * *"` already satisfies that.

- [ ] **Step 2: Run the full test suite and typecheck as a final gate**

Run: `npm test`
Expected: all tests pass, including the 10 new `tests/curator.test.mjs` tests.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: schedule catalog curator agent via Vercel Cron"
```

---

## After merging

- Add `CRON_SECRET` to the Vercel project's Production environment variables (Project Settings → Environment Variables) — the cron job will 401 against itself until this is set.
- The first Production deploy after this merges will register the cron job; check Vercel's dashboard (Project → Cron Jobs) to confirm it's scheduled, and check its execution log after the first 04:00 UTC run for the `{inserted, skipped, failed}` summary.
