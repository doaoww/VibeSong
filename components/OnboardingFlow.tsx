"use client";
import { useState } from "react";
import LanguageStep from "./onboarding/LanguageStep";
import ArtistStep from "./onboarding/ArtistStep";
import AvoidListStep from "./onboarding/AvoidListStep";
import StorySongsStep from "./onboarding/StorySongsStep";
import SongSwipeOnboarding from "./SongSwipeOnboarding";
import { useTranslation } from "../lib/translations/useTranslation";

type Step = "language" | "artists" | "avoid" | "story-songs" | "swipe" | "done";

interface Props {
  onComplete: (completed: boolean) => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const t = useTranslation();
  const [step, setStep] = useState<Step>("language");
  const [languages, setLanguages] = useState<string[]>([]);
  const [openness, setOpenness] = useState<"strict" | "flexible" | "open">("flexible");
  const [artists, setArtists] = useState<string[]>([]);
  const [avoidLabels, setAvoidLabels] = useState<string[]>([]);
  const [avoidGenreScores, setAvoidGenreScores] = useState<Record<string, number>>({});
  const [avoidedStoryTags, setAvoidedStoryTags] = useState<string[]>([]);
  const [avoidDiscoveryStyle, setAvoidDiscoveryStyle] = useState<
    "niche" | "popular-ok" | null
  >(null);

  // /api/taste and /api/taste/story-songs both do a full-row upsert (not a
  // merge) — Task 6's story-songs call may have already written genreScores/
  // favoriteStorySongs before this runs. Fetch current state first so this
  // write layers avoid-list scores on top instead of clobbering them.
  const persistTaste = async (setupComplete: boolean) => {
    const current = await fetch("/api/taste")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    await fetch("/api/taste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languages,
        languageOpenness: openness,
        favoriteArtists: artists,
        genreScores: { ...(current?.genreScores ?? {}), ...avoidGenreScores },
        avoidedStoryTags,
        favoriteStorySongs: current?.favoriteStorySongs ?? [],
        discoveryStyle: avoidDiscoveryStyle ?? "balanced",
        setupComplete,
      }),
    }).catch(() => {});
  };

  const handleQuickStart = async () => {
    await persistTaste(true);
    onComplete(true);
  };

  const finishToSwipe = async () => {
    await persistTaste(false);
    setStep("swipe");
  };

  if (step === "language") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">{t.onboarding.setupStep(1)}</p>
        <LanguageStep
          languages={languages}
          openness={openness}
          onChange={(l, o) => { setLanguages(l); setOpenness(o); }}
          onNext={() => setStep("artists")}
        />
      </div>
    );
  }

  if (step === "artists") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">{t.onboarding.setupStep(2)}</p>
        <ArtistStep
          selectedArtists={artists}
          onChange={setArtists}
          onQuickStart={handleQuickStart}
          onContinue={() => setStep("avoid")}
        />
      </div>
    );
  }

  if (step === "avoid") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">{t.onboarding.setupStep(3)}</p>
        <AvoidListStep
          selected={avoidLabels}
          onChange={(labels, genreScores, storyTags, discoveryStyle) => {
            setAvoidLabels(labels);
            setAvoidGenreScores(genreScores);
            setAvoidedStoryTags(storyTags);
            setAvoidDiscoveryStyle(discoveryStyle);
          }}
          onNext={() => setStep("story-songs")}
          onBack={() => setStep("artists")}
        />
      </div>
    );
  }

  if (step === "story-songs") {
    return (
      <div className="fixed inset-x-0 top-0 z-[100] bg-[#080808] flex flex-col px-5 pt-14 pb-8 overflow-y-auto" style={{ height: "100dvh" }}>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase mb-4">{t.onboarding.setupStep(4)}</p>
        <StorySongsStep
          onNext={finishToSwipe}
          onBack={() => setStep("avoid")}
          onSkip={finishToSwipe}
        />
      </div>
    );
  }

  // step === "swipe"
  return (
    <SongSwipeOnboarding
      languages={languages}
      likedArtists={artists}
      onComplete={(completed) => onComplete(completed)}
    />
  );
}
