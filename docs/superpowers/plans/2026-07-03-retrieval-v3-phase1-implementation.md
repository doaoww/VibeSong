# Retrieval v3 Phase 1 (Semantic Brief Layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the additive semantic-brief layer on top of Retrieval v2 — a shared, structured `MusicSupervisorBrief` on both the photo and song sides, embedded via `text-embedding-3-small`, feeding a new fifth candidate pool and a conservative `briefFit` scoring component — fully wired but disabled by default behind `ENABLE_BRIEF_POOL`.

**Architecture:** One shared pure module (`lib/musicSupervisorBrief.ts`) defines the brief shape and its deterministic text-for-embedding builder, reused unmodified by both `/api/analyze` (photo) and `lib/autoTag.ts` (song), and by the new backfill script. A new `lib/embeddings.ts` wraps the one genuinely new OpenAI call type this spec introduces. Everything downstream — the new Postgres RPC, the new candidate pool, the new scoring term — mirrors an existing Retrieval v2 pattern exactly, so nothing about v2's four pools, Rules Layer, or existing scoring is touched.

**Tech Stack:** Next.js 16 API routes, TypeScript, Supabase Postgres + pgvector, OpenAI `gpt-4o` (existing client) + `text-embedding-3-small` (new), Node's built-in test runner (`node --test`) with this codebase's existing VM-based TS-transpile test harness.

## Global Constraints

- No new GPT **completion** calls for the real-time paths — `musicBrief` (photo) and `musicSupervisorBrief` (song) are added as extra fields on the *existing* single GPT-4o calls in `/api/analyze` and `autoTagSong()`. The embedding call is the only genuinely new API call type, per `docs/superpowers/specs/2026-07-03-retrieval-v3-semantic-brief-design.md`.
- `avoid` (part of `MusicSupervisorBrief`) must never be passed into `buildBriefText()` — text embeddings handle negation unreliably; folding "avoid: X" into embedded text risks attracting X instead of repelling it.
- `whyThisPhotoNeedsMusic` is debug-only: never embedded, never scored, never gates anything.
- Both sides of the brief (photo and song) use the exact same `MusicSupervisorBrief` TypeScript type and the exact same `buildBriefText()` function — no duplicated concatenation logic anywhere.
- `ENABLE_BRIEF_POOL` defaults OFF. It is read once, server-side, in `/api/recommend/route.ts` — no other file branches on it.
- `briefFit`/`briefSimilarity` are `0` whenever either side's embedding is missing (never an error, never a hard block) — same missing-data philosophy v2 already uses for `story_context_tags`.
- New read-path RPC (`match_songs_by_brief`) takes its vector parameter as a native `vector(1536)` type and an explicit typed `RETURNS TABLE(...)` — never `RETURNS SETOF songs` (PostgREST can't resolve the `vector` column type through schema-cache introspection on the raw table). This mirrors `match_songs`'s existing `query_vector vector(10)` parameter, confirmed in `supabase/songs-schema.sql`.
- Write-path RPCs (`create_song`, `update_song`) take the new embedding as `text` and cast internally with `::vector(1536)` — mirrors the existing `p_emotional_vector text` → `::vector(10)` convention already used by `create_song`, not the read-path's direct-vector-type convention. `lib/db/songs.ts` builds the bracketed string (`\`[${arr.join(",")}]\``) the same way it already does for `emotional_vector`.
- Full source spec: `docs/superpowers/specs/2026-07-03-retrieval-v3-semantic-brief-design.md`.

---

## File Structure

**New files:**
- `lib/musicSupervisorBrief.ts` — shared `MusicSupervisorBrief` type, `parseMusicSupervisorBrief()`, `buildBriefText()`. Pure, no dependencies (mirrors `lib/matchSignals.ts`/`lib/tagTaxonomy.ts`).
- `tests/musicSupervisorBrief.test.mjs`
- `lib/embeddings.ts` — `embedText()` wrapping `openai.embeddings.create`.
- `tests/embeddings.test.mjs`
- `supabase/retrieval-v3-migration.sql` — two new columns, `match_songs_by_brief` RPC, extended `create_song`/`update_song`.
- `scripts/verify-retrieval-v3-rpcs.mjs` — smoke-tests the new RPCs after manual migration.
- `scripts/backfill-music-supervisor-briefs.mjs` — backfills `music_supervisor_summary`/`brief_embedding`, runnable against a curated subset or the full catalog.

**Modified files:**
- `app/api/analyze/route.ts` — extend prompt + response with `musicBrief`, `whyThisPhotoNeedsMusic`, `photoBriefEmbedding`.
- `lib/autoTag.ts` — extend `buildGptTagPrompt`/`parseGptTagResponse`/`AutoTagResult`/`autoTagSong()` with `musicSupervisorBrief` → `music_supervisor_summary`/`brief_embedding`; add `buildMusicSupervisorBriefPrompt()`/`generateMusicSupervisorBrief()` for the backfill script's narrower call.
- `lib/db/songs.ts` — `CatalogSong`/`SongPatch` gain the two new fields; `insertSong`/`updateSong` forward them; new `searchCatalogByBrief()`.
- `lib/recommend.ts` — `RecommendRequest`/`ScoreComponents`/`DebugEntry` gain `photoBriefEmbedding`/`briefFit`/`briefSimilarity`; scoring loop computes `briefFit`.
- `tests/recommend.test.mjs` — fixture + tests for the above.
- `tests/autoTag.test.mjs` — fixture + tests for the `musicSupervisorBrief` additions.
- `app/api/recommend/route.ts` — `ENABLE_BRIEF_POOL` flag, Pool 5 query, `poolStats` additions.
- `app/app/page.tsx` — forward `photoBriefEmbedding` from the analyze response into the recommend request.

---

### Task 1: `lib/musicSupervisorBrief.ts` — shared brief type, parser, text builder

**Files:**
- Create: `lib/musicSupervisorBrief.ts`
- Create: `tests/musicSupervisorBrief.test.mjs`

**Interfaces:**
- Produces: `Restraint` type, `MusicSupervisorBrief` interface, `parseMusicSupervisorBrief(raw: unknown): MusicSupervisorBrief`, `buildBriefText(brief: MusicSupervisorBrief): string`. Tasks 3, 4, 5, 8 all import this module directly — do not redefine the shape anywhere else.

- [ ] **Step 1: Write the failing tests**

Create `tests/musicSupervisorBrief.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

const msb = await import("../lib/musicSupervisorBrief.ts");

test("parseMusicSupervisorBrief returns safe defaults when raw is not an object", () => {
  const result = msb.parseMusicSupervisorBrief(null);
  assert.deepEqual(result, {
    narrative: "",
    emotionalSubtext: "",
    restraint: "balanced",
    context: "",
    direction: "",
    avoid: "",
  });
});

test("parseMusicSupervisorBrief trims whitespace and caps free-text fields at 300 chars", () => {
  const result = msb.parseMusicSupervisorBrief({
    narrative: "  a quiet morning selfie  ",
    emotionalSubtext: "x".repeat(500),
  });
  assert.equal(result.narrative, "a quiet morning selfie");
  assert.equal(result.emotionalSubtext.length, 300);
});

test("parseMusicSupervisorBrief defaults restraint to balanced when invalid or missing", () => {
  assert.equal(msb.parseMusicSupervisorBrief({}).restraint, "balanced");
  assert.equal(msb.parseMusicSupervisorBrief({ restraint: "extremely loud" }).restraint, "balanced");
  assert.equal(msb.parseMusicSupervisorBrief({ restraint: "expressive" }).restraint, "expressive");
  assert.equal(msb.parseMusicSupervisorBrief({ restraint: "understated" }).restraint, "understated");
});

test("parseMusicSupervisorBrief coerces non-string field values to empty string", () => {
  const result = msb.parseMusicSupervisorBrief({ narrative: 5, avoid: null, context: ["not", "a", "string"] });
  assert.equal(result.narrative, "");
  assert.equal(result.avoid, "");
  assert.equal(result.context, "");
});

test("buildBriefText concatenates narrative/emotionalSubtext/restraint/context/direction", () => {
  const text = msb.buildBriefText({
    narrative: "A quiet morning selfie.",
    emotionalSubtext: "none, this is literal.",
    restraint: "understated",
    context: "private, just for herself.",
    direction: "something soft and unhurried.",
    avoid: "nothing loud or ironic.",
  });
  assert.ok(text.includes("A quiet morning selfie."));
  assert.ok(text.includes("Restraint: understated."));
  assert.ok(text.includes("private, just for herself."));
  assert.ok(text.includes("something soft and unhurried."));
});

test("buildBriefText never includes the avoid field's text", () => {
  const text = msb.buildBriefText({
    narrative: "n",
    emotionalSubtext: "e",
    restraint: "balanced",
    context: "c",
    direction: "d",
    avoid: "nothing euphoric or ironic",
  });
  assert.ok(!text.includes("euphoric"), "avoid text must never reach the embedded string");
  assert.ok(!text.includes("ironic"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/musicSupervisorBrief.test.mjs`
Expected: FAIL — `Cannot find module '../lib/musicSupervisorBrief.ts'`.

- [ ] **Step 3: Implement `lib/musicSupervisorBrief.ts`**

```ts
export type Restraint = "understated" | "balanced" | "expressive";

export interface MusicSupervisorBrief {
  narrative: string;
  emotionalSubtext: string;
  restraint: Restraint;
  context: string;
  direction: string;
  avoid: string;
}

const RESTRAINT_VALUES: Set<string> = new Set(["understated", "balanced", "expressive"]);
const MAX_FIELD_LENGTH = 300;

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_FIELD_LENGTH);
}

function parseRestraint(value: unknown): Restraint {
  return typeof value === "string" && RESTRAINT_VALUES.has(value) ? (value as Restraint) : "balanced";
}

/**
 * Validates GPT's structured music-supervisor brief — used identically on
 * the photo side (app/api/analyze/route.ts) and the song side
 * (lib/autoTag.ts) so both sides produce the same shape before embedding.
 */
export function parseMusicSupervisorBrief(raw: unknown): MusicSupervisorBrief {
  if (!raw || typeof raw !== "object") {
    return { narrative: "", emotionalSubtext: "", restraint: "balanced", context: "", direction: "", avoid: "" };
  }
  const obj = raw as Record<string, unknown>;
  return {
    narrative: cleanText(obj.narrative),
    emotionalSubtext: cleanText(obj.emotionalSubtext),
    restraint: parseRestraint(obj.restraint),
    context: cleanText(obj.context),
    direction: cleanText(obj.direction),
    avoid: cleanText(obj.avoid),
  };
}

/**
 * Deterministic template turning a brief into the text that gets embedded.
 * `avoid` is deliberately excluded — text embeddings handle negation
 * unreliably, so folding "avoid: X" into this text risks attracting X
 * instead of repelling it (see the v3 spec's Risk Review §2).
 */
export function buildBriefText(brief: MusicSupervisorBrief): string {
  return `${brief.narrative} ${brief.emotionalSubtext} Restraint: ${brief.restraint}. ${brief.context} ${brief.direction}`.trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/musicSupervisorBrief.test.mjs`
Expected: PASS — 6/6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/musicSupervisorBrief.ts tests/musicSupervisorBrief.test.mjs
git commit -m "feat: add shared MusicSupervisorBrief type, parser, and text builder"
```

---

### Task 2: `lib/embeddings.ts` — embedding helper

**Files:**
- Create: `lib/embeddings.ts`
- Create: `tests/embeddings.test.mjs`

**Interfaces:**
- Consumes: default export from `./openai` (existing `OpenAI` client instance).
- Produces: `embedText(text: string): Promise<number[]>`. Tasks 3, 4, 5 call this.

- [ ] **Step 1: Write the failing test**

Create `tests/embeddings.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const stubState = { embedding: [0.1, 0.2, 0.3], lastArgs: null };

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const stubRequire = (id) => {
    if (id.includes("openai")) {
      return {
        __esModule: true,
        default: {
          embeddings: {
            create: async (args) => {
              stubState.lastArgs = args;
              return { data: [{ embedding: stubState.embedding }] };
            },
          },
        },
      };
    }
    return require(id);
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const embeddings = loadTsModule("lib/embeddings.ts");

test("embedText calls openai.embeddings.create with text-embedding-3-small and returns the embedding array", async () => {
  stubState.embedding = [0.5, 0.25, -0.1];
  const result = await embeddings.embedText("a quiet morning selfie");
  assert.deepEqual(result, [0.5, 0.25, -0.1]);
  assert.equal(stubState.lastArgs.model, "text-embedding-3-small");
  assert.equal(stubState.lastArgs.input, "a quiet morning selfie");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/embeddings.test.mjs`
Expected: FAIL — `Cannot find module 'lib/embeddings.ts'`.

- [ ] **Step 3: Implement `lib/embeddings.ts`**

```ts
import openai from "./openai";

/**
 * text-embedding-3-small, native 1536 dimensions — see the v3 spec's Layer 3
 * for why this model over -large (no discrimination need at this catalog
 * size; cost/latency both favor the smaller model).
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0].embedding;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/embeddings.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/embeddings.ts tests/embeddings.test.mjs
git commit -m "feat: add embedText helper wrapping text-embedding-3-small"
```

---

### Task 3: Extend `/api/analyze` with `musicBrief`, `whyThisPhotoNeedsMusic`, `photoBriefEmbedding`

**Files:**
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `parseMusicSupervisorBrief`, `buildBriefText` (Task 1); `embedText` (Task 2).
- Produces: `/api/analyze` response gains `musicBrief: MusicSupervisorBrief`, `whyThisPhotoNeedsMusic: string`, `photoBriefEmbedding: number[]`.

- [ ] **Step 1: Add imports**

In `app/api/analyze/route.ts`, add after the existing `parseMatchSignals` import (currently line 21):

```ts
import { parseMusicSupervisorBrief, buildBriefText } from "../../../lib/musicSupervisorBrief";
import { embedText } from "../../../lib/embeddings";
```

- [ ] **Step 2: Extend the JSON schema in `BASE_SYSTEM_PROMPT`**

Find this block (the end of the JSON schema, right before the closing `}` and `NUMBER RULES:`):

```ts
    "energy_bounds": { "min": 0.0, "max": 0.0 }
  }
}
NUMBER RULES:
```

Replace with:

```ts
    "energy_bounds": { "min": 0.0, "max": 0.0 }
  },
  "musicBrief": {
    "narrative": "1-2 sentences: what's happening, what story this photo is telling",
    "emotionalSubtext": "1 sentence: the gap between surface mood and what's actually going on underneath — or explicitly 'none, this is literal' when there isn't one",
    "restraint": "understated | balanced | expressive",
    "context": "1 sentence: how private/public this reads, who it's implicitly for",
    "direction": "1-2 sentences, feeling-first not genre-first: what the song needs to emotionally DO for this photo",
    "avoid": "0-1 sentence, optional: what the music should NOT do for this photo — leave empty string if nothing is worth flagging"
  },
  "whyThisPhotoNeedsMusic": "1-2 sentences, debug-only: in plain language, why does this specific photo call for music at all, and what is GPT actually seeing? Not used in retrieval — purely so a human reviewing logs can sanity-check whether GPT understood the photo."
}
NUMBER RULES:
```

- [ ] **Step 3: Parse the new fields and compute the embedding in the `POST` handler**

Find this line (currently around line 305):

```ts
    const matchSignals = parseMatchSignals(result.matchSignals, photoVector.energy);
```

Add immediately after it:

```ts
    const musicBrief = parseMusicSupervisorBrief(result.musicBrief);
    const whyThisPhotoNeedsMusic =
      typeof result.whyThisPhotoNeedsMusic === "string" ? result.whyThisPhotoNeedsMusic.trim().slice(0, 300) : "";
    const briefText = buildBriefText(musicBrief);
    const photoBriefEmbedding = briefText ? await embedText(briefText) : [];
```

- [ ] **Step 4: Include the new fields in the response**

Find (currently around line 320):

```ts
    return NextResponse.json({ ...result, photoVectorArray, photoConfidence, matchSignals });
```

Replace with:

```ts
    return NextResponse.json({
      ...result,
      photoVectorArray,
      photoConfidence,
      matchSignals,
      musicBrief,
      whyThisPhotoNeedsMusic,
      photoBriefEmbedding,
    });
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors introduced by `app/api/analyze/route.ts`. (No unit-test harness exists for this route — it makes live OpenAI/Supabase calls, same as v2's equivalent task; manual verification happens later against the running dev server.)

- [ ] **Step 6: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: extend photo-analysis prompt with musicBrief and photoBriefEmbedding"
```

---

### Task 4: `lib/autoTag.ts` — `musicSupervisorBrief` on the new-song tagging path

**Files:**
- Modify: `lib/autoTag.ts`
- Modify: `tests/autoTag.test.mjs`

**Interfaces:**
- Consumes: `parseMusicSupervisorBrief`, `buildBriefText` (Task 1); `embedText` (Task 2).
- Produces: `AutoTagResult` gains `music_supervisor_summary: string`, `brief_embedding: number[]`. Task 7 (`lib/db/songs.ts`) depends on these exact field names.

- [ ] **Step 1: Write the failing tests**

In `tests/autoTag.test.mjs`, extend the `stubRequire` function's `openai` branch (currently returns only `chat.completions.create`) to also provide `embeddings.create`:

```js
    if (id.includes("openai")) {
      return {
        __esModule: true,
        default: {
          chat: {
            completions: {
              create: async () => ({ choices: [{ message: { content: stubState.openaiContent } }] }),
            },
          },
          embeddings: {
            create: async () => ({ data: [{ embedding: stubState.embedding ?? [0.11, 0.22, 0.33] }] }),
          },
        },
      };
    }
```

Add `stubState.embedding = undefined;` to `resetHarness()` alongside the existing `stubState.openaiContent = "";` reset.

Append these tests after the existing tests in the file:

```js
test("buildGptTagPrompt includes musicSupervisorBrief instructions", () => {
  const { buildGptTagPrompt } = autoTag;
  const prompt = buildGptTagPrompt("Song", "Artist", []);
  assert.ok(prompt.includes("musicSupervisorBrief"));
  assert.ok(prompt.includes("narrative"));
  assert.ok(prompt.includes("emotionalSubtext"));
  assert.ok(prompt.includes("restraint"));
});

test("parseGptTagResponse derives music_supervisor_summary from musicSupervisorBrief via buildBriefText, excluding avoid", () => {
  const { parseGptTagResponse } = autoTag;
  const raw = JSON.stringify({
    musicSupervisorBrief: {
      narrative: "A late-night synth ballad about missing someone.",
      emotionalSubtext: "sincere, no irony.",
      restraint: "expressive",
      context: "reach for this after a long, quiet drive.",
      direction: "wide, cinematic, lets the vocal carry the weight.",
      avoid: "nothing upbeat or ironic",
    },
  });
  const result = parseGptTagResponse(raw);
  assert.ok(result.music_supervisor_summary.includes("A late-night synth ballad"));
  assert.ok(result.music_supervisor_summary.includes("Restraint: expressive."));
  assert.ok(!result.music_supervisor_summary.includes("upbeat"), "avoid text must not leak into the stored summary");
});

test("parseGptTagResponse defaults music_supervisor_summary to empty text when musicSupervisorBrief is missing", () => {
  const { parseGptTagResponse } = autoTag;
  const result = parseGptTagResponse(JSON.stringify({ language: "English" }));
  assert.equal(result.music_supervisor_summary, "Restraint: balanced.");
});

test("autoTagSong attaches brief_embedding computed from music_supervisor_summary", async () => {
  resetHarness();
  delete process.env.LASTFM_API_KEY;
  stubState.fetchImpl = async (url) => {
    if (url.startsWith("https://itunes.apple.com/search?")) return jsonResponse({ results: [] });
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  stubState.embedding = [0.9, 0.8, 0.7];
  stubState.openaiContent = JSON.stringify({
    language: "English",
    popularity_tier: 3,
    emotional_vector: {
      dreamy: 0.5, nostalgia: 0.5, energy: 0.5, cinematic: 0.5, darkness: 0.5,
      confidence: 0.5, intimacy: 0.5, danceability: 0.5, electronic: 0.5, acoustic: 0.5,
    },
    genre_tags: ["indie"],
    aesthetic_tags: ["dreamy"],
    mood_tags: ["nostalgic"],
    story_intent_tags: ["healing era"],
    modern_aesthetic_tags: ["quiet luxury"],
    story_context_tags: ["night drive"],
    vibe_summary: "A quiet night song.",
    confidence_level: "uncertain",
    confidence_reason: "Not a widely known track.",
    musicSupervisorBrief: {
      narrative: "A song about driving alone at night.",
      emotionalSubtext: "none, literal.",
      restraint: "understated",
      context: "late-night, solo drives.",
      direction: "steady, warm, unhurried.",
      avoid: "",
    },
  });

  const { autoTagSong } = loadTsModule("lib/autoTag.ts");
  const result = await autoTagSong("Some Song", "Some Artist");

  assert.ok(result.music_supervisor_summary.includes("A song about driving alone at night."));
  assert.deepEqual(result.brief_embedding, [0.9, 0.8, 0.7]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/autoTag.test.mjs`
Expected: FAIL — `musicSupervisorBrief`/`music_supervisor_summary`/`brief_embedding` don't exist yet.

- [ ] **Step 3: Add imports to `lib/autoTag.ts`**

Add after the existing `lyrics` import block (currently lines 16-17):

```ts
import { parseMusicSupervisorBrief, buildBriefText } from "./musicSupervisorBrief";
import { embedText } from "./embeddings";
```

- [ ] **Step 4: Extend `AutoTagResult` and `ParsedTagResponse`**

In `AutoTagResult` (currently lines 72-102), add after `vibe_summary: string;`:

```ts
  music_supervisor_summary: string;
  brief_embedding: number[];
```

In `ParsedTagResponse` (currently lines 207-221), add after `vibe_summary: string;`:

```ts
  music_supervisor_summary: string;
```

- [ ] **Step 5: Extend `buildGptTagPrompt`**

In `buildGptTagPrompt` (currently lines 171-205), add a new field to the JSON schema right after `"vibe_summary"` and before `"confidence_level"`:

```ts
  "vibe_summary": "1-2 short sentences in natural language describing this song's feeling/story",
  "musicSupervisorBrief": {
    "narrative": "1-2 sentences: what this song is about, the story or feeling it carries",
    "emotionalSubtext": "1 sentence: what's underneath the surface mood, if anything — irony, contrast, restraint",
    "restraint": "understated | balanced | expressive",
    "context": "1 sentence: what kind of moment or photo a music supervisor would reach for this song for",
    "direction": "1-2 sentences: what this song emotionally delivers — energy character, sonic space",
    "avoid": "0-1 sentence, optional: what this song should NOT be paired with — leave empty string if nothing is worth flagging"
  },
  "confidence_level": "one of: known_track, known_artist_only, metadata_inference, uncertain — how well do you actually know THIS SPECIFIC SONG, not just the artist's general style",
```

(This replaces the existing `"confidence_level": ...` line — the rest of that line's content is unchanged, only the new `musicSupervisorBrief` block is inserted above it.)

- [ ] **Step 6: Derive `music_supervisor_summary` in `parseGptTagResponse`**

In `parseGptTagResponse` (currently lines 225-302), find:

```ts
      vibe_summary: typeof parsed.vibe_summary === "string" ? parsed.vibe_summary : "",
      confidence_level,
```

Replace with:

```ts
      vibe_summary: typeof parsed.vibe_summary === "string" ? parsed.vibe_summary : "",
      music_supervisor_summary: buildBriefText(parseMusicSupervisorBrief(parsed.musicSupervisorBrief)),
      confidence_level,
```

Also add `music_supervisor_summary: ""` to the `fallback` object at the top of `parseGptTagResponse` (currently lines 226-240), right after `vibe_summary: "",`. Note this fallback path never reaches `buildBriefText` — it's the raw JSON-parse-failure fallback, so an explicit empty string is correct there, not `buildBriefText(parseMusicSupervisorBrief(undefined))` (which would actually equal `"Restraint: balanced."`, not `""` — keep the two fallback paths distinct on purpose, since the parse-failure fallback should read as "nothing generated" not "generated a near-empty brief").

- [ ] **Step 7: Compute and attach `brief_embedding` in `autoTagSong()`**

In `autoTagSong()` (currently lines 304-379), find:

```ts
  const gptData = parseGptTagResponse(rawGpt);
```

Add immediately after:

```ts
  const briefEmbedding = gptData.music_supervisor_summary
    ? await embedText(gptData.music_supervisor_summary)
    : [];
```

Then in the function's final returned object, add after `vibe_summary: gptData.vibe_summary,`:

```ts
    music_supervisor_summary: gptData.music_supervisor_summary,
    brief_embedding: briefEmbedding,
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test tests/autoTag.test.mjs`
Expected: PASS — all tests green, including the pre-existing ones (confirms the extension didn't change existing behavior).

- [ ] **Step 9: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: All tests pass, no new type errors.

- [ ] **Step 10: Commit**

```bash
git add lib/autoTag.ts tests/autoTag.test.mjs
git commit -m "feat: add musicSupervisorBrief to autoTagSong, deriving music_supervisor_summary/brief_embedding"
```

---

### Task 5: `lib/autoTag.ts` — narrow brief-only generation for the backfill script

**Files:**
- Modify: `lib/autoTag.ts`
- Modify: `tests/autoTag.test.mjs`

**Interfaces:**
- Consumes: `parseMusicSupervisorBrief`, `buildBriefText` (Task 1); `embedText` (Task 2).
- Produces: `buildMusicSupervisorBriefPrompt(title: string, artist: string): string`, `generateMusicSupervisorBrief(title: string, artist: string): Promise<{ brief: MusicSupervisorBrief; summary: string; embedding: number[] }>`. Task 11 (backfill script) depends on `generateMusicSupervisorBrief`'s exact return shape.

This is deliberately a separate, smaller GPT call from Task 4's — it exists only for backfilling songs that are *already* tagged (language, emotional_vector, genre_tags, etc. already populated), where re-running the full `buildGptTagPrompt` would re-hit iTunes/Last.fm and re-ask GPT for data that hasn't changed. See the v3 spec's "Catalog Backfill" section.

- [ ] **Step 1: Write the failing tests**

Append to `tests/autoTag.test.mjs`:

```js
test("buildMusicSupervisorBriefPrompt includes title, artist, and the brief JSON schema", () => {
  const { buildMusicSupervisorBriefPrompt } = autoTag;
  const prompt = buildMusicSupervisorBriefPrompt("Хочешь?", "Земфира");
  assert.ok(prompt.includes("Хочешь?"));
  assert.ok(prompt.includes("Земфира"));
  assert.ok(prompt.includes("musicSupervisorBrief"));
  assert.ok(prompt.includes("narrative"));
});

test("generateMusicSupervisorBrief parses GPT's response and embeds the resulting summary", async () => {
  resetHarness();
  stubState.embedding = [0.4, 0.5, 0.6];
  stubState.openaiContent = JSON.stringify({
    musicSupervisorBrief: {
      narrative: "A driving, defiant breakup anthem.",
      emotionalSubtext: "none, literal.",
      restraint: "expressive",
      context: "post-breakup, walking away with your head up.",
      direction: "big, propulsive, doesn't apologize.",
      avoid: "nothing quiet or tentative",
    },
  });

  const { generateMusicSupervisorBrief } = loadTsModule("lib/autoTag.ts");
  const result = await generateMusicSupervisorBrief("Some Song", "Some Artist");

  assert.equal(result.brief.restraint, "expressive");
  assert.ok(result.summary.includes("A driving, defiant breakup anthem."));
  assert.ok(!result.summary.includes("tentative"));
  assert.deepEqual(result.embedding, [0.4, 0.5, 0.6]);
});

test("generateMusicSupervisorBrief returns an empty embedding when GPT returns nothing usable", async () => {
  resetHarness();
  stubState.openaiContent = "not valid json at all";

  const { generateMusicSupervisorBrief } = loadTsModule("lib/autoTag.ts");
  const result = await generateMusicSupervisorBrief("Some Song", "Some Artist");

  assert.deepEqual(result.embedding, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/autoTag.test.mjs`
Expected: FAIL — `buildMusicSupervisorBriefPrompt`/`generateMusicSupervisorBrief` are not functions.

- [ ] **Step 3: Implement in `lib/autoTag.ts`**

Add at the end of the file:

```ts
export function buildMusicSupervisorBriefPrompt(title: string, artist: string): string {
  return `You are a music supervisor's assistant. For the song "${title}" by ${artist}, write a short structured brief on what this song is FOR emotionally — when another human would reach for it and why.

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "musicSupervisorBrief": {
    "narrative": "1-2 sentences: what this song is about, the story or feeling it carries",
    "emotionalSubtext": "1 sentence: what's underneath the surface mood, if anything — irony, contrast, restraint",
    "restraint": "understated | balanced | expressive",
    "context": "1 sentence: what kind of moment or photo a music supervisor would reach for this song for",
    "direction": "1-2 sentences: what this song emotionally delivers — energy character, sonic space",
    "avoid": "0-1 sentence, optional: what this song should NOT be paired with — leave empty string if nothing is worth flagging"
  }
}`;
}

export interface GeneratedMusicSupervisorBrief {
  brief: ReturnType<typeof parseMusicSupervisorBrief>;
  summary: string;
  embedding: number[];
}

/** Narrow, backfill-only GPT call — see Task 5 of the v3 implementation plan for why this is separate from autoTagSong()'s full tagging call. */
export async function generateMusicSupervisorBrief(title: string, artist: string): Promise<GeneratedMusicSupervisorBrief> {
  const prompt = buildMusicSupervisorBriefPrompt(title, artist);
  let raw = "";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0,
    });
    raw = res.choices[0].message.content ?? "";
  } catch (err) {
    console.error("[generateMusicSupervisorBrief] GPT failed:", err);
  }

  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  let parsedRaw: unknown = {};
  try {
    parsedRaw = firstBrace !== -1 && lastBrace > firstBrace ? JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) : {};
  } catch {
    parsedRaw = {};
  }

  const brief = parseMusicSupervisorBrief((parsedRaw as Record<string, unknown>).musicSupervisorBrief);
  const summary = buildBriefText(brief);
  const embedding = summary ? await embedText(summary) : [];
  return { brief, summary, embedding };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/autoTag.test.mjs`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/autoTag.ts tests/autoTag.test.mjs
git commit -m "feat: add generateMusicSupervisorBrief for backfill-only brief generation"
```

---

### Task 6: Database migration — `music_supervisor_summary`/`brief_embedding` columns, `match_songs_by_brief`, extended `create_song`/`update_song`

**Files:**
- Create: `supabase/retrieval-v3-migration.sql`
- Create: `scripts/verify-retrieval-v3-rpcs.mjs`

**Interfaces:**
- Produces: `songs.music_supervisor_summary text`, `songs.brief_embedding vector(1536)`, RPC `match_songs_by_brief(p_brief_vector vector(1536), p_match_count int)`, extended `create_song`/`update_song` accepting `p_music_supervisor_summary text`/`p_brief_embedding text`. Task 7 (`lib/db/songs.ts`) depends on these exact names.

This migration must be applied **manually** by the human running this plan — there is no `exec_sql`-style RPC available on this Supabase project (confirmed during the 2026-07-03 bug-fix session), so it cannot be applied programmatically the way most other steps in this plan can.

- [ ] **Step 1: Write `supabase/retrieval-v3-migration.sql`**

```sql
-- Retrieval v3: semantic brief layer. Adds music_supervisor_summary/
-- brief_embedding columns, a new match_songs_by_brief RPC (read path — takes
-- a native vector(1536) param, mirroring match_songs's query_vector
-- vector(10)), and extends create_song/update_song to accept the two new
-- fields (write path — text param cast internally, mirroring how
-- p_emotional_vector is already handled).
--
-- Apply this against the SUPABASE_CATALOG_URL project (not the main auth
-- project) via the Supabase SQL editor. Idempotent — safe to re-run.

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS music_supervisor_summary text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS brief_embedding vector(1536);

DROP FUNCTION IF EXISTS public.match_songs_by_brief(vector(1536), int);

CREATE OR REPLACE FUNCTION public.match_songs_by_brief(
  p_brief_vector vector(1536),
  p_match_count  int DEFAULT 25
)
RETURNS TABLE (
  id uuid, title text, artist text, language text, energy float,
  popularity_tier int, emotional_vector vector(10), genre_tags text[],
  aesthetic_tags text[], mood_tags text[], story_intent_tags text[],
  modern_aesthetic_tags text[], story_context_tags text[],
  final_confidence float, needs_review boolean, itunes_preview_url text,
  artwork_url text, apple_music_url text, youtube_id text,
  quality_score float, distance float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.title, s.artist, s.language, s.energy, s.popularity_tier,
    s.emotional_vector, s.genre_tags, s.aesthetic_tags, s.mood_tags,
    s.story_intent_tags, s.modern_aesthetic_tags, s.story_context_tags,
    s.final_confidence, s.needs_review, s.itunes_preview_url, s.artwork_url,
    s.apple_music_url, s.youtube_id, s.quality_score,
    (s.brief_embedding <=> p_brief_vector) AS distance
  FROM public.songs s
  WHERE s.brief_embedding IS NOT NULL
  ORDER BY s.brief_embedding <=> p_brief_vector
  LIMIT p_match_count;
END;
$$;

-- Extend create_song (write path) with the two new fields.
DROP FUNCTION IF EXISTS public.create_song(
  text, text, text, int, int, text, int, text, float8, text[], text[], text[],
  text[], text[], text, text, text, text, text[], text[], text, text, float8,
  float8, float8, boolean, text[], text, text
);

CREATE OR REPLACE FUNCTION public.create_song(
  p_title                    text,
  p_artist                   text,
  p_album                    text,
  p_year                     int,
  p_duration_seconds         int,
  p_language                 text,
  p_popularity_tier          int,
  p_emotional_vector         text,
  p_energy                   float8,
  p_genre_tags               text[],
  p_aesthetic_tags           text[],
  p_mood_tags                text[],
  p_story_intent_tags        text[],
  p_modern_aesthetic_tags    text[],
  p_itunes_preview_url       text,
  p_artwork_url              text,
  p_apple_music_url          text,
  p_youtube_id               text,
  p_story_context_tags       text[]  DEFAULT '{}',
  p_discarded_tags           text[]  DEFAULT '{}',
  p_confidence_level         text    DEFAULT NULL,
  p_confidence_reason        text    DEFAULT NULL,
  p_gpt_confidence           float8  DEFAULT NULL,
  p_source_confidence        float8  DEFAULT NULL,
  p_final_confidence         float8  DEFAULT NULL,
  p_needs_review             boolean DEFAULT false,
  p_evidence_sources         text[]  DEFAULT '{}',
  p_tagging_version          text    DEFAULT 'v1',
  p_vibe_summary             text    DEFAULT NULL,
  p_music_supervisor_summary text    DEFAULT NULL,
  p_brief_embedding          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.songs (
    title, artist, album, year, duration_seconds, language, popularity_tier,
    emotional_vector, energy, genre_tags, aesthetic_tags, mood_tags,
    story_intent_tags, modern_aesthetic_tags, itunes_preview_url, artwork_url,
    apple_music_url, youtube_id,
    story_context_tags, discarded_tags, confidence_level, confidence_reason,
    gpt_confidence, source_confidence, final_confidence, needs_review,
    evidence_sources, tagging_version, vibe_summary,
    music_supervisor_summary, brief_embedding, updated_at
  ) VALUES (
    p_title, p_artist, p_album, p_year, p_duration_seconds, p_language, p_popularity_tier,
    p_emotional_vector::vector(10), p_energy,
    p_genre_tags, p_aesthetic_tags, p_mood_tags,
    p_story_intent_tags, p_modern_aesthetic_tags, p_itunes_preview_url, p_artwork_url,
    p_apple_music_url, p_youtube_id,
    p_story_context_tags, p_discarded_tags, p_confidence_level, p_confidence_reason,
    p_gpt_confidence, p_source_confidence, p_final_confidence, p_needs_review,
    p_evidence_sources, p_tagging_version, p_vibe_summary,
    p_music_supervisor_summary, p_brief_embedding::vector(1536), now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Extend update_song (write path) with the two new fields. The 2026-07-03
-- overload collision (a stale 10-param version left over from the v2
-- migration) was already resolved manually before this migration; this
-- extends the single remaining 11-param canonical signature.
DROP FUNCTION IF EXISTS public.update_song(uuid, text, int, text[], text[], text[], text[], text[], text[], text, boolean);

CREATE OR REPLACE FUNCTION public.update_song(
  p_id                       uuid,
  p_language                 text    DEFAULT NULL,
  p_popularity_tier          int     DEFAULT NULL,
  p_genre_tags               text[]  DEFAULT NULL,
  p_aesthetic_tags           text[]  DEFAULT NULL,
  p_mood_tags                text[]  DEFAULT NULL,
  p_story_intent_tags        text[]  DEFAULT NULL,
  p_modern_aesthetic_tags    text[]  DEFAULT NULL,
  p_story_context_tags       text[]  DEFAULT NULL,
  p_vibe_summary             text    DEFAULT NULL,
  p_approve                  boolean DEFAULT false,
  p_music_supervisor_summary text    DEFAULT NULL,
  p_brief_embedding          text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.songs SET
    language                 = COALESCE(p_language,                 language),
    popularity_tier          = COALESCE(p_popularity_tier,          popularity_tier),
    genre_tags                = COALESCE(p_genre_tags,               genre_tags),
    aesthetic_tags             = COALESCE(p_aesthetic_tags,            aesthetic_tags),
    mood_tags                   = COALESCE(p_mood_tags,                mood_tags),
    story_intent_tags           = COALESCE(p_story_intent_tags,        story_intent_tags),
    modern_aesthetic_tags       = COALESCE(p_modern_aesthetic_tags,    modern_aesthetic_tags),
    story_context_tags          = COALESCE(p_story_context_tags,       story_context_tags),
    vibe_summary                = COALESCE(p_vibe_summary,             vibe_summary),
    music_supervisor_summary    = COALESCE(p_music_supervisor_summary, music_supervisor_summary),
    brief_embedding              = COALESCE(p_brief_embedding::vector(1536), brief_embedding),
    needs_review                = CASE WHEN p_approve THEN false ELSE needs_review END,
    tag_source                  = CASE WHEN p_approve THEN 'auto_plus_manual' ELSE tag_source END,
    manual_reviewed_at          = CASE WHEN p_approve THEN now() ELSE manual_reviewed_at END,
    updated_at                  = now()
  WHERE id = p_id;
END;
$$;
```

- [ ] **Step 2: Apply the migration manually**

Tell the human running this plan: paste the contents of `supabase/retrieval-v3-migration.sql` into the Supabase SQL editor for the `SUPABASE_CATALOG_URL` project and run it. If PostgREST doesn't pick up the new/changed functions immediately, run `NOTIFY pgrst, 'reload schema';` (same fix already documented for prior migrations in `scripts/test-supabase.mjs`). **Do not proceed to Step 3 until this is confirmed done.**

- [ ] **Step 3: Write `scripts/verify-retrieval-v3-rpcs.mjs`**

```js
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
console.log(`   OK — ${briefData.length} rows returned (0 is fine before any backfill has run)`);

console.log("2. Calling extended update_song with music_supervisor_summary/brief_embedding...");
const { data: anySong, error: listErr } = await supabase.rpc("list_catalog", { p_limit: 1, p_offset: 0 });
if (listErr) {
  console.error("   FAIL:", listErr.message);
  process.exit(1);
}
if (!anySong?.[0]) {
  console.log("   SKIPPED — no song available to test against");
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
  console.log("   OK — update_song accepted the new parameters");
}

console.log("\nAll retrieval v3 RPCs verified.");
```

- [ ] **Step 4: Run the verification script**

Run: `node scripts/verify-retrieval-v3-rpcs.mjs`
Expected: Both steps print `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/retrieval-v3-migration.sql scripts/verify-retrieval-v3-rpcs.mjs
git commit -m "feat: add music_supervisor_summary/brief_embedding columns, match_songs_by_brief RPC"
```

---

### Task 7: `lib/db/songs.ts` — `searchCatalogByBrief`, type/RPC-forwarding updates

**Files:**
- Modify: `lib/db/songs.ts`
- Modify: `tests/songs.test.mjs`

**Interfaces:**
- Consumes: `match_songs_by_brief`, extended `create_song`/`update_song` (Task 6).
- Produces: `searchCatalogByBrief(embedding: number[], matchCount?: number): Promise<CatalogSong[]>`. Task 9 (`/api/recommend`) depends on this exact name/shape. `CatalogSong` gains `music_supervisor_summary`, `brief_embedding` — Task 8 (`lib/recommend.ts`) reads `song.brief_embedding`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/songs.test.mjs` (reuses that file's existing `loadTsModule`/`mockSupabase` harness):

```js
test("searchCatalogByBrief calls match_songs_by_brief with the embedding and a default match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => {
    captured = { name, args };
    return { data: [{ id: "1" }], error: null };
  };
  const embedding = [0.1, 0.2, 0.3];
  const result = await songsLib.searchCatalogByBrief(embedding);
  assert.equal(captured.name, "match_songs_by_brief");
  assert.deepEqual(captured.args, { p_brief_vector: embedding, p_match_count: 25 });
  assert.deepEqual(result, [{ id: "1" }]);
});

test("searchCatalogByBrief accepts a custom match count", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: [], error: null }; };
  await songsLib.searchCatalogByBrief([0.1], 10);
  assert.equal(captured.args.p_match_count, 10);
});

test("searchCatalogByBrief throws with a descriptive message on RPC error", async () => {
  mockSupabase.rpc = async () => ({ data: null, error: { message: "boom" } });
  await assert.rejects(() => songsLib.searchCatalogByBrief([0.1]), /searchCatalogByBrief failed: boom/);
});

test("updateSong forwards music_supervisor_summary and brief_embedding to update_song", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", {
    music_supervisor_summary: "a quiet, unhurried night song",
    brief_embedding: [0.1, 0.2],
  });
  assert.equal(captured.name, "update_song");
  assert.equal(captured.args.p_id, "song-id");
  assert.equal(captured.args.p_music_supervisor_summary, "a quiet, unhurried night song");
  assert.equal(captured.args.p_brief_embedding, "[0.1,0.2]");
});

test("updateSong passes null for brief_embedding when not provided", async () => {
  let captured = null;
  mockSupabase.rpc = async (name, args) => { captured = { name, args }; return { data: null, error: null }; };
  await songsLib.updateSong("song-id", { language: "English" });
  assert.equal(captured.args.p_brief_embedding, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/songs.test.mjs`
Expected: FAIL — `searchCatalogByBrief` is not a function; `updateSong` doesn't forward the new fields yet.

- [ ] **Step 3: Extend `CatalogSong` and `SongPatch` in `lib/db/songs.ts`**

In `CatalogSong` (currently lines 5-39), add after `vibe_summary?: string | null;`:

```ts
  music_supervisor_summary?: string | null;
  brief_embedding?: number[] | null;
```

In `SongPatch` (currently lines 41-53), add after `vibe_summary?: string;`:

```ts
  music_supervisor_summary?: string;
  brief_embedding?: number[];
```

- [ ] **Step 4: Forward the new fields in `insertSong`**

Find:

```ts
export async function insertSong(data: AutoTagResult): Promise<{ id: string }> {
  const vectorArray = vectorToArray(data.emotional_vector);
  const vectorString = `[${vectorArray.join(",")}]`;
  const youtubeId = (data as AutoTagResult & { youtube_id?: string | null }).youtube_id ?? null;

  const { data: id, error } = await supabase.rpc("create_song", {
```

Replace with:

```ts
export async function insertSong(data: AutoTagResult): Promise<{ id: string }> {
  const vectorArray = vectorToArray(data.emotional_vector);
  const vectorString = `[${vectorArray.join(",")}]`;
  const youtubeId = (data as AutoTagResult & { youtube_id?: string | null }).youtube_id ?? null;
  const briefEmbeddingString = data.brief_embedding && data.brief_embedding.length
    ? `[${data.brief_embedding.join(",")}]`
    : null;

  const { data: id, error } = await supabase.rpc("create_song", {
```

Then find:

```ts
    p_tagging_version:       data.tagging_version,
    p_vibe_summary:          data.vibe_summary,
  });
```

Replace with:

```ts
    p_tagging_version:       data.tagging_version,
    p_vibe_summary:          data.vibe_summary,
    p_music_supervisor_summary: data.music_supervisor_summary ?? null,
    p_brief_embedding:          briefEmbeddingString,
  });
```

- [ ] **Step 5: Forward the new fields in `updateSong`**

Find:

```ts
export async function updateSong(id: string, patch: Partial<SongPatch>): Promise<void> {
  const { error } = await supabase.rpc("update_song", {
    p_id:                    id,
    p_language:              patch.language              ?? null,
    p_popularity_tier:       patch.popularity_tier       ?? null,
    p_genre_tags:            patch.genre_tags            ?? null,
    p_aesthetic_tags:        patch.aesthetic_tags        ?? null,
    p_mood_tags:             patch.mood_tags             ?? null,
    p_story_intent_tags:     patch.story_intent_tags     ?? null,
    p_modern_aesthetic_tags: patch.modern_aesthetic_tags ?? null,
    p_story_context_tags:    patch.story_context_tags    ?? null,
    p_vibe_summary:          patch.vibe_summary          ?? null,
    p_approve:               patch.approve                ?? false,
  });
  if (error) throw new Error(`updateSong failed: ${error.message}`);
}
```

Replace with:

```ts
export async function updateSong(id: string, patch: Partial<SongPatch>): Promise<void> {
  const briefEmbeddingString = patch.brief_embedding && patch.brief_embedding.length
    ? `[${patch.brief_embedding.join(",")}]`
    : null;
  const { error } = await supabase.rpc("update_song", {
    p_id:                    id,
    p_language:              patch.language              ?? null,
    p_popularity_tier:       patch.popularity_tier       ?? null,
    p_genre_tags:            patch.genre_tags            ?? null,
    p_aesthetic_tags:        patch.aesthetic_tags        ?? null,
    p_mood_tags:             patch.mood_tags             ?? null,
    p_story_intent_tags:     patch.story_intent_tags     ?? null,
    p_modern_aesthetic_tags: patch.modern_aesthetic_tags ?? null,
    p_story_context_tags:    patch.story_context_tags    ?? null,
    p_vibe_summary:          patch.vibe_summary          ?? null,
    p_approve:               patch.approve                ?? false,
    p_music_supervisor_summary: patch.music_supervisor_summary ?? null,
    p_brief_embedding:          briefEmbeddingString,
  });
  if (error) throw new Error(`updateSong failed: ${error.message}`);
}
```

- [ ] **Step 6: Add `searchCatalogByBrief`**

Add after `searchCatalogByTaste` (currently ends around line 200):

```ts
export async function searchCatalogByBrief(
  embedding: number[],
  matchCount = 25
): Promise<CatalogSong[]> {
  const { data, error } = await supabase.rpc("match_songs_by_brief", {
    p_brief_vector: embedding,
    p_match_count: matchCount,
  });
  if (error) throw new Error(`searchCatalogByBrief failed: ${error.message}`);
  return (data ?? []) as CatalogSong[];
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test tests/songs.test.mjs`
Expected: PASS — all tests green.

- [ ] **Step 8: Commit**

```bash
git add lib/db/songs.ts tests/songs.test.mjs
git commit -m "feat: add searchCatalogByBrief and forward music_supervisor_summary/brief_embedding"
```

---

### Task 8: `lib/recommend.ts` — `briefFit`/`briefSimilarity` scoring

**Files:**
- Modify: `lib/recommend.ts`
- Modify: `tests/recommend.test.mjs`

**Interfaces:**
- Consumes: `song.brief_embedding` (Task 7); `cosine` (existing, `lib/vectorMath.ts`).
- Produces: `RecommendRequest.photoBriefEmbedding: number[] | null`; `ScoreComponents`/`DebugEntry` gain `briefFit: number`, `briefSimilarity: number`. Task 9 (`/api/recommend` route) depends on this field name for gating.

- [ ] **Step 1: Write the failing tests**

Append to `tests/recommend.test.mjs`:

```js
test("briefFit is 0 when photoBriefEmbedding is null, even if the song has brief_embedding", () => {
  const song = makeSong({ brief_embedding: [1, 0, 0] });
  const req = makeRequest({ photoBriefEmbedding: null });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefFit, 0);
  assert.equal(results[0].scoreComponents.briefSimilarity, 0);
});

test("briefFit is 0 when the song has no brief_embedding, even if photoBriefEmbedding is present", () => {
  const song = makeSong({ brief_embedding: null });
  const req = makeRequest({ photoBriefEmbedding: [1, 0, 0] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefFit, 0);
});

test("briefFit rewards high cosine similarity between photoBriefEmbedding and song.brief_embedding, weighted at 20", () => {
  const song = makeSong({ brief_embedding: [1, 0, 0] });
  const req = makeRequest({ photoBriefEmbedding: [1, 0, 0] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefSimilarity, 1);
  assert.equal(results[0].scoreComponents.briefFit, 20);
});

test("briefFit scales down for a dissimilar brief embedding", () => {
  const song = makeSong({ brief_embedding: [0, 1, 0] });
  const req = makeRequest({ photoBriefEmbedding: [1, 0, 0] });
  const { results } = rec.buildRecommendations(req, [song]);
  assert.equal(results[0].scoreComponents.briefSimilarity, 0);
  assert.equal(results[0].scoreComponents.briefFit, 0);
});
```

Also update `makeSong()`'s defaults to include `brief_embedding: null,` and `makeRequest()`'s defaults to include `photoBriefEmbedding: null,` (both alongside their existing default fields), so every pre-existing test keeps passing unmodified.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/recommend.test.mjs`
Expected: FAIL — `briefFit`/`briefSimilarity` are `undefined` on `scoreComponents`.

- [ ] **Step 3: Extend `RecommendRequest`, `ScoreComponents`, `DebugEntry` in `lib/recommend.ts`**

In `RecommendRequest` (currently lines 4-21), add after `energyBounds: { min: number; max: number };`:

```ts
  photoBriefEmbedding: number[] | null;  // null when ENABLE_BRIEF_POOL is off or the photo has no brief text
```

In `ScoreComponents` (currently lines 23-36), add after `qualityBonus: number;`:

```ts
  briefFit: number;
  briefSimilarity: number;
```

- [ ] **Step 4: Compute `briefFit`/`briefSimilarity` in the scoring loop**

Find, in `buildRecommendations` (currently around lines 256-257):

```ts
    const noveltyFit = discoveryScore(song.popularity_tier, req.discoveryStyle) * 10;
    const qualityBonus = song.quality_score * 5;
```

Add immediately before it:

```ts
    const briefSimilarity =
      req.photoBriefEmbedding && song.brief_embedding && song.brief_embedding.length
        ? cosine(req.photoBriefEmbedding, song.brief_embedding)
        : 0;
    const briefFit = briefSimilarity * 20;
```

- [ ] **Step 5: Include the new fields in `raw`, `components`, and the debug log entry**

Find:

```ts
    const raw = photoFit + tasteFit + storyFit + contextFit + vibeAestheticFit + noveltyFit + qualityBonus;
```

Replace with:

```ts
    const raw = photoFit + tasteFit + storyFit + contextFit + vibeAestheticFit + briefFit + noveltyFit + qualityBonus;
```

In the `components` object construction, add after `qualityBonus: Math.round(qualityBonus * 10) / 10,`:

```ts
      briefFit: Math.round(briefFit * 10) / 10,
      briefSimilarity: Math.round(briefSimilarity * 1000) / 1000,
```

(`briefSimilarity` gets 3 decimal places, not 1, since it's a raw -1..1 cosine value where the existing 1-decimal rounding used for weighted scores would lose most of its resolution — this is the field the Layer 6 evaluation reads to judge whether the signal is discriminating at all.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test tests/recommend.test.mjs`
Expected: PASS — all tests green, including every pre-existing test (confirms `briefFit`/`briefSimilarity` default to 0 and don't change any existing score when `photoBriefEmbedding` is `null`).

- [ ] **Step 7: Commit**

```bash
git add lib/recommend.ts tests/recommend.test.mjs
git commit -m "feat: add briefFit/briefSimilarity scoring component to buildRecommendations"
```

---

### Task 9: `/api/recommend/route.ts` — Pool 5 wiring behind `ENABLE_BRIEF_POOL`

**Files:**
- Modify: `app/api/recommend/route.ts`

**Interfaces:**
- Consumes: `searchCatalogByBrief` (Task 7); `RecommendRequest.photoBriefEmbedding` (Task 8).
- Produces: `/api/recommend` accepts `photoBriefEmbedding` in the request body; `poolStats` response gains `briefPoolCount`, `briefPoolEnabled`.

No unit test for this file — same as v2's equivalent task, this route requires a live Supabase connection and an authenticated user, so it has no existing unit-test harness. Verified by typecheck here; manual end-to-end verification happens once Task 10 (page.tsx) is also done.

- [ ] **Step 1: Import `searchCatalogByBrief`**

In `app/api/recommend/route.ts`, find:

```ts
import { searchCatalog, searchCatalogByTags, searchCatalogByTaste, type CatalogSong } from "../../../lib/db/songs";
```

Replace with:

```ts
import { searchCatalog, searchCatalogByTags, searchCatalogByTaste, searchCatalogByBrief, type CatalogSong } from "../../../lib/db/songs";
```

- [ ] **Step 2: Read the flag and the request field**

Find (currently around line 59):

```ts
    const musicDirection: { genres: string[]; references: string[]; avoid: string[] } =
      body.musicDirection ?? { genres: [], references: [], avoid: [] };
```

Add immediately after:

```ts
    const briefPoolEnabled = process.env.ENABLE_BRIEF_POOL === "true";
    const photoBriefEmbeddingRaw: number[] | null = Array.isArray(body.photoBriefEmbedding) ? body.photoBriefEmbedding : null;
    const photoBriefEmbedding = briefPoolEnabled ? photoBriefEmbeddingRaw : null;
```

- [ ] **Step 3: Query Pool 5 alongside the existing four**

Find:

```ts
    const [vectorPool, storyPool, contextPool, tastePool] = await Promise.all([
      searchCatalog(queryVector, 25),
      searchCatalogByTags({ intentTags: storyIntentTags, aestheticTags, moodTags }, 25),
      searchCatalogByTags({ contextTags: sceneContextTags }, 20),
      searchCatalogByTaste({ artistPatterns, positiveGenres }, 20),
    ]);

    const poolMap = new Map<string, CatalogSong>();
    for (const song of [...vectorPool, ...storyPool, ...contextPool, ...tastePool]) {
      if (!poolMap.has(song.id)) poolMap.set(song.id, song);
    }
```

Replace with:

```ts
    const [vectorPool, storyPool, contextPool, tastePool, briefPool] = await Promise.all([
      searchCatalog(queryVector, 25),
      searchCatalogByTags({ intentTags: storyIntentTags, aestheticTags, moodTags }, 25),
      searchCatalogByTags({ contextTags: sceneContextTags }, 20),
      searchCatalogByTaste({ artistPatterns, positiveGenres }, 20),
      photoBriefEmbedding ? searchCatalogByBrief(photoBriefEmbedding, 25) : Promise.resolve([] as CatalogSong[]),
    ]);

    const poolMap = new Map<string, CatalogSong>();
    for (const song of [...vectorPool, ...storyPool, ...contextPool, ...tastePool, ...briefPool]) {
      if (!poolMap.has(song.id)) poolMap.set(song.id, song);
    }
```

- [ ] **Step 4: Pass `photoBriefEmbedding` into `buildRecommendations`**

Find, inside the `buildRecommendations({...}, candidates)` call:

```ts
        energyBounds,
      },
      candidates
    );
```

Replace with:

```ts
        energyBounds,
        photoBriefEmbedding,
      },
      candidates
    );
```

- [ ] **Step 5: Extend `poolStats`**

Find:

```ts
    const poolStats = {
      vectorPoolCount: vectorPool.length,
      storyPoolCount: storyPool.length,
      contextPoolCount: contextPool.length,
      tastePoolCount: tastePool.length,
      mergedCandidateCount: candidates.length,
      removedByRulesCount: debugLog.filter((e) => e.rulesRemoved).length,
    };
```

Replace with:

```ts
    const poolStats = {
      vectorPoolCount: vectorPool.length,
      storyPoolCount: storyPool.length,
      contextPoolCount: contextPool.length,
      tastePoolCount: tastePool.length,
      briefPoolCount: briefPool.length,
      briefPoolEnabled,
      mergedCandidateCount: candidates.length,
      removedByRulesCount: debugLog.filter((e) => e.rulesRemoved).length,
    };
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/recommend/route.ts
git commit -m "feat: wire Semantic Brief Pool into /api/recommend behind ENABLE_BRIEF_POOL"
```

---

### Task 10: Forward `photoBriefEmbedding` through `app/app/page.tsx`

**Files:**
- Modify: `app/app/page.tsx`

**Interfaces:**
- Consumes: `photoBriefEmbedding` field on the `/api/analyze` response (Task 3).

- [ ] **Step 1: Forward the field**

Find (currently around lines 139-155):

```ts
        const recommendRes = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoVectorArray: vibeData.photoVectorArray,
            photoConfidence: vibeData.photoConfidence,
            vibeBoosts: {},
            storyIntentTags: matchSignals.story_intent_tags ?? [],
            antiTags: [],
            photoAntiTags: matchSignals.anti_tags ?? [],
            sceneContextTags: matchSignals.scene_context_tags ?? [],
            aestheticTags: matchSignals.modern_aesthetic_tags ?? [],
            moodTags: matchSignals.mood_tags ?? [],
            musicDirection,
            energyBounds: matchSignals.energy_bounds,
          }),
        });
```

Replace with:

```ts
        const recommendRes = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoVectorArray: vibeData.photoVectorArray,
            photoConfidence: vibeData.photoConfidence,
            vibeBoosts: {},
            storyIntentTags: matchSignals.story_intent_tags ?? [],
            antiTags: [],
            photoAntiTags: matchSignals.anti_tags ?? [],
            sceneContextTags: matchSignals.scene_context_tags ?? [],
            aestheticTags: matchSignals.modern_aesthetic_tags ?? [],
            moodTags: matchSignals.mood_tags ?? [],
            musicDirection,
            energyBounds: matchSignals.energy_bounds,
            photoBriefEmbedding: vibeData.photoBriefEmbedding ?? null,
          }),
        });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat: forward photoBriefEmbedding from analyze response to /api/recommend"
```

---

### Task 11: Backfill script — `scripts/backfill-music-supervisor-briefs.mjs`

**Files:**
- Create: `scripts/backfill-music-supervisor-briefs.mjs`

**Interfaces:**
- Consumes: `generateMusicSupervisorBrief` (Task 5); extended `update_song` (Task 6).

Per the v3 spec's Layer 6/Catalog Backfill sections, this script is built here but **not run against the full catalog as part of this plan** — actually running it (Stage A pilot, then Stage B full catalog) is Phase 2, gated on the evaluation set, and out of scope for this Phase 1 implementation plan. This task's deliverable is a working, idempotent, spot-checked script — not a completed backfill.

- [ ] **Step 1: Write `scripts/backfill-music-supervisor-briefs.mjs`**

```js
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

const supabase = createClient(env.SUPABASE_CATALOG_URL, env.SUPABASE_CATALOG_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { generateMusicSupervisorBrief } = await import("../lib/autoTag.ts");

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
```

- [ ] **Step 2: Spot-check the script against 2 real songs**

Run: `node scripts/backfill-music-supervisor-briefs.mjs --ids=<two real song ids from your catalog>`

Get two real ids first via:

```bash
node -e "
const { readFileSync } = require('fs');
const { createClient } = require('@supabase/supabase-js');
const text = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of text.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const supabase = createClient(env.SUPABASE_CATALOG_URL, env.SUPABASE_CATALOG_SERVICE_ROLE_KEY);
supabase.rpc('list_catalog', { p_limit: 2, p_offset: 0 }).then(({ data }) => console.log(data.map(s => s.id).join(',')));
"
```

Expected: The backfill script prints two `[N/2] ...` progress lines ending in `Backfill complete: 2/2 updated.` (or fewer if a song's GPT call happened to return an empty brief — logged, not fatal).

- [ ] **Step 3: Verify via the RPC verification script**

Run: `node scripts/verify-retrieval-v3-rpcs.mjs`
Expected: `match_songs_by_brief` now returns at least 1 row (the songs just backfilled), where it may have returned 0 in Task 6.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-music-supervisor-briefs.mjs
git commit -m "feat: add backfill script for music_supervisor_summary/brief_embedding"
```

---

## Final Verification

- [ ] **Run the full test suite:** `npm test` — expect all tests green, including every pre-existing v1/v2 test (confirms nothing in this plan changed existing behavior when `ENABLE_BRIEF_POOL` is unset/false).
- [ ] **Typecheck:** `npx tsc --noEmit` — expect no errors.
- [ ] **Confirm the flag truly gates everything:** with `ENABLE_BRIEF_POOL` unset, start the dev server, upload a photo, and confirm in the `[recommend] pool stats:` log line that `briefPoolCount` is `0` and `briefPoolEnabled` is `false` — today's Retrieval v2 behavior, byte-for-byte.
- [ ] **Confirm the new path works when locally enabled:** with `ENABLE_BRIEF_POOL=true npm run dev`, upload a photo, confirm `briefPoolCount` is nonzero (assuming at least the Task 11 spot-check songs were backfilled) and at least one `[recommend] debug log:` entry shows a nonzero `briefFit`/`briefSimilarity`.

This plan's scope ends here. Layer 6 (the evaluation set, Stage A/B backfill, and the decision to flip `ENABLE_BRIEF_POOL` in production) is Phase 2 per the spec's Phasing section — a separate plan, written once this one is merged and verified.
