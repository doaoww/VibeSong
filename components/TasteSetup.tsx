"use client";
import { useEffect, useState } from "react";
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
  aestheticTags: string[];
  setupComplete: boolean;
}

const GENRES = [
  "Alternative Hip-Hop",
  "Trap & Drill",
  "R&B & Neo-Soul",
  "Pop & Hyperpop",
  "Indie Rock & Shoegaze",
  "Electronic & Synth",
  "Club / House / Techno",
  "Lo-Fi & Chillwave",
  "Jazz & Soul",
  "Latin & Reggaeton",
  "K-Pop & K-R&B",
  "Afrobeats & Amapiano",
  "Pop-Punk & Emo",
  "Folk & Indie Folk",
  "Bedroom Pop",
  "Metal & Hard Rock",
  "Ambient & Experimental",
  "Classical & Orchestral",
];

const AESTHETIC_TAGS = [
  "Dark",
  "Dreamy",
  "Raw",
  "Euphoric",
  "Nostalgic",
  "Hypnotic",
  "Gritty",
  "Ethereal",
  "Minimalist",
  "Anthemic",
  "Romantic",
  "Playful",
  "Cinematic",
  "Introspective",
  "Aggressive",
  "Smooth",
];

const DISLIKES = [
  "Overplayed hits",
  "Mumble rap",
  "Heavy metal / screamo",
  "Very sad / slow songs",
  "Generic pop ballads",
  "EDM / festival drops",
  "Explicit lyrics",
  "Songs over 5 min",
  "Pre-2010 music",
  "Foreign language vocals",
];

const LANGUAGES = [
  "No preference",
  "English",
  "Korean",
  "Spanish / Latin",
  "Russian",
  "Uzbek",
  "Arabic",
  "Hindi",
  "French",
  "Japanese",
  "Portuguese",
  "Turkish",
  "German",
  "Mandarin",
  "Italian",
  "Afrobeats",
  "Global mix",
];

const DEFAULT_TASTE: UserTaste = {
  genres: [],
  favoriteArtists: [],
  defaultMood: "",
  discoveryStyle: "balanced",
  dislikes: [],
  languagePreference: "No preference",
  energyPreference: "depends",
  aestheticTags: [],
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
      transition={{ duration: 0.22 }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <p className="font-display text-5xl font-extrabold text-hot-pink">{number}</p>
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
  const [artistQuery, setArtistQuery] = useState("");
  const [artistSuggestions, setArtistSuggestions] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [aestheticTags, setAestheticTags] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [languagePreference, setLanguagePreference] = useState("No preference");

  const toggle = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  useEffect(() => {
    const q = artistQuery.trim();
    const t = setTimeout(() => {
      if (q.length < 2) { setArtistSuggestions([]); return; }
      fetch(`/api/artist-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { artists: [] }))
        .then((d) => setArtistSuggestions(d.artists ?? []))
        .catch(() => setArtistSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [artistQuery]);

  const addArtist = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selectedArtists.includes(trimmed)) return;
    setSelectedArtists((prev) => [...prev, trimmed]);
    setArtistQuery("");
    setArtistSuggestions([]);
  };

  const save = (taste: UserTaste) => {
    localStorage.setItem("userTaste", JSON.stringify(taste));
    onComplete(taste);
  };

  const handleSkip = () => save(DEFAULT_TASTE);

  const handleFinish = () =>
    save({
      genres,
      favoriteArtists: selectedArtists,
      defaultMood: "",
      discoveryStyle: "balanced",
      dislikes,
      languagePreference,
      energyPreference: "depends",
      aestheticTags,
      setupComplete: true,
    });

  const navBtn = (label: string, onClick: () => void, disabled = false) => (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex-1 py-4 rounded-full font-display font-bold text-base bg-ink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95"
    >
      {label}
    </button>
  );

  const backBtn = (toStep: number) => (
    <button
      onClick={() => setStep(toStep)}
      className="px-6 py-4 rounded-full border border-black/10 text-black/60 font-semibold text-sm hover:bg-black/[0.04] transition-colors"
    >
      Back
    </button>
  );

  const steps = [
    // Step 01 — Genres
    <StepShell key="genres" number="01" title="Your sound" subtitle="Pick 2–4 genres you love">
      <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => toggle(g, genres, setGenres)}
            className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
              genres.includes(g)
                ? "bg-hot-pink text-white border-transparent"
                : "bg-black/[0.04] border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      {navBtn("Next", () => setStep(1), genres.length === 0)}
    </StepShell>,

    // Step 02 — Artists
    <StepShell key="artists" number="02" title="Artists you love" subtitle="The more you add, the better we match">
      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedArtists.map((a) => (
            <button
              key={a}
              onClick={() => setSelectedArtists((prev) => prev.filter((x) => x !== a))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-hot-pink text-white active:scale-95 transition-transform"
            >
              {a}
              <span className="text-white/70">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={artistQuery}
          onChange={(e) => setArtistQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArtist(artistQuery); } }}
          placeholder="e.g. Frank Ocean"
          className="w-full bg-white border border-black/10 rounded-xl px-4 py-4 text-ink placeholder:text-black/40 focus:outline-none focus:border-hot-pink transition-colors text-base"
          autoFocus
        />
        {artistSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-black/10 rounded-xl overflow-hidden shadow-lg z-10">
            {artistSuggestions.map((a) => (
              <button
                key={a}
                onClick={() => addArtist(a)}
                className="w-full text-left px-4 py-3 text-sm text-ink hover:bg-hot-pink/10 transition-colors"
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-black/40 text-xs">Can&apos;t find them? Type the name and press Enter.</p>
      <div className="flex gap-3">
        {backBtn(0)}
        {navBtn("Next", () => setStep(2), selectedArtists.length === 0)}
      </div>
    </StepShell>,

    // Step 03 — Aesthetic tags
    <StepShell key="aesthetic" number="03" title="Your vibe" subtitle="Pick 3–5 words that describe your taste">
      <div className="flex flex-wrap gap-2">
        {AESTHETIC_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggle(tag, aestheticTags, setAestheticTags)}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              aestheticTags.includes(tag)
                ? "bg-hot-pink text-white border-transparent"
                : "bg-black/[0.04] border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        {backBtn(1)}
        {navBtn("Next", () => setStep(3), aestheticTags.length < 3)}
      </div>
    </StepShell>,

    // Step 04 — Dislikes (optional)
    <StepShell key="dislikes" number="04" title="What to avoid?" subtitle="Optional — pick any deal-breakers">
      <div className="flex flex-wrap gap-2">
        {DISLIKES.map((d) => (
          <button
            key={d}
            onClick={() => toggle(d, dislikes, setDislikes)}
            className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
              dislikes.includes(d)
                ? "bg-hot-pink text-white border-transparent"
                : "bg-black/[0.04] border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        {backBtn(2)}
        {navBtn("Next", () => setStep(4))}
      </div>
    </StepShell>,

    // Step 05 — Language
    <StepShell key="language" number="05" title="Language?" subtitle="Optional — what vocals do you prefer?">
      <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguagePreference(lang)}
            className={`px-3 py-3 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
              languagePreference === lang
                ? "bg-hot-pink text-white border-transparent"
                : "bg-white border-black/10 text-black/70 hover:border-hot-pink/40"
            }`}
          >
            {lang}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        {backBtn(3)}
        <button
          onClick={handleFinish}
          className="flex-1 py-4 rounded-full font-display font-bold text-base bg-hot-pink text-white transition-opacity active:scale-95 glow-pink"
        >
          Find my sound
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
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-5 bg-hot-pink" : i < step ? "w-2.5 bg-hot-pink/50" : "w-2.5 bg-black/10"
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
