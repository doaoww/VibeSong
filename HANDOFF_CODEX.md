# Handoff to Codex — Retrieval v3 Phase 1 implementation

Claude ran out of session budget mid-task. Nothing is broken or blocked —
this is a clean stopping point, just paused before finishing.

## What this is

Implementing `docs/superpowers/plans/2026-07-03-retrieval-v3-phase1-implementation.md`
(11 tasks), which builds on the design in
`docs/superpowers/specs/2026-07-03-retrieval-v3-semantic-brief-design.md`.

Full, detailed progress ledger (what's done, exact commits, review findings,
exact next steps with commands): `.superpowers/sdd/progress.md` — **read this
first**, it has far more detail than this file. This file is just the
short version so you know where to look.

## Status right now

- Tasks 1-3: fully done and reviewed clean. Commits: `efb6352`, `2751b3f`,
  `d1b322f` + fix `52ebc00`.
- Task 4 (`lib/autoTag.ts` — song-side `musicSupervisorBrief`): **implementation
  is done and committed** (`550a9fd`), tests pass (17/17 focused, 120/120 full
  suite), typecheck clean — but it has **not been reviewed yet**. That's the
  very next step.
- Tasks 5-11 + final whole-branch review: not started.

Working directly on `main` (user's explicit choice, no worktree/branch).

## Immediate next step

Review Task 4's diff before doing anything else. If you're running as a plain
CLI agent without Claude's subagent-dispatch tooling, just do the review
yourself:

1. `git diff 92c6c6f..550a9fd` (base `92c6c6f` is a plan-doc-only commit —
   diffing from there instead of `52ebc00` keeps the diff scoped to just
   Task 4's actual change).
2. Read `.superpowers/sdd/task-4-brief.md` (exact requirements) and
   `.superpowers/sdd/task-4-report.md` (what the implementer claims it did).
3. Check specifically:
   - `buildGptTagPrompt` in `lib/autoTag.ts` adds exactly one new JSON field
     (`musicSupervisorBrief`) without disturbing the rest of the schema.
   - `parseGptTagResponse` has **two distinct fallback behaviors** by design
     — the top-of-function `fallback` object (used only when JSON.parse
     throws entirely) must set `music_supervisor_summary: ""` literally.
     The normal-parse path derives it via
     `buildBriefText(parseMusicSupervisorBrief(parsed.musicSupervisorBrief))`,
     which — even with no `musicSupervisorBrief` in the response — actually
     renders `"Restraint: balanced."`, not `""`. These are *deliberately*
     different from each other. Don't "fix" this into one path.
   - `autoTagSong()` skips the `embedText()` call when
     `music_supervisor_summary` is empty, and a real `embedText()` failure
     doesn't crash the whole tagging pipeline.
   - `avoid` (part of `MusicSupervisorBrief`) never reaches
     `music_supervisor_summary`.
4. **Ignore** one unrelated pre-existing line baked into this same commit
   (same file, couldn't be separated): `model: "gpt-4o-mini"` instead of
   `"gpt-4o"` inside `autoTagSong()`'s GPT call. That's from a different,
   earlier concurrent session, not part of this plan — leave it alone, don't
   flag it, don't revert it.

If it looks right: move on to Task 5. If not: fix it directly in `lib/autoTag.ts`
(same file), re-run `node --test tests/autoTag.test.mjs` and `npm test`,
commit as a new commit (don't amend `550a9fd`).

## After Task 4

Tasks 5 through 11 are fully specified in the plan file with complete code
for every step (find/replace blocks, full function bodies, full test files —
nothing is left vague). Work through them in order:

- **Task 5** (`lib/autoTag.ts` — `generateMusicSupervisorBrief` for backfill):
  same file as Task 4, independent addition.
- **Task 6** (DB migration): **cannot be applied by any agent** — there is no
  `exec_sql`-style RPC on this Supabase project (confirmed earlier this
  session). Write `supabase/retrieval-v3-migration.sql` and
  `scripts/verify-retrieval-v3-rpcs.mjs` per the plan, then **stop and ask
  the human** (Dilara) to paste the SQL into the Supabase SQL editor for the
  `SUPABASE_CATALOG_URL` project. Only after she confirms it's applied, run
  `node scripts/verify-retrieval-v3-rpcs.mjs` to confirm, then continue.
- **Task 7** (`lib/db/songs.ts`), **Task 8** (`lib/recommend.ts` scoring),
  **Task 9** (`/api/recommend` wiring), **Task 10** (`app/app/page.tsx`),
  **Task 11** (backfill script) — each has its own full brief in the plan
  file, in order, each depending only on the previous ones already being done.

**Critical constraint to preserve throughout:** `ENABLE_BRIEF_POOL` must stay
unset/false by default at every step. Nothing in Tasks 1-11 should make it
default to `true` anywhere. This is the whole point of the feature-flag
design — verify this explicitly before considering the plan done.

## When all 11 tasks are done

Run the full test suite (`npm test`) and typecheck (`npx tsc --noEmit`) one
more time across everything, then do a final read-through of the whole diff
range (`git diff 0f2024b..HEAD` — `0f2024b` is this plan's true starting
commit, before even the plan-doc commit) against
`docs/superpowers/specs/2026-07-03-retrieval-v3-semantic-brief-design.md`'s
"Explicit Invariants" section (8 numbered invariants) to confirm every one
still holds. Report back to Dilara with a summary — do not merge/deploy
anything or flip any flags without her explicit sign-off, especially since
`ENABLE_BRIEF_POOL` flipping to `true` in production is explicitly gated on
a separate, not-yet-started Phase 2 evaluation per the spec.
