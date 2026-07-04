"use client";
import { useAppStore } from "../store/useAppStore";

export default function LanguageToggle() {
  const { locale, setLocale } = useAppStore();

  return (
    <div className="flex items-center rounded-full bg-white/5 border border-white/10 p-0.5 text-xs font-semibold font-display">
      <button
        onClick={() => setLocale("en")}
        className={`px-2.5 py-1 rounded-full transition-all ${
          locale === "en" ? "bg-hot-pink text-white" : "text-white/50 hover:text-white/80"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("ru")}
        className={`px-2.5 py-1 rounded-full transition-all ${
          locale === "ru" ? "bg-hot-pink text-white" : "text-white/50 hover:text-white/80"
        }`}
      >
        RU
      </button>
    </div>
  );
}
