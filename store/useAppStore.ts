import { create } from "zustand";

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
  genres?: string[];
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
  loadFeedback: () => Promise<void>;
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
    set((s) => ({ savedSongs: [...s.savedSongs, withMeta] }));
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
        sourceImage: get().uploadedImageUrl || undefined,
      }),
    }).catch(() => {});
  },

  skipTrack: (track) => {
    const withMeta: Track = {
      ...track,
      skippedAt: Date.now(),
      sourceImage: get().uploadedImageUrl || undefined,
    };
    set((s) => ({ skippedSongs: [...s.skippedSongs, withMeta].slice(-50) }));
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
        sourceImage: get().uploadedImageUrl || undefined,
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
      vibeProfile: null,
      tracks: [],
      currentCardIndex: 0,
    }),

  loadFeedback: async () => {
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) return;
      const data = await res.json();
      set({ savedSongs: data.saved ?? [], skippedSongs: data.skipped ?? [] });
    } catch {
      // keep whatever is already in memory on network failure
    }
  },
}));
