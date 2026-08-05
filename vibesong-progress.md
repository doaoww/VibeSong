# VibeSong Audit — Progress

_Last updated: 2026-08-05, late evening_

## ⚠️ Urgent — do this before testing onboarding

I just built the age/generation feature (#3b) and confirmed empirically that **`user_taste.generation` does not exist in production yet**. Because `upsertUserTaste()` saves the whole taste profile in one upsert call, this means **onboarding will silently fail to save anything** (languages, artists, avoid-list — all of it) for any real user who completes it right now, until the migration is applied. The failure is swallowed silently client-side, so nothing looks broken — it just quietly doesn't save.

**Fix:** run `supabase/generation-preference-migration.sql` (main project) and `supabase/song-generation-migration.sql` (catalog project) via the Supabase SQL editor before anyone goes through onboarding.

## Where things stand

All 5 original problems are diagnosed. #1, #2, #3a, #4 are fixed, deployed, and verified with real data/calls. #3b is fully built and test-passing but not yet deployed (see above). #5 is partially addressed.

**1. Faces/portraits (wrong-gender songs)** — ✅ Fixed, deployed, verified end-to-end with real GPT-4o calls against real photos and real penalty math against real classified catalog songs.

**2. "French vibe" ignored** — ✅ Fixed. Deterministic language-keyword matcher now overrides the language filter when you type an explicit request.

**3a. Weak non-English retrieval** — ✅ Confirmed fixed and live (Hindi search now returns real results).

**3b. No age/generation awareness** — ✅ Built this session, following your direction (ask age directly, derive generation, apply the same architecture as the gender fix): new onboarding step asks age range → maps to a generation cohort → songs get a GPT-classified generation tag → a soft scoring penalty deprioritizes songs aimed at a distantly different generation (adjacent generations, like millennial/gen-x, are never penalized — only a 2+ cohort gap is). All code written, typechecked, and test-covered (mirrors the exact pattern already proven for the gender fix). **Not yet deployed** — two migrations need to be applied, then a backfill run (same cost profile as before, ~2583 GPT-4o-mini calls, will ask before running).

**4. Onboarding flash** — ✅ Fixed. Also fixed a related speed bug (redundant network call on every login, not just the first).

**5. Slow loading** — 🟡 One contributor fixed as a side effect of #4. Still need your input on which screen feels slow, or permission to profile broadly.

## What's not done

- The two new #3b migrations need to be applied (see urgent note above)
- The #3b backfill script hasn't been run (needs your go-ahead, real API cost)
- The new age-onboarding screen hasn't been visually tested in a browser — only typechecked/unit-tested
- #5 broader profiling
- A live photo test reproducing the *exact* original #1 bug (man → wrong song) — I don't have a male test photo among the app's assets, so I verified the mechanism in the female direction instead, which is symmetric by construction

Full detail, file-by-file, is in `vibesong-agent-state.json`.

---

**Stopping here.** Dev server is running locally. To continue in a new terminal, say "continue from state file."
