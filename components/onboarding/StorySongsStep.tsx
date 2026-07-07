"use client";
import { useRef, useState } from "react";
import { useTranslation } from "../../lib/translations/useTranslation";

interface PickedSong {
  title: string;
  artist: string;
}

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export default function StorySongsStep({ onNext, onSkip }: Props) {
  const t = useTranslation();
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<PickedSong[]>([]);
  const [showFillHint, setShowFillHint] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const artistInputRef = useRef<HTMLInputElement>(null);

  const addSong = () => {
    const trimmedArtist = artist.trim();
    const trimmedTitle = title.trim();
    if (!trimmedArtist || !trimmedTitle) {
      setShowFillHint(true);
      return;
    }
    if (picked.length >= 3) return;
    if (picked.some((p) => p.title === trimmedTitle && p.artist === trimmedArtist)) return;
    setPicked((prev) => [...prev, { title: trimmedTitle, artist: trimmedArtist }]);
    setArtist("");
    setTitle("");
    setShowFillHint(false);
    artistInputRef.current?.focus();
  };

  const removeSong = (song: PickedSong) =>
    setPicked((prev) => prev.filter((p) => !(p.title === song.title && p.artist === song.artist)));

  const primaryLabel = resolving
    ? t.onboarding.storySongs.finding
    : picked.length > 0
      ? t.onboarding.storySongs.continueWithSelection
      : t.onboarding.storySongs.continueWithoutSongs;

  const handleContinue = async () => {
    if (picked.length === 0) { onSkip(); return; }
    setResolving(true);
    setError(null);
    try {
      const res = await fetch("/api/taste/story-songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: picked }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      onNext();
    } catch {
      setError(t.onboarding.storySongs.saveFailed);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">
          {t.onboarding.storySongs.heading}
        </h2>
        <p className="text-white/40 text-sm">
          {t.onboarding.storySongs.subtitle}
        </p>
      </div>

      <div className="space-y-3">
        {picked.length > 0 && (
          <div className="flex items-center justify-end">
            <span className="text-white/35 text-xs font-semibold">
              {t.onboarding.storySongs.pickedCount(picked.length)}
            </span>
          </div>
        )}

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {picked.map((s) => (
              <button
                key={`${s.title}-${s.artist}`}
                type="button"
                onClick={() => removeSong(s)}
                aria-label={t.onboarding.storySongs.removeSong(s.title, s.artist)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-hot-pink text-white active:scale-95 transition-transform"
              >
                {s.title} — {s.artist}
                <span className="text-white/70" aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        {picked.length < 3 && (
          <div className="space-y-2">
            <input
              ref={artistInputRef}
              type="text"
              value={artist}
              onChange={(e) => { setArtist(e.target.value); setShowFillHint(false); }}
              aria-label={t.onboarding.storySongs.artistPlaceholder}
              placeholder={t.onboarding.storySongs.artistPlaceholder}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
            />
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setShowFillHint(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSong();
                }
              }}
              aria-label={t.onboarding.storySongs.titlePlaceholder}
              placeholder={t.onboarding.storySongs.titlePlaceholder}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
            />
            <button
              type="button"
              onClick={addSong}
              className="w-full py-3.5 rounded-xl border border-hot-pink/30 text-hot-pink font-semibold text-sm active:scale-95 transition-transform"
            >
              {t.onboarding.storySongs.addLabel}
            </button>
            {showFillHint && (
              <p role="alert" className="text-white/45 text-xs">{t.onboarding.storySongs.fillBothFields}</p>
            )}
          </div>
        )}

        {picked.length >= 3 && (
          <p className="text-white/35 text-xs leading-relaxed">
            {t.onboarding.storySongs.maxReached}
          </p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleContinue}
          disabled={resolving}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-60"
        >
          {primaryLabel}
        </button>
        <p className="text-center text-white/30 text-xs">
          {t.onboarding.storySongs.optionalNote}
        </p>
      </div>
    </div>
  );
}
