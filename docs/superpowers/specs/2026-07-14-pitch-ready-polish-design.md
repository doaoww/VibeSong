# Pitch-Ready Polish: Surface Existing Intelligence + Live Taste-Learning

## Problem

VibeSong is being pitched to investors/an accelerator this week (video-recorded
demo + existing slide deck). The founder is worried the product reads as
technically shallow — "photo in, GPT picks a song name, YouTube search" — and
wants to add something that looks like a real "agent."

That fear is only half right. The backend already does more than it shows:

- `lib/curator.ts` + `app/api/cron/curate-catalog/route.ts` run a real,
  autonomous, Vercel-Cron-scheduled agent that pulls trending charts daily,
  tags candidates, dedupes, and gates low-confidence additions behind
  `needs_review` — nobody has to press a button.
- `/api/recommend` runs real pgvector similarity search (`lib/db/songs.ts`,
  `lib/vectorMath.ts`, `lib/recommend.ts`) across six parallel retrieval pools
  (vector, story-tag, context-tag, taste, brief-embedding, language) and
  scores candidates on a weighted blend of photoFit/tasteFit/storyFit/
  contextFit/briefFit plus penalties.

None of this reaches the UI. `SwipeCard` shows one bare `matchScore` percentage
(mobile doesn't even show the `reason` text), and there's no live personalization
signal — the 12 cards returned after upload are ranked once, server-side, and
never adapt to what the user does mid-session even though `Track` already
carries `photoFitScore`/`tasteFitScore` from the API response.

Design principle #1 in `PRODUCT.md` already says this out loud: "Make the
match feel earned: expose the signals that explain why a song belongs." This
work is that principle, applied under a pitch deadline.

## Change

Three pieces, in build order (each independently shippable/skippable if time
runs short — cutting #3 still leaves #1+#2 as a coherent improvement):

### 1. Surface the match-score breakdown (SwipeCard)

Replace the single `matchScore` bar with a compact breakdown using data that
mostly already flows to the client (`Track.photoFitScore`, `Track.tasteFitScore`
per `store/useAppStore.ts:64-68`):

- Extend the `mappedTracks` mapping in `app/app/page.tsx` (~line 205-227) to
  also carry `storyFitScore: s.scoreComponents.storyFit` and
  `emotionalVector: s.emotional_vector` (the latter needed by piece #3 below)
  onto `Track`.
- `components/SwipeCard.tsx`: replace the desktop-only `MatchScore` component
  with a small breakdown showing 2-3 labeled mini-bars (Photo vibe / Your
  taste / Story) instead of one generic bar, each using existing translation
  infrastructure (`t.swipe.*`) — new keys `photoFit`, `tasteFit`, `storyFit`
  added to `lib/translations/en.ts` / `ru.ts`. Rendered on **both** mobile and
  desktop layouts (today `reason`/score detail is desktop-only — mobile is
  where a phone-recorded demo will actually be filmed).
- Numeric percentages stay alongside the bars (WCAG: don't rely on color/bar
  length alone, per `PRODUCT.md` accessibility principle already in place).
- No backend changes — `scoreComponents.storyFit` and `emotional_vector` are
  already computed and returned by `/api/recommend`, just not threaded through
  the client mapping.

### 2. Demo-safety pass (not a rebuild — the flow is more solid than it looked)

Reading `app/app/page.tsx` and `app/results/page.tsx` directly (rather than
trusting a grep-based sweep) shows loading (`analyzing` state with progress
text), error+retry (`errorMsg`/`failedUpload`), and an empty/done state
("nothing saved, try another photo") already exist and are reasonably built.
The real gap for a *recorded* demo is silent long waits:

- `app/app/page.tsx`: in the `analyzing` state, add a fallback line that
  appears if analysis is still running past ~8s (e.g. "Still working — the AI
  is checking your photo against thousands of tracks"), so a slow OpenAI/
  YouTube round-trip during recording doesn't look frozen. Implemented as a
  `setTimeout` alongside the existing `analyzeTextIdx` interval, not a new
  polling mechanism.
- Quick manual pass in the browser at the actual recording viewport (phone
  size if filming on phone) to confirm nothing clips/overflows — visual QA,
  not a code deliverable to spec line-by-line.

### 3. Live in-session taste-learning re-rank

The new "agent" story: as the user swipes, the remaining unseen cards
re-rank in real time toward what they just saved and away from what they
skipped — visible, not simulated, built on the scoring math that already
exists (`cosine` in `lib/vectorMath.ts`, `emotional_vector` per song).

- `lib/sessionTaste.ts` (new): a pure function that folds a newly-saved or
  newly-skipped track's `emotionalVector` into a running session vector —
  exponential-moving-average nudge toward saves (larger pull weight), smaller
  push away from skips, clamped like `applyVibeCap` already does elsewhere.
  Starts `null` (no saves yet → no re-ranking, stack stays server-ranked).
- `app/results/page.tsx`: on `handleSave`/`handleSkip`, after recording the
  swipe, update the session vector and recompute a `liveScore` for every
  **not-yet-seen** remaining track (never the current top card mid-view) as a
  blend of its original `finalScore` and its cosine similarity to the updated
  session vector. Remaining indices are reordered via a local
  `remainingOrder: number[] | null` array of original indices — the
  underlying `tracks` array/`gone` index-tracking in the store is untouched,
  only the *display order* of not-yet-gone indices changes.
- Visual feedback: a brief "Learning your vibe…" pulse near the score
  breakdown (piece #1) for ~1.5s after a re-rank, same toast pattern already
  used for `paymentSuccess`. Card stack positions animate into their new
  order (spring transition on the `y`/`scale` values in `SwipeCard`, currently
  static inline styles) rather than snapping, so the reorder is visible on
  camera.
- Requires at least one save before it activates — first card(s) reflect pure
  server ranking, which doubles as an honest "this needs a signal to learn
  from" behavior rather than fake immediate personalization.

## Out of scope

- No cross-session/persistent taste memory — this is in-session only, per
  the earlier decision; `sessionTasteVector` lives in component state and
  disappears on navigation, same as the rest of the swipe session.
- No changes to the curator agent's cron schedule, catalog logic, or
  admin review flow — piece #1/#2 only surface it in narrative (deck talking
  points), not new UI screens for it.
- No new backend retrieval pools, no changes to `/api/recommend`'s scoring
  formula in `lib/recommend.ts` — the live re-rank in piece #3 is a
  client-side nudge on top of already-fetched candidates, not a new server
  round-trip (keeps it zero-latency-risk for a recorded demo).
- No changes to credits, auth, or payment flow.
- Deck content/slides are not touched — only product/demo surface.
