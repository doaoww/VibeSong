"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { EmotionalVector } from "../lib/emotionalVector";
import MusicDNACard from "./MusicDNACard";
import { buildTasteVector } from "../lib/emotionalVector";

export interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  previewUrl: string | null;
  artwork: string | null;
  emotionalVector?: EmotionalVector;
}

export interface OnboardingPrefs {
  languagePreference: string;
  dislikes: string[];
}

interface Props {
  onComplete: (saved: SeedSong[], skipped: SeedSong[], prefs: OnboardingPrefs) => void;
}

const LANGUAGES = [
  "No preference",
  "English",
  "Korean",
  "Spanish / Latin",
  "Russian",
  "Uzbek",
  "Arabic",
  "French",
  "Hindi",
  "Japanese",
];

const DISLIKES_OPTIONS = [
  "Explicit lyrics",
  "Heavy metal / screamo",
  "Very slow / sad songs",
  "EDM / festival drops",
  "Foreign language",
  "Overplayed hits",
  "Mumble rap",
  "Generic pop ballads",
];

type Phase = "prefs" | "swipe" | "done";

export default function SongSwipeOnboarding({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("prefs");
  const [prefs, setPrefs] = useState<OnboardingPrefs>({ languagePreference: "No preference", dislikes: [] });

  const [songs, setSongs] = useState<SeedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<SeedSong[]>([]);
  const [skipped, setSkipped] = useState<SeedSong[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);
  const [dnaVector, setDnaVector] = useState<EmotionalVector | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-160, 160], [-14, 14]);
  const likeOpacity = useTransform(x, [25, 90], [0, 1]);
  const nopeOpacity = useTransform(x, [-90, -25], [1, 0]);

  useEffect(() => {
    fetch("/api/seed-tracks")
      .then((r) => r.json())
      .then((data) => setSongs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentSong = index < songs.length ? songs[index] : null;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsPlaying(false);

    if (!currentSong?.previewUrl || phase !== "swipe") return;

    const audio = new Audio(currentSong.previewUrl);
    audio.volume = 0.65;
    audioRef.current = audio;
    // Don't auto-play — mobile browsers block play() without direct user gesture

    return () => {
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase]);

  const handleAction = useCallback(
    (action: "saved" | "skipped") => {
      if (!currentSong) return;
      if (action === "saved") setSaved((p) => [...p, currentSong]);
      else setSkipped((p) => [...p, currentSong]);
      x.set(0);
      setSwiping(null);
      setIndex((i) => i + 1);
    },
    [currentSong, x]
  );

  const swipeOff = useCallback(
    (direction: "left" | "right") => {
      setSwiping(direction);
      animate(x, direction === "right" ? 600 : -600, { duration: 0.28 });
      setTimeout(() => handleAction(direction === "right" ? "saved" : "skipped"), 260);
    },
    [x, handleAction]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x > 80) swipeOff("right");
      else if (info.offset.x < -80) swipeOff("left");
      else animate(x, 0, { type: "spring", stiffness: 380, damping: 28 });
    },
    [x, swipeOff]
  );

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else audio.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const toggleDislike = (item: string) => {
    setPrefs((p) => ({
      ...p,
      dislikes: p.dislikes.includes(item)
        ? p.dislikes.filter((d) => d !== item)
        : [...p.dislikes, item],
    }));
  };

  // ── Prefs screen ──────────────────────────────────────────────────────────
  if (phase === "prefs") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: '100dvh' }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-1">Setup · 1 of 1</p>
        <h1 className="text-white font-display font-extrabold text-2xl leading-tight mb-6">
          Quick taste check
        </h1>

        {/* Language */}
        <div className="mb-6">
          <p className="text-white/60 text-sm font-semibold mb-3">What language do you prefer?</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setPrefs((p) => ({ ...p, languagePreference: lang }))}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                  prefs.languagePreference === lang
                    ? "bg-hot-pink border-hot-pink text-white"
                    : "border-white/15 text-white/50 hover:border-white/30"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Dislikes */}
        <div className="mb-8">
          <p className="text-white/60 text-sm font-semibold mb-1">Anything you can&apos;t stand? <span className="text-white/30 font-normal">(optional)</span></p>
          <div className="flex flex-wrap gap-2 mt-3">
            {DISLIKES_OPTIONS.map((item) => (
              <button
                key={item}
                onClick={() => toggleDislike(item)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                  prefs.dislikes.includes(item)
                    ? "bg-white/10 border-white/40 text-white"
                    : "border-white/15 text-white/50 hover:border-white/30"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setPhase("swipe")}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base glow-pink"
        >
          Start swiping →
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-hot-pink border-t-transparent animate-spin" />
          <p className="text-white/50 text-sm font-display">Loading songs...</p>
        </div>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (index >= songs.length && songs.length > 0) {
    if (!dnaVector) {
      const vec = buildTasteVector(saved, skipped);
      setDnaVector(vec);
      return null;
    }
    return (
      <MusicDNACard
        vector={dnaVector}
        onContinue={() => { audioRef.current?.pause(); onComplete(saved, skipped, prefs); }}
      />
    );
  }

  if (!currentSong) {
    return null;
  }

  const nextSong = songs[index + 1] ?? null;

  // ── Swipe screen ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col select-none" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {songs.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i < index
                  ? "w-4 bg-hot-pink/40"
                  : i === index
                  ? "w-7 bg-hot-pink"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => { audioRef.current?.pause(); onComplete(saved, skipped, prefs); }}
          className="text-white/35 text-xs font-semibold hover:text-white/60 transition-colors px-2 py-1"
        >
          Skip
        </button>
      </div>

      {/* Prompt */}
      <p className="text-center text-white/40 text-xs font-semibold tracking-wide uppercase px-4 pb-2 flex-shrink-0">
        Do you vibe with this?
      </p>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center px-5 min-h-0">
        <div className="relative w-full max-w-xs" style={{ height: 440 }}>

          {nextSong && (
            <div
              className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{ transform: "scale(0.94) translateY(10px)", zIndex: 0 }}
            >
              {nextSong.artwork ? (
                <img src={nextSong.artwork} alt="" className="w-full h-full object-cover opacity-50" />
              ) : (
                <div className="w-full h-full bg-[#1a1a1a]" />
              )}
            </div>
          )}

          <motion.div
            key={`${currentSong.title}-${index}`}
            style={{ x, rotate, zIndex: 1 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.75}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
          >
            {currentSong.artwork ? (
              <img
                src={currentSong.artwork}
                alt={currentSong.title}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-hot-pink/20 to-[#1a0a2e]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-5 right-4 bg-hot-pink text-white font-display font-black text-lg px-3 py-1 rounded-lg rotate-12 border-2 border-white/30"
            >
              LOVE
            </motion.div>

            <motion.div
              style={{ opacity: nopeOpacity }}
              className="absolute top-5 left-4 bg-black/50 backdrop-blur text-white font-display font-black text-lg px-3 py-1 rounded-lg -rotate-12 border-2 border-white/20"
            >
              NOPE
            </motion.div>

            {currentSong.previewUrl && (
              <button
                onClick={togglePlay}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
              >
                {isPlaying ? (
                  <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ["30%", "100%", "50%", "80%", "30%"] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                        className="w-0.5 bg-hot-pink rounded-full"
                        style={{ minHeight: 3, maxHeight: 12 }}
                      />
                    ))}
                    <span className="text-white/60 text-[10px] ml-1">playing</span>
                  </div>
                ) : (
                  <div className="bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <span className="text-white/50 text-[10px]">▶ tap to play</span>
                  </div>
                )}
              </button>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5">
              <p className="text-white font-display font-extrabold text-xl leading-tight">
                {currentSong.title}
              </p>
              <p className="text-white/65 font-semibold text-sm">{currentSong.artist}</p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {currentSong.genres.slice(0, 2).map((g) => (
                  <span
                    key={g}
                    className="px-2 py-0.5 rounded-full bg-white/10 text-white/55 text-[10px] font-semibold"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-10 pt-3 pb-10 flex-shrink-0">
        <button
          onClick={() => swipeOff("left")}
          className="w-14 h-14 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white/50 text-xl hover:border-white/30 hover:bg-white/10 transition-all active:scale-90"
          aria-label="Skip"
        >
          ✕
        </button>
        <button
          onClick={() => swipeOff("right")}
          className="w-18 h-18 rounded-full bg-hot-pink flex items-center justify-center text-white text-2xl glow-pink hover:scale-105 transition-all active:scale-95 shadow-xl"
          style={{ width: 68, height: 68 }}
          aria-label="Love it"
        >
          ♥
        </button>
      </div>

      {index === 0 && (
        <p className="text-center text-white/25 text-[11px] pb-3 -mt-4 flex-shrink-0">
          Swipe or tap · right to love it · left to skip
        </p>
      )}
    </div>
  );
}
