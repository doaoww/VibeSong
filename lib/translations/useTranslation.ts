"use client";
import { useAppStore } from "../../store/useAppStore";
import { translations } from "./index";

export function useTranslation() {
  const locale = useAppStore((s) => s.locale);
  return translations[locale];
}
