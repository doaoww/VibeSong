# Handoff: Instagram Story Share v3 — continue this with Codex

Claude's session hit its usage limit mid-implementation. Everything needed to
continue is written down here and in the files it points to — read this
whole file first, then follow "Immediate next step" below.

## Read these first, in order

1. `docs/superpowers/specs/2026-07-14-instagram-story-share-design.md` —
   read the **"v3 (current)"** part of the "Revision history" section and
   the **"Change (v3)"** section. Ignore the "Superseded (v2)" section —
   that's old, do not implement it.
2. `docs/superpowers/plans/2026-07-15-instagram-story-share-v3.md` — this
   is the authoritative, task-by-task implementation plan with **complete,
   exact code for every remaining step**. Do not improvise beyond what it
   specifies.
3. `.superpowers/sdd/progress-igshare.md` — the running progress log for
   this whole feature (all three versions, v1/v2/v3). The bottom of the
   file is the most recent state.

## Where things actually stand right now

- v3 Task 1 (`lib/generateShareVideo.ts`'s `buildShareVideoPlan`) — **done**,
  committed, reviewed, approved. Commit `f44315e`.
- v3 Task 2 (`generateShareVideo` — spawns ffmpeg) — **done**, committed,
  reviewed, approved, and manually verified with a real photo + real audio
  (produced a genuine 15s MP4). Commit `1e014e3`.
- v3 Task 3 (`app/api/share-video/route.ts`) — **code committed** (commit
  `5c0cf5b`), but review caught a real bug: the route 500s under `next dev`
  because Turbopack mis-resolves `ffmpeg-static`'s bundled binary path
  (`ENOENT` on spawn). The fix is **`serverExternalPackages: ["ffmpeg-static",
  "fluent-ffmpeg"]`** added to `next.config.ts` — this is the standard,
  documented Next.js mechanism for exactly this class of native-binary
  bundling problem.
  - **As of this handoff, that fix is already written into `next.config.ts`
    but NOT YET COMMITTED.** Run `git diff next.config.ts` — if you see a
    `serverExternalPackages` addition, it's already there; just verify it
    works (see below) and commit it. If for some reason it's gone, re-add
    exactly that one line (see the plan/ledger for the exact diff).
  - Verify: `npx tsc --noEmit` clean, then `npm run dev` and re-run the
    same manual test this pipeline has already passed twice: get a real
    preview URL via `curl -s "https://itunes.apple.com/search?term=blinding+lights+weeknd&media=music&limit=1" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.results[0].previewUrl);})"`,
    then POST to `http://localhost:3000/api/share-video` with that
    `previewUrl`, `photo=@public/landing/blinding-lights.jpg` (already in
    the repo), `startSeconds=0`, and confirm the response is a real,
    playable ~15s MP4 (check with `ffmpeg -i <file>`, both video and audio
    streams present).
  - Once verified working, commit **only** `next.config.ts` with message:
    `Opt ffmpeg-static/fluent-ffmpeg out of Turbopack's server bundle`
- v3 Tasks 4, 5, 6, 7 — **not started yet.** Full exact code for each is in
  the plan file (`docs/superpowers/plans/2026-07-15-instagram-story-share-v3.md`),
  under "### Task 4", "### Task 5", etc.

## Exact stopping point

Work stopped mid-fix on Task 3, at the very last verification step before
a commit. As of right now:

- `next.config.ts` has an **uncommitted** change adding
  `serverExternalPackages: ["ffmpeg-static", "fluent-ffmpeg"]` (run
  `git diff next.config.ts` to see it — it's a 6-line addition, nothing
  else touched). This was mid-verification (re-running the curl test
  below) when the session ended — it may or may not have been confirmed
  working yet. Re-verify it yourself before committing, don't assume it's
  already proven.
- Also noteworthy: a separate, already-completed commit (`f6ec35f`, "Hide
  Instagram share entry points from swipe/library UI") has temporarily
  removed the share button from `app/results/page.tsx`'s header and the
  per-row share button from `app/library/page.tsx`, so the half-built
  feature doesn't show to real users mid-rebuild. **This is intentional
  and out of scope for the v3 plan** — do not re-add those buttons; that
  commit's own message says they get re-wired "once the feature is
  ready," which is a deliberate later step, not something Tasks 4-7 ask
  for.

## Immediate next step

1. Handle the Task 3 fix above (verify + commit `next.config.ts`).
2. Then work through Task 4 → Task 5 → Task 6 → Task 7 in
   `docs/superpowers/plans/2026-07-15-instagram-story-share-v3.md`, in
   order, exactly as written (each task's Markdown section has the exact
   code, exact commands to run, and exact expected output). Each task ends
   with its own `git commit` — make one commit per task, don't batch them.

## Constraints that still apply

- **Work directly on the `main` branch, in this same working tree — no git
  worktree, no new branch.** This was an explicit, repeated user decision
  throughout this whole feature's history (v1, v2, v3 all built this way).
- **There is a separate, unrelated automated process also committing to
  this same `main` branch concurrently.** Before you start, run
  `git status` — you will likely see modified/untracked files that aren't
  yours (e.g. `app/results/page.tsx`, `components/YouTubePlayer.tsx`,
  `lib/useCredits.ts`, various `scripts/seed-*.mjs` files, possibly a new
  `docs/superpowers/plans/2026-07-15-us-seo-geo-optimization.md`). **Do not
  touch, stage, or commit any of those** — only add/commit the exact files
  each task in the v3 plan names. Never use `git add -A` or `git add .` —
  always add specific files by path.
- The v3 plan **does not touch `app/results/page.tsx` or
  `app/library/page.tsx` at all** — `ShareSheet`'s prop contract
  (`isOpen`/`onClose`/`track`/`photoUrl`) is unchanged from the previous
  version, so those two files need zero edits in this plan. If a task
  seems to need you to touch either of those files, stop and re-read the
  plan — that would be a mistake.
- After each task: run `npx tsc --noEmit` and (where the task's plan text
  says to) `npm test` / `node --test <specific file>` before committing.
  Confirm output matches what the plan says to expect.
- Optionally keep updating `.superpowers/sdd/progress-igshare.md` with a
  short note per task as you go (append, don't rewrite existing content) —
  this is the shared project memory in case yet another handoff is needed
  later. Not required, but genuinely useful given this feature has already
  changed hands/tools/models multiple times.

## Why this feature has been rebuilt three times (context, not action needed)

Quick orientation so you don't accidentally re-litigate settled decisions:
v1 baked song text onto a photo and tried an Instagram pasteboard trick —
reverted after the photo didn't appear on a real device. v2 fixed the
suspected cause (needed a real Meta App ID) and redesigned song-attachment
around clipboard-copy — abandoned when the user couldn't complete third-party
Meta account registration (not a code problem). v3 (current, in progress)
sidesteps Instagram's cooperation entirely: bake real audio into a video
server-side via ffmpeg, so "song attached" doesn't depend on Instagram at
all. Full detail is in the spec's "Revision history" section if you want
it, but you don't need to re-derive any of this — just execute the v3 plan.
