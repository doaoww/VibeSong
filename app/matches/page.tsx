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

export default function MatchesPage() {
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

  const withPhoto = savedSongs.filter((s) => Boolean(s.sourceImage));
  const displayed = filterSongs(withPhoto, activeFilter);

  const handleCardActivate = (song: Track, key: string) => {
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
      header={
        <AppHeader
          showCredits={false}
          center={t.matches.heading}
          left={
            <button
              onClick={() => history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors lg:hidden"
            >
              <Icon name="arrow_back" className="text-on-surface-variant" />
            </button>
          }
        />
      }
    >
      <div className="space-y-6">
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
            <p className="text-on-surface-variant">{t.matches.emptyTitle}</p>
            <p className="text-on-surface-variant/60 text-sm">
              {t.matches.emptyBody}
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {displayed.map((song, i) => {
              const key = `${song.previewUrl || song.youtubeId || song.title}-${i}`;
              const isPlaying = playingKey === key;
              return (
                <motion.div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardActivate(song, key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardActivate(song, key);
                    }
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/20 hover:border-hot-pink/40 cursor-pointer"
                >
                  <img
                    src={song.sourceImage}
                    alt={song.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareTrack(song);
                      setShareSheetOpen(true);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={t.share.rowAria(song.title, song.artist)}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                  >
                    <Icon name="share" className="text-lg" />
                  </button>

                  {isPlaying && (
                    <Icon
                      name="pause_circle"
                      className="absolute top-2 left-2 text-white text-2xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    />
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-2.5 space-y-0.5">
                    <p className="text-white font-display font-bold text-xs truncate">
                      {song.title}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white/70 text-[11px] truncate">
                        {song.artist}
                      </p>
                      {song.matchScore > 0 && (
                        <span className="text-hot-pink text-[11px] font-display font-bold flex-shrink-0">
                          {song.matchScore}%
                        </span>
                      )}
                    </div>
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
