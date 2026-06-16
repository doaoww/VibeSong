# AGENTS.md - VibeSong AI

Read this before ANY code change.

## Docs Order
1. `AGENTS.md` - rules, constraints, product direction
2. `docs/BRD.md` - business requirements
3. `docs/PRD.md` - product requirements  
4. `docs/TRD.md` - technical requirements
5. `docs/TRACKER.yaml` - current progress
6. `design/style-guide.md` - UI rules

---

## What Is VibeSong?
AI-powered app where users upload a photo or video and get 
matched with perfect songs for Instagram/TikTok Stories.
Core mechanic: upload → AI analyzes vibe → swipe song cards.

## Current Phase
PHASE 1 — Core MVP (no payments yet)
Goal: make the matching feel magical before monetizing.

---

## Hard Rules
- Never call OpenAI or YouTube API from client components
- Never expose API keys to the browser
- All AI routes must use Node runtime
- Test each API route before building UI on top of it
- Build in the order defined in TRACKER.yaml
- Do not skip phases or build features out of order
- After each step: tell me what's done, show key code, ask before continuing

# docs/BRD.md - Business Requirements

## Problem
People want perfect music for their Stories but spend 
10+ minutes scrolling through playlists. The vibe never 
quite matches the visual.

## Solution  
Upload a photo → AI reads the mood → get 5 perfect 
song matches in 5 seconds. Swipe to save or skip.

## Revenue Model

### Free (Phase 1 - now)
- 3 free credits on signup
- Full swipe experience
- Save songs to library

### Paid Credits (Phase 2)
- 10 credits / $1.99 ($0.20 per match)
- 50 credits / $6.99 ($0.14 per match) — most popular
- 200 credits / $19.99 ($0.10 per match) — best value

### Pro Subscription (Phase 3 - future)
- Unlimited matches / $9.99 per month
- Spotify playlist export
- Advanced taste personalization

## Business Goals
- Phase 1: validate that AI matching feels accurate and magical
- Phase 2: reach first $500 MRR through credits
- Phase 3: grow to $3000 MRR through Pro subscriptions
- Viral growth through shareable "my vibe" cards

## Success Metrics
- Match feels accurate: >70% of users save at least 1 song
- Retention: user uploads 3+ photos in first session
- Virality: >20% share their vibe card to Stories

# docs/PRD.md - Product Requirements

## Core User Flow
Landing → Upload photo/video → AI analyzes → 
Swipe songs → Save favorites → Library → Share

## Screens

| Screen | Path | Purpose |
|--------|------|---------|
| Home | / | Upload + recent vibes |
| Analyzing | /analyzing | Loading state |
| Results | /results | Swipe cards |
| Library | /library | Saved songs |
| Profile | /profile | Spotify + credits |
| Pricing | modal | Buy credits |

## Features by Phase

### Phase 1 - Core (build now)
- Photo upload (JPG, PNG, max 15MB)
- Video upload (MP4, extract frame at 1 second)
- GPT-4o Vision analysis
- YouTube track search (5 results)
- Swipe mechanic (save / skip)
- Save to library (localStorage)
- 3 free credits system (localStorage)
- Spotify optional login (taste enhancement)

### Phase 2 - Monetization (after Phase 1 works)
- Stripe credit purchases
- Credit tracking in database
- Supabase user accounts

### Phase 3 - Growth (after Phase 2)
- Shareable vibe cards (og:image generation)
- Spotify playlist export
- Pro subscription

## Spotify Integration Rules
- Login is OPTIONAL — main flow works without it
- Without Spotify: GPT picks songs by photo vibe only
- With Spotify: GPT mixes photo vibe + user taste
- Scope needed: user-top-read, user-read-email
- In Development Mode: max 25 users (manually added)
- Show "Enhance with your Spotify taste" as optional CTA

## Credit Rules
- New user: 3 free credits (localStorage)
- Each analysis: 1 credit
- 0 credits: show pricing modal BEFORE analysis starts
- Credits never expire

# docs/TRD.md - Technical Requirements

## Stack
| Layer | Package |
|-------|---------|
| Framework | Next.js 16.2.9 App Router (NOT v14 — breaking changes apply) |
| Styles | Tailwind CSS v4 (no tailwind.config.js — use CSS @import) |
| Language | TypeScript |
| AI Vision | OpenAI GPT-4o (gpt-4o) |
| Music Search | YouTube Data API v3 |
| Auth | Auth.js v5 / next-auth@beta (v4 API is incompatible with Next.js 16) |
| Animation | Framer Motion |
| State | Zustand |
| Deploy | Vercel |
| React | React 19.2.4 |

## Environment Variables
OPENAI_API_KEY=
YOUTUBE_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
# NEXTAUTH_URL for production: https://vibe-song.vercel.app

## File Structure
app/
  page.tsx                     — Home/Upload
  results/page.tsx             — Swipe cards
  library/page.tsx             — Saved songs
  profile/page.tsx             — User profile
  api/
    analyze/route.ts           — GPT-4o vision
    search-tracks/route.ts     — YouTube search
    enhance/route.ts           — Spotify taste mix
    auth/[...nextauth]/route.ts
components/
  DropZone.tsx
  SwipeCard.tsx
  YouTubePlayer.tsx
  VibeTags.tsx
  CreditBadge.tsx
  NavBar.tsx
  PricingModal.tsx
lib/
  openai.ts
  youtube.ts
  spotify.ts
  credits.ts
store/
  useAppStore.ts
docs/
  BRD.md
  PRD.md
  TRD.md
  TRACKER.yaml
design/
  style-guide.md

## API Routes

### POST /api/analyze
Input: { image: string (base64), mimeType: string }
Output: {
  scene: { setting, timeOfDay, season, weather },
  emotion: { primary, secondary, intensity },
  visual: { dominantColors, brightness, aesthetic },
  musicDNA: {
    energy, valence, tempo, genres,
    tracks: [{ title, artist, reason, matchScore }] (8 tracks)
  },
  vibeCaption: string,
  vibeTags: string[]
}
Runtime: nodejs
Model: gpt-4o

### POST /api/search-tracks  
Input: { tracks: [{ title, artist }] }
Output: [{
  title, artist, reason, matchScore,
  youtubeId, thumbnail, youtubeUrl
}]
Logic: search "{title} {artist} official audio"
Filter: duration 2-6 min, exclude live/concert
Return: minimum 5 tracks

### POST /api/enhance
Input: { vibeProfile, accessToken }
Output: { tracks } (re-ranked with Spotify taste)
Only called if user logged in with Spotify

## Styling Rules
- Background: #080808
- Cards: #111111, border: 1px solid #222222
- Primary purple: #7C3AED
- Accent: #A855F7
- Text: #F5F5F5, muted: #888888
- Spotify green: #1DB954
- Border radius: 16px cards, 12px buttons, 999px pills
- Font: Inter
- No hardcoded colors outside these values

## AI Rules
- Never call OpenAI from client components
- All AI routes: export const runtime = "nodejs"
- If GPT returns invalid JSON: retry once with temperature 0
- Strip markdown fences before JSON.parse()
- Add .replace(/```json|```/g, '').trim() before parsing

## Video Handling
Extract frame at 1 second using canvas:
const video = document.createElement('video')
video.src = URL.createObjectURL(file)
video.currentTime = 1
video.onseeked = () => {
  const canvas = document.createElement('canvas')
  canvas.getContext('2d').drawImage(video, 0, 0)
  const base64 = canvas.toDataURL('image/jpeg', 0.8)
}

# docs/TRACKER.yaml

project: VibeSong AI
phase: 1
updated: 2024-01-01

phases:
  - id: 1
    name: Core MVP
    status: in-progress
    steps:
      - id: 1.1
        name: Project setup + dependencies
        status: pending
        tasks:
          - Install next-auth, openai, framer-motion, zustand
          - Create .env.local with all keys
          - Create all folders and empty files

      - id: 1.2
        name: Backend — lib helpers
        status: pending
        tasks:
          - lib/openai.ts — OpenAI client
          - lib/youtube.ts — YouTube search helper
          - lib/spotify.ts — Spotify API helper
          - lib/credits.ts — Credit system logic

      - id: 1.3
        name: Backend — API routes
        status: pending
        tasks:
          - api/analyze/route.ts — GPT-4o vision
          - api/search-tracks/route.ts — YouTube search
          - api/auth/[...nextauth]/route.ts — Spotify OAuth
          - Test each route before moving on

      - id: 1.4
        name: Components
        status: pending
        tasks:
          - DropZone.tsx — drag & drop upload
          - SwipeCard.tsx — framer-motion swipe
          - YouTubePlayer.tsx — iframe player
          - VibeTags.tsx — mood pills
          - CreditBadge.tsx — credits display
          - NavBar.tsx — bottom navigation
          - PricingModal.tsx — credit packages

      - id: 1.5
        name: Zustand store
        status: pending
        tasks:
          - store/useAppStore.ts
          - State: uploadedImage, vibeProfile, tracks,
            savedSongs, credits, isAnalyzing

      - id: 1.6
        name: Pages
        status: pending
        tasks:
          - app/page.tsx — Home with upload
          - app/results/page.tsx — Swipe interface
          - app/library/page.tsx — Saved songs
          - app/profile/page.tsx — Spotify + credits

      - id: 1.7
        name: Full flow test
        status: pending
        tasks:
          - Upload photo → analyze → search → swipe → save
          - Test video upload frame extraction
          - Test 0 credits → pricing modal
          - Test Spotify login → enhancement

      - id: 1.8
        name: Deploy
        status: pending
        tasks:
          - Add env vars to Vercel
          - Deploy and test on mobile
          - Fix any mobile layout issues

  - id: 2
    name: Monetization
    status: planned
    steps:
      - Stripe integration
      - Supabase user accounts
      - Credit tracking in DB

  - id: 3
    name: Growth
    status: planned
    steps:
      - Shareable vibe cards
      - Spotify playlist export
      - Pro subscription

# design/style-guide.md

## Colors
- Background: #080808
- Card surface: #111111
- Card border: 1px solid #222222
- Primary: #7C3AED (purple)
- Accent: #A855F7 (violet)
- Text primary: #F5F5F5
- Text muted: #888888
- Spotify green: #1DB954
- Skip red: #EF4444 (tint)
- Save purple: #7C3AED

## Typography
- Font: Inter (Google Fonts)
- Heading: 700 weight
- Body: 400 weight
- Muted: 400 weight, #888888

## Components
- Cards: bg #111111, border 1px #222222, radius 16px
- Buttons: radius 12px, no border on primary
- Pills/badges: radius 999px
- Bottom nav: fixed, backdrop-blur, bg #080808/80

## Spacing
- Page padding: 16px horizontal
- Card padding: 16px
- Gap between cards: 12px
- Bottom nav height: 64px
- Safe area: padding-bottom for iOS home bar

## Animations (Framer Motion)
- Page enter: opacity 0→1, y 20→0, duration 0.3s
- Cards stagger: 100ms between each
- SwipeCard throw: velocity-based, rotation ±15deg
- Save: fly right + purple heart burst
- Skip: fly left + fade
- Analyzing: pulse on image border, waveform beat


