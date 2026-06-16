import { create } from "zustand";

export interface GPTTrack {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
  viralMomentSeconds?: number;
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
  vibeCaption: string;
  vibeTags: string[];
}

export interface Track {
  title: string;
  artist: string;
  reason: string;
  matchScore: number;
  youtubeId: string;
  thumbnail: string;
  youtubeUrl: string;
  viralMomentSeconds?: number;
  savedAt?: number;
  sourceImage?: string;
}

interface AppState {
  uploadedImage: string | null;
  uploadedImageUrl: string | null;
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
  },
}));
