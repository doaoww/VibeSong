# VibeSong Matching Algorithm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade VibeSong matching so recommendations balance photo vibe, optional user taste, discovery style, and clean playback quality.

**Architecture:** Keep the current Next.js route structure. Expand the taste model and GPT response schema, add server-side score normalization, add an iTunes resolver before YouTube fallback, and update the player to support audio previews.

**Tech Stack:** Next.js App Router, TypeScript, React 19, OpenAI GPT-4o, iTunes Search API, YouTube Data API fallback, Zustand localStorage state.

---

## Files

- Modify `components/TasteSetup.tsx`: richer optional quiz and expanded `UserTaste`.
- Modify `store/useAppStore.ts`: richer `VibeProfile`, `GPTTrack`, and `Track` types; record skips.
- Modify `app/api/analyze/route.ts`: deeper prompt, expanded schema, candidate pool scoring, taste defaults.
- Create `lib/matching.ts`: score normalization and discovery-style helpers.
- Create `lib/itunes.ts`: public iTunes Search API preview resolver.
- Modify `lib/youtube.ts`: optional YouTube metadata, stricter fallback filters.
- Modify `app/api/search-tracks/route.ts`: iTunes-first resolution, YouTube fallback, final sorting.
- Modify `components/YouTubePlayer.tsx`: allow preview component split or audio preview support.
- Modify `components/SwipeCard.tsx`: play iTunes preview when present.
- Modify `app/results/page.tsx`: record skips when user skips a card.

## Task 1: Expand Shared Types and Feedback State

- [ ] Update `store/useAppStore.ts` so `GPTTrack` includes `photoFitScore`, `tasteFitScore`, `discoveryFitScore`, `obviousnessPenalty`, `finalScore`, and optional preview metadata.
- [ ] Add `skipTrack(track)` to persist skipped songs in `localStorage` under `vibesong_skipped`.
- [ ] Keep `youtubeId` optional because iTunes previews can now be the primary playback source.
- [ ] Run `npm run lint`.

## Task 2: Upgrade Optional Taste Quiz

- [ ] Update `components/TasteSetup.tsx` with the expanded `UserTaste` interface.
- [ ] Add quiz steps for discovery style, dislikes, language or region, and energy preference.
- [ ] Keep skip behavior optional and save defaults:

```ts
{
  genres: [],
  favoriteArtists: [],
  defaultMood: "",
  discoveryStyle: "balanced",
  dislikes: [],
  languagePreference: "No preference",
  energyPreference: "depends",
  setupComplete: true
}
```

- [ ] Run `npm run lint`.

## Task 3: Add Matching Helpers

- [ ] Create `lib/matching.ts`.
- [ ] Export `normalizeTaste`, `getDiscoveryInstructions`, `normalizeCandidateScores`, and `scoreResolvedTrack`.
- [ ] Ensure old taste objects from localStorage are upgraded safely.
- [ ] Run `npm run lint`.

## Task 4: Upgrade Analyze Route

- [ ] Modify `app/api/analyze/route.ts` to import matching helpers.
- [ ] Update GPT prompt to analyze people, emotions, activity, social vibe, camera mood, and visual aesthetic.
- [ ] Generate 24 candidate tracks and return the top 12 after server-side normalization.
- [ ] Preserve `musicDNA.tracks` so the frontend flow keeps working.
- [ ] Run `npm run lint`.

## Task 5: Add iTunes Resolver

- [ ] Create `lib/itunes.ts`.
- [ ] Search `artist title` with `media=music`, `entity=song`, `limit=5`, `country=US`.
- [ ] Pick the best result by artist/title token overlap.
- [ ] Return `previewUrl`, `artwork`, and `appleMusicUrl`.
- [ ] Run `npm run lint`.

## Task 6: Improve Track Search Route

- [ ] Modify `app/api/search-tracks/route.ts` to try iTunes before YouTube.
- [ ] Add `previewProvider: "itunes"` when iTunes succeeds.
- [ ] Fall back to `searchYouTubeTrack` only when iTunes has no playable preview.
- [ ] Sort by adjusted score and return up to 8 playable tracks.
- [ ] Run `npm run lint`.

## Task 7: Tighten YouTube Fallback

- [ ] Modify `lib/youtube.ts` to reject clip/trailer/scene/intro/reaction/shorts/sped-up/slowed/edit results unless those words are in the original title.
- [ ] Prefer `Topic`, `Official Audio`, `VEVO`, and official channels.
- [ ] Keep duration filter.
- [ ] Run `npm run lint`.

## Task 8: Add Audio Preview Playback

- [ ] Modify `components/YouTubePlayer.tsx` or add an internal audio path so `previewUrl` plays in the same UI when present.
- [ ] Keep the YouTube iframe path for fallback.
- [ ] Update `components/SwipeCard.tsx` to pass `previewUrl`, `previewProvider`, and artwork.
- [ ] Run `npm run lint`.

## Task 9: Wire Skip Feedback

- [ ] Modify `app/results/page.tsx` to call `skipTrack(track)` when a user skips.
- [ ] Ensure saved and skipped feedback are available for future analysis prompts.
- [ ] Run `npm run lint`.

## Task 10: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev` and smoke test upload -> analysis -> results.
- [ ] Confirm result cards can play iTunes previews when available and YouTube fallback when not.
