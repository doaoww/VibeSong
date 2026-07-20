"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import ShareSheet from "../../components/ShareSheet";
import { useAppStore, Track } from "../../store/useAppStore";
import { useTranslation } from "../../lib/translations/useTranslation";
import { resolveSongLink } from "../../lib/songLink";
import { FILTERS, filterSongs, getFilterLabel, type Filter } from "../../lib/libraryFilters";
import Icon from "../../components/Icon";

export default function LibraryPage() {
  const { savedSongs, loadFeedback } = useAppStore();
  const t = useTranslation();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [shareTrack, setShareTrack] = useState<Track | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  // Pause playback when leaving the page instead of letting it run under
  // whatever's rendered next.
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const displayed = filterSongs(savedSongs, activeFilter);

  const handleRowActivate = (song: Track, key: string) => {
    if (song.previewUrl) {
      const audio = audioRef.current;
      if (!audio) return;
      if (playingKey === key) {
        audio.pause();
        setPlayingKey(null);
        return;
      }
      audio.src = song.previewUrl;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      setPlayingKey(key);
      return;
    }
    const link = resolveSongLink(song);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <>
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
            <Icon name="music_off" className="text-5xl text-on-surface-variant" />
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
          <>
          <audio
            ref={audioRef}
            onEnded={() => setPlayingKey(null)}
            className="hidden"
          />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {displayed.map((song, i) => {
              const key = `${song.previewUrl || song.youtubeId || song.title}-${i}`;
              const canPlayInline = Boolean(song.previewUrl);
              const isInteractive = canPlayInline || Boolean(resolveSongLink(song));
              const isPlaying = playingKey === key;
              return (
              <motion.div
                key={key}
                role={isInteractive ? "button" : undefined}
                tabIndex={isInteractive ? 0 : undefined}
                onClick={isInteractive ? () => handleRowActivate(song, key) : undefined}
                onKeyDown={
                  isInteractive
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowActivate(song, key);
                        }
                      }
                    : undefined
                }
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 transition-all ${
                  isInteractive ? "hover:border-hot-pink/40 cursor-pointer" : "opacity-70 cursor-default"
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareTrack(song);
                        setShareSheetOpen(true);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label={t.share.rowAria(song.title, song.artist)}
                      className="text-hot-pink/70 hover:text-hot-pink transition-colors"
                    >
                      <Icon name="share" className="text-xl" />
                    </button>
                  )}
                  {song.sourceImage && (
                    <img
                      src={song.sourceImage}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border-2 border-hot-pink/30 hidden sm:block"
                    />
                  )}
                  {canPlayInline && (
                    <Icon
                      name={isPlaying ? "pause_circle" : "play_circle"}
                      className="text-hot-pink text-2xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    />
                  )}
                  {song.matchScore > 0 && (
                    <p className="text-hot-pink text-xs font-display font-bold">
                      {song.matchScore}%
                    </p>
                  )}
                </div>
              </motion.div>
              );
            })}
          </div>
          </>
        )}
      </div>

    </AppShell>
      <ShareSheet
        isOpen={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        track={shareTrack}
        photoUrl={shareTrack?.sourceImage}
      />
    </>
  );
}
