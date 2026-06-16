"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface UserTaste {
  genres: string[];
  favoriteArtists: string[];
  defaultMood: string;
  discoveryStyle: "hidden-gems" | "niche" | "balanced" | "popular-ok";
  dislikes: string[];
  languagePreference: string;
  energyPreference: "calm" | "medium" | "high" | "depends";
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

const DISCOVERY_STYLES: Array<{
  value: UserTaste["discoveryStyle"];
  label: string;
  description: string;
}> = [
  {
    value: "hidden-gems",
    label: "Known artists, hidden gems",
    description: "Familiar names, less obvious songs",
  },
  {
    value: "niche",
    label: "Niche discoveries",
    description: "Smaller artists and deeper scenes",
  },
  {
    value: "balanced",
    label: "Balanced mix",
    description: "Some familiar, some surprising",
  },
  {
    value: "popular-ok",
    label: "Popular is okay",
    description: "Hits allowed when the fit is perfect",
  },
];

const DISLIKES = [
  "Overplayed TikTok songs",
  "Very sad songs",
  "Aggressive trap",
  "Slow songs",
  "Generic pop",
  "EDM drops",
  "Old songs",
  "Explicit lyrics",
];

const LANGUAGES = [
  "No preference",
  "English",
  "Korean / K-Pop",
  "Latin",
  "Russian",
  "Uzbek",
  "Global mix",
];

const ENERGY_OPTIONS: Array<{
  value: UserTaste["energyPreference"];
  label: string;
}> = [
  { value: "depends", label: "Depends on photo" },
  { value: "calm", label: "Calm" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High energy" },
];

const DEFAULT_TASTE: UserTaste = {
  genres: [],
  favoriteArtists: [],
  defaultMood: "",
  discoveryStyle: "balanced",
  dislikes: [],
  languagePreference: "No preference",
  energyPreference: "depends",
  setupComplete: true,
};

interface Props {
  onComplete: (taste: UserTaste) => void;
}

function StepShell({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      key={number}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <p className="font-display text-5xl font-extrabold text-hot-pink">
          {number}
        </p>
        <h2 className="font-display font-bold text-2xl text-ink">{title}</h2>
        <p className="text-black/60 text-sm">{subtitle}</p>
      </div>
      {children}
    </motion.div>
  );
}

export default function TasteSetup({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const [mood, setMood] = useState("");
  const [discoveryStyle, setDiscoveryStyle] =
    useState<UserTaste["discoveryStyle"]>("balanced");
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [languagePreference, setLanguagePreference] = useState("No preference");
  const [energyPreference, setEnergyPreference] =
    useState<UserTaste["energyPreference"]>("depends");

  const toggleGenre = (value: string) => {
    setGenres((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const toggleDislike = (value: string) => {
    setDislikes((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const save = (taste: UserTaste) => {
    localStorage.setItem("userTaste", JSON.stringify(taste));
    onComplete(taste);
  };

  const handleSkip = () => save(DEFAULT_TASTE);

  const handleFinish = () => {
    const artists = artistInput
      .split(",")
      .map((artist) => artist.trim())
      .filter(Boolean);

    save({
      genres,
      favoriteArtists: artists,
      defaultMood: mood,
      discoveryStyle,
      dislikes,
      languagePreference,
      energyPreference,
      setupComplete: true,
    });
  };

  const steps = [
    <StepShell
      key="genres"
      number="01"
      title="What's your vibe?"
      subtitle="Pick 1 or 2 genres you love"
    >
      <div className="flex flex-wrap gap-2">
        {GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => toggleGenre(genre)}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              genres.includes(genre)
                ? "bg-hot-pink text-white border-transparent"
                : "bg-black/[0.04] border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {genre}
          </button>
        ))}
      </div>
      <button
        disabled={genres.length === 0}
        onClick={() => setStep(1)}
        className="w-full py-4 rounded-full font-display font-bold text-base bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95"
      >
        Next
      </button>
    </StepShell>,

    <StepShell
      key="artists"
      number="02"
      title="Name artists you love"
      subtitle="Comma-separate up to 3 names"
    >
      <input
        type="text"
        value={artistInput}
        onChange={(event) => setArtistInput(event.target.value)}
        placeholder="e.g. Frank Ocean, SZA, The Weeknd"
        className="w-full bg-white border border-black/10 rounded-xl px-4 py-4 text-ink placeholder:text-black/40 focus:outline-none focus:border-hot-pink transition-colors text-base"
        autoFocus
      />
      <div className="flex gap-3">
        <button
          onClick={() => setStep(0)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          Back
        </button>
        <button
          disabled={artistInput.trim().length === 0}
          onClick={() => setStep(2)}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95"
        >
          Next
        </button>
      </div>
    </StepShell>,

    <StepShell
      key="mood"
      number="03"
      title="Your usual mood?"
      subtitle="Pick what fits you most"
    >
      <div className="flex flex-col gap-2">
        {MOODS.map((option) => (
          <button
            key={option}
            onClick={() => setMood(option)}
            className={`w-full px-5 py-3.5 rounded-xl text-sm font-semibold border text-left transition-all active:scale-[0.98] ${
              mood === option
                ? "bg-hot-pink text-white border-transparent"
                : "bg-white border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep(1)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          Back
        </button>
        <button
          disabled={mood.length === 0}
          onClick={() => setStep(3)}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95"
        >
          Next
        </button>
      </div>
    </StepShell>,

    <StepShell
      key="discovery"
      number="04"
      title="What kind of songs?"
      subtitle="Choose how discovery should feel"
    >
      <div className="space-y-2">
        {DISCOVERY_STYLES.map((option) => (
          <button
            key={option.value}
            onClick={() => setDiscoveryStyle(option.value)}
            className={`w-full px-4 py-3 rounded-xl text-left border transition-all active:scale-[0.98] ${
              discoveryStyle === option.value
                ? "bg-hot-pink text-white border-transparent"
                : "bg-white border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            <span className="block font-semibold text-sm">{option.label}</span>
            <span
              className={`block text-xs mt-0.5 ${
                discoveryStyle === option.value ? "text-white/75" : "text-black/45"
              }`}
            >
              {option.description}
            </span>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep(2)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setStep(4)}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-ink text-white transition-opacity active:scale-95"
        >
          Next
        </button>
      </div>
    </StepShell>,

    <StepShell
      key="dislikes"
      number="05"
      title="What should we avoid?"
      subtitle="Optional, pick any deal-breakers"
    >
      <div className="flex flex-wrap gap-2">
        {DISLIKES.map((option) => (
          <button
            key={option}
            onClick={() => toggleDislike(option)}
            className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
              dislikes.includes(option)
                ? "bg-hot-pink text-white border-transparent"
                : "bg-black/[0.04] border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep(3)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setStep(5)}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-ink text-white transition-opacity active:scale-95"
        >
          Next
        </button>
      </div>
    </StepShell>,

    <StepShell
      key="language"
      number="06"
      title="Language or scene?"
      subtitle="Optional preference for vocals"
    >
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map((option) => (
          <button
            key={option}
            onClick={() => setLanguagePreference(option)}
            className={`px-3 py-3 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
              languagePreference === option
                ? "bg-hot-pink text-white border-transparent"
                : "bg-white border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep(4)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setStep(6)}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-ink text-white transition-opacity active:scale-95"
        >
          Next
        </button>
      </div>
    </StepShell>,

    <StepShell
      key="energy"
      number="07"
      title="Energy level?"
      subtitle="We still listen to the photo first"
    >
      <div className="grid grid-cols-2 gap-2">
        {ENERGY_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setEnergyPreference(option.value)}
            className={`px-4 py-4 rounded-xl text-sm font-semibold border transition-all active:scale-[0.98] ${
              energyPreference === option.value
                ? "bg-hot-pink text-white border-transparent"
                : "bg-white border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep(5)}
          className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleFinish}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-hot-pink text-white transition-opacity active:scale-95 glow-pink"
        >
          Find your sound
        </button>
      </div>
    </StepShell>,
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-cream rounded-2xl p-6 space-y-6"
      >
        <div className="flex items-center gap-1.5">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === step
                  ? "w-5 bg-hot-pink"
                  : index < step
                  ? "w-2.5 bg-hot-pink/50"
                  : "w-2.5 bg-black/10"
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
