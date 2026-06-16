import { create } from "zustand";

export interface GPTTrack {
  title: string;
  artist: string;
  reason: string;
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
    tracks: GPTTrack[];
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
  matchScore: number;
  finalScore?: number;
  photoFitScore?: number;
  tasteFitScore?: number;
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
  vibeProfile: VibeProfile | null;
  tracks: Track[];
  savedSongs: Track[];
  skippedSongs: Track[];
  credits: number;
  isAnalyzing: boolean;
  currentCardIndex: number;

  setUploadedImage: (base64: string, objectUrl: string) => void;
  setVibeProfile: (profile: VibeProfile) => void;
  setTracks: (tracks: Track[]) => void;
  saveTrack: (track: Track) => void;
  skipTrack: (track: Track) => void;
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
  skippedSongs: [],
  credits: 3,
  isAnalyzing: false,
  currentCardIndex: 0,

  setUploadedImage: (base64, objectUrl) =>
    set({ uploadedImage: base64, uploadedImageUrl: objectUrl }),

  setVibeProfile: (profile) => set({ vibeProfile: profile }),

  setTracks: (tracks) => set({ tracks, currentCardIndex: 0 }),

  saveTrack: (track) => {
    const withMeta: Track = {
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

  skipTrack: (track) => {
    const withMeta: Track = {
      ...track,
      skippedAt: Date.now(),
      sourceImage: get().uploadedImageUrl || undefined,
    };
    const updated = [...get().skippedSongs, withMeta].slice(-50);
    if (typeof window !== "undefined") {
      localStorage.setItem("vibesong_skipped", JSON.stringify(updated));
    }
    set({ skippedSongs: updated });
  },

  setCredits: (credits) => set({ credits }),

  setIsAnalyzing: (v) => set({ isAnalyzing: v }),

  nextCard: () => set((s) => ({ currentCardIndex: s.currentCardIndex + 1 })),

  resetSession: () =>
    set({
      uploadedImage: null,
      uploadedImageUrl: null,
      vibeProfile: null,
      tracks: [],
      currentCardIndex: 0,
    }),

  loadSavedSongs: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("vibesong_library");
    if (stored) {
      try {
        set({ savedSongs: JSON.parse(stored) });
      } catch {
        // ignore malformed data
      }
    }
    const skipped = localStorage.getItem("vibesong_skipped");
    if (skipped) {
      try {
        set({ skippedSongs: JSON.parse(skipped) });
      } catch {
        // ignore malformed data
      }
    }
  },
}));
