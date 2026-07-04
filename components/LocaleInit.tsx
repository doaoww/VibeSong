"use client";
import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

export default function LocaleInit() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  // One-time detection: stored preference wins, then browser language, else
  // the static "en" default already rendered on the server.
  useEffect(() => {
    const stored = localStorage.getItem("vibesong_locale");
    if (stored === "en" || stored === "ru") {
      setLocale(stored);
    } else if (navigator.language.toLowerCase().startsWith("ru")) {
      setLocale("ru");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep <html lang> in sync with manual toggles too.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
