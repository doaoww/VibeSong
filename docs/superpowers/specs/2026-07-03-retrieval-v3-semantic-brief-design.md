# VibeSong Retrieval v3 — Semantic Brief Layer

**Date:** 2026-07-03
**Status:** Approved — ready for implementation planning

---

## Problem Statement

Retrieval v2 (2026-07-02) replaced a single 10-dim emotional vector with a hybrid of vector similarity + closed-vocabulary tag overlap (`story_intent_tags`, `modern_aesthetic_tags`, `mood_tags`, `story_context_tags`) across four candidate pools. It shipped and works as designed, but a live-GPT audit done immediately after shipping found two failure modes baked into the *representation*, not the retrieval logic:

1. **Closed vocabularies are too low-bandwidth for what a photo actually means.** `STORY_CONTEXT_TAGS` is a 12-item list built around selfie-culture scenes (mirror selfie, night drive, gym, outfit check…). Photos that don't cleanly fit any of the 12 categories (a landscape, an object close-up) forced GPT to either invent an out-of-vocabulary tag — silently dropped by `parseMatchSignals`, zeroing that photo's Context/Scene Pool and `contextFit` score — or return nothing. Neither outcome is "the photo doesn't have this signal"; it's the schema failing to represent the photo at all.
2. **Tags and floats can't carry subtext, irony, or restraint.** "This looks celebratory but is actually a performance" or "this needs a song that holds tension rather than resolving it" has no home in any enum in `lib/tagTaxonomy.ts`, no matter how many categories are added. A human music supervisor reasons about a photo in prose — narrative, subtext, social audience, restraint — not in a fixed set of labels.

This spec adds a **semantic layer on top of Retrieval v2**, not a replacement for it. GPT already writes something close to a music-supervisor's read of a photo when prompted for `vibeCaption`; this spec asks it to write that read in full, as prose, and uses text embeddings — not enums — to carry it into retrieval. Everything Retrieval v2 built (four pools, Rules Layer, existing scoring components) stays exactly as it is.

## Core Principle

A photo's "does this song belong here" signal is fundamentally a language problem, not a classification problem. Where v2 asked "which boxes does this photo check," v3 asks "what would a music supervisor write about this photo," embeds the answer, and lets semantic similarity — not overlap counting — do the matching for that one signal. Every other v2 signal (hard filters, taste, discovery, the existing tag pools) is untouched; this is one new pool and one new, deliberately modest scoring component sitting alongside them.

**Constraint carried over, one exception:** v2 required zero new OpenAI calls. v3 lifts that constraint specifically for **embedding calls** — one per photo analysis, one per song at tagging/backfill time. It does **not** add new GPT completion calls: both `musicBrief` (photo) and `music_supervisor_summary` (song) are added as extra fields on the *existing* single GPT-4o calls already made by `/api/analyze` and `autoTagSong()`, the same way v2 added `matchSignals` to the existing vision call. Only the embedding step is genuinely new infrastructure.

---

## Layer 1: Photo Side — `musicBrief` in `/api/analyze`

Added to the existing GPT-4o vision call's JSON schema in `app/api/analyze/route.ts`, alongside `matchSignals` (both stay — v3 doesn't remove v2's tags):

```json
"musicBrief": {
  "narrative": "1-2 sentences: what's happening, what story this photo is telling",
  "emotionalSubtext": "1 sentence: the gap between surface mood and what's actually going on underneath — or explicitly 'none, this is literal' when there isn't one",
  "restraint": "understated | balanced | expressive",
  "intimacyAudience": "1 sentence: how private/public this reads, who it's implicitly for",
  "musicDirection": "1-2 sentences, feeling-first not genre-first: what the song needs to emotionally DO for this photo"
}
```

Field rules:
- `narrative`, `emotionalSubtext`, `intimacyAudience`, `musicDirection`: free text, no closed vocabulary. Server-side validation trims whitespace, coerces non-strings to `""`, and caps each field at 300 characters (defends against a pathological GPT response inflating embedding token cost — not a quality constraint, just a sanity ceiling well above any realistic 1-2 sentence output).
- `restraint`: closed 3-value enum (`understated`/`balanced`/`expressive`), validated against a `Set`; invalid or missing values default to `"balanced"`. This is the one non-prose field — kept as a coarse, cheap, loggable signal for the evaluation phase, **not** as a retrieval filter or scoring input in this spec.

New pure module `lib/musicBrief.ts` (mirrors `lib/matchSignals.ts`):
- `parseMusicBrief(raw: unknown): MusicBrief` — validates/defaults the shape above.
- `buildBriefText(brief: MusicBrief): string` — deterministic template, not GPT's job:
  ```
  `${narrative} ${emotionalSubtext} Restraint: ${restraint}. ${intimacyAudience} ${musicDirection}`
  ```
  This concatenated string is what actually gets embedded. Keeping the sub-fields separate (rather than asking GPT for one free-form paragraph) preserves per-field debuggability in logs while still producing one coherent text block for the embedding call.

`/api/analyze` calls a new `embedText()` helper (Layer 3) on `buildBriefText(musicBrief)` after parsing GPT's response, and returns `photoBriefEmbedding: number[]` (1536 floats) in the response body alongside the existing `matchSignals`/`photoVectorArray`/`photoConfidence`.

---

## Layer 2: Song Side — `music_supervisor_summary`

Extends the existing single GPT-4o tagging call in `lib/autoTag.ts` (`buildGptTagPrompt`/`parseGptTagResponse`), not a new call:

```json
"music_supervisor_summary": "2-4 sentences, written as a music supervisor's note on what this song is FOR emotionally — narrative fit, energy character, sonic space, when to reach for it and when not to"
```

**Deliberately mirrored instruction language with the photo-side prompt.** This is the one real technical risk in this design: embedding similarity is sensitive to the *register* of the text, not just its content — if the photo brief reads like clinical analyst notes and the song brief reads like Spotify editorial copy, `briefFit` will partly measure writing-style similarity instead of emotional-fit similarity. Both prompts are built from a shared instruction fragment ("write as a music supervisor briefing another human on why this [photo/song] calls for the kind of music it does") to keep the two embedding spaces comparable.

`music_supervisor_summary` is a **new column**, not a repurposing of the existing `vibe_summary` (a shorter display blurb already used by the admin UI and `update_song`'s `p_vibe_summary` — changing its meaning would be a silent behavior change elsewhere).

`autoTagSong()` calls `embedText()` on the new summary and attaches `brief_embedding: number[]` to `AutoTagResult`, same as the photo side.

---

## Layer 3: Embedding Infrastructure

New `lib/embeddings.ts`:

```ts
export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0].embedding;
}
```

**Model choice:** `text-embedding-3-small`, native 1536 dimensions. At a ~600-900 song catalog this is not a discrimination problem requiring `-large`; cost and latency both favor the smaller model. No dimensionality truncation — keep the model's native output.

**Cost:** ~$0.02 / 1M tokens. Photo brief text (~100-150 tokens) × every analysis request, plus a one-time ~800-song catalog backfill (~150 tokens/song) — total cost is a rounding error next to the GPT-4o vision call this app already makes per request.

**Latency:** one new *sequential* step in `/api/analyze` — the embedding call happens after GPT-4o vision returns (needs `musicBrief` text first) and before the response is sent. Typically +100-300ms on top of the existing 2-5s GPT-4o-vision-dominated request. `/api/recommend` gets **zero** added latency — the embedding is computed once in `/api/analyze` and forwarded through `app/app/page.tsx`, exactly like `photoVectorArray` already is, never recomputed.

---

## Layer 4: Schema Changes

- `songs.music_supervisor_summary text` (nullable — populated by `autoTagSong()` going forward, by backfill for existing rows).
- `songs.brief_embedding vector(1536)` (nullable, same reason).
- New RPC `match_songs_by_brief`, mirroring `match_songs_by_tags`'s established `RETURNS TABLE(...)` pattern (required — PostgREST cannot resolve the `vector` column type through schema-cache introspection on the raw table):

  ```sql
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
  ```

  No ivfflat/hnsw index needed yet — exact cosine scan is fast at <1k rows. Revisit only if the catalog grows past ~10k songs.

- `update_song` and `create_song` each gain two new params: `p_music_supervisor_summary text DEFAULT NULL`, `p_brief_embedding vector(1536) DEFAULT NULL`. **This is the same function whose overload collision was fixed manually on 2026-07-03** (a stale 10-param `update_song` from the v2 migration was colliding with the canonical 11-param version); this migration extends that now-single canonical signature rather than creating a third overload.
- `lib/db/songs.ts`: new `searchCatalogByBrief(embedding: number[], matchCount = 25): Promise<CatalogSong[]>`, mirroring `searchCatalogByTags`. `insertSong`/`updateSong` forward the two new fields.

---

## Layer 5: Fifth Candidate Pool + `briefFit` Scoring — Conservative by Design

**Feature flag: `ENABLE_BRIEF_POOL`, defaults OFF.** Read server-side in `/api/recommend/route.ts`. When off, `/api/recommend` behaves exactly as Retrieval v2 does today — no Pool 5 query, no `briefFit` computation, `photoBriefEmbedding` in the request body is accepted but ignored. The flag only flips to `true` after the evaluation set (Layer 6) is manually reviewed and signed off — never auto-enabled by a deploy.

**Pool 5 — Semantic Brief Pool** (new, flag-gated): `searchCatalogByBrief(photoBriefEmbedding, 25)`, merged into the existing candidate dedupe alongside the four v2 pools exactly the same way — no special-casing in the merge logic itself, only in whether Pool 5 is queried at all.

**Scoring — deliberately does not rebalance existing weights.** Per explicit direction: don't shrink `photoFit`/`storyFit`/etc. to make room for `briefFit` before there's evidence it deserves the room. `briefFit` is a pure addition with a conservative starting weight, well below `photoFit`'s:

```
photoFit          = cosine(query_vector, song.emotional_vector) × 40      (unchanged)
tasteFit          = ... (unchanged, max 30)
storyFit          = ... (unchanged, max 21)
contextFit        = ... (unchanged, max 12)
vibeAestheticFit  = ... (unchanged, max 10)
briefFit          = cosine(photoBriefEmbedding, song.brief_embedding) × 20    [NEW]
noveltyFit        = ... (unchanged, max 10)
qualityBonus      = ... (unchanged, max 5)

raw_score   = sum of all components above (max ~148 when flag on, ~128 when off — unchanged from v2)
final_score = clamp(raw_score - penalties, 0, 100)      (unchanged)
```

`briefFit`'s weight of 20 (half of `photoFit`'s 40) is explicitly a **starting point, not a conclusion** — it is not tuned against real data yet, by design. Raising it is the expected next step *after* the evaluation set shows the semantic signal is pulling in the right direction, not before.

**Not confidence-gated.** Unlike `contextFit`/`vibeAestheticFit`/`storyFit`, `briefFit` is **not** scaled by `confFactor` (derived from `photoConfidence`). This is a deliberate departure from the v2 pattern: the 2026-07-03 audit found `photoConfidence` itself is poorly calibrated by GPT (clusters at 0.8-0.9 regardless of actual photo ambiguity, even after a prompt fix attempt) — gating a brand-new signal by an already-known-unreliable one would just add noise neither of us could interpret. Fixing `photoConfidence` calibration (likely via the same categorical-self-assessment pattern `lib/autoTag.ts` already uses for song confidence) is out of scope for this spec and tracked separately.

**Heavy logging, per explicit direction.** `ScoreComponents`/`DebugEntry` (`lib/recommend.ts`) gain two fields, not one:
- `briefFit` — the weighted score (0-20), logged like every other component today.
- `briefSimilarity` — the **raw** cosine similarity (-1 to 1), logged separately from the weighted score specifically so the evaluation phase can inspect the underlying similarity distribution independent of whatever weight happens to be configured.

`poolStats` gains `briefPoolCount` (raw Pool 5 row count before dedup, matching the existing convention for the other three new-in-v2 pools) and `briefPoolEnabled` (boolean, so it's visible in logs whether a given request even queried Pool 5).

---

## Layer 6: Evaluation Set — Gate for Enabling the Flag

`ENABLE_BRIEF_POOL` only flips to `true` after this comparison, not automatically after deployment.

**Test set:** 10-20 real photos spanning: selfie, night car photo, beach/sunset, cafe, outfit check, group photo, dark/moody photo, romantic photo (1-2 photos per category). Stored as a fixed reference set so the comparison is repeatable.

**Procedure, per photo:**
1. Run through `/api/analyze` → `/api/recommend` with `ENABLE_BRIEF_POOL=false` (today's v2 behavior) — capture top 8 + full `debugLog`.
2. Run the same photo with `ENABLE_BRIEF_POOL=true` — capture top 8 + full `debugLog` (including `briefFit`/`briefSimilarity` per song).
3. Compare: did the top 8 change at all? Where they differ, does the v3 pick read as a better emotional fit than the v2 pick, or just different? Check the `briefSimilarity` distribution — is it meaningfully discriminating (spread across the candidate pool) or flat (near-identical for every song, which would mean the brief text isn't carrying enough distinguishing signal)?
4. **Exit condition:** the flag is enabled in production only after a human (product owner) reviews the paired before/after output across the full set and judges the v3 results visibly better on at least a majority of the test photos — not a threshold on an automated metric. This mirrors `docs/BRD.md`'s own Phase 1 business goal ("validate that AI matching feels accurate and magical"), which is a qualitative bar by design, not the separate quantitative >70%-save-rate success metric.

The exact mechanics of running `/api/analyze`/`/api/recommend` outside the authenticated UI flow for repeatable evaluation (both routes currently require a signed-in Supabase user) are an implementation detail for the plan, not resolved here — likely a small `ADMIN_SECRET`-gated eval script that calls the underlying `buildRecommendations`/pool functions directly rather than through the HTTP routes' auth layer.

---

## Catalog Backfill (Parallel, Non-Blocking)

New script mirroring `scripts/backfill-story-context-tags.mjs`, but lighter-weight — it does **not** re-run full `autoTagSong()` (which would re-hit iTunes/Last.fm/GPT-tagging pointlessly for songs already tagged). A narrow `generateMusicSupervisorSummary(title, artist)` GPT call + `embedText()`, writing only `music_supervisor_summary`/`brief_embedding` via the extended `update_song`. Idempotent, same re-run-safe pattern as the existing backfill script — recomputes the "missing" set from live data each run.

A song missing `brief_embedding` (mid-backfill, or a song added the moment before this ships) simply doesn't appear in Pool 5 and scores `briefFit = 0` — not an error, not a hard block. Fully consistent with how v2 already treats songs missing `story_context_tags`.

---

## How New Songs Get Added (No Workflow Change)

`autoTagSong()` — called from `POST /api/admin/songs` and every seed script — gains the two extra steps (extended prompt field + one `embedText()` call) internally. The admin "type title + artist, click Add" flow is unchanged; the brief and its embedding are generated for free inside the existing call, same as `story_context_tags` already is today.

---

## Explicit Invariants

1. `ENABLE_BRIEF_POOL` defaults OFF. Enabling it in production is a deliberate, manual action gated by the Layer 6 evaluation review — never automatic on deploy.
2. When the flag is on, Pool 5 and `briefFit` only activate per-song when both the photo's and that song's embeddings are present — a song mid-backfill degrades to `briefFit = 0`, never an error.
3. `briefFit`'s starting weight (20) is explicitly provisional. This spec does not attempt to justify a "correct" final weight — that is deferred to a follow-up after the evaluation set produces real comparison data.
4. All four existing v2 pools, the Rules Layer, and all existing scoring components are structurally unchanged. v3 is additive-only — nothing from `docs/superpowers/specs/2026-07-02-retrieval-v2-design.md` is removed or altered.
5. Photo-side and song-side brief prompts must stay written from the same shared "music supervisor" instruction fragment. A stylistic drift between the two would silently corrupt `briefFit` (it would still compute a number, just not a meaningful one) — this is a correctness requirement, not a style preference.
6. `briefFit` is not scaled by `photoConfidence`/`confFactor`, unlike `contextFit`/`vibeAestheticFit`/`storyFit` — a deliberate exception, not an oversight (see Layer 5).

---

## What Does NOT Change

- All of Retrieval v2: four existing pools, Rules Layer (energy tolerance, anti-tags, hard blocks, language), existing scoring components and their weights, `blendQueryVector`'s confidence-aware blend.
- The two open bugs noted during the 2026-07-03 audit that this spec does not fix: `photoConfidence` calibration (GPT clusters at 0.8-0.9 regardless of actual ambiguity — needs the categorical-self-assessment treatment `lib/autoTag.ts` already uses for song confidence, not addressed here) and `STORY_CONTEXT_TAGS` vocabulary coverage gaps (partially mitigated by the 2026-07-03 prompt fix forcing closest-match-or-empty instead of invented tags, not expanded further here).
- Auth, credits, payments (Polar), YouTube/iTunes playback — untouched.
- Requested-vibe UI wiring, Spotify integration, `lib/matching.ts` dead code — still out of scope, per v2's own deferred list.
- Scoring weight tuning beyond the conservative starting point above — explicitly deferred to a follow-up once the evaluation set produces data.

---

## Phasing

**Phase 1 (this spec, single implementation unit) — flag stays OFF throughout:**
1. `lib/musicBrief.ts` — parse/validate `musicBrief`, `buildBriefText()`.
2. `lib/embeddings.ts` — `embedText()` helper.
3. Extend `/api/analyze` prompt + response with `musicBrief` + `photoBriefEmbedding`.
4. Extend `autoTagSong()`/`buildGptTagPrompt` with `music_supervisor_summary`; attach `brief_embedding`.
5. Schema migration: two new columns, `match_songs_by_brief` RPC, extended `update_song`/`create_song`.
6. `searchCatalogByBrief` in `lib/db/songs.ts`.
7. Wire Pool 5 + `briefFit`/`briefSimilarity` into `/api/recommend`, gated end-to-end by `ENABLE_BRIEF_POOL` (default off).
8. Forward `photoBriefEmbedding` through `app/app/page.tsx`.
9. Catalog backfill script for `music_supervisor_summary`/`brief_embedding`.

**Phase 2 (separate, after Phase 1 ships with flag off):**
10. Build the evaluation set + comparison tooling (Layer 6).
11. Run the before/after comparison, human review, decide whether to flip `ENABLE_BRIEF_POOL` in production.
12. Only after a positive decision: weight tuning based on real comparison data — explicitly out of scope for Phase 1's implementation plan.

**Explicitly deferred, not part of either phase:** `photoConfidence` recalibration, `STORY_CONTEXT_TAGS` vocabulary expansion, requested-vibe UI, Spotify, `lib/matching.ts` cleanup.
