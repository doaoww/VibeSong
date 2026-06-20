"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "../../components/AppShell";
import SwipeCard from "../../components/SwipeCard";
import VibeTags from "../../components/VibeTags";
import { useAppStore, Track } from "../../store/useAppStore";

function VibeHero({
  imageUrl,
  caption,
  tags,
}: {
  imageUrl: string;
  caption?: string;
  tags?: string[];
}) {
  return (
    <section className="space-y-3">
      <p className="text-hot-pink text-xs font-display font-semibold uppercase tracking-widest">
        Your photo
      </p>

      <div className="w-full rounded-xl overflow-hidden bg-surface-container border border-outline-variant/25 flex items-center justify-center">
        <img
          src={imageUrl}
          alt="Your vibe"
          className="w-full h-auto max-h-[calc(100vh-14rem)] object-contain"
        />
      </div>

      {(caption || tags?.length) && (
        <div className="space-y-2 px-0.5">
          {caption && (
            <p className="text-white italic text-base leading-relaxed line-clamp-2">
              {caption}
            </p>
          )}
          {tags && tags.length > 0 && <VibeTags tags={tags} />}
        </div>
      )}
    </section>
  );
}

function MatchControls({
  topIdx,
  onSkip,
  onSave,
}: {
  topIdx: number;
  onSkip: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-10 lg:gap-14">
      <button
        onClick={onSkip}
        disabled={topIdx < 0}
        aria-label="Skip song"
        className="flex flex-col items-center gap-1 disabled:opacity-40"
      >
        <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full border-2 border-error/40 bg-error/10 flex items-center justify-center text-error hover:bg-error/15 transition-colors active:scale-90 shadow-[0_0_20px_-4px_rgba(255,107,107,0.4)]">
          <span className="material-symbols-outlined text-2xl lg:text-3xl">close</span>
        </span>
        <span className="text-error/80 text-[10px] lg:text-[11px] font-semibold">Skip</span>
      </button>
      <button
        onClick={onSave}
        disabled={topIdx < 0}
        aria-label="Save song"
        className="flex flex-col items-center gap-1 disabled:opacity-40"
      >
        <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full border-2 border-hot-pink/40 bg-hot-pink/15 flex items-center justify-center text-hot-pink hover:bg-hot-pink/25 transition-colors active:scale-90 glow-pink">
          <span
            className="material-symbols-outlined text-2xl lg:text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            favorite
          </span>
        </span>
        <span className="text-hot-pink/80 text-[10px] lg:text-[11px] font-semibold">Save</span>
      </button>
    </div>
  );
}

function ProgressDots({
  total,
  topIdx,
  gone,
}: {
  total: number;
  topIdx: number;
  gone: Set<number>;
}) {
  return (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            gone.has(i)
              ? "bg-hot-pink/40 w-1"
              : i === topIdx
              ? "bg-hot-pink w-5"
              : "bg-surface-container-highest w-1"
          }`}
        />
      ))}
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const {
    tracks,
    vibeProfile,
    uploadedImageUrl,
    saveTrack,
    skipTrack,
    nextCard,
  } = useAppStore();

  const [gone, setGone] = useState<Set<number>>(new Set());
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [done, setDone] = useState(false);

  const displayTracks = tracks;

  useEffect(() => {
    if (tracks.length === 0) router.replace("/app");
  }, [tracks, router]);

  const getTopIndex = (goneSet: Set<number>) => {
    for (let i = 0; i < displayTracks.length; i++) {
      if (!goneSet.has(i)) return i;
    }
    return -1;
  };

  const handleSave = (idx: number, track: Track) => {
    saveTrack(track);
    setSavedTracks((p) => [...p, track]);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    if (getTopIndex(newGone) === -1) setDone(true);
  };

  const handleSkip = (idx: number, track: Track) => {
    skipTrack(track);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    if (getTopIndex(newGone) === -1) setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-y-auto">
        <div className="max-w-sm mx-auto w-full px-5 pt-14 pb-10 space-y-7">
          {/* Photo thumbnail */}
          {uploadedImageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <img
                src={uploadedImageUrl}
                alt="Your vibe"
                className="w-full max-h-52 object-cover rounded-2xl"
              />
              {vibeProfile?.vibeCaption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl px-4 py-3">
                  <p className="text-white text-sm font-semibold italic">
                    {vibeProfile.vibeCaption}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center space-y-1"
          >
            {savedTracks.length > 0 ? (
              <>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Your soundtrack</p>
                <h1 className="font-display font-black text-white text-2xl">
                  {savedTracks.length} song{savedTracks.length !== 1 ? "s" : ""} chosen ✦
                </h1>
              </>
            ) : (
              <>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Nothing saved</p>
                <h1 className="font-display font-black text-white text-2xl">Try another photo?</h1>
              </>
            )}
          </motion.div>

          {/* Saved songs list */}
          {savedTracks.length > 0 && (
            <div className="space-y-2">
              {savedTracks.map((track, i) => (
                <motion.div
                  key={track.title + i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="flex items-center gap-3 bg-surface-container rounded-xl p-3 border border-outline-variant/20"
                >
                  {(track.artwork || track.thumbnail) ? (
                    <img
                      src={track.artwork || track.thumbnail}
                      alt={track.title}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-hot-pink/15 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-hot-pink text-xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}>music_note</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{track.title}</p>
                    <p className="text-white/50 text-xs truncate">{track.artist}</p>
                  </div>
                  <span className="material-symbols-outlined text-hot-pink text-lg flex-shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                </motion.div>
              ))}
            </div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + savedTracks.length * 0.06 }}
            className="space-y-3"
          >
            {savedTracks.length > 0 && (
              <button
                onClick={() => router.push("/library")}
                className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink"
              >
                Open Library →
              </button>
            )}
            <button
              onClick={() => router.push("/app")}
              className="w-full border border-white/10 text-white/60 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white/80 active:scale-95 transition-all"
            >
              Match another photo
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  const topIdx = getTopIndex(gone);

  return (
    <AppShell
      header={
        <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-outline-variant/20 lg:left-64">
          <div className="mx-auto max-w-6xl flex justify-between items-center px-4 md:px-6 lg:px-8 py-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-hot-pink">
                arrow_back
              </span>
            </button>
            <h1 className="font-display font-bold text-hot-pink text-sm md:text-base">
              {displayTracks.length - gone.size} of {displayTracks.length} left
            </h1>
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-hot-pink">
                share
              </span>
            </button>
          </div>
        </header>
      }
    >
      <div className="flex flex-col min-h-[calc(100dvh-9rem)] lg:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:gap-10 xl:gap-14 lg:items-start">
        {/* Desktop only: photo in sidebar */}
        {uploadedImageUrl && (
          <aside className="hidden lg:block lg:sticky lg:top-[4.5rem]">
            <VibeHero
              imageUrl={uploadedImageUrl}
              caption={vibeProfile?.vibeCaption}
              tags={vibeProfile?.vibeTags}
            />
          </aside>
        )}

        <div className="flex flex-col flex-1 min-h-0 space-y-3 lg:space-y-5">
          <p className="hidden lg:block text-hot-pink text-xs font-display font-semibold uppercase tracking-widest">
            Now playing match
          </p>

          <p className="lg:hidden text-center text-on-surface-variant/60 text-[11px]">
            Swipe right to save · left to skip
          </p>

          {/* Mobile: tall combined swipe stack; desktop: song card only */}
          <div className="relative flex-1 min-h-[min(560px,calc(100dvh-13.5rem))] lg:h-[540px] lg:flex-none -mx-1 px-1">
            <AnimatePresence>
              {displayTracks.map((track, idx) => {
                if (gone.has(idx)) return null;
                const isTop = idx === topIdx;
                const stackIndex = idx - (topIdx === -1 ? 0 : topIdx);
                return (
                  <SwipeCard
                    key={`${track.previewUrl || track.youtubeId || track.title}-${idx}`}
                    track={track}
                    isTop={isTop}
                    stackIndex={Math.max(0, stackIndex)}
                    onSave={() => handleSave(idx, track)}
                    onSkip={() => handleSkip(idx, track)}
                    vibeImageUrl={uploadedImageUrl ?? undefined}
                    vibeCaption={vibeProfile?.vibeCaption}
                    vibeTags={vibeProfile?.vibeTags}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          <MatchControls
            topIdx={topIdx}
            onSkip={() => topIdx >= 0 && handleSkip(topIdx, displayTracks[topIdx])}
            onSave={() => topIdx >= 0 && handleSave(topIdx, displayTracks[topIdx])}
          />

          <ProgressDots
            total={displayTracks.length}
            topIdx={topIdx}
            gone={gone}
          />
        </div>
      </div>
    </AppShell>
  );
}
