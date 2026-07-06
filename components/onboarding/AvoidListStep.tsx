"use client";
import { useTranslation } from "../../lib/translations/useTranslation";

type AvoidTarget =
  | { type: "genre"; key: string }
  | { type: "storyTag"; tag: string }
  | { type: "discovery"; value: "niche" | "popular-ok" };

export const AVOID_OPTIONS: Array<{ label: string; target: AvoidTarget }> = [
  { label: "EDM", target: { type: "genre", key: "electronic" } },
  { label: "Rap", target: { type: "genre", key: "hip-hop" } },
  { label: "Mainstream pop", target: { type: "genre", key: "pop" } },
  { label: "Sad acoustic", target: { type: "storyTag", tag: "expensive sadness" } },
  { label: "Too dramatic", target: { type: "storyTag", tag: "cinematic soft flex" } },
  { label: "Too niche", target: { type: "discovery", value: "popular-ok" } },
  { label: "Too mainstream", target: { type: "discovery", value: "niche" } },
];

interface Props {
  selected: string[];
  onChange: (
    selectedLabels: string[],
    genreScores: Record<string, number>,
    avoidedStoryTags: string[],
    discoveryStyle: "niche" | "popular-ok" | null
  ) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function AvoidListStep({ selected, onChange, onNext, onBack }: Props) {
  const t = useTranslation();

  // AVOID_OPTIONS' `label` field is the stored/matched value (compared via
  // `selected.includes`, looked up via `AVOID_OPTIONS.find`, and passed up
  // through `onChange`) — it must stay the original English string regardless
  // of UI language. Only the rendered button text is translated, via this
  // lookup.
  const displayLabel = (label: string): string => {
    switch (label) {
      case "EDM": return t.onboarding.avoidList.tagEdm;
      case "Rap": return t.onboarding.avoidList.tagRap;
      case "Mainstream pop": return t.onboarding.avoidList.tagMainstreamPop;
      case "Sad acoustic": return t.onboarding.avoidList.tagSadAcoustic;
      case "Too dramatic": return t.onboarding.avoidList.tagTooDramatic;
      case "Too niche": return t.onboarding.avoidList.tagTooNiche;
      case "Too mainstream": return t.onboarding.avoidList.tagTooMainstream;
      default: return label;
    }
  };

  const toggle = (label: string) => {
    const nextLabels = selected.includes(label)
      ? selected.filter((l) => l !== label)
      : [...selected, label];

    const genreScores: Record<string, number> = {};
    const avoidedStoryTags: string[] = [];
    let discoveryStyle: "niche" | "popular-ok" | null = null;

    for (const l of nextLabels) {
      const opt = AVOID_OPTIONS.find((o) => o.label === l);
      if (!opt) continue;
      if (opt.target.type === "genre") genreScores[opt.target.key] = -1;
      if (opt.target.type === "storyTag") avoidedStoryTags.push(opt.target.tag);
      if (opt.target.type === "discovery") discoveryStyle = opt.target.value;
    }

    onChange(nextLabels, genreScores, avoidedStoryTags, discoveryStyle);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">{t.onboarding.avoidList.heading}</h2>
        <p className="text-white/40 text-sm">{t.onboarding.avoidList.subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {AVOID_OPTIONS.map(({ label }) => (
          <button
            key={label}
            onClick={() => toggle(label)}
            className={`px-3 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
              selected.includes(label)
                ? "bg-white/15 border-white/40 text-white"
                : "border-white/15 text-white/50 hover:border-white/30"
            }`}
          >
            {displayLabel(label)}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3.5 rounded-xl border border-white/15 text-white/60 font-semibold text-sm">
          {t.common.back}
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all"
        >
          {t.common.next}
        </button>
      </div>
    </div>
  );
}
