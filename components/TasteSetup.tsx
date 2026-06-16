"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface UserTaste {
  genres: string[];
  favoriteArtists: string[];
  defaultMood: string;
  setupComplete: boolean;
}

const GENRES = [
  "Indie / Alternative",
  "Hip-Hop / R&B",
  "Pop",
  "Electronic / Dance",
  "Rock",
  "Jazz / Soul",
  "K-Pop",
  "Latin",
  "Classical / Ambient",
];

const MOODS = [
  "Chill & Melancholic",
  "Hype & Energetic",
  "Romantic & Dreamy",
  "Dark & Moody",
  "Happy & Fun",
];

interface Props {
  onComplete: (taste: UserTaste) => void;
}

export default function TasteSetup({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const [mood, setMood] = useState("");

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const save = (taste: UserTaste) => {
    localStorage.setItem("userTaste", JSON.stringify(taste));
    onComplete(taste);
  };

  const handleSkip = () => {
    save({ genres: [], favoriteArtists: [], defaultMood: "", setupComplete: true });
  };

  const handleFinish = () => {
    const artists = artistInput
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    save({ genres, favoriteArtists: artists, defaultMood: mood, setupComplete: true });
  };

  const steps = [
    <motion.div
      key="step-genres"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <p className="font-display text-5xl font-extrabold text-hot-pink">01</p>
        <h2 className="font-display font-bold text-2xl text-ink">
          What&apos;s your vibe?
        </h2>
        <p className="text-black/60 text-sm">Pick 1 or 2 genres you love</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => toggleGenre(g)}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              genres.includes(g)
                ? "bg-hot-pink text-white border-transparent"
                : "bg-black/[0.04] border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <button
        disabled={genres.length === 0}
        onClick={() => setStep(1)}
        className="w-full py-4 rounded-full font-display font-bold text-base bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95"
      >
        Next →
      </button>
    </motion.div>,

    <motion.div
      key="step-artists"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <p className="font-display text-5xl font-extrabold text-hot-pink">02</p>
        <h2 className="font-display font-bold text-2xl text-ink">
          Name an artist you love
        </h2>
        <p className="text-black/60 text-sm">Comma-separate up to 3 names</p>
      </div>
      <input
        type="text"
        value={artistInput}
        onChange={(e) => setArtistInput(e.target.value)}
        placeholder="e.g. Frank Ocean, The Weeknd..."
        className="w-full bg-white border border-black/10 rounded-xl px-4 py-4 text-ink placeholder:text-black/40 focus:outline-none focus:border-hot-pink transition-colors text-base"
        autoFocus
      />
      <div className="flex gap-3">
        <button
          onClick={() => setStep(0)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          ←
        </button>
        <button
          disabled={artistInput.trim().length === 0}
          onClick={() => setStep(2)}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95"
        >
          Next →
        </button>
      </div>
    </motion.div>,

    <motion.div
      key="step-mood"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <p className="font-display text-5xl font-extrabold text-hot-pink">03</p>
        <h2 className="font-display font-bold text-2xl text-ink">
          Your usual mood?
        </h2>
        <p className="text-black/60 text-sm">Pick what fits you most</p>
      </div>
      <div className="flex flex-col gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => setMood(m)}
            className={`w-full px-5 py-3.5 rounded-xl text-sm font-semibold border text-left transition-all active:scale-[0.98] ${
              mood === m
                ? "bg-hot-pink text-white border-transparent"
                : "bg-white border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          ←
        </button>
        <button
          disabled={mood.length === 0}
          onClick={handleFinish}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-hot-pink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95 glow-pink"
        >
          Find your sound →
        </button>
      </div>
    </motion.div>,
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-cream rounded-2xl p-6 space-y-6"
      >
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-hot-pink"
                  : i < step
                  ? "w-3 bg-hot-pink/50"
                  : "w-3 bg-black/10"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>

        <button
          onClick={handleSkip}
          className="w-full text-center text-xs text-black/40 hover:text-black/60 transition-colors py-1"
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
