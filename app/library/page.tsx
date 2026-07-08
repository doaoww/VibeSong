"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import { useAppStore, Track } from "../../store/useAppStore";
import { useTranslation } from "../../lib/translations/useTranslation";
import { en } from "../../lib/translations/en";
import { resolveSongLink } from "../../lib/songLink";

const FILTERS = ["All", "This Week", "Moody", "Hype"] as const;
type Filter = (typeof FILTERS)[number];

function filterSongs(songs: Track[], filter: Filter): Track[] {
  if (filter === "All") return songs;
  if (filter === "This Week") {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return songs.filter((s) => (s.savedAt || 0) > weekAgo);
  }
  return songs;
}

function getFilterLabel(filter: Filter, t: typeof en): string {
  switch (filter) {
    case "All": return t.library.filterAll;
    case "This Week": return t.library.filterThisWeek;
    case "Moody": return t.library.filterMoody;
    case "Hype": return t.library.filterHype;
    default: return filter;
  }
}

export default function LibraryPage() {
  const { savedSongs, loadFeedback } = useAppStore();
  const t = useTranslation();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const displayed = filterSongs(savedSongs, activeFilter);

  return (
    <AppShell
      bottomPad="large"
      decor
      header={<AppHeader showCredits={false} center={t.library.heading} />}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">
            {t.library.savedSongsHeading}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {t.library.subtitle}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto scroll-hide">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-semibold font-display whitespace-nowrap transition-all ${
                activeFilter === f
                  ? "bg-hot-pink text-white glow-pink"
                  : "border border-outline-variant/30 text-on-surface-variant hover:text-white hover:border-white/30"
              }`}
            >
              {getFilterLabel(f, t)}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              music_off
            </span>
            <p className="text-on-surface-variant">{t.library.emptyTitle}</p>
            <p className="text-on-surface-variant/60 text-sm">
              {t.library.emptyBody}
            </p>
            <a
              href="/app"
              className="mt-2 inline-flex items-center gap-2 bg-hot-pink text-white px-6 py-3 rounded-full text-sm font-display font-semibold glow-pink"
            >
              {t.common.uploadPhotoArrow}
            </a>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {displayed.map((song, i) => {
              const link = resolveSongLink(song);
              return (
              <motion.a
                key={`${song.previewUrl || song.youtubeId || song.title}-${i}`}
                href={link ?? undefined}
                target={link ? "_blank" : undefined}
                rel={link ? "noopener noreferrer" : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 transition-all ${
                  link ? "hover:border-hot-pink/40 cursor-pointer" : "opacity-70 cursor-default"
                }`}
              >
                {song.artwork || song.thumbnail ? (
                  <img
                    src={song.artwork || song.thumbnail}
                    alt={song.title}
                    className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg bg-surface-container-highest flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">
                    {song.title}
                  </p>
                  <p className="text-on-surface-variant text-xs truncate">
                    {song.artist}
                  </p>
                </div>
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  {song.sourceImage && (
                    <img
                      src={song.sourceImage}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border-2 border-hot-pink/30 hidden sm:block"
                    />
                  )}
                  <p className="text-hot-pink text-xs font-display font-bold">
                    {song.matchScore}%
                  </p>
                </div>
              </motion.a>
              );
            })}
          </div>
        )}
      </div>

    </AppShell>
  );
}
