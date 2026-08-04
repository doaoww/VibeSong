# Matching Quality — Phase 1: Taxonomy, POV Signal, Portrait Reading

## Background

An audit of the full photo → song matching pipeline (prompted by reports that matches feel narrow and sometimes tone-deaf — e.g. a man's photo matched to "i don't need a boyfriend") found three root causes that are fixable without new infrastructure:

1. **`lib/tagTaxonomy.ts`'s closed tag vocabulary is almost entirely feminine lifestyle-coded** ("coquette", "clean girl", "mob wife", "hot girl summer"), with no masculine, general/neutral, or cultural-aesthetic equivalents. A male-presenting or culturally-specific photo (e.g. "French vibe") has structurally nowhere good to land.
2. **No signal anywhere in the system represents gender/POV** — not on the photo side, not on the song side. A song's lyrical point-of-view (e.g. a song written from a female narrator's perspective, addressed to "him") can score a strong mood/tag match against a photo of a man with zero mechanism to notice the mismatch.
3. **The vision prompt (`app/api/analyze/route.ts`) gives GPT detailed, example-driven guidance for reading scenes** ("broken nail → frustration", "gym selfie → confidence") **but only one generic line for reading faces/portraits**, so subtlety, grit, and "coolness" in a portrait get read far less reliably than mood in a landscape shot.

A separate, larger audit also found catalog-growth and semantic-search gaps (why "French vibe" doesn't surface chic French songs even with better tags) — those are out of scope here and tracked as later phases (see "Deferred" below).

## Goals

- Expand the tag taxonomy so masculine-coded, gender-neutral, and culturally-specific photos have real tags to match against.
- Add a lightweight, safely-defaulted gender/POV signal so a song whose lyrical address clearly conflicts with the photo's subject is strongly deprioritized — without ever hard-excluding it (the catalog is too thin in places for a hard filter to be safe) and without persisting anything sensitive.
- Give GPT concrete guidance for reading portraits/faces at the same fidelity it already has for scenes.

## Non-goals

- Turning on semantic/embedding-based free-text search (`ENABLE_BRIEF_POOL`) — separate phase, needs its own evaluation gate per the existing `2026-07-03-retrieval-v3-semantic-brief-design.md`.
- Catalog expansion / curator source coverage — separate phase.
- Genre-string canonicalization, `lib/matching.ts` dead-code cleanup, `photoConfidence` calibration — separate, lower-urgency cleanup.
- Any new dimension on the 10-dim `EmotionalVector` — avoided specifically so this phase needs no catalog vector backfill.

## Design

### 1. Taxonomy expansion (`lib/tagTaxonomy.ts`)

Add new entries to `STORY_INTENT_TAGS` and `MODERN_AESTHETIC_TAGS` at comparable density to the existing feminine-coded set, plus a couple of gaps in `STORY_CONTEXT_TAGS`:

- **Masculine/edge-coded** (story intent): "gym flex", "night drive alone", "hustle grind", "rap swagger", "rock grit", "stoic heartbreak", "streetwear energy", "game day".
- **Cultural/aesthetic** (modern aesthetic — today only Slavic culture has coverage via "slavic underground"/"russian indie"/"cold Russian melancholy"): "French chic", "Scandi minimal", "Latin heat", "Japanese minimalist", "K-pop glossy".
- **Context gaps** (`STORY_CONTEXT_TAGS`): "workout", "sports", "study/creative grind".

These are additive to the existing `as const` arrays — no changes to `splitByCanonical`, `normalizeStringArray`, or the `*_SET` derivations, which all operate generically over whatever the arrays contain. `ANTI_TAG_CANDIDATES_SET` picks up the new story/aesthetic tags automatically since it's built from the same arrays.

No prompt change is strictly required for GPT to start selecting these (the arrays are already interpolated into the vision prompt's allowed-values list), but the analyze prompt's existing hedge line ("only pick a feminine-coded tag when the subject genuinely reads as feminine... pick from the remaining neutral tags instead" — `app/api/analyze/route.ts:131`) gets a small edit so it points at the new tags by name rather than a vague "neutral tags" fallback that was thin before this change.

### 2. Gender/POV signal

**New enum** (shared type, e.g. in `lib/tagTaxonomy.ts` or a new small `lib/pov.ts`): `"male-pov" | "female-pov" | "neutral" | "unclear"`.

**Song side** — `lyricalAddress` classified once at tag time in `lib/autoTag.ts` (same call that already produces `story_intent_tags`/`genre_tags`/etc.), stored as a new `lyrical_address` column on the `songs` table (migration; nullable, defaults to `"unclear"` at the DB level so any row without a value is inert). `CatalogSong` (`lib/db/songs.ts:5`) and the create/update RPC payloads (`lib/db/songs.ts:126,167`) gain the field alongside the existing tag columns. A one-time backfill script (same pattern as the existing seed/backfill scripts) classifies the ~600-900 existing catalog songs; songs added after this ships get it automatically via `autoTag`.

**Photo side** — `presentationRead`, computed fresh on every `/api/analyze` call, same enum. This is **never persisted** — not to the `user_taste` table, not anywhere tied to the account — and never shown in any UI. It's forwarded from `/api/analyze`'s response through `app/app/page.tsx` into the `/api/recommend` request body exactly the way `photoVectorArray` already is (`app/app/page.tsx` request-building call site), and used once, in-memory, for that single recommend call.

**Scoring** (`lib/recommend.ts`, alongside the existing penalty block at `:437-474`): a new `povPenalty`, applied only when both sides are confidently opposite (`male-pov` photo + `female-pov` song, or vice versa) — either side being `neutral`/`unclear` means no penalty. Sized as a heavy-but-not-exclusionary deduction: `-25 * confFactor` (heavier than `softAntiTagPenalty`'s per-match `-15`, in the same range as `freshnessPenalty`'s `-20` and the steepest `mainstreamPenalty` tier), gated by the same `confFactor` already used for other GPT-confidence-sensitive components (`storyFit`, `contextFit`, `vibeAestheticFit`) so a low-confidence photo read doesn't strongly punish a song. This demotes a mismatched song out of the top 12 in virtually every real case without ever hard-filtering it — important because a hard filter risks zero results for thin catalog segments (e.g. a niche-language, high-energy, `male-pov`-only pocket of the catalog).

### 3. Portrait/face reading guidance

`BASE_SYSTEM_PROMPT` (`app/api/analyze/route.ts:41-49`) gets 2-3 new worked examples in the same style as the existing scene examples, specifically for portraits/faces/body language — e.g. "guarded/neutral expression + hard lighting → grit/edge, not sadness"; "relaxed shoulders + soft smile → warmth, not necessarily romance"; "direct eye contact + minimal expression → confidence/coolness, not aloofness." This replaces the single generic "mirror selfie → read face + body language carefully" line with concrete calibration, mirroring how scenes are already handled. The new "grit"/"edge"-flavored story-intent tags from Part 1 give this reading somewhere to land in scoring without touching the `EmotionalVector` schema.

## Error handling

Both new enum fields follow the existing project pattern for GPT-filled enums (`discoveryStyle`, `restraint`): if GPT omits the field or returns a value outside the four allowed values, it's coerced to the safe default (`"unclear"` for `lyricalAddress`, `"unclear"` for `presentationRead`) via the same kind of `Set`-validated coercion already used elsewhere. A safe default means the POV penalty simply never fires — it never blocks a request, never throws, and degrades to today's behavior (no POV signal) rather than failing loud.

## Testing

- `tests/recommend.test.mjs`: unit tests on the new penalty function directly — opposite confident pairs produce the expected `-25 * confFactor` deduction; any pair involving `neutral`/`unclear` on either side produces zero; confirms it composes correctly into `finalScore` alongside existing penalties.
- Backfill script: dry-run/idempotency check — running it twice against the same song doesn't change an already-set `lyrical_address`, and it never throws on malformed/missing GPT output (falls back to `"unclear"`).
- No new UI to test — `presentationRead` is never rendered.

## Rollout

Straightforward: ship the taxonomy additions and prompt changes together (pure prompt/const changes, no migration), then the `lyrical_address` migration + backfill script + scoring penalty as a second, still-same-phase deploy once the migration has run. No feature flag needed — none of this changes existing behavior for songs/photos that don't yet have the new signal (safe defaults mean it's purely additive).

## Deferred to later phases

- **Phase 2** — flip `ENABLE_BRIEF_POOL` (the already-built-but-off semantic embedding search) after running its existing deferred evaluation gate; this is the real fix for free-text intent like "French vibe" not surfacing genuinely on-vibe songs.
- **Phase 3** — catalog growth: expand curator source coverage beyond the current 5 trending-chart countries (7 of the 11 onboarding languages currently have zero automated catalog growth), add a diversity/coverage report, canonicalize genre-string matching.
- **Phase 4** — hygiene: remove or clearly mark `lib/matching.ts`'s dead scoring path (superseded by `lib/recommend.ts`) and `/api/search-tracks` if truly unreachable; revisit `photoConfidence` self-calibration.
