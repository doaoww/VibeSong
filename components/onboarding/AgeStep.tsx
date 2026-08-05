"use client";
import { useTranslation } from "../../lib/translations/useTranslation";
import type { Generation } from "../../lib/tagTaxonomy";

// Age ranges map to a generation cohort (current-year-relative, see
// lib/tagTaxonomy.ts's Generation type) — the range itself isn't stored,
// only the derived cohort, so we ask for as little as we need. Kept as
// age ranges (not generation-labeled buttons) because that's a plainer,
// less loaded question for a user to answer than "which generation are you."
const AGE_OPTIONS: Array<{ value: Generation; rangeKey: "under18" | "18to24" | "25to34" | "35to44" | "45to54" | "55plus" }> = [
  { value: "gen-z", rangeKey: "under18" },
  { value: "gen-z", rangeKey: "18to24" },
  { value: "millennial", rangeKey: "25to34" },
  { value: "millennial", rangeKey: "35to44" },
  { value: "gen-x", rangeKey: "45to54" },
  { value: "boomer", rangeKey: "55plus" },
];

interface Props {
  generation: Generation;
  onChange: (generation: Generation) => void;
  onNext: () => void;
  onSkip: () => void;
}

export default function AgeStep({ generation, onChange, onNext, onSkip }: Props) {
  const t = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-bold text-2xl mb-1">{t.onboarding.age.heading}</h2>
        <p className="text-white/40 text-sm">{t.onboarding.age.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {AGE_OPTIONS.map((opt) => (
          <button
            key={opt.rangeKey}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              generation === opt.value
                ? "bg-hot-pink border-hot-pink text-white"
                : "border-white/15 text-white/50 hover:border-white/30"
            }`}
          >
            {t.onboarding.age.ranges[opt.rangeKey]}
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={onNext}
          disabled={generation === "unclear"}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t.common.next}
        </button>
        <button type="button" onClick={onSkip} className="w-full text-center text-white/40 text-sm py-1">
          {t.onboarding.age.skip}
        </button>
      </div>
    </div>
  );
}
