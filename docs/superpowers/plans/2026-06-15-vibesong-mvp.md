# VibeSong AI — Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build VibeSong AI — photo/video upload → GPT-4o vibe analysis → YouTube track search → Tinder-style swipe UI → localStorage library.

**Architecture:** Next.js 16 App Router with server-side API routes for all AI/API calls (never client-side). Zustand manages global state (uploaded image, vibe profile, tracks, saved songs, credits). All persistence via localStorage (Phase 1 — no DB).

**Tech Stack:** Next.js 16.2.9 · React 19 · Tailwind CSS v4 · Auth.js v5 (next-auth@beta) · OpenAI SDK · framer-motion · zustand · Material Symbols Outlined icons

---

## File Map

```
app/
  layout.tsx                   MODIFY — Inter font, dark html class, metadata
  globals.css                  MODIFY — Tailwind v4 @theme with full color system
  page.tsx                     MODIFY — Home / Upload screen
  results/page.tsx             CREATE — Swipe results screen
  library/page.tsx             CREATE — Saved songs library
  profile/page.tsx             CREATE — User profile + Spotify
  api/
    analyze/route.ts           CREATE — POST GPT-4o vision analysis
    search-tracks/route.ts     CREATE — POST YouTube search
    enhance/route.ts           CREATE — POST Spotify taste enhancement
    auth/[...nextauth]/route.ts CREATE — Auth.js handler export
auth.ts                        CREATE — Auth.js v5 config (root level)
components/
  NavBar.tsx                   CREATE — Fixed bottom navigation
  CreditBadge.tsx              CREATE — Credits pill display
  VibeTags.tsx                 CREATE — Mood tag pills
  DropZone.tsx                 CREATE — Drag & drop upload with video frame extraction
  SwipeCard.tsx                CREATE — Framer-motion swipe card
  YouTubePlayer.tsx            CREATE — YouTube iframe embed
  PricingModal.tsx             CREATE — Credits purchase modal
lib/
  openai.ts                    CREATE — OpenAI client singleton
  youtube.ts                   CREATE — YouTube Data API v3 search helper
  spotify.ts                   CREATE — Spotify API helper (top tracks/artists)
  credits.ts                   CREATE — localStorage credit system
store/
  useAppStore.ts               CREATE — Zustand global store
```

---

## Task 1: Install Dependencies + Environment

**Files:**
- Modify: `package.json` (via npm install)
- Create: `.env.local`

- [ ] **Step 1: Install all required packages**

```bash
npm install next-auth@beta openai framer-motion zustand
```

Expected output: packages added, no peer dep errors.

- [ ] **Step 2: Create .env.local**

```bash
# .env.local
OPENAI_API_KEY=your_key_here
YOUTUBE_API_KEY=your_key_here
SPOTIFY_CLIENT_ID=your_key_here
SPOTIFY_CLIENT_SECRET=your_key_here
NEXTAUTH_SECRET=vibesong_secret_2024
AUTH_URL=http://localhost:3000
```

Note: Auth.js v5 uses `AUTH_URL` not `NEXTAUTH_URL`. Both work but `AUTH_URL` is canonical for v5.

- [ ] **Step 3: Create empty folder structure**

```bash
mkdir -p app/results app/library app/profile
mkdir -p app/api/analyze app/api/search-tracks app/api/enhance "app/api/auth/[...nextauth]"
mkdir -p components lib store docs/superpowers/plans
touch app/results/page.tsx app/library/page.tsx app/profile/page.tsx
touch "app/api/auth/[...nextauth]/route.ts" app/api/analyze/route.ts
touch app/api/search-tracks/route.ts app/api/enhance/route.ts
touch auth.ts
touch components/NavBar.tsx components/CreditBadge.tsx components/VibeTags.tsx
touch components/DropZone.tsx components/SwipeCard.tsx
touch components/YouTubePlayer.tsx components/PricingModal.tsx
touch lib/openai.ts lib/youtube.ts lib/spotify.ts lib/credits.ts
touch store/useAppStore.ts
```

- [ ] **Step 4: Verify Next.js still starts**

```bash
npm run dev
```

Expected: server starts on localhost:3000, no errors.

---

## Task 2: Tailwind v4 Theme + Layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Replace globals.css with full Tailwind v4 theme**

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-background: #080808;
  --color-surface: #15121b;
  --color-surface-dim: #15121b;
  --color-surface-bright: #3c3742;
  --color-surface-container-lowest: #100d16;
  --color-surface-container-low: #1d1a24;
  --color-surface-container: #221e28;
  --color-surface-container-high: #2c2833;
  --color-surface-container-highest: #37333e;
  --color-surface-variant: #37333e;

  /* Primary — purple */
  --color-primary: #d2bbff;
  --color-primary-container: #7c3aed;
  --color-primary-fixed: #eaddff;
  --color-primary-fixed-dim: #d2bbff;
  --color-on-primary: #3f008e;
  --color-on-primary-container: #ede0ff;
  --color-on-primary-fixed: #25005a;
  --color-on-primary-fixed-variant: #5a00c6;
  --color-inverse-primary: #732ee4;

  /* Secondary */
  --color-secondary: #ddb7ff;
  --color-secondary-container: #6f00be;
  --color-secondary-fixed: #f0dbff;
  --color-secondary-fixed-dim: #ddb7ff;
  --color-on-secondary: #490080;
  --color-on-secondary-container: #d6a9ff;
  --color-on-secondary-fixed: #2c0051;
  --color-on-secondary-fixed-variant: #6900b3;

  /* On-surface */
  --color-on-surface: #e8dfee;
  --color-on-surface-variant: #ccc3d8;
  --color-on-background: #e8dfee;
  --color-inverse-surface: #e8dfee;
  --color-inverse-on-surface: #332f39;

  /* Outline */
  --color-outline: #958da1;
  --color-outline-variant: #4a4455;

  /* Error */
  --color-error: #ffb4ab;
  --color-error-container: #93000a;
  --color-on-error: #690005;
  --color-on-error-container: #ffdad6;

  /* Tertiary (Spotify green zone) */
  --color-tertiary: #53e076;
  --color-tertiary-container: #007731;
  --color-tertiary-fixed: #72fe8f;
  --color-tertiary-fixed-dim: #53e076;
  --color-on-tertiary: #003914;
  --color-on-tertiary-container: #84ff99;
  --color-on-tertiary-fixed: #002108;
  --color-on-tertiary-fixed-variant: #005320;

  /* Brand extras */
  --color-spotify-green: #1DB954;
  --color-surface-tint: #d2bbff;

  /* Typography */
  --font-sans: 'Inter', sans-serif;

  /* Border radius */
  --radius-sm: 8px;
  --radius-DEFAULT: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;
}

body {
  background-color: #080808;
  color: #e8dfee;
  font-family: 'Inter', sans-serif;
  -webkit-tap-highlight-color: transparent;
}

.glass-effect {
  background: rgba(21, 18, 27, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.glow-purple {
  box-shadow: 0 10px 30px -10px rgba(124, 58, 237, 0.4);
}

.dashed-upload-border {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='24' ry='24' stroke='%237C3AEDFF' stroke-width='3' stroke-dasharray='10%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
}

.scroll-hide::-webkit-scrollbar { display: none; }
.scroll-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 2: Update layout.tsx — Inter font, dark class, Material Symbols, metadata**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "VibeSong AI — Your Photo. Your Soundtrack.",
  description: "Upload a photo or video and get AI-matched songs perfect for your Stories.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans min-h-full bg-background text-on-surface antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update next.config.ts — allow YouTube image domain**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Verify dev server — check background is #080808**

```bash
npm run dev
```

Open localhost:3000 — background should be near-black (#080808), text light.

---

## Task 3: Lib Helpers

**Files:**
- Create: `lib/openai.ts`
- Create: `lib/youtube.ts`
- Create: `lib/spotify.ts`
- Create: `lib/credits.ts`

- [ ] **Step 1: lib/openai.ts — singleton client**

```ts
// lib/openai.ts
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default openai;
```

- [ ] **Step 2: lib/youtube.ts — search helper**

```ts
// lib/youtube.ts
export interface YouTubeTrack {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
  youtubeId: string;
  thumbnail: string;
  youtubeUrl: string;
}

interface GPTTrack {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
}

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

function isLiveVersion(title: string): boolean {
  const lower = title.toLowerCase();
  return ["live", "concert", "tour", "festival", "performance"].some((w) => lower.includes(w));
}

function durationToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

export async function searchYouTubeTrack(track: GPTTrack): Promise<YouTubeTrack | null> {
  const query = encodeURIComponent(`${track.title} ${track.artist} official audio`);
  const searchRes = await fetch(
    `${YOUTUBE_API}/search?part=snippet&q=${query}&type=video&videoCategoryId=10&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`
  );
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const ids: string[] = (searchData.items || []).map((i: { id: { videoId: string } }) => i.id.videoId);
  if (!ids.length) return null;

  const detailRes = await fetch(
    `${YOUTUBE_API}/videos?part=contentDetails,snippet&id=${ids.join(",")}&key=${process.env.YOUTUBE_API_KEY}`
  );
  if (!detailRes.ok) return null;

  const detailData = await detailRes.json();
  for (const item of detailData.items || []) {
    const seconds = durationToSeconds(item.contentDetails.duration);
    if (seconds < 120 || seconds > 360) continue;
    if (isLiveVersion(item.snippet.title)) continue;

    return {
      title: track.title,
      artist: track.artist,
      reason: track.reason,
      matchScore: track.matchScore,
      youtubeId: item.id,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || "",
      youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
    };
  }
  return null;
}
```

- [ ] **Step 3: lib/spotify.ts — top tracks + artists helper**

```ts
// lib/spotify.ts
export interface SpotifyTopData {
  topArtists: string[];
  topTracks: string[];
}

export async function getSpotifyTopData(accessToken: string): Promise<SpotifyTopData> {
  const [artistsRes, tracksRes] = await Promise.all([
    fetch("https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch("https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const artists = artistsRes.ok ? await artistsRes.json() : { items: [] };
  const tracks = tracksRes.ok ? await tracksRes.json() : { items: [] };

  return {
    topArtists: (artists.items || []).map((a: { name: string }) => a.name),
    topTracks: (tracks.items || []).map((t: { name: string; artists: { name: string }[] }) =>
      `${t.name} by ${t.artists[0]?.name}`
    ),
  };
}

export async function createSpotifyPlaylist(
  accessToken: string,
  userId: string,
  trackUris: string[],
  playlistName = "My VibeSong Matches"
): Promise<string | null> {
  const createRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: playlistName, public: true }),
  });
  if (!createRes.ok) return null;
  const playlist = await createRes.json();

  await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: trackUris }),
  });

  return playlist.external_urls?.spotify || null;
}
```

- [ ] **Step 4: lib/credits.ts — localStorage credit system**

```ts
// lib/credits.ts
const KEY = "vibesong_credits";
const DEFAULT_CREDITS = 3;

export function getCredits(): number {
  if (typeof window === "undefined") return DEFAULT_CREDITS;
  const stored = localStorage.getItem(KEY);
  if (stored === null) {
    localStorage.setItem(KEY, String(DEFAULT_CREDITS));
    return DEFAULT_CREDITS;
  }
  return parseInt(stored, 10);
}

export function deductCredit(): boolean {
  const current = getCredits();
  if (current <= 0) return false;
  localStorage.setItem(KEY, String(current - 1));
  return true;
}

export function addCredits(amount: number): void {
  const current = getCredits();
  localStorage.setItem(KEY, String(current + amount));
}

export function hasCredits(): boolean {
  return getCredits() > 0;
}
```

---

## Task 4: Zustand Store

**Files:**
- Create: `store/useAppStore.ts`

- [ ] **Step 1: Write the store**

```ts
// store/useAppStore.ts
import { create } from "zustand";

export interface VibeProfile {
  scene: {
    setting: string;
    timeOfDay: string;
    season: string;
    weather: string;
  };
  emotion: { primary: string; secondary: string; intensity: number };
  visual: { dominantColors: string[]; brightness: number; aesthetic: string };
  musicDNA: {
    energy: number;
    valence: number;
    tempo: string;
    genres: string[];
    mood: string;
    tracks: GPTTrack[];
  };
  vibeCaption: string;
  vibeTags: string[];
}

export interface GPTTrack {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
}

export interface Track {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
  youtubeId: string;
  thumbnail: string;
  youtubeUrl: string;
  savedAt?: number;
  sourceImage?: string;
}

interface AppState {
  uploadedImage: string | null;         // base64
  uploadedImageUrl: string | null;      // object URL for display
  vibeProfile: VibeProfile | null;
  tracks: Track[];
  savedSongs: Track[];
  credits: number;
  isAnalyzing: boolean;
  currentCardIndex: number;

  setUploadedImage: (base64: string, objectUrl: string) => void;
  setVibeProfile: (profile: VibeProfile) => void;
  setTracks: (tracks: Track[]) => void;
  saveTrack: (track: Track) => void;
  setCredits: (credits: number) => void;
  setIsAnalyzing: (v: boolean) => void;
  nextCard: () => void;
  resetSession: () => void;
  loadSavedSongs: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  uploadedImage: null,
  uploadedImageUrl: null,
  vibeProfile: null,
  tracks: [],
  savedSongs: [],
  credits: 3,
  isAnalyzing: false,
  currentCardIndex: 0,

  setUploadedImage: (base64, objectUrl) =>
    set({ uploadedImage: base64, uploadedImageUrl: objectUrl }),

  setVibeProfile: (profile) => set({ vibeProfile: profile }),

  setTracks: (tracks) => set({ tracks, currentCardIndex: 0 }),

  saveTrack: (track) => {
    const withMeta = {
      ...track,
      savedAt: Date.now(),
      sourceImage: get().uploadedImageUrl || undefined,
    };
    const updated = [...get().savedSongs, withMeta];
    if (typeof window !== "undefined") {
      localStorage.setItem("vibesong_library", JSON.stringify(updated));
    }
    set({ savedSongs: updated });
  },

  setCredits: (credits) => set({ credits }),

  setIsAnalyzing: (v) => set({ isAnalyzing: v }),

  nextCard: () => set((s) => ({ currentCardIndex: s.currentCardIndex + 1 })),

  resetSession: () =>
    set({ uploadedImage: null, uploadedImageUrl: null, vibeProfile: null, tracks: [], currentCardIndex: 0 }),

  loadSavedSongs: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("vibesong_library");
    if (stored) set({ savedSongs: JSON.parse(stored) });
  },
}));
```

---

## Task 5: API — Auth.js v5 Setup

**Files:**
- Create: `auth.ts` (root level)
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create auth.ts at project root**

```ts
// auth.ts
import NextAuth from "next-auth";
import Spotify from "next-auth/providers/spotify";

const SPOTIFY_SCOPES = "user-top-read user-read-email playlist-modify-public";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: { scope: SPOTIFY_SCOPES },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.id = token.sub!;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    accessToken: string;
  }
}
```

- [ ] **Step 2: Create the route handler**

```ts
// app/api/auth/[...nextauth]/route.ts
export { GET, POST } from "../../../../auth";
// Auth.js v5: handlers export { GET, POST }
// We re-export from auth.ts: const { handlers } = NextAuth(...)
// But handlers object contains GET and POST directly
```

Actually the correct pattern for Auth.js v5:

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "../../../../auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Add Spotify redirect URI to Spotify Dashboard**

In Spotify Developer Dashboard → App Settings → Redirect URIs add:
```
http://localhost:3000/api/auth/callback/spotify
```

---

## Task 6: API — POST /api/analyze

**Files:**
- Create: `app/api/analyze/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a world-class music supervisor who matches songs to visuals for films, ads and social media. Analyze this image deeply.
Return ONLY valid JSON, no markdown:
{
  "scene": {
    "setting": "string",
    "timeOfDay": "morning|afternoon|evening|night|unknown",
    "season": "spring|summer|autumn|winter|unknown",
    "weather": "string"
  },
  "emotion": {
    "primary": "string",
    "secondary": "string",
    "intensity": 0.0
  },
  "visual": {
    "dominantColors": ["string"],
    "brightness": 0.0,
    "aesthetic": "string"
  },
  "musicDNA": {
    "energy": 0.0,
    "valence": 0.0,
    "tempo": "slow|medium|fast",
    "genres": ["string"],
    "mood": "string",
    "tracks": [
      {
        "title": "string",
        "artist": "string",
        "reason": "string",
        "matchScore": 0
      }
    ]
  },
  "vibeCaption": "string",
  "vibeTags": ["string", "string", "string"]
}
Generate exactly 8 specific real songs in musicDNA.tracks. vibeTags must have exactly 3 items.`;

function parseGPTJson(raw: string) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType } = await req.json();
    if (!image || !mimeType) {
      return NextResponse.json({ error: "image and mimeType required" }, { status: 400 });
    }

    let result;
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SYSTEM_PROMPT },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } },
            ],
          },
        ],
        max_tokens: 2000,
      });
      result = parseGPTJson(res.choices[0].message.content || "");
    } catch {
      // Retry once with temperature 0
      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SYSTEM_PROMPT },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } },
            ],
          },
        ],
        max_tokens: 2000,
      });
      result = parseGPTJson(retry.choices[0].message.content || "");
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("/api/analyze error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test the route with curl (after npm run dev)**

```bash
# Create test image base64 (use any small JPEG)
$img = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\test.jpg"))
Invoke-RestMethod -Uri "http://localhost:3000/api/analyze" -Method POST `
  -ContentType "application/json" `
  -Body "{`"image`": `"$img`", `"mimeType`": `"image/jpeg`"}"
```

Expected: JSON with scene, emotion, visual, musicDNA, vibeCaption, vibeTags keys.

---

## Task 7: API — POST /api/search-tracks

**Files:**
- Create: `app/api/search-tracks/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/search-tracks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeTrack } from "../../../lib/youtube";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tracks } = await req.json();
    if (!Array.isArray(tracks)) {
      return NextResponse.json({ error: "tracks array required" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      tracks.map((t: { title: string; artist: string; reason: string; matchScore: number }) =>
        searchYouTubeTrack(t)
      )
    );

    const found = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8);

    if (found.length < 5) {
      return NextResponse.json({ error: "Not enough tracks found", found }, { status: 206 });
    }

    return NextResponse.json(found);
  } catch (err) {
    console.error("/api/search-tracks error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test the route**

```bash
Invoke-RestMethod -Uri "http://localhost:3000/api/search-tracks" -Method POST `
  -ContentType "application/json" `
  -Body '{"tracks":[{"title":"Blinding Lights","artist":"The Weeknd","reason":"test","matchScore":94}]}'
```

Expected: array with youtubeId, thumbnail, youtubeUrl populated.

---

## Task 8: API — POST /api/enhance

**Files:**
- Create: `app/api/enhance/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/enhance/route.ts
import { NextRequest, NextResponse } from "next/server";
import openai from "../../../lib/openai";
import { getSpotifyTopData } from "../../../lib/spotify";

export const runtime = "nodejs";

function parseGPTJson(raw: string) {
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

export async function POST(req: NextRequest) {
  try {
    const { vibeProfile, accessToken } = await req.json();
    if (!accessToken) {
      return NextResponse.json({ error: "accessToken required" }, { status: 400 });
    }

    const { topArtists, topTracks } = await getSpotifyTopData(accessToken);

    const prompt = `Original photo analysis:
${JSON.stringify(vibeProfile, null, 2)}

User's favorite artists: ${topArtists.join(", ")}
User's favorite tracks: ${topTracks.slice(0, 10).join(", ")}

Refine the track recommendations to match BOTH the photo vibe AND the user's personal taste. Prioritize artists similar to their favorites. Keep the same JSON format.
Return ONLY the updated tracks array as JSON (array of objects with title, artist, reason, matchScore).`;

    let tracks;
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      });
      tracks = parseGPTJson(res.choices[0].message.content || "");
    } catch {
      const retry = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      });
      tracks = parseGPTJson(retry.choices[0].message.content || "");
    }

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error("/api/enhance error:", err);
    return NextResponse.json({ error: "Enhancement failed" }, { status: 500 });
  }
}
```

---

## Task 9: Components — NavBar + CreditBadge + VibeTags

**Files:**
- Create: `components/NavBar.tsx`
- Create: `components/CreditBadge.tsx`
- Create: `components/VibeTags.tsx`

- [ ] **Step 1: NavBar.tsx**

```tsx
// components/NavBar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/explore", icon: "explore", label: "Explore" },
  { href: "/library", icon: "library_music", label: "Library" },
  { href: "/profile", icon: "person", label: "Profile" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 pt-2 glass-effect border-t border-outline-variant/20 rounded-t-xl shadow-[0_-10px_30px_-10px_rgba(124,58,237,0.3)]">
      {NAV_ITEMS.map(({ href, icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 active:scale-90 ${
              active
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
            <span className="text-[10px] mt-1 font-semibold tracking-wide">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: CreditBadge.tsx**

```tsx
// components/CreditBadge.tsx
"use client";
import { motion } from "framer-motion";

interface CreditBadgeProps {
  credits: number;
  onClick?: () => void;
}

export default function CreditBadge({ credits, onClick }: CreditBadgeProps) {
  return (
    <motion.button
      onClick={onClick}
      animate={credits === 0 ? { x: [-4, 4, -4, 4, 0] } : {}}
      transition={{ duration: 0.4 }}
      className="bg-primary-container text-on-primary-container rounded-full px-3 py-1 text-sm font-semibold flex items-center gap-1 glow-purple cursor-pointer"
    >
      <span>✦</span>
      <span>{credits} credits</span>
    </motion.button>
  );
}
```

- [ ] **Step 3: VibeTags.tsx**

```tsx
// components/VibeTags.tsx
"use client";
import { motion } from "framer-motion";

interface VibeTagsProps {
  tags: string[];
  animate?: boolean;
}

const TAG_COLORS: Record<string, string> = {
  Melancholic: "bg-blue-900/40 text-blue-200 border-blue-700/30",
  "High Energy": "bg-orange-900/40 text-orange-200 border-orange-700/30",
  "Golden Hour": "bg-yellow-900/40 text-yellow-200 border-yellow-700/30",
  Chill: "bg-teal-900/40 text-teal-200 border-teal-700/30",
  Romantic: "bg-pink-900/40 text-pink-200 border-pink-700/30",
  Dark: "bg-purple-900/40 text-purple-200 border-purple-700/30",
};

export default function VibeTags({ tags, animate = false }: VibeTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <motion.span
          key={tag}
          initial={animate ? { opacity: 0, scale: 0.8 } : {}}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: animate ? i * 0.3 : 0, duration: 0.4 }}
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            TAG_COLORS[tag] || "bg-primary-container/20 text-primary border-primary-container/30"
          }`}
        >
          {tag}
        </motion.span>
      ))}
    </div>
  );
}
```

---

## Task 10: Component — DropZone

**Files:**
- Create: `components/DropZone.tsx`

- [ ] **Step 1: Write DropZone with drag & drop + video frame extraction**

```tsx
// components/DropZone.tsx
"use client";
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";

interface DropZoneProps {
  onImageReady: (base64: string, mimeType: string, objectUrl: string) => void;
}

const MAX_SIZE = 15 * 1024 * 1024; // 15MB

async function extractVideoFrame(file: File): Promise<{ base64: string; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.crossOrigin = "anonymous";
    video.currentTime = 1;
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      resolve({ base64, objectUrl });
    };
    video.onerror = reject;
  });
}

async function fileToBase64(file: File): Promise<{ base64: string; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1], objectUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DropZone({ onImageReady }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_SIZE) {
        setError("File too large. Max 15MB.");
        return;
      }
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setError("Only JPG, PNG, or MP4 files supported.");
        return;
      }
      try {
        const { base64, objectUrl } = isVideo
          ? await extractVideoFrame(file)
          : await fileToBase64(file);
        onImageReady(base64, isVideo ? "image/jpeg" : file.type, objectUrl);
      } catch {
        setError("Failed to process file. Please try another.");
      }
    },
    [onImageReady]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div>
      <motion.div
        whileTap={{ scale: 0.97 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`dashed-upload-border rounded-2xl p-8 flex flex-col items-center text-center gap-4 cursor-pointer transition-all duration-300 ${
          isDragging ? "opacity-80 scale-98 bg-primary-container/10" : "bg-surface-container-low/30 hover:bg-surface-container/50"
        }`}
      >
        <div className="w-16 h-16 bg-primary-container/10 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-primary-container text-4xl">
            add_photo_alternate
          </span>
        </div>
        <div>
          <p className="font-bold text-primary-container text-base">Drop your photo or video</p>
          <p className="text-on-surface-variant text-xs mt-1">JPG, PNG, MP4 · Max 15MB</p>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.setAttribute("accept", "image/*"); inputRef.current?.click(); }}
            className="flex items-center gap-2 border border-primary-container text-primary-container px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary-container/10 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            Photo
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.setAttribute("accept", "video/*"); inputRef.current?.click(); }}
            className="flex items-center gap-2 border border-primary-container text-primary-container px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary-container/10 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">movie</span>
            Video
          </button>
        </div>
      </motion.div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {error && <p className="text-error text-xs mt-2 text-center">{error}</p>}
    </div>
  );
}
```

---

## Task 11: Component — YouTubePlayer

**Files:**
- Create: `components/YouTubePlayer.tsx`

- [ ] **Step 1: Write the player**

```tsx
// components/YouTubePlayer.tsx
"use client";
import { useState } from "react";

interface YouTubePlayerProps {
  youtubeId: string;
  thumbnail: string;
  title: string;
}

export default function YouTubePlayer({ youtubeId, thumbnail, title }: YouTubePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const handlePlayToggle = () => setIsPlaying((p) => !p);

  return (
    <div className="w-full glass-effect rounded-xl p-4 flex items-center gap-4">
      {isPlaying ? (
        <iframe
          className="hidden"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=0`}
          allow="autoplay"
          title={title}
        />
      ) : null}
      <button
        onClick={handlePlayToggle}
        className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {isPlaying ? "pause" : "play_arrow"}
        </span>
      </button>
      <div className="flex-1 space-y-1">
        <div className="flex justify-between text-[10px] text-on-surface-variant font-semibold">
          <span>0:00</span>
          <span>0:30 preview</span>
        </div>
        <div className="w-full h-[3px] rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-primary-container transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Task 12: Component — SwipeCard

**Files:**
- Create: `components/SwipeCard.tsx`

- [ ] **Step 1: Write the swipe card with framer-motion**

```tsx
// components/SwipeCard.tsx
"use client";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { Track } from "../store/useAppStore";
import YouTubePlayer from "./YouTubePlayer";

interface SwipeCardProps {
  track: Track;
  onSave: () => void;
  onSkip: () => void;
  isTop: boolean;
}

export default function SwipeCard({ track, onSave, onSkip, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);
  const saveOpacity = useTransform(x, [0, 100], [0, 1]);

  useEffect(() => {
    if (!isTop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onSkip();
      if (e.key === "ArrowRight") onSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isTop, onSave, onSkip]);

  const handleDragEnd = (_: never, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipe = Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 500;
    if (swipe) {
      info.offset.x > 0 ? onSave() : onSkip();
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Blurred background */}
      <div className="relative w-full h-full rounded-xl overflow-hidden glass-card shadow-[0_10px_30px_-10px_rgba(124,58,237,0.3)]">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-black/40 z-10" />
          {track.thumbnail && (
            <img
              src={track.thumbnail}
              alt=""
              className="w-full h-full object-cover blur-2xl scale-110"
            />
          )}
        </div>

        {/* Skip / Save overlays */}
        <motion.div
          style={{ opacity: skipOpacity }}
          className="absolute top-6 left-6 z-30 border-4 border-error text-error rounded-xl px-3 py-1 font-bold text-xl rotate-[-12deg]"
        >
          SKIP
        </motion.div>
        <motion.div
          style={{ opacity: saveOpacity }}
          className="absolute top-6 right-6 z-30 border-4 border-primary-container text-primary-container rounded-xl px-3 py-1 font-bold text-xl rotate-[12deg]"
        >
          SAVE
        </motion.div>

        {/* Content */}
        <div className="relative z-20 h-full flex flex-col p-4 justify-between">
          <div className="flex items-center gap-4">
            {track.thumbnail && (
              <img
                src={track.thumbnail}
                alt={track.title}
                className="w-20 h-20 rounded-lg object-cover border border-white/20 shadow-xl flex-shrink-0"
              />
            )}
            <div>
              <h2 className="text-white font-bold text-xl leading-tight">{track.title}</h2>
              <p className="text-on-surface-variant font-medium text-base">{track.artist}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-on-surface-variant italic text-sm">{track.reason}</p>
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-primary text-xs font-semibold uppercase tracking-widest">Match Score</span>
                <span className="text-white font-bold text-lg">{track.matchScore}%</span>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${track.matchScore}%`,
                    background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

---

## Task 13: Component — PricingModal

**Files:**
- Create: `components/PricingModal.tsx`

- [ ] **Step 1: Write the modal**

```tsx
// components/PricingModal.tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { addCredits } from "../lib/credits";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onCreditsAdded: (newTotal: number) => void;
}

const PACKAGES = [
  { id: "starter", label: "Starter", credits: 10, price: "$1.99", perMatch: "$0.20 per match", badge: null, borderColor: "border-outline-variant/30" },
  { id: "popular", label: "Popular", credits: 50, price: "$6.99", perMatch: "$0.14 per match", badge: "MOST POPULAR", saveBadge: "SAVE 30%", borderColor: "border-primary-container", glow: true },
  { id: "pro", label: "Pro", credits: 200, price: "$19.99", perMatch: "$0.10 per match", badge: "BEST VALUE", saveBadge: "SAVE 50%", borderColor: "border-yellow-500/60", goldBadge: true },
];

export default function PricingModal({ isOpen, onClose, currentCredits, onCreditsAdded }: PricingModalProps) {
  const [selected, setSelected] = useState("popular");

  const handleContinue = () => {
    const pkg = PACKAGES.find((p) => p.id === selected)!;
    addCredits(pkg.credits);
    onCreditsAdded(currentCredits + pkg.credits);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface-container-low rounded-t-3xl p-6 space-y-6 pb-10"
          >
            {/* Header */}
            <div className="flex justify-between items-center">
              <button onClick={onClose} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
              <h2 className="text-on-surface font-bold text-lg">Get Credits</h2>
              <div className="bg-primary-container text-on-primary-container rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
                <span>✦</span><span>{currentCredits} credits</span>
              </div>
            </div>

            {/* Balance */}
            <div className="text-center space-y-1">
              <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-widest">Balance</p>
              <p className="text-primary-container text-5xl font-bold">{currentCredits}✦</p>
              <p className="text-on-surface-variant text-sm">credits remaining</p>
              <p className="text-on-surface-variant/60 text-xs">Each photo match uses 1 credit</p>
            </div>

            {/* Packages */}
            <div className="space-y-3">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelected(pkg.id)}
                  className={`relative border rounded-2xl p-4 cursor-pointer transition-all ${pkg.borderColor} ${
                    selected === pkg.id ? "bg-surface-container" : "bg-surface-container-lowest"
                  }`}
                >
                  {pkg.badge && (
                    <span className={`absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      pkg.goldBadge ? "bg-yellow-500 text-black" : "bg-primary-container text-on-primary-container"
                    }`}>
                      {pkg.badge}
                    </span>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-on-surface-variant text-xs font-semibold">{pkg.label}</p>
                      <p className="text-on-surface font-bold text-base">
                        {pkg.credits} Credits · {pkg.price}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-on-surface-variant text-xs">{pkg.perMatch}</p>
                        {pkg.saveBadge && (
                          <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {pkg.saveBadge}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selected === pkg.id ? "border-primary-container bg-primary-container" : "border-outline-variant"
                    }`}>
                      {selected === pkg.id && (
                        <span className="material-symbols-outlined text-on-primary-container text-sm" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Perks */}
            <div className="space-y-2">
              {["Credits never expire", "Cancel anytime"].map((perk) => (
                <div key={perk} className="flex items-center gap-2 text-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-tertiary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  {perk}
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={handleContinue}
              className="w-full bg-primary-container text-on-primary-container font-bold py-4 rounded-2xl text-base tracking-wide hover:opacity-90 active:scale-98 transition-all"
            >
              CONTINUE →
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## Task 14: Page — Home / Upload (app/page.tsx)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Write the full home page**

```tsx
// app/page.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import DropZone from "../components/DropZone";
import NavBar from "../components/NavBar";
import CreditBadge from "../components/CreditBadge";
import VibeTags from "../components/VibeTags";
import PricingModal from "../components/PricingModal";
import { useAppStore } from "../store/useAppStore";
import { getCredits, deductCredit } from "../lib/credits";

type HomeState = "idle" | "uploading" | "analyzing";

const ANALYZING_TEXTS = [
  "Reading the vibe...",
  "Analyzing mood & energy...",
  "Searching millions of tracks...",
  "Curating your soundtrack...",
];

const QUICK_PROMPTS = ["Sunset Drive", "Cyberpunk Night", "Rainy Window", "Gym Energy"];

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [state, setState] = useState<HomeState>("idle");
  const [analyzeTextIdx, setAnalyzeTextIdx] = useState(0);
  const [showPricing, setShowPricing] = useState(false);
  const [credits, setCredits] = useState(3);
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; objectUrl: string } | null>(null);

  const {
    setUploadedImage, setVibeProfile, setTracks, setIsAnalyzing,
    savedSongs, loadSavedSongs, vibeProfile, uploadedImageUrl,
  } = useAppStore();

  useEffect(() => {
    setCredits(getCredits());
    loadSavedSongs();
  }, [loadSavedSongs]);

  // Cycle analyzing text
  useEffect(() => {
    if (state !== "analyzing") return;
    const interval = setInterval(() => {
      setAnalyzeTextIdx((i) => (i + 1) % ANALYZING_TEXTS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [state]);

  const runAnalysis = useCallback(
    async (base64: string, mimeType: string, objectUrl: string) => {
      setState("analyzing");
      setIsAnalyzing(true);
      setUploadedImage(base64, objectUrl);

      try {
        // Step 1: Analyze
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mimeType }),
        });
        const vibeData = await analyzeRes.json();
        setVibeProfile(vibeData);

        let tracks = vibeData.musicDNA.tracks;

        // Step 2: Enhance with Spotify if logged in
        if (session?.accessToken) {
          try {
            const enhanceRes = await fetch("/api/enhance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vibeProfile: vibeData, accessToken: session.accessToken }),
            });
            const enhanced = await enhanceRes.json();
            if (enhanced.tracks) tracks = enhanced.tracks;
          } catch {
            // Spotify enhancement optional — continue without it
          }
        }

        // Step 3: Search YouTube
        const searchRes = await fetch("/api/search-tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tracks }),
        });
        const ytTracks = await searchRes.json();
        setTracks(Array.isArray(ytTracks) ? ytTracks : ytTracks.found || []);

        setIsAnalyzing(false);
        router.push("/results");
      } catch (err) {
        console.error("Analysis failed:", err);
        setIsAnalyzing(false);
        setState("idle");
      }
    },
    [session, setUploadedImage, setVibeProfile, setTracks, setIsAnalyzing, router]
  );

  const handleImageReady = useCallback(
    (base64: string, mimeType: string, objectUrl: string) => {
      const currentCredits = getCredits();
      if (currentCredits <= 0) {
        setPendingImage({ base64, mimeType, objectUrl });
        setShowPricing(true);
        return;
      }
      deductCredit();
      setCredits(getCredits());
      setState("uploading");
      setTimeout(() => runAnalysis(base64, mimeType, objectUrl), 500);
    },
    [runAnalysis]
  );

  const handleCreditsAdded = (newTotal: number) => {
    setCredits(newTotal);
    if (pendingImage) {
      deductCredit();
      setCredits(getCredits());
      setState("uploading");
      setTimeout(() => runAnalysis(pendingImage.base64, pendingImage.mimeType, pendingImage.objectUrl), 500);
      setPendingImage(null);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    router.push(`/results?prompt=${encodeURIComponent(prompt)}`);
  };

  // ANALYZING STATE
  if (state === "analyzing") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        {/* Top half: uploaded image */}
        {uploadedImageUrl && (
          <div className="relative h-1/2">
            <img src={uploadedImageUrl} alt="Your upload" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
            <div className="absolute top-4 right-4 bg-primary-container text-on-primary-container rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
              <span>✦</span><span>{credits} credits</span>
            </div>
            {/* Pulsing border */}
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 border-4 border-primary-container rounded-none"
            />
          </div>
        )}

        {/* Bottom half: analysis UI */}
        <div className="flex-1 flex flex-col items-center justify-start pt-8 px-6 space-y-6">
          {/* Vibe tags appearing */}
          {vibeProfile?.vibeTags && (
            <VibeTags tags={vibeProfile.vibeTags} animate />
          )}

          {/* Waveform animation */}
          <div className="flex items-end gap-1 h-12">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: ["20%", "100%", "40%", "80%", "20%"] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.06 }}
                className="w-1.5 bg-primary-container rounded-full"
                style={{ minHeight: 4 }}
              />
            ))}
          </div>

          {/* Cycling text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={analyzeTextIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-on-surface font-bold text-xl text-center"
            >
              {ANALYZING_TEXTS[analyzeTextIdx]}
            </motion.p>
          </AnimatePresence>

          <p className="text-on-surface-variant text-sm">This takes about 5 seconds</p>
        </div>
      </div>
    );
  }

  // IDLE / UPLOADING STATE
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-effect border-b border-outline-variant/20 flex justify-between items-center px-4 py-3">
        <span className="font-bold text-2xl text-primary-container tracking-tight">VibeSong AI</span>
        <CreditBadge credits={credits} onClick={() => setShowPricing(true)} />
      </header>

      <main className="pt-20 px-4 space-y-6">
        {/* Welcome */}
        <section>
          <h1 className="font-bold text-xl text-on-surface">Transform your moments</h1>
          <p className="text-on-surface-variant text-sm opacity-80 mt-1">
            Upload a visual vibe and let AI curate your soundtrack.
          </p>
        </section>

        {/* Spotify CTA */}
        {!session && (
          <button
            onClick={() => signIn("spotify")}
            className="w-full flex items-center justify-center gap-2 border border-spotify-green/40 text-spotify-green py-3 rounded-xl text-sm font-semibold hover:bg-spotify-green/10 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>music_note</span>
            ✨ Enhance with your Spotify taste
          </button>
        )}
        {session && (
          <div className="flex items-center gap-2 text-xs text-spotify-green font-semibold">
            <span className="w-2 h-2 rounded-full bg-spotify-green inline-block" />
            Connected to Spotify — matches will be personalized
          </div>
        )}

        {/* Upload Zone */}
        <DropZone onImageReady={handleImageReady} />

        {/* Recent Vibes */}
        {savedSongs.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-base text-on-surface">Recent Vibes</h2>
              <a href="/library" className="text-primary text-xs font-semibold hover:underline">See all</a>
            </div>
            <div className="flex overflow-x-auto gap-3 scroll-hide pb-1 -mx-4 px-4">
              {savedSongs.slice(0, 5).map((song, i) => (
                <div
                  key={i}
                  className="relative flex-shrink-0 w-40 h-48 rounded-2xl overflow-hidden border border-outline-variant/20 hover:border-primary-container transition-all cursor-pointer"
                >
                  {song.sourceImage ? (
                    <img src={song.sourceImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-surface-container-highest" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-on-surface font-bold text-xs truncate">{song.title}</p>
                    <p className="text-on-surface-variant text-[10px] truncate">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick Prompts */}
        <section className="space-y-3">
          <h2 className="font-bold text-base text-on-surface">Quick Prompts</h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={prompt}
                onClick={() => handleQuickPrompt(prompt)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105 ${
                  i === 0
                    ? "text-on-primary-container"
                    : "bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-variant"
                }`}
                style={i === 0 ? { background: "linear-gradient(to right, #7c3aed, #6f00be)" } : undefined}
              >
                {i === 0 && <span className="material-symbols-outlined text-[14px] align-middle mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>}
                {prompt}
              </button>
            ))}
          </div>
        </section>
      </main>

      <NavBar />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onCreditsAdded={handleCreditsAdded}
      />
    </div>
  );
}
```

---

## Task 15: Page — Results / Swipe (app/results/page.tsx)

**Files:**
- Create: `app/results/page.tsx`

- [ ] **Step 1: Write the results page**

```tsx
// app/results/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import NavBar from "../../components/NavBar";
import SwipeCard from "../../components/SwipeCard";
import VibeTags from "../../components/VibeTags";
import { useAppStore, Track } from "../../store/useAppStore";

export default function ResultsPage() {
  const router = useRouter();
  const { tracks, vibeProfile, uploadedImageUrl, currentCardIndex, saveTrack, nextCard } = useAppStore();
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [done, setDone] = useState(false);

  const displayTracks = tracks.slice(0, 5);

  useEffect(() => {
    if (!tracks.length) router.replace("/");
  }, [tracks, router]);

  const handleSave = (idx: number, track: Track) => {
    saveTrack(track);
    setSavedCount((c) => c + 1);
    setGone((g) => new Set(g).add(idx));
    nextCard();
    if (idx >= displayTracks.length - 1) setDone(true);
  };

  const handleSkip = (idx: number) => {
    setGone((g) => new Set(g).add(idx));
    nextCard();
    if (idx >= displayTracks.length - 1) setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center space-y-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <span className="material-symbols-outlined text-7xl text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
            library_music
          </span>
        </motion.div>
        <h1 className="text-on-surface font-bold text-2xl">You saved {savedCount} song{savedCount !== 1 ? "s" : ""}!</h1>
        <p className="text-on-surface-variant">Your vibe is curated.</p>
        <button
          onClick={() => router.push("/library")}
          className="bg-primary-container text-on-primary-container font-bold py-4 px-8 rounded-2xl text-base hover:opacity-90 active:scale-95 transition-all"
        >
          View in Library →
        </button>
        <button onClick={() => router.push("/")} className="text-on-surface-variant text-sm hover:underline">
          Match another photo
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-effect border-b border-outline-variant/20 flex justify-between items-center px-4 py-3">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span className="material-symbols-outlined text-primary-container">arrow_back</span>
        </button>
        <h1 className="font-bold text-primary-container">{displayTracks.length} matches found</h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span className="material-symbols-outlined text-primary-container">share</span>
        </button>
      </header>

      <main className="pt-20 pb-6 px-4 space-y-6">
        {/* Context image + vibe caption */}
        {uploadedImageUrl && (
          <div className="relative h-48 w-full rounded-xl overflow-hidden shadow-lg">
            <img src={uploadedImageUrl} alt="Your vibe" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
              <div className="space-y-2 w-full">
                {vibeProfile?.vibeCaption && (
                  <p className="text-white italic text-sm">{vibeProfile.vibeCaption}</p>
                )}
                {vibeProfile?.vibeTags && <VibeTags tags={vibeProfile.vibeTags} />}
              </div>
            </div>
          </div>
        )}

        {/* Swipe stack */}
        <div className="relative h-[380px]">
          <AnimatePresence>
            {displayTracks.map((track, idx) => {
              if (gone.has(idx)) return null;
              const isTop = !gone.has(idx) && idx === Math.min(...displayTracks.map((_, i) => i).filter((i) => !gone.has(i)));
              return (
                <SwipeCard
                  key={track.youtubeId}
                  track={track}
                  isTop={isTop}
                  onSave={() => handleSave(idx, track)}
                  onSkip={() => handleSkip(idx)}
                />
              );
            })}
          </AnimatePresence>
        </div>

        {/* Hint */}
        <div className="text-center text-on-surface-variant/60 text-xs flex items-center justify-center gap-2">
          <span>← Skip</span>
          <span className="opacity-30">·</span>
          <span>Save →</span>
        </div>

        {/* Skip / Save buttons */}
        <div className="flex items-center justify-center gap-12">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                const top = displayTracks.findIndex((_, i) => !gone.has(i));
                if (top >= 0) handleSkip(top);
              }}
              className="w-16 h-16 rounded-full border-2 border-error/30 bg-error/5 flex items-center justify-center text-error hover:bg-error/10 transition-colors active:scale-90"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
            <span className="text-error/70 text-xs font-semibold uppercase tracking-wider">Skip</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                const topIdx = displayTracks.findIndex((_, i) => !gone.has(i));
                if (topIdx >= 0) handleSave(topIdx, displayTracks[topIdx]);
              }}
              className="w-16 h-16 rounded-full border-2 border-primary/30 bg-primary/5 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors active:scale-90"
            >
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </button>
            <span className="text-primary/70 text-xs font-semibold uppercase tracking-wider">Save</span>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {displayTracks.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                gone.has(i) ? "bg-primary-container w-1.5" : i === currentCardIndex ? "bg-primary w-6" : "bg-surface-container-highest w-1.5"
              }`}
            />
          ))}
        </div>
      </main>

      <NavBar />
    </div>
  );
}
```

---

## Task 16: Page — Library (app/library/page.tsx)

**Files:**
- Create: `app/library/page.tsx`

- [ ] **Step 1: Write the library page**

```tsx
// app/library/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import NavBar from "../../components/NavBar";
import { useAppStore, Track } from "../../store/useAppStore";

const FILTERS = ["All", "This Week", "Moody", "Hype"] as const;
type Filter = (typeof FILTERS)[number];

function filterSongs(songs: Track[], filter: Filter): Track[] {
  if (filter === "All") return songs;
  if (filter === "This Week") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return songs.filter((s) => (s.savedAt || 0) > weekAgo);
  }
  return songs;
}

export default function LibraryPage() {
  const { data: session } = useSession();
  const { savedSongs, loadSavedSongs } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  useEffect(() => { loadSavedSongs(); }, [loadSavedSongs]);

  const displayed = filterSongs(savedSongs, activeFilter);

  const handleExportSpotify = () => {
    alert("Spotify playlist export coming in Phase 2!");
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-effect border-b border-outline-variant/20 flex justify-between items-center px-4 py-3">
        <span className="font-bold text-2xl text-on-surface">VibeSong AI</span>
      </header>

      <main className="pt-20 px-4 space-y-4">
        <div>
          <h1 className="font-bold text-lg text-on-surface">Saved Songs</h1>
          <p className="text-on-surface-variant text-sm">From your VibeSong matches</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto scroll-hide">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                activeFilter === f
                  ? "bg-primary-container text-on-primary-container"
                  : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Songs list */}
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">music_off</span>
            <p className="text-on-surface-variant">No saved songs yet.</p>
            <p className="text-on-surface-variant/60 text-sm">Upload a photo to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((song, i) => (
              <motion.div
                key={`${song.youtubeId}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 bg-surface-container-low rounded-2xl p-3 border border-outline-variant/20"
              >
                {song.thumbnail ? (
                  <img src={song.thumbnail} alt={song.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface font-bold text-sm truncate">{song.title}</p>
                  <p className="text-on-surface-variant text-xs truncate">{song.artist}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    {song.sourceImage && (
                      <img src={song.sourceImage} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-primary-container/30" />
                    )}
                    <p className="text-primary text-xs font-semibold">{song.matchScore}% match</p>
                  </div>
                  <button className="text-on-surface-variant hover:text-on-surface transition-colors">
                    <span className="material-symbols-outlined text-base">more_vert</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Export to Spotify */}
      {savedSongs.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4">
          <button
            onClick={session ? handleExportSpotify : undefined}
            className={`w-full py-4 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              session
                ? "bg-spotify-green text-black hover:opacity-90 active:scale-95"
                : "bg-spotify-green/30 text-spotify-green/60 cursor-not-allowed"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>music_note</span>
            {session ? "Export playlist to Spotify" : "Connect Spotify to export"}
          </button>
        </div>
      )}

      <NavBar />
    </div>
  );
}
```

---

## Task 17: Page — Profile (app/profile/page.tsx)

**Files:**
- Create: `app/profile/page.tsx`

- [ ] **Step 1: Write the profile page**

```tsx
// app/profile/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import NavBar from "../../components/NavBar";
import { useAppStore } from "../../store/useAppStore";
import { getCredits } from "../../lib/credits";

export default function ProfilePage() {
  const { data: session } = useSession();
  const { savedSongs, loadSavedSongs } = useAppStore();
  const [credits, setCredits] = useState(3);
  const [showCredits, setShowCredits] = useState(false);

  useEffect(() => {
    setCredits(getCredits());
    loadSavedSongs();
  }, [loadSavedSongs]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-effect border-b border-outline-variant/20 flex justify-between items-center px-4 py-3">
        <button onClick={() => history.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <span className="font-bold text-on-surface">VibeSong AI</span>
        <div className="bg-primary-container text-on-primary-container rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
          <span>✦</span><span>{credits} credits</span>
        </div>
      </header>

      <main className="pt-20 px-4 space-y-6">
        {!session ? (
          /* Not logged in */
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-primary-container/20 flex items-center justify-center border-2 border-primary-container/40">
              <span className="material-symbols-outlined text-5xl text-primary-container">person</span>
            </div>
            <div>
              <h1 className="font-bold text-2xl text-on-surface">Your Profile</h1>
              <p className="text-on-surface-variant text-sm mt-2">Connect Spotify to personalize your matches</p>
            </div>
            <button
              onClick={() => signIn("spotify")}
              className="flex items-center gap-2 bg-spotify-green text-black font-bold py-4 px-8 rounded-full hover:opacity-90 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>music_note</span>
              Connect Spotify
            </button>
            <div className="bg-surface-container rounded-2xl p-4 w-full">
              <div className="flex justify-around">
                <div className="text-center">
                  <p className="font-bold text-2xl text-on-surface">0</p>
                  <p className="text-on-surface-variant text-xs">Matches</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-2xl text-on-surface">{savedSongs.length}</p>
                  <p className="text-on-surface-variant text-xs">Saved</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-2xl text-on-surface">{credits}</p>
                  <p className="text-on-surface-variant text-xs">Credits</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Logged in */
          <>
            {/* Avatar */}
            <div className="flex flex-col items-center space-y-2 pt-4">
              <div className="relative">
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || ""}
                    className="w-20 h-20 rounded-full border-2 border-primary-container"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary-container/20 border-2 border-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-primary-container">person</span>
                  </div>
                )}
              </div>
              <p className="font-bold text-on-surface">@{session.user?.name?.replace(/\s+/g, "").toLowerCase() || "user"}</p>
              <div className="flex items-center gap-1 text-spotify-green text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-spotify-green" />
                Connected to Spotify
              </div>
            </div>

            {/* Stats */}
            <div className="bg-surface-container rounded-2xl p-4">
              <div className="flex justify-around">
                <div className="text-center">
                  <p className="font-bold text-2xl text-on-surface">{savedSongs.length}</p>
                  <p className="text-on-surface-variant text-xs uppercase tracking-wide">Matches</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-2xl text-on-surface">{savedSongs.length}</p>
                  <p className="text-on-surface-variant text-xs uppercase tracking-wide">Saved</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-2xl text-on-surface">0</p>
                  <p className="text-on-surface-variant text-xs uppercase tracking-wide">Playlists</p>
                </div>
              </div>
            </div>

            {/* Matches history */}
            {savedSongs.length > 0 && (
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-on-surface">My Matches History</h2>
                  <a href="/library" className="text-primary text-xs font-semibold hover:underline">View All</a>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {savedSongs.slice(0, 6).map((song, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-surface-container">
                      {song.sourceImage && (
                        <img src={song.sourceImage} alt="" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-end justify-end p-1">
                        <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>music_note</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Credits + Actions */}
            <button
              onClick={() => setShowCredits(true)}
              className="w-full border border-primary-container text-primary-container font-bold py-4 rounded-2xl hover:bg-primary-container/10 active:scale-95 transition-all"
            >
              Manage Credits · {credits} remaining
            </button>

            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full text-on-surface-variant text-sm hover:text-on-surface transition-colors py-2"
            >
              Settings · Sign out
            </button>
          </>
        )}
      </main>

      <NavBar />
    </div>
  );
}
```

---

## Task 18: Session Provider Wrapper

**Files:**
- Create: `components/SessionProvider.tsx`
- Modify: `app/layout.tsx`

Auth.js v5 session requires a client-side provider around the app.

- [ ] **Step 1: Create SessionProvider wrapper**

```tsx
// components/SessionProvider.tsx
"use client";
import { SessionProvider } from "next-auth/react";

export default function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Wrap layout.tsx body with provider**

```tsx
// app/layout.tsx (updated body)
import NextAuthProvider from "../components/SessionProvider";

// Inside RootLayout:
<body className={`${inter.variable} font-sans min-h-full bg-background text-on-surface antialiased`}>
  <NextAuthProvider>
    {children}
  </NextAuthProvider>
</body>
```

---

## Task 19: Full Flow Test + Fixes

- [ ] **Step 1: Start dev server**
```bash
npm run dev
```

- [ ] **Step 2: Test home page loads with correct dark theme**
Open localhost:3000 — should match design screenshot exactly.

- [ ] **Step 3: Test /api/analyze with a real image**
Use browser DevTools console:
```js
const res = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: '<small base64>', mimeType: 'image/jpeg' })
});
console.log(await res.json());
```

- [ ] **Step 4: Test full flow**
1. Upload a photo from home screen
2. Watch analyzing screen with waveform animation
3. Verify results page loads with 5 swipe cards
4. Swipe/button save 2 songs
5. Navigate to /library — saved songs appear
6. Navigate to /profile

- [ ] **Step 5: Test 0 credits flow**
Open DevTools console: `localStorage.setItem('vibesong_credits', '0')`
Reload, try to upload → pricing modal should appear.

- [ ] **Step 6: Test Spotify login (if keys set)**
Click "Enhance with Spotify taste" → OAuth flow → returns to home with green indicator.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: VibeSong AI Phase 1 MVP complete"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Photo upload (JPG, PNG, max 15MB) | Task 10 DropZone |
| Video upload (MP4, extract frame at 1s) | Task 10 DropZone |
| GPT-4o Vision analysis | Task 6 /api/analyze |
| YouTube track search (5 results) | Task 7 /api/search-tracks |
| Swipe mechanic (save/skip) | Task 12 SwipeCard + Task 15 Results |
| Save to library (localStorage) | Task 4 Store + Task 16 Library |
| 3 free credits system (localStorage) | Task 3 lib/credits + Task 18 |
| Spotify optional login | Task 5 auth.ts |
| Spotify taste enhancement | Task 8 /api/enhance |
| Analyzing screen animations | Task 14 HomePage analyzing state |
| Pricing modal (10/$1.99, 50/$6.99, 200/$19.99) | Task 13 PricingModal |
| Bottom nav (Home/Explore/Library/Profile) | Task 9 NavBar |
| VibeTags animated appearance | Task 9 VibeTags |
| Credit badge with shake on 0 | Task 9 CreditBadge |
| Quick Prompts | Task 14 HomePage |
| Recent Vibes horizontal scroll | Task 14 HomePage |
| Keyboard swipe (ArrowLeft/Right) | Task 12 SwipeCard |
| Profile page + Spotify stats | Task 17 |
| Material Symbols icons | Task 2 layout.tsx |
| Tailwind v4 color system | Task 2 globals.css |
| Auth.js v5 session | Task 5 + Task 18 |

All requirements covered.
