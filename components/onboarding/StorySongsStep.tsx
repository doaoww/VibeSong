"use client";
import { useEffect, useState } from "react";

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
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SongSuggestion[]>([]);
  const [picked, setPicked] = useState<PickedSong[]>([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) { setSuggestions([]); return; }
      fetch(`/api/song-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { songs: [] }))
        .then((d) => setSuggestions(d.songs ?? []))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addSong = (song: PickedSong) => {
    if (picked.length >= 3) return;
    if (picked.some((p) => p.title === song.title && p.artist === song.artist)) return;
    setPicked((prev) => [...prev, song]);
    setQuery("");
    setSuggestions([]);
  };

  const removeSong = (song: PickedSong) =>
    setPicked((prev) => prev.filter((p) => !(p.title === song.title && p.artist === song.artist)));

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
      setError("Couldn't save those songs — you can still continue.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-extrabold text-2xl mb-1">
          Which songs have you recently posted?
        </h2>
        <p className="text-white/40 text-sm">
          Add up to 3 songs you&apos;ve recently used in your Instagram or TikTok stories.
        </p>
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((s) => (
            <button
              key={`${s.title}-${s.artist}`}
              onClick={() => removeSong(s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-hot-pink text-white active:scale-95 transition-transform"
            >
              {s.title} — {s.artist}
              <span className="text-white/70">×</span>
            </button>
          ))}
        </div>
      )}

      {picked.length < 3 && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a song..."
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#151515] border border-white/15 rounded-xl overflow-hidden shadow-lg z-10">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => addSong({ title: s.title, artist: s.artist })}
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-hot-pink/10 transition-colors"
                >
                  {s.title} — {s.artist}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={resolving} className="px-6 py-3.5 rounded-xl border border-white/15 text-white/60 font-semibold text-sm disabled:opacity-40">
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={resolving}
          className="flex-1 py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-60"
        >
          {resolving ? "Finding these songs…" : picked.length > 0 ? "Continue" : "Skip"}
        </button>
      </div>
    </div>
  );
}
