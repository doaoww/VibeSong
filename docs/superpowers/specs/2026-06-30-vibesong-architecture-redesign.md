# VibeSong Architecture Redesign
**Date:** 2026-06-30  
**Status:** Approved — ready for implementation planning

---

## Problem Statement

The current system asks GPT-4o to simultaneously analyze the photo, invent song names, and score them. This is the root cause of poor recommendation quality: GPT hallucinates songs that don't exist, picks lazy obvious choices, and cannot guarantee the "magic first impression" the product requires.

**Root cause:** GPT is doing too many jobs at once. Song selection must be separated from photo analysis.

---

## Core Principle

> "What would *this person* actually post with *this photo*?"

VibeSong is not a music streaming product. It is a Taste Engine for social storytelling. The system must understand not just what emotion a photo conveys, but what *story* the user wants to tell with it.

---

## Chosen Architecture: Taste Graph + Curated Catalog + Rules + Scoring + Feedback Loop

### The Five Layers




```
INPUT PHOTO
    ↓
[1. Photo Analysis]      GPT-4o → Photo Vector (10 dimensions)
    ↓
[2. Catalog Search]      pgvector → 50 candidates from song database
    ↓
[3. Rules Layer]         Hard filters: language, blocks, energy compatibility
    ↓
[4. Scoring Layer]       Soft ranking: photo fit + taste fit + story fit + novelty
    ↓
[5. Feedback Loop]       Every save/skip/perfect updates the user's taste profile
    ↓
TOP 8–12 SONGS
```

GPT touches only Layer 1. Songs come only from the catalog. The final ranking is deterministic and explainable.

---

## Three Input Signals

Every recommendation is built from three signals. None replaces the others.

| Signal | Source | Role |
|--------|--------|------|
| **Photo Vector** | GPT-4o photo analysis | Visual ground truth — what is objectively in the image |
| **User Taste Profile** | Onboarding + feedback history | Who this person is musically |
| **Requested Vibe** | Optional text input before analysis | What story they want to tell right now |

### Combining the three signals

**Without requested vibe:**
```
query_vector = photo_vector × 0.55 + taste_vector × 0.45
```

**With requested vibe:**
```
query_vector = photo_vector × 0.40 + taste_vector × 0.25 + vibe_vector × 0.35
```

### Requested Vibe — Compatibility Safeguard

The requested vibe shifts direction; the photo stays the visual anchor. The cap formula:

```
target_dim = clamp(photo_dim + vibe_boost, photo_dim - 0.25, photo_dim + 0.35)
```

Example: photo has `energy: 0.2` (calm, soft). User writes "dark toxic revenge" (energy boost +0.7). The applied energy becomes `clamp(0.2 + 0.7, -0.05, 0.55) = 0.55`, not 0.9. The system translates the request into something compatible — "soft revenge", "quiet confidence", "expensive sadness" — rather than jumping to aggressive/dark songs that contradict the visual truth.

### Requested Vibe — UI

Appears before photo analysis. Optional.

```
Describe the vibe you want (optional)

[ make it feel like she will regret losing me     ]

Quick picks: [expensive sadness] [main character] [hot girl night] [Russian indie cold]
```

GPT-4o parses the free text into structured signals (this is a fast JSON extraction, not song selection):

```json
{
  "emotional_boosts":  { "confidence": 0.4, "darkness": 0.2, "energy": 0.3 },
  "story_intent_tags": ["post-breakup confidence", "soft revenge", "she'll regret losing you"],
  "anti_tags":         ["too sad", "too slow"],
  "language_hint":     null,
  "niche_direction":   "lean niche"
}
```

---

## Layer 1: Photo Analysis

**Model:** GPT-4o (current). Can be swapped for Gemini Flash for cost/speed without changing the API contract.

**What GPT returns:**
- `photo_vector` — 10-dimension emotional vector
- `photo_confidence` — 0.0–1.0 (how clear the vibe is)
- `moment_type` — reflective-solo | social | nature-escape | urban | romance | high-energy
- `vibe_caption` — 3–6 words describing the social moment
- `vibe_tags[]` — 3 tags
- `scene` — setting, time of day, season, weather

**What GPT does NOT do:** suggest, invent, or select songs.

### Emotional Vector (10 dimensions, 0.0–1.0)

```
dreamy      nostalgia    energy      cinematic    darkness
confidence  intimacy     danceability electronic  acoustic
```

These same dimensions exist on every song in the catalog. Similarity search works because they share the same vector space.

---

## Layer 2: Song Catalog

### Database Schema (Supabase + pgvector)

```sql
songs (
  id              uuid primary key,
  title           text not null,
  artist          text not null,
  album           text,
  year            int,
  duration_seconds int,
  language        text not null,       -- actual vocal language
  popularity_tier int check (1–5),     -- 1=niche, 5=mainstream
  
  -- Vector (pgvector extension)
  emotional_vector vector(10),         -- indexed for similarity search
  
  -- Key dimensions extracted separately for Rules Layer SQL filtering
  energy   float,   -- mirrors emotional_vector[2], used in energy compatibility filter
  
  -- Tag arrays
  genre_tags          text[],
  aesthetic_tags      text[],
  mood_tags           text[],
  story_intent_tags   text[],          -- "post-breakup confidence", "soft revenge"
  modern_aesthetic_tags text[],        -- "quiet luxury", "dark academia", "Slavic sad girl"
  
  -- Playback
  itunes_preview_url  text,
  artwork_url         text,
  apple_music_url     text,
  youtube_id          text,
  
  -- Quality metrics (updated by feedback)
  save_count     int default 0,
  skip_count     int default 0,
  perfect_count  int default 0,
  quality_score  float generated always as (
    case when (save_count + skip_count) = 0 then 0.5
    else save_count::float / (save_count + skip_count)
    end
  ) stored,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

### Story Intent Tags (canonical list, extendable)

```
post-breakup confidence    expensive sadness         soft revenge
she'll regret losing you   cold Russian melancholy   toxic but iconic
quiet luxury               main character walk       private story energy
clean girl morning         lonely but pretty         night-luxe
cinematic soft flex        modern romantic           not basic TikTok
Slavic sad girl            hot girl summer           dark feminine
cool girl car selfie       dark academia moment      healing era
confident comeback         bittersweet nostalgia     chaotic but cute
```

### Auto-Tagging Pipeline (per song, runs once on add)

```
1. iTunes Search API      → title, artist, album, preview URL, artwork, duration
2. Last.fm API            → community tags, similar artists
3. GPT-4o analysis        → emotional_vector, story_intent_tags, modern_aesthetic_tags,
                            mood_tags, aesthetic_tags, language confirmation
4. Save to Supabase       → pgvector index updated automatically
```

GPT receives: title, artist, genre hints, Last.fm tags, lyrics excerpt (if available).  
GPT does not listen to audio — it reasons from metadata and cultural knowledge.  
The pipeline is re-runnable: if tagging improves, the whole catalog can be re-indexed.

### Initial Catalog Target

**Vertical slice (launch with this):** 150–300 songs, covering Russian and English first. Good coverage of `story_intent_tags` matters more than volume. Every song must be real, playable, genuinely fit at least 3 story contexts.

**Target after validation:** 500+ songs, adding K-pop, Spanish/Latin, Turkish, Uzbek once the recommendation engine is proven on Russian/English.

Quality over quantity. 200 perfectly tagged songs outperform 1000 loosely tagged songs.

### Auto-Tagging Accuracy Note

For MVP: GPT reasons from artist, title, Last.fm tags, and lyrics excerpts. This is sufficient to launch.

For quality improvement later: add audio-based analysis (Deezer BPM/energy metadata, Cyanite or similar music tagging API that analyzes actual audio). GPT-only tagging can misread a song's true vibe — especially for instrumental or genre-bending tracks. The pipeline is designed to be re-runnable: when better tagging is available, the whole catalog can be re-indexed without changing application code.

### Admin Interface for Manual Corrections

Auto-tagging will make mistakes. A simple admin screen is required to manually edit any song's: `language`, `story_intent_tags`, `modern_aesthetic_tags`, `popularity_tier`, `genre_tags`. This is a non-negotiable part of the catalog system — not a future feature.

---

## Layer 3: Rules Layer (Hard Filters)

Applied in order after pgvector returns 50 candidates. A song that fails any rule is removed.

1. **Language filter (strict)** — if user selected "Only what I selected", any song not in their language list is removed unconditionally. No exceptions — not even a perfect vibe match overrides this. For "Mostly mine, sometimes others", a soft penalty applies instead of removal.
2. **Hard blocks** — songs in user's "never show again" list → remove
3. **Artist blocks** — artists explicitly blocked by user → remove
4. **Energy compatibility** — `|song.energy - query_vector.energy| > 0.5` → remove (prevents calm photo getting aggressive songs; `query_vector.energy` is the blended energy dimension after applying vibe cap)
5. **Anti-tag filter** — song has a tag that matches `requested_vibe.anti_tags` → remove

---

## Layer 4: Scoring Layer

### Scoring Formula

```
photo_fit        = cosine_similarity(query_vector, song.emotional_vector) × 40
taste_fit        = genre_overlap_score × 15 + artist_proximity × 10 + aesthetic_match × 5
  -- artist_proximity: 0–1 score from Last.fm similarity graph between song artist and user's liked artists
story_fit     = story_intent_tag_overlap_count × 7          (max 3 tags × 7 = 21, only if vibe requested)
novelty_fit   = discovery_style_score × 10
quality_bonus = song.quality_score × 5

raw_score = photo_fit + taste_fit + story_fit + novelty_fit + quality_bonus
```

### Penalties

```
language_soft_mismatch    -15    (language matches but not primary preference)
shown_recently_to_user    -20    (same song in last 5 sessions — freshness)
mainstream_penalty        -10    (if discovery_style=niche and popularity_tier > 3)
```

### Final Score

```
final_score = clamp(raw_score - penalties, 0, 100)
```

Sort by `final_score` descending, return top 8–12.

### Scoring Debug Log (required from day one)

Every recommendation call must log all components per song:

```json
{
  "song": "Земфира — Хочешь?",
  "photo_fit": 34.2,
  "taste_fit": 22.0,
  "story_fit": 14.0,
  "novelty_fit": 7.5,
  "quality_bonus": 2.5,
  "penalty_language": 0,
  "penalty_freshness": -20,
  "penalty_mainstream": 0,
  "final_score": 60.2,
  "rules_removed": false
}
```

Also log which candidates were removed by the Rules Layer and why (`language_mismatch`, `hard_block`, `energy_gap`, `anti_tag`). Without this log, it is impossible to debug why a recommendation was bad. This is not optional.

---

## Layer 5: Adaptive Onboarding

Goal: enough signal for a good first recommendation in 30–60 seconds.

### Stage Labels (no fake percentages)

| Stage | When | Recommendation quality |
|-------|------|------------------------|
| Cold start | New user, no data | Relies on language + artist seed |
| Usable | After Step 2 (artists named) | Artist-graph seeding helps |
| Personalized | After 8–12 swipes | Taste vector formed |
| Highly personalized | After 3+ photo sessions with feedback | Full profile active |

### Onboarding Flow

**Step 1 — Languages (10 seconds)**
```
What do you listen to?
[Русский] [English] [Korean] [Spanish] [Arabic] [French] [Turkish] [Uzbek] [Hindi] [Japanese]

How open are you to other languages?
○ Only what I selected
○ Mostly mine, sometimes others
○ Open to everything
```

Required before swipes. Without this, swipe signals are misinterpreted.

**Step 2 — Favorite Artists (15 seconds)**
```
Name 2–3 artists you love
[ search... ]  → autocomplete via Last.fm

[Макс Корж ×]  [Земфира ×]  + add

→ Skip for now
```

These names immediately seed the swipe pool: Last.fm finds similar artists → system finds their songs in catalog → swipes show those songs. Not random tracks.

**Step 3 — 8–12 Filtered Swipes**

Only songs matching selected language(s). The question is not "do you like this song?" but:

```
Would you post this with your story?

♥ Yes          ✕ Nope
```

This framing trains the model on the actual task — music for Stories, not music in general.

After all cards are swiped: progress screen with option to swipe 8 more for higher accuracy.

**Quick Start Path (alternative)**

"Skip and try now" button after Step 1. User goes directly to photo upload. After first recommendation, the app offers: "Help us understand your taste → Swipe 8 songs". Some users will take this path; the feedback loop still builds their profile over time.

---

## Feedback Loop

### Per-recommendation Feedback (always visible)

```
❤️ Perfect    👍 Good    👎 Wrong vibe    ✕ Never again
```

### Reason picker (shown after Wrong or Never again)

```
What was off?
○ Too sad / too slow       ○ Too mainstream / basic
○ Wrong language           ○ Too fast / too intense
○ Wrong vibe for photo     ○ Not my style at all
```

### What each signal does

| Action | Effect on taste profile |
|--------|------------------------|
| ❤️ Perfect | +0.8 to emotional vector dimensions, strong genre boost, story intent tag affinity |
| 👍 Good | +0.3 to emotional vector, small genre boost |
| 👎 Wrong vibe | -0.4 on relevant emotional dimensions; if reason given, targeted rollback |
| ✕ Never again | Hard block on this specific song only |
| ✕ + "not this artist" reason | Hard block on artist |
| 3+ skips from same artist | Artist score reduced (soft signal) |
| Save to library | +0.5 to emotional vector |
| Swipe skip (no rating) | -0.2 (weak signal — could be contextual) |

**Important:** "Never again" blocks the song, not the artist by default. Artist blocks require explicit user confirmation or a pattern of repeated negative signals from the same artist.

### Song Battle (optional deep calibration)

After several recommendations, optionally show:

```
Which fits this photo better?

[Cover A]              [Cover B]
Макс Корж             Луна
Cold evening          Night drive
────────────────────────────────
→ Song A              → Song B
```

Pairwise comparison provides 3–4× stronger signal than individual swipes because the user discriminates between specific alternatives rather than rating in isolation.

---

## User Taste Profile Schema

```sql
user_taste (
  user_id             uuid primary key,
  
  -- Onboarding settings
  languages           text[] not null default '{}',
  language_openness   text default 'flexible',   -- strict | flexible | open
  discovery_style     text default 'balanced',   -- niche | balanced | popular-ok
  dislikes            text[] not null default '{}',
  
  -- Emotional taste vector (same 10 dimensions as songs)
  emotional_vector    vector(10),
  
  -- Genre preferences (-1.0 to 1.0)
  genre_scores        jsonb default '{}',
  
  -- Artist preferences
  liked_artists       text[] default '{}',
  blocked_artists     text[] default '{}',
  blocked_songs       text[] default '{}',    -- "Never again" songs
  
  -- Story intent affinity (which story tags this user saves most)
  story_tag_scores    jsonb default '{}',
  
  -- Per-moment-type context vectors (already in codebase)
  context_vectors     jsonb default '{}',
  
  setup_complete      boolean default false,
  updated_at          timestamptz default now()
)
```

---

## External APIs

| Service | Usage | Auth |
|---------|-------|------|
| iTunes Search API | Track metadata, preview URLs, artwork | None (free) |
| Last.fm API | Similar artists, community tags, artist search | API key |
| GPT-4o | Photo analysis, vibe parsing, auto-tagging | OpenAI key |
| Supabase pgvector | Similarity search | Supabase key |
| YouTube Data API | Playback fallback when iTunes preview unavailable | API key |

Deezer API can be added later for BPM and energy metadata to supplement GPT-based tagging.

---

## What Does NOT Change

- Auth system (Supabase + Auth.js) — unchanged
- Credits system — unchanged
- YouTube playback — unchanged
- iTunes preview integration — unchanged
- Decay-weighted feedback aggregation in `tasteProfile.ts` — kept, extended
- Per-moment-type context vectors — kept, integrated into taste profile schema

---

## What Changes

| Current | New |
|---------|-----|
| GPT picks song names | GPT analyzes photo only |
| Songs validated after GPT picks them | Songs come from catalog only |
| Single giant GPT prompt | Separate: photo analysis prompt + vibe parsing prompt |
| TasteSetup form (5 steps) | Adaptive onboarding (language → artists → filtered swipes) |
| Binary save/skip | 4-tier feedback + reason picker |
| No requested vibe input | Requested vibe as third input signal |
| Simple string tags on songs | Emotional vector + story intent tags + modern aesthetic tags |
| No song database | Curated catalog in Supabase with pgvector |
| Scoring in application code | Transparent scoring formula, every component logged |

---

## Implementation Strategy: Vertical Slice First

Do not build the entire system at once. Build a small but fully working vertical slice, validate that recommendations are good, then expand.

### Phase 1 — Vertical Slice (prove the engine works)

1. Enable pgvector in Supabase + create `songs` table
2. Build auto-tagging pipeline (admin script: song title/artist → iTunes + Last.fm + GPT → save to DB)
3. Build simple admin UI — add songs, edit tags, view catalog
4. Seed 150–200 songs (Russian + English, good story_intent_tag coverage)
5. Rebuild `/api/analyze` — GPT returns photo vector only, no song names
6. Build `/api/recommend` — query vector + pgvector search + rules layer + scoring layer + debug log
7. Wire up the new recommend API to the existing results UI (swipe cards still work)
8. Test manually: upload photos, verify recommendations feel right, read debug logs

**Exit condition for Phase 1:** Recommendations feel noticeably better than the old GPT-picks-songs system. Debug log makes it clear why each song was ranked where it was.

### Phase 2 — Personalization

9. Add requested vibe input to photo upload flow
10. Update onboarding (language-first → artist seeding → filtered swipes)
11. Update taste profile schema (add `languages`, `language_openness`, `story_tag_scores`, `blocked_songs`)
12. Update feedback UI (4-tier rating + reason picker)
13. Wire feedback into taste profile updates

### Phase 3 — Polish

14. Song Battle screen
15. Expand catalog to 500+ songs (K-pop, Spanish/Latin, Turkish, Uzbek)
16. Add Deezer BPM/energy metadata to auto-tagging pipeline
17. Re-index catalog with improved tagging
