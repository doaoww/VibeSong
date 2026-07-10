"use client";
import { useTranslation } from "../../lib/translations/useTranslation";

// These values are matched against the song catalog's `language` field
// (see lib/matching.ts's LANGUAGE_PREFERENCE_ALIASES) — they must stay the
// original English strings regardless of UI language. Only the rendered
// button text is translated (see displayLanguage/displayOpenness below).
const LANGUAGES = [
  "Russian", "English", "Korean", "Spanish", "Arabic", "French",
  "Turkish", "Uzbek", "Hindi", "Japanese", "Kazakh",
];

const OPENNESS_OPTIONS: Array<{ value: "strict" | "flexible" | "open" }> = [
  { value: "strict" },
  { value: "flexible" },
  { value: "open" },
];

interface Props {
  languages: string[];
  openness: "strict" | "flexible" | "open";
  onChange: (languages: string[], openness: "strict" | "flexible" | "open") => void;
  onNext: () => void;
}

export default function LanguageStep({ languages, openness, onChange, onNext }: Props) {
  const t = useTranslation();

  const displayLanguage = (lang: string): string => {
    switch (lang) {
      case "Russian": return t.onboarding.language.russian;
      case "English": return t.onboarding.language.english;
      case "Korean": return t.onboarding.language.korean;
      case "Spanish": return t.onboarding.language.spanish;
      case "Arabic": return t.onboarding.language.arabic;
      case "French": return t.onboarding.language.french;
      case "Turkish": return t.onboarding.language.turkish;
      case "Uzbek": return t.onboarding.language.uzbek;
      case "Hindi": return t.onboarding.language.hindi;
      case "Japanese": return t.onboarding.language.japanese;
      case "Kazakh": return t.onboarding.language.kazakh;
      default: return lang;
    }
  };

  const displayOpenness = (value: "strict" | "flexible" | "open"): string => {
    switch (value) {
      case "strict": return t.onboarding.language.onlySelected;
      case "flexible": return t.onboarding.language.mostlyMine;
      case "open": return t.onboarding.language.openToAnything;
    }
  };

  const toggleLanguage = (lang: string) => {
    const next = languages.includes(lang)
      ? languages.filter((l) => l !== lang)
      : [...languages, lang];
    onChange(next, openness);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-bold text-2xl mb-1">
          {t.onboarding.language.heading}
        </h2>
        <p className="text-white/40 text-sm">{t.onboarding.language.subtitle}</p>
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
            {displayLanguage(lang)}
          </button>
        ))}
      </div>

      <div>
        <p className="text-white/60 text-sm font-semibold mb-3">{t.onboarding.language.openness}</p>
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
              {displayOpenness(opt.value)}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={languages.length === 0}
        className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
      >
        {t.common.next}
      </button>
    </div>
  );
}
