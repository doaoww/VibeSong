# Vibe Intent Input: Let Users State What They Want From The Song

## Problem

Today the only input to matching is the photo itself — GPT-4o Vision reads
the scene and infers mood, genre direction, and story intent purely from
what's visible. There's no way for a user to say "I want this to feel like
X" when the photo alone doesn't carry that intent (e.g. a neutral photo
posted after a breakup, meant to land as "she'll regret leaving me," or a
plain interior shot meant to read as "cozy homebody night"). Users currently
have no way to steer the match beyond re-uploading a different photo.

## Change

Add an optional free-text field, shown above the upload box, where the user
can type what vibe/story they want from the song. If provided, it's sent to
`/api/analyze` alongside the photo and folded into the GPT-4o Vision prompt
as the dominant driver of mood/genre/story-intent output, while the photo
still grounds the literal scene/visual fields. No changes are needed to
`/api/recommend` — it already fully consumes `matchSignals`/`musicBrief`, so
the steer flows through the existing pipeline automatically. This also means
the change does not touch the `ENABLE_BRIEF_POOL`-gated embedding pathway,
which stays off in production per its existing invariant.

If the field is left empty, behavior is unchanged from today.

### New component: `components/VibeIntentInput.tsx`

- Single-line text `<input>`, `maxLength={120}`.
- Controlled component: `value` + `onChange` props, no internal state (parent
  owns the text so it can be sent alongside the image on upload).
- Localized placeholder cycles through 2-3 example phrases (e.g. EN: "she'll
  regret leaving me", "cozy homebody night" — RU equivalents). Static
  placeholder text is enough; no animation/rotation logic required.
- Visually consistent with existing inputs in the app (dark surface, hot-pink
  focus ring, rounded-xl) — matches the treatment already used in
  `StorySongsStep.tsx`'s inputs.
- No validation errors shown for empty submission — it's optional, so there
  is nothing to validate.

### `app/app/page.tsx` (upload screen)

- New local state: `const [vibeIntentText, setVibeIntentText] = useState("")`.
- Renders `<VibeIntentInput value={vibeIntentText} onChange={setVibeIntentText} />`
  directly above `<DropZone />`, inside the same `<section>`.
- `runAnalysis` reads `vibeIntentText.trim()` at call time and:
  - includes it as `vibeIntent` in the `/api/analyze` POST body
    (omit the key entirely, or send `""`, when the trimmed text is empty —
    either is fine since the server treats both as "no intent given").
  - calls `setVibeIntent(vibeIntentText.trim())` on the store (see below) so
    it's available on the results page.
- On successful navigation to `/results`, `vibeIntentText` local state is not
  explicitly cleared — `AppUploadPage` unmounts on navigation, so the local
  input naturally starts blank the next time the upload screen is visited.
- On analysis failure (existing `catch` block), `vibeIntentText` is left as
  whatever the user typed (not cleared), consistent with `failedUpload`
  preserving the photo for retry — the user shouldn't have to retype their
  vibe when hitting "Try again."

### `store/useAppStore.ts`

- New field: `vibeIntent: string | null` (default `null`).
- New action: `setVibeIntent: (text: string) => void` → stores the trimmed,
  non-empty text, or `null` if empty.
- `resetSession()` resets `vibeIntent` to `null` alongside the other
  per-session fields it already clears.

### `app/api/analyze/route.ts`

- Destructure `vibeIntent` (string, optional) from the request body next to
  the existing `exifData`/`contrastMode` destructure.
- Add `buildVibeIntentBlock(vibeIntent: string | null): string`, following
  the same shape as the existing `buildExifBlock`:
  - Returns `""` when `vibeIntent` is missing/blank.
  - Server-side defensively trims and slices to 120 chars (mirrors the
    `MAX_FIELD_LENGTH` pattern already used in `lib/musicSupervisorBrief.ts`)
    — this is a safety net, not the primary limit (the UI's `maxLength=120`
    is primary).
  - Wraps the text clearly as quoted user-supplied data on its own labeled
    line, e.g.:
    ```
    USER'S REQUESTED VIBE (weight this heavily as the dominant driver of
    emotion, musicDNA, matchSignals, and musicBrief — but still ground
    scene/visual fields in what is literally visible in the photo):
    "<vibeIntent text>"
    ```
  - This labeling keeps the text legible as data to quote/react to, not as
    instructions to execute — GPT's output is parsed into a strict
    whitelisted schema afterward regardless (tags validated against fixed
    taxonomies via `parseMatchSignals`, `restraint` whitelisted via
    `parseMusicSupervisorBrief`), so even an adversarial input can only
    produce an off-vibe match, not an unsafe one.
- `buildPrompt(exifBlock)` becomes `buildPrompt(exifBlock, vibeIntentBlock)`,
  concatenating both blocks onto `BASE_SYSTEM_PROMPT`. Every place
  `buildPrompt` is already called (initial attempt, and the retry/fix prompt
  built from `prompt` on parse failure) picks this up automatically since
  they all thread through the same `prompt` variable.
- No changes to the JSON response contract — `musicDNA`, `matchSignals`,
  `musicBrief`, `vibeCaption`, `vibeTags`, `vibeMetrics` all already exist
  and will simply reflect the steer when GPT honors the instruction.
- The response is not modified to echo `vibeIntent` back — the client
  already has the text (it sent it), so the store, not the API response, is
  the source of truth for display.

### Display: analyzing screen (`app/app/page.tsx`, `pageState === "analyzing"`)

- Read `vibeIntent` from the store.
- If non-null, render a small quoted line near the existing `VibeTags`
  block, e.g. below it: `“{vibeIntent}”` in muted italic text, consistent
  with the `vibeCaption` styling already used on the results page. Shown as
  soon as the analyzing screen mounts (does not wait for `vibeProfile` to
  arrive, since the text is already known client-side).
- If `vibeIntent` is null, nothing renders here — no layout change from
  today.

### Display: results screen (`app/results/page.tsx`, `VibeHero`)

- `VibeHero` reads `vibeIntent` from the store (via a new prop, e.g.
  `vibeIntent?: string | null`, passed from the parent the same way
  `caption`/`tags` are).
- Renders it under the existing `caption` line, styled as a distinct muted
  quoted line (not the same bold italic treatment as `caption`, so the two
  are visually distinguishable): e.g. `t.results.youToldUs(vibeIntent)` →
  `You told us: "cozy homebody night"`.
- Omitted entirely when `vibeIntent` is null.

### Translations (`lib/translations/en.ts`, `ru.ts`)

Added under `home`:
- `vibeIntentPlaceholder`: e.g. EN `"What vibe do you want? (optional)"`,
  RU `"Какой вайб тебе нужен? (необязательно)"`.

Added under `results`:
- `youToldUs`: a function `(text: string) => string`, e.g. EN
  `` `You told us: "${text}"` ``, RU `` `Ты хотел(а): «${text}»` ``.

No existing translation keys are removed or renamed.

## Out of scope

- No changes to `/api/recommend`, vector blending, or the
  `ENABLE_BRIEF_POOL` embedding pathway.
- No profanity/content filtering on the typed text — matches the existing
  lenient-input posture used elsewhere in the app (e.g. `StorySongsStep`
  artist/title fields).
- No persistence of `vibeIntent` across sessions/localStorage — it's
  per-upload only, cleared with the rest of session state.
- No changes to the 3-free-credit system, credit deduction, or the
  upload/analyze/recommend request sequencing.
- No changes to video upload frame extraction.
