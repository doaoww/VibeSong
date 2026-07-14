import { create } from "zustand";
import { mergeFeedbackTracks } from "../lib/mergeFeedback";

export interface ExifData {
  capturedHour?: number;   // 0-23
  capturedMonth?: number;  // 1-12
  latitude?: number;
  longitude?: number;
}

export interface GPTTrack {
  title: string;
  artist: string;
  reason: string;
  genres?: string[];
  matchScore: number;
  viralMomentSeconds?: number;
  photoFitScore?: number;
  tasteFitScore?: number;
  discoveryFitScore?: number;
  obviousnessPenalty?: number;
  finalScore?: number;
}

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
    tracks?: GPTTrack[];  // optional — GPT no longer returns songs
  };
  people?: {
    count: number;
    visibleEmotions: string[];
    socialVibe: string;
    activity: string;
  };
  vibeMetrics?: {
    intimacy: number;
    confidence: number;
    nostalgia: number;
    movement: number;
  };
  vibeCaption: string;
  vibeTags: string[];
}

export interface Track {
  title: string;
  artist: string;
  reason: string;
  genres?: string[];
  matchScore: number;
  finalScore?: number;
  photoFitScore?: number;
  tasteFitScore?: number;
  storyFitScore?: number;
  emotionalVector?: number[] | null;
  discoveryFitScore?: number;
  obviousnessPenalty?: number;
  youtubeId?: string;
  thumbnail: string;
  youtubeUrl?: string;
  previewUrl?: string;
  previewProvider?: "itunes" | "youtube";
  artwork?: string;
  appleMusicUrl?: string;
  viralMomentSeconds?: number;
  savedAt?: number;
  skippedAt?: number;
  sourceImage?: string;
}

interface AppState {
  uploadedImage: string | null;
  uploadedImageUrl: string | null;
  // Small data: URL, durable across reloads — unlike uploadedImageUrl (a
  // blob: URL that only lives for the current tab). This is what actually
  // gets persisted as Track.sourceImage; uploadedImageUrl stays blob-based
  // since it's only ever used for same-session full-size display.
  uploadedThumbnail: string | null;
  vibeProfile: VibeProfile | null;
  tracks: Track[];
  savedSongs: Track[];
  skippedSongs: Track[];
  credits: number;
  isAnalyzing: boolean;
  currentCardIndex: number;
  likedSeedTracks: Array<{ title: string; artist: string }>;
  onboardingPrefs: { languagePreference: string; dislikes: string[] };
  contrastMode: boolean;
  locale: "en" | "ru";
  vibeIntent: string | null;

  setUploadedImage: (base64: string, objectUrl: string, thumbnailDataUrl: string) => void;
  setVibeProfile: (profile: VibeProfile) => void;
  setTracks: (tracks: Track[]) => void;
  saveTrack: (track: Track) => void;
  skipTrack: (track: Track) => void;
  setCredits: (credits: number) => void;
  setIsAnalyzing: (v: boolean) => void;
  nextCard: () => void;
  resetSession: () => void;
  loadFeedback: () => Promise<void>;
  setLikedSeedTracks: (tracks: Array<{ title: string; artist: string }>) => void;
  setOnboardingPrefs: (prefs: { languagePreference: string; dislikes: string[] }) => void;
  setContrastMode: (v: boolean) => void;
  setLocale: (locale: "en" | "ru") => void;
  setVibeIntent: (text: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  uploadedImage: null,
  uploadedImageUrl: null,
  uploadedThumbnail: null,
  vibeProfile: null,
  tracks: [],
  savedSongs: [],
  skippedSongs: [],
  credits: 3,
  isAnalyzing: false,
  currentCardIndex: 0,
  likedSeedTracks: [],
  onboardingPrefs: { languagePreference: "No preference", dislikes: [] },
  contrastMode: false,
  locale: "en",
  vibeIntent: null,

  setUploadedImage: (base64, objectUrl, thumbnailDataUrl) =>
    set({ uploadedImage: base64, uploadedImageUrl: objectUrl, uploadedThumbnail: thumbnailDataUrl }),

  setVibeProfile: (profile) => set({ vibeProfile: profile }),

  setTracks: (tracks) => set({ tracks, currentCardIndex: 0 }),

  saveTrack: (track) => {
    const withMeta: Track = {
      ...track,
      savedAt: Date.now(),
      sourceImage: get().uploadedThumbnail || undefined,
    };
    set((s) => {
      const updated = [...s.savedSongs, withMeta];
      // Persist to localStorage as fallback for anonymous users or offline
      try { localStorage.setItem("vs_saved", JSON.stringify(updated.slice(-200))); } catch {}
      return { savedSongs: updated };
    });
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saved",
        track: {
          title: track.title,
          artist: track.artist,
          reason: track.reason,
          matchScore: track.matchScore,
          artwork: track.artwork,
          thumbnail: track.thumbnail,
          appleMusicUrl: track.appleMusicUrl,
          youtubeUrl: track.youtubeUrl,
          youtubeId: track.youtubeId,
          previewUrl: track.previewUrl,
          previewProvider: track.previewProvider,
        },
        genres:
          track.genres && track.genres.length > 0
            ? track.genres
            : get().vibeProfile?.musicDNA.genres ?? [],
        sourceImage: get().uploadedThumbnail || undefined,
      }),
    }).catch(() => {});
  },

  skipTrack: (track) => {
    const withMeta: Track = {
      ...track,
      skippedAt: Date.now(),
      sourceImage: get().uploadedThumbnail || undefined,
    };
    set((s) => {
      // A reject should retract an earlier save of the same song (e.g. liked
      // during the onboarding taste quiz, then rejected in a real match session)
      // instead of leaving it stuck in the library until the next server sync.
      const key = (t: Track) => `${t.title.trim().toLowerCase()}|||${t.artist.trim().toLowerCase()}`;
      const skipKey = key(track);
      const savedSongs = s.savedSongs.filter((t) => key(t) !== skipKey);
      if (savedSongs.length !== s.savedSongs.length) {
        try { localStorage.setItem("vs_saved", JSON.stringify(savedSongs.slice(-200))); } catch {}
      }
      return { savedSongs, skippedSongs: [...s.skippedSongs, withMeta].slice(-50) };
    });
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "skipped",
        track: {
          title: track.title,
          artist: track.artist,
          reason: track.reason,
          matchScore: track.matchScore,
          artwork: track.artwork,
          thumbnail: track.thumbnail,
          appleMusicUrl: track.appleMusicUrl,
          youtubeUrl: track.youtubeUrl,
          youtubeId: track.youtubeId,
          previewUrl: track.previewUrl,
          previewProvider: track.previewProvider,
        },
        genres:
          track.genres && track.genres.length > 0
            ? track.genres
            : get().vibeProfile?.musicDNA.genres ?? [],
        sourceImage: get().uploadedThumbnail || undefined,
      }),
    }).catch(() => {});
  },

  setCredits: (credits) => set({ credits }),

  setIsAnalyzing: (v) => set({ isAnalyzing: v }),

  nextCard: () => set((s) => ({ currentCardIndex: s.currentCardIndex + 1 })),

  resetSession: () =>
    set({
      uploadedImage: null,
      uploadedImageUrl: null,
      uploadedThumbnail: null,
      vibeProfile: null,
      tracks: [],
      currentCardIndex: 0,
      vibeIntent: null,
    }),

  loadFeedback: async () => {
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) {
        const data = await res.json();
        // Merge rather than replace: saveTrack/skipTrack POST without
        // awaiting the result, so this GET can race ahead of that write
        // landing in the DB — merging keeps a just-saved track visible
        // instead of it vanishing until the next refresh.
        set((s) => ({
          savedSongs: mergeFeedbackTracks(s.savedSongs, data.saved ?? []),
          skippedSongs: mergeFeedbackTracks(s.skippedSongs, data.skipped ?? []),
        }));
        // Sync merged result back to localStorage cache
        try { localStorage.setItem("vs_saved", JSON.stringify(get().savedSongs)); } catch {}
        return;
      }
    } catch {}
    // Fallback: restore from localStorage (anonymous users / network failure)
    try {
      const ls = localStorage.getItem("vs_saved");
      if (ls) set({ savedSongs: JSON.parse(ls) });
    } catch {}
  },

  setLikedSeedTracks: (tracks) => set({ likedSeedTracks: tracks }),

  setOnboardingPrefs: (prefs) => set({ onboardingPrefs: prefs }),

  setContrastMode: (v) => set({ contrastMode: v }),

  setLocale: (locale) => {
    if (typeof window !== "undefined") localStorage.setItem("vibesong_locale", locale);
    set({ locale });
  },

  setVibeIntent: (text) => set({ vibeIntent: text.trim() || null }),
}));
