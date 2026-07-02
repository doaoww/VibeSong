"use client";

const LANGUAGES = [
  "Russian", "English", "Korean", "Spanish", "Arabic", "French",
  "Turkish", "Uzbek", "Hindi", "Japanese",
];

const OPENNESS_OPTIONS: Array<{ value: "strict" | "flexible" | "open"; label: string }> = [
  { value: "strict", label: "Only what I selected" },
  { value: "flexible", label: "Mostly mine, sometimes others" },
  { value: "open", label: "Open to anything if the vibe fits" },
];

interface Props {
  languages: string[];
  openness: "strict" | "flexible" | "open";
  onChange: (languages: string[], openness: "strict" | "flexible" | "open") => void;
  onNext: () => void;
}

export default function LanguageStep({ languages, openness, onChange, onNext }: Props) {
  const toggleLanguage = (lang: string) => {
    const next = languages.includes(lang)
      ? languages.filter((l) => l !== lang)
      : [...languages, lang];
    onChange(next, openness);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">
          Which languages do you actually post/listen to in your stories?
        </h2>
        <p className="text-white/40 text-sm">Pick at least one.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => toggleLanguage(lang)}
            className={`px-3 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              languages.includes(lang)
                ? "bg-hot-pink border-hot-pink text-white"
                : "border-white/15 text-white/50 hover:border-white/30"
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      <div>
        <p className="text-white/60 text-sm font-semibold mb-3">How open are you to other languages?</p>
        <div className="space-y-2">
          {OPENNESS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange(languages, opt.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                openness === opt.value
                  ? "bg-hot-pink/10 border-hot-pink text-white"
                  : "border-white/15 text-white/60 hover:border-white/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={languages.length === 0}
        className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
      >
        Next
      </button>
    </div>
  );
}
