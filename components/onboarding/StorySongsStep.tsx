"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "../../lib/translations/useTranslation";

interface SongSuggestion {
  id: string;
  title: string;
  artist: string;
}

interface PickedSong {
  title: string;
  artist: string;
}

interface Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export default function StorySongsStep({ onNext, onBack, onSkip }: Props) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SongSuggestion[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [picked, setPicked] = useState<PickedSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setSuggestions([]);
        setSearchedQuery("");
        setSearching(false);
        return;
      }
      setSearching(true);
      fetch(`/api/song-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { songs: [] }))
        .then((d) => {
          if (!active) return;
          setSuggestions(d.songs ?? []);
          setSearchedQuery(q);
        })
        .catch(() => {
          if (!active) return;
          setSuggestions([]);
          setSearchedQuery(q);
        })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const addSong = (song: PickedSong) => {
    if (picked.length >= 3) return;
    if (picked.some((p) => p.title === song.title && p.artist === song.artist)) return;
    setPicked((prev) => [...prev, song]);
    setQuery("");
    setSuggestions([]);
    setSearchedQuery("");
  };

  const removeSong = (song: PickedSong) =>
    setPicked((prev) => prev.filter((p) => !(p.title === song.title && p.artist === song.artist)));

  const trimmedQuery = query.trim();
  const helperText = picked.length >= 3
    ? t.onboarding.storySongs.maxReached
    : trimmedQuery.length > 0 && trimmedQuery.length < 2
      ? t.onboarding.storySongs.keepTyping
      : t.onboarding.storySongs.searchHint;
  const primaryLabel = resolving
    ? t.onboarding.storySongs.finding
    : picked.length > 0
      ? t.onboarding.storySongs.continueWithSelection
      : t.onboarding.storySongs.continueWithoutSongs;
  const hasFreshSearch = searchedQuery === trimmedQuery;
  const showSearching = searching && trimmedQuery.length >= 2;
  const showSuggestions = !searching && hasFreshSearch && suggestions.length > 0;
  const showNoMatches = !searching && hasFreshSearch && trimmedQuery.length >= 2 && suggestions.length === 0;

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
        <div className="flex items-center justify-between gap-3">
          <p className="text-white/60 text-sm font-semibold">
            {t.onboarding.storySongs.searchLabel}
          </p>
          <span className="text-white/35 text-xs font-semibold">
            {t.onboarding.storySongs.pickedCount(picked.length)}
          </span>
        </div>

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
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-white/30">
              search
            </span>
            <input
              id="story-song-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) {
                  e.preventDefault();
                  addSong({ title: suggestions[0].title, artist: suggestions[0].artist });
                }
              }}
              aria-label={t.onboarding.storySongs.searchLabel}
              aria-describedby="story-song-search-help"
              placeholder={t.onboarding.storySongs.searchPlaceholder}
              className="w-full bg-white/5 border border-white/15 rounded-xl pl-11 pr-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
            />
            {showSearching && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#151515] border border-white/15 rounded-xl px-4 py-3 text-sm text-white/45 shadow-lg z-10">
                {t.onboarding.storySongs.searching}
              </div>
            )}
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#151515] border border-white/15 rounded-xl overflow-hidden shadow-lg z-10">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addSong({ title: s.title, artist: s.artist })}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-white hover:bg-hot-pink/10 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s.title}</span>
                      <span className="block truncate text-white/45">{s.artist}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-hot-pink/30 px-2 py-1 text-xs font-semibold text-hot-pink">
                      {t.onboarding.storySongs.addLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showNoMatches && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#151515] border border-white/15 rounded-xl px-4 py-3 text-sm text-white/45 shadow-lg z-10">
                {t.onboarding.storySongs.noMatches}
              </div>
            )}
          </div>
        )}

        <p id="story-song-search-help" className="text-white/35 text-xs leading-relaxed">
          {helperText}
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-2 pt-1">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={resolving}
            className="px-6 py-3.5 rounded-xl border border-white/15 text-white/60 font-semibold text-sm disabled:opacity-40"
          >
            {t.common.back}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={resolving}
            className="flex-1 py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-60"
          >
            {primaryLabel}
          </button>
        </div>
        <p className="text-center text-white/30 text-xs">
          {t.onboarding.storySongs.optionalNote}
        </p>
      </div>
    </div>
  );
}
