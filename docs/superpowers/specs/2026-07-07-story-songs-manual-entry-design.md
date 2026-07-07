# Story Songs Step: Manual Artist/Title Entry

## Problem

`StorySongsStep` (onboarding step 4, "Какие песни ты недавно постил(а)?") lets
users add songs only via live search against the internal catalog
(`/api/song-search` → `searchCatalogByText` → Supabase `search_catalog` RPC).
If a song isn't already in the seeded catalog, search returns no results and
there is no other way to add it — the step reads as broken. The save endpoint
(`/api/taste/story-songs`) already accepts arbitrary `{title, artist}` pairs
and AI-tags them via `autoTagSong`, so catalog membership was never actually
required — only the UI enforced it.

## Change

Replace the search box + suggestions dropdown with two plain text inputs
(Artist, Title) and an explicit Add action. Remove the Back button from this
step.

### Input area

- Two text inputs: **Artist**, **Title** (placeholder-only, no separate
  label element — same visual treatment the search input has today).
- **Add** button/action next to or below the inputs.
  - Enabled only when both fields are non-empty after trim (no network
    round-trip needed to enable it).
  - If pressed with either field empty: no request is made; an inline hint
    string appears under the inputs (new translation key
    `storySongs.fillBothFields`), e.g. "Заполни и артиста, и название".
  - On success: appends `{title, artist}` to `picked` (existing dedup logic:
    skip if a pick with the same title+artist already exists), clears both
    inputs, refocuses the Artist input.
- Once `picked.length === 3`, the inputs and Add action are hidden — same
  gating the search box already has today (`picked.length < 3`) — and only
  the `maxReached` copy is shown alongside the picked list.

### Picked list

Unchanged: chips with `title — artist` and a `×` remove button, `pickedCount`
label, same dedup/remove logic.

### Bottom action

Single button, no Back button. Reuses the existing `primaryLabel` /
`handleContinue` logic unchanged:
- `picked.length === 0` → label `continueWithoutSongs` ("Skip"); tapping
  calls `onSkip()`.
- `picked.length > 0` → label `continueWithSelection` ("Продолжить с
  выбранными песнями"); tapping POSTs `picked` to `/api/taste/story-songs`
  then calls `onNext()`.

This means a user who added 1–3 songs and doesn't want to add more just taps
this same button — its label already reads as "continue with what I picked."
No separate "Done" control is introduced.

### Props / parent wiring

- `StorySongsStep` drops the `onBack` prop.
- `OnboardingFlow.tsx` (`step === "story-songs"` branch) stops passing
  `onBack={() => setStep("avoid")}`.

### Removed code

- `query`, `suggestions`, `searchedQuery`, `searching`, `resolving`'s
  sibling search-effect (the `useEffect` debounced fetch), and the
  suggestions/no-matches/searching dropdown markup are deleted from
  `StorySongsStep.tsx`.
- `app/api/song-search/route.ts` is deleted — `StorySongsStep.tsx` is its
  only caller.
- `searchCatalogByText` in `lib/db/songs.ts` is deleted — its only caller is
  the route above.

### Translations (`lib/translations/ru.ts`, `en.ts`, key `storySongs`)

Removed: `searchLabel`, `searchPlaceholder`, `searchHint`, `keepTyping`,
`searching`, `noMatches`.

Added:
- `artistPlaceholder` (e.g. RU "Артист", EN "Artist")
- `titlePlaceholder` (e.g. RU "Название песни", EN "Song title")
- `fillBothFields` (e.g. RU "Заполни и артиста, и название", EN "Fill in
  both artist and title")

Unchanged: `saveFailed`, `heading`, `subtitle`, `pickedCount`, `addLabel`,
`removeSong`, `maxReached`, `finding`, `continueLabel`,
`continueWithSelection`, `continueWithoutSongs`, `optionalNote`.

### Taste-learning path

No change. `/api/taste/story-songs` already tags whatever title/artist pairs
it receives via `autoTagSong` and folds the result into the user's
`genreScores` and emotional vector. Manual entry flows through the same
endpoint the search-based flow used.

## Out of scope

- No changes to `/api/taste/story-songs`, `autoTagSong`, or the emotional
  vector math.
- No changes to the 3-song limit.
- No changes to any other onboarding step.
