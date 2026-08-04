"use client";
import { useState } from "react";
import { useTranslation } from "../../lib/translations/useTranslation";
import PlaylistImport from "../PlaylistImport";

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export default function StorySongsStep({ onNext, onSkip }: Props) {
  const t = useTranslation();
  const [playlistImported, setPlaylistImported] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-bold text-2xl mb-1">
          {t.onboarding.storySongs.heading}
        </h2>
        <p className="text-white/40 text-sm">
          {t.onboarding.storySongs.subtitle}
        </p>
      </div>

      <PlaylistImport compact onImported={() => setPlaylistImported(true)} />

      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={playlistImported ? onNext : onSkip}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-60"
        >
          {playlistImported
            ? t.onboarding.storySongs.continueLabel
            : t.onboarding.storySongs.continueWithoutSongs}
        </button>
        <p className="text-center text-white/30 text-xs">
          {t.onboarding.storySongs.optionalNote}
        </p>
      </div>
    </div>
  );
}
