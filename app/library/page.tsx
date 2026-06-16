"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import { useAppStore, Track } from "../../store/useAppStore";

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

export default function LibraryPage() {
  const { data: session } = useSession();
  const { savedSongs, loadSavedSongs } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  useEffect(() => {
    loadSavedSongs();
  }, [loadSavedSongs]);

  const displayed = filterSongs(savedSongs, activeFilter);

  return (
    <AppShell
      bottomPad="large"
      decor
      header={<AppHeader showCredits={false} center="Library" />}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white">
            Saved Songs
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            From your VibeSong matches
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
              {f}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              music_off
            </span>
            <p className="text-on-surface-variant">No saved songs yet.</p>
            <p className="text-on-surface-variant/60 text-sm">
              Upload a photo to get started.
            </p>
            <a
              href="/app"
              className="mt-2 inline-flex items-center gap-2 bg-hot-pink text-white px-6 py-3 rounded-full text-sm font-display font-semibold glow-pink"
            >
              Upload a photo →
            </a>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {displayed.map((song, i) => (
              <motion.a
                key={`${song.previewUrl || song.youtubeId || song.title}-${i}`}
                href={song.appleMusicUrl || song.youtubeUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 hover:border-hot-pink/40 transition-all"
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
            ))}
          </div>
        )}
      </div>

      {savedSongs.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 lg:static lg:mt-8 lg:px-0">
          <button
            disabled={!session}
            className={`w-full lg:max-w-md py-4 rounded-full font-display font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              session
                ? "bg-spotify-green text-black hover:opacity-90 active:scale-95"
                : "bg-spotify-green/30 text-spotify-green/60 cursor-not-allowed"
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              music_note
            </span>
            {session
              ? "Export playlist to Spotify"
              : "Connect Spotify to export"}
          </button>
        </div>
      )}
    </AppShell>
  );
}
