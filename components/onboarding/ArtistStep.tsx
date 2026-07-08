"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "../../lib/translations/useTranslation";

interface Props {
  selectedArtists: string[];
  onChange: (artists: string[]) => void;
  onQuickStart: () => void;
  onContinue: () => void;
}

export default function ArtistStep({ selectedArtists, onChange, onQuickStart, onContinue }: Props) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) { setSuggestions([]); return; }
      fetch(`/api/artist-search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { artists: [] }))
        .then((d) => setSuggestions(d.artists ?? []))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const addArtist = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || selectedArtists.includes(trimmed)) return;
    onChange([...selectedArtists, trimmed]);
    setQuery("");
    setSuggestions([]);
  };

  const removeArtist = (name: string) => onChange(selectedArtists.filter((a) => a !== name));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-display font-bold text-2xl mb-1">{t.onboarding.artist.heading}</h2>
        <p className="text-white/40 text-sm">{t.onboarding.artist.subtitle}</p>
      </div>

      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedArtists.map((a) => (
            <button
              key={a}
              onClick={() => removeArtist(a)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-hot-pink text-white active:scale-95 transition-transform"
            >
              {a}
              <span className="text-white/70">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArtist(query); } }}
          placeholder={t.onboarding.artist.placeholderExample}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base"
          autoFocus
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#151515] border border-white/15 rounded-xl overflow-hidden shadow-lg z-10">
            {suggestions.map((a) => (
              <button
                key={a}
                onClick={() => addArtist(a)}
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-hot-pink/10 transition-colors"
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-white/30 text-xs">{t.onboarding.artist.helpText}</p>

      <div className="space-y-3 pt-2">
        <button
          onClick={onContinue}
          disabled={selectedArtists.length === 0}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {t.onboarding.artist.continueImprove}
        </button>
        <button
          onClick={onQuickStart}
          className="w-full py-3.5 rounded-xl border border-white/15 text-white/70 font-display font-bold text-base active:scale-95 transition-all"
        >
          {t.onboarding.artist.skipToUpload}
        </button>
      </div>
    </div>
  );
}
