"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

export interface SeedSong {
  title: string;
  artist: string;
  genres: string[];
  previewUrl: string | null;
  artwork: string | null;
}

interface Props {
  onComplete: (saved: SeedSong[], skipped: SeedSong[]) => void;
}

export default function SongSwipeOnboarding({ onComplete }: Props) {
  const [songs, setSongs] = useState<SeedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<SeedSong[]>([]);
  const [skipped, setSkipped] = useState<SeedSong[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [swiping, setSwiping] = useState<"left" | "right" | null>(null);
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

    if (!currentSong?.previewUrl) return;

    const audio = new Audio(currentSong.previewUrl);
    audio.volume = 0.65;
    audioRef.current = audio;

    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));

    return () => {
      audio.pause();
      audio.src = "";
    };
    // index change is the real trigger; songs array stable after load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-hot-pink border-t-transparent animate-spin" />
          <p className="text-white/50 text-sm font-display">Loading songs...</p>
        </div>
      </div>
    );
  }

  // Done screen — shown after all songs swiped
  if (index >= songs.length && songs.length > 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#080808] flex flex-col items-center justify-center p-6 gap-5">
        <div className="w-16 h-16 rounded-full bg-hot-pink/15 flex items-center justify-center">
          <span className="text-hot-pink text-2xl font-display font-black">♫</span>
        </div>
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl font-bold text-white">Taste locked in</h2>
          <p className="text-white/50 text-sm">Every match from here is built around you.</p>
        </div>
        <button
          onClick={() => onComplete(saved, skipped)}
          className="px-8 py-4 rounded-full bg-hot-pink text-white font-display font-bold text-base glow-pink active:scale-95 transition-transform"
        >
          Start matching
        </button>
      </div>
    );
  }

  if (!currentSong) {
    // No songs loaded (API failed) — skip straight through
    return null;
  }

  const nextSong = songs[index + 1] ?? null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] flex flex-col select-none">
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
          onClick={() => { audioRef.current?.pause(); onComplete(saved, skipped); }}
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

          {/* Background card (next song) */}
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

          {/* Active card */}
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

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

            {/* LOVE label */}
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-5 right-4 bg-hot-pink text-white font-display font-black text-lg px-3 py-1 rounded-lg rotate-12 border-2 border-white/30"
            >
              LOVE
            </motion.div>

            {/* NOPE label */}
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="absolute top-5 left-4 bg-black/50 backdrop-blur text-white font-display font-black text-lg px-3 py-1 rounded-lg -rotate-12 border-2 border-white/20"
            >
              NOPE
            </motion.div>

            {/* Playing badge */}
            {currentSong.previewUrl && (
              <button
                onClick={togglePlay}
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

            {/* Song info */}
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
