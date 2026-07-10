# How to seed more songs into the catalog

Instructions for an AI coding agent (Codex, Claude, etc.) tasked with adding
more songs to VibeSong's catalog. Read this fully before writing any code.

## How the pipeline works

1. A seed script is a list of `{ title, artist }` pairs.
2. For each pair it does `POST http://localhost:3000/api/admin/songs` with
   header `x-admin-secret: <ADMIN_SECRET>` and body `{ title, artist }`.
3. The route (`app/api/admin/songs/route.ts`):
   - Checks `title`+`artist` against the DB (`findSongByTitleArtist`). If it
     already exists, returns `409` — **safe to re-run or overlap with other
     seed files, duplicates are skipped automatically.**
   - Otherwise calls `autoTagSong(title, artist)` (`lib/autoTag.ts`), which
     looks the track up via iTunes + Last.fm, then GPT-4o to assign mood/story
     tags, language, popularity tier, and an emotional vector.
   - Inserts the tagged song into Supabase.
4. This means **you never write tags, vectors, or metadata by hand** — you
   only supply real `title` + `artist` pairs. The pipeline does the rest.

## Prerequisites

- Dev server running: `npm run dev` (must be reachable at
  `http://localhost:3000` — pass `BASE_URL=http://host:port` env var if not).
- `.env.local` must already have `ADMIN_SECRET`, `OPENAI_API_KEY`,
  `LASTFM_API_KEY` set (they are, in this repo — don't touch them).
- The hardcoded secret in every seed script is `vibesong-admin-2026`, which
  matches `ADMIN_SECRET` in `.env.local`. Reuse that exact string.

## Adding songs: step by step

1. Look at an existing script for the shape, e.g. `scripts/seed-catalog.mjs`
   or `scripts/seed-vibey-artists.mjs`. Don't reinvent the runner logic —
   copy the `RUNNER` section (the `sleep`, `addSong`, `main` functions) as-is
   from one of those files.
2. Create a new file `scripts/seed-<short-topic-name>.mjs` (e.g.
   `seed-more-latin.mjs`, `seed-turkish-pop.mjs`) rather than editing an
   existing seed file — keeps each batch reviewable and re-runnable on its
   own.
3. Build the `SONGS` array:
   - Only include **real songs that exist** (iTunes lookup has to find them —
     don't invent titles/artists).
   - Group with `// ── CATEGORY NAME ──` comment headers (genre, language,
     vibe, or artist) — see `seed-catalog.mjs` for the convention.
   - Before picking songs, check what's already covered: skim the existing
     `scripts/seed-*.mjs` files (or `GET /api/admin/songs` with the admin
     header) so you're filling gaps, not duplicating — though exact
     duplicates are harmlessly skipped by the API either way.
   - Aim for the same kind of diversity the existing catalog goes for:
     mix of languages (especially Russian + English, but other languages are
     welcome), moods (dark/cinematic, dreamy, confident/energy, post-breakup,
     chill, electronic, etc.), and eras — not just current chart hits.
4. Keep the 2-second delay between requests (already in the runner
   boilerplate) — it exists to respect iTunes/Last.fm/GPT rate limits. Don't
   remove it or parallelize requests.
5. Run it: `node scripts/seed-<name>.mjs` (with the dev server already up in
   another terminal). Watch the console output — each line shows the tagged
   result (language, popularity tier, story tags) or the failure reason.
6. If a run reports failures, don't just retry blindly — check the printed
   error. Common causes: iTunes/Last.fm found no match for that title/artist
   spelling (fix the spelling or drop the entry), or a transient API error
   (safe to re-run just that script; duplicates already inserted are
   skipped).

## What not to do

- Don't call `/api/admin/songs` with anything other than `{ title, artist }`
  — no other fields are accepted or needed.
- Don't write directly to the `songs` table in Supabase to "seed faster" —
  that bypasses tagging entirely and the song will have no mood/story tags,
  breaking matching.
- Don't lower or remove the inter-request delay.
