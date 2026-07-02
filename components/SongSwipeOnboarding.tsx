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

interface Props {
  languages: string[];
  likedArtists: string[];
  onComplete: (completed: boolean) => void;
}

type Phase = "swipe" | "progress" | "dna";

export default function SongSwipeOnboarding({ languages, likedArtists, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("swipe");

  const [songs, setSongs] = useState<SeedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<SeedSong[]>([]);
  const [skipped, setSkipped] = useState<SeedSong[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);
  const [dnaVector, setDnaVector] = useState<EmotionalVector | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Single persistent Audio element — iOS only unlocks the element the user tapped,
  // so reusing the same element across songs lets auto-play work after first tap.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const swipingRef = useRef(false); // guard against double-fire from drag + button click

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-160, 160], [-14, 14]);
  const likeOpacity = useTransform(x, [25, 90], [0, 1]);
  const nopeOpacity = useTransform(x, [-90, -25], [1, 0]);

  // Create one persistent audio element for the entire onboarding session
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.65;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; audioRef.current = null; };
  }, []);

  // Fetch the initial batch of songs as soon as the component mounts
  useEffect(() => {
    setLoading(true);
    fetch("/api/seed-tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude: [], languages, likedArtists }),
    })
      .then((r) => r.json())
      .then((data) => {
        const loaded: SeedSong[] = Array.isArray(data) ? data : [];
        if (loaded.length === 0) {
          setDnaVector(buildTasteVector([], []));
          setPhase("dna");
        } else {
          setSongs(loaded);
        }
      })
      .catch(() => {
        setDnaVector(buildTasteVector([], []));
        setPhase("dna");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSong = index < songs.length ? songs[index] : null;

  // On song change (or when songs finish loading): update src and attempt auto-play
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || phase !== "swipe") return;
    audio.pause();
    setIsPlaying(false);
    if (!currentSong?.previewUrl) return;
    audio.src = currentSong.previewUrl;
    audio.load();
    // Succeeds after first user tap unlocks the element on iOS
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [index, phase, currentSong?.previewUrl]);

  // Detect when all songs in current batch are swiped → go to progress screen
  useEffect(() => {
    if (phase === "swipe" && songs.length > 0 && index >= songs.length) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setDnaVector(buildTasteVector(saved, skipped));
      setPhase("progress");
    }
  }, [phase, index, songs.length, saved, skipped]);

  const loadMoreSongs = useCallback(async () => {
    setLoadingMore(true);
    try {
      const exclude = songs.map((s) => s.title);
      const res = await fetch("/api/seed-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exclude, languages, likedArtists }),
      });
      const data: SeedSong[] = await res.json();
      const fresh = Array.isArray(data) ? data : [];
      if (fresh.length > 0) {
        setSongs((prev) => [...prev, ...fresh]);
        setPhase("swipe");
      } else {
        setPhase("dna");
      }
    } catch {
      setPhase("dna");
    } finally {
      setLoadingMore(false);
    }
  }, [songs, languages, likedArtists]);

  const handleAction = useCallback(
    (action: "saved" | "skipped", song: SeedSong) => {
      if (action === "saved") setSaved((p) => [...p, song]);
      else setSkipped((p) => [...p, song]);
      x.set(0);
      setSwiping(null);
      setIndex((i) => i + 1);
    },
    [x]
  );

  const swipeOff = useCallback(
    (direction: "left" | "right", song: SeedSong) => {
      if (swipingRef.current) return; // prevent double-fire (drag + button click same gesture)
      swipingRef.current = true;
      setSwiping(direction);
      animate(x, direction === "right" ? 600 : -600, { duration: 0.28 });
      setTimeout(() => {
        handleAction(direction === "right" ? "saved" : "skipped", song);
        swipingRef.current = false;
      }, 300);
    },
    [x, handleAction]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (!currentSong) return;
      if (info.offset.x > 80) swipeOff("right", currentSong);
      else if (info.offset.x < -80) swipeOff("left", currentSong);
      else animate(x, 0, { type: "spring", stiffness: 380, damping: 28 });
    },
    [x, swipeOff, currentSong]
  );

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else audio.play().then(() => setIsPlaying(true)).catch(() => {});
  };

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

  // ── Progress screen ───────────────────────────────────────────────────────
  if (phase === "progress") {
    const totalSwiped = saved.length + skipped.length;
    const confidence = Math.min(90, Math.round(20 + totalSwiped * 2));
    const nextConfidence = Math.min(90, confidence + 20);
    const canImprove = confidence < 88;
    const circumference = 2 * Math.PI * 58;

    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col items-center justify-center px-6" style={{ height: "100dvh" }}>
        <div className="w-full max-w-sm text-center space-y-8">
          <div className="relative inline-flex items-center justify-center">
            <svg width="144" height="144" className="-rotate-90">
              <circle cx="72" cy="72" r="58" fill="none" stroke="#1f1f1f" strokeWidth="10" />
              <circle
                cx="72" cy="72" r="58" fill="none"
                stroke="#ec4899" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - confidence / 100)}
                style={{ transition: "stroke-dashoffset 1.2s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white font-display font-extrabold text-3xl">{confidence}%</span>
              <span className="text-white/40 text-xs mt-0.5">taste match</span>
            </div>
          </div>

          <div>
            <h2 className="text-white font-display font-extrabold text-xl mb-2">
              We know your taste!
            </h2>
            <p className="text-white/50 text-sm">
              {canImprove
                ? `Swipe 10 more songs to reach ${nextConfidence}% accuracy`
                : "Your taste profile is fully calibrated"}
            </p>
          </div>

          <div className="space-y-3">
            {canImprove && (
              <button
                onClick={loadMoreSongs}
                disabled={loadingMore}
                className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base glow-pink disabled:opacity-60 active:scale-95 transition-all"
              >
                {loadingMore ? "Loading..." : "Swipe 10 more →"}
              </button>
            )}
            <button
              onClick={() => setPhase("dna")}
              className={`w-full py-3.5 rounded-xl font-display font-bold text-base active:scale-95 transition-all ${
                canImprove
                  ? "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
                  : "bg-hot-pink text-white glow-pink"
              }`}
            >
              See my Music DNA →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DNA screen ────────────────────────────────────────────────────────────
  if (phase === "dna") {
    if (!dnaVector) {
      // Fallback: dnaVector not ready yet, complete directly
      audioRef.current?.pause();
      onComplete(true);
      return null;
    }
    return (
      <MusicDNACard
        vector={dnaVector}
        onContinue={() => { audioRef.current?.pause(); onComplete(true); }}
      />
    );
  }

  if (!currentSong) {
    return null;
  }

  // ── Swipe screen ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col select-none" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 flex-shrink-0 gap-3">
        {/* Progress bar — fixed width, never overflows regardless of song count */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-hot-pink rounded-full transition-all duration-300"
              style={{ width: `${Math.round(((index + 1) / songs.length) * 100)}%` }}
            />
          </div>
          <span className="text-white/35 text-[11px] font-mono flex-shrink-0">
            {index + 1}/{songs.length}
          </span>
        </div>
        <button
          onClick={() => { audioRef.current?.pause(); onComplete(false); }}
          className="text-white/40 text-xs font-semibold hover:text-white/70 transition-colors flex-shrink-0 px-3 py-2 -mr-1"
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
          onClick={() => currentSong && swipeOff("left", currentSong)}
          className="w-14 h-14 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white/50 text-xl hover:border-white/30 hover:bg-white/10 transition-all active:scale-90"
          aria-label="Skip"
        >
          ✕
        </button>
        <button
          onClick={() => currentSong && swipeOff("right", currentSong)}
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
