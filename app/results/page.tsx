"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "../../components/AppShell";
import SwipeCard from "../../components/SwipeCard";
import VibeTags from "../../components/VibeTags";
import ShareSheet from "../../components/ShareSheet";
import Icon from "../../components/Icon";
import { useAppStore, Track } from "../../store/useAppStore";
import { useTranslation } from "../../lib/translations/useTranslation";
import { computeSessionTasteVector, scoreRemainingTracks } from "../../lib/sessionTaste";

function VibeHero({
  imageUrl,
  caption,
  tags,
  vibeIntent,
  t,
}: {
  imageUrl: string;
  caption?: string;
  tags?: string[];
  vibeIntent?: string | null;
  t: ReturnType<typeof useTranslation>;
}) {
  return (
    <section className="space-y-3">
      <p className="text-hot-pink text-xs font-display font-semibold uppercase tracking-widest">
        {t.results.yourPhoto}
      </p>

      <div className="w-full rounded-xl overflow-hidden bg-surface-container border border-outline-variant/25 flex items-center justify-center">
        <img
          src={imageUrl}
          alt={t.results.yourVibeAlt}
          className="w-full h-auto max-h-[calc(100vh-14rem)] object-contain"
        />
      </div>

      {(caption || tags?.length || vibeIntent) && (
        <div className="space-y-2 px-0.5">
          {caption && (
            <p className="text-white italic text-base leading-relaxed line-clamp-2">
              {caption}
            </p>
          )}
          {vibeIntent && (
            <p className="text-on-surface-variant text-sm">
              {t.results.youToldUs(vibeIntent)}
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
  t,
}: {
  topIdx: number;
  onSkip: () => void;
  onSave: () => void;
  t: ReturnType<typeof useTranslation>;
}) {
  return (
    <div className="flex items-center justify-center gap-10 lg:gap-14">
      <button
        onClick={onSkip}
        disabled={topIdx < 0}
        aria-label={t.results.skipAria}
        className="flex flex-col items-center gap-1 disabled:opacity-40"
      >
        <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full border-2 border-error/40 bg-error/10 flex items-center justify-center text-error hover:bg-error/15 transition-colors active:scale-90 shadow-[0_0_20px_-4px_rgba(255,107,107,0.4)]">
          <Icon name="close" className="text-2xl lg:text-3xl" />
        </span>
        <span className="text-error/80 text-[10px] lg:text-[11px] font-semibold">{t.common.skip}</span>
      </button>
      <button
        onClick={onSave}
        disabled={topIdx < 0}
        aria-label={t.results.saveAria}
        className="flex flex-col items-center gap-1 disabled:opacity-40"
      >
        <span className="w-12 h-12 lg:w-14 lg:h-14 rounded-full border-2 border-hot-pink/40 bg-hot-pink/15 flex items-center justify-center text-hot-pink hover:bg-hot-pink/25 transition-colors active:scale-90 glow-pink">
          <Icon
            name="favorite"
            className="text-2xl lg:text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          />
        </span>
        <span className="text-hot-pink/80 text-[10px] lg:text-[11px] font-semibold">{t.results.saveLabel}</span>
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
  const t = useTranslation();
  const router = useRouter();
  const {
    tracks,
    vibeProfile,
    vibeIntent,
    uploadedImageUrl,
    saveTrack,
    skipTrack,
    nextCard,
  } = useAppStore();

  const [gone, setGone] = useState<Set<number>>(new Set());
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [skippedThisSession, setSkippedThisSession] = useState<Track[]>([]);
  const [remainingOrder, setRemainingOrder] = useState<number[] | null>(null);
  const [liveScores, setLiveScores] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const [shareTrack, setShareTrack] = useState<Track | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  const displayTracks = tracks;

  type IndexedTrack = Track & { __idx: number };

  const recomputeOrder = (newGone: Set<number>, saved: Track[], skipped: Track[]) => {
    const sessionVector = computeSessionTasteVector(saved, skipped);
    if (!sessionVector) {
      setRemainingOrder(null);
      setLiveScores({});
      return;
    }
    const indexed: IndexedTrack[] = displayTracks
      .map((track, i) => ({ ...track, __idx: i }))
      .filter((track) => !newGone.has(track.__idx));
    const scored = scoreRemainingTracks(indexed, sessionVector);
    setRemainingOrder(scored.map((track) => track.__idx));
    const scoresByIdx: Record<number, number> = {};
    for (const track of scored) scoresByIdx[track.__idx] = track.liveScore;
    setLiveScores(scoresByIdx);
  };

  useEffect(() => {
    if (tracks.length === 0) router.replace("/app");
  }, [tracks, router]);

  const getTopIndex = (goneSet: Set<number>) => {
    for (let i = 0; i < displayTracks.length; i++) {
      if (!goneSet.has(i)) return i;
    }
    return -1;
  };

  // Persists this session's revealed taste into the user's long-term taste
  // vector (blended server-side, not overwritten) so future sessions start
  // pre-tuned to it — fire-and-forget, same pattern as saveTrack/skipTrack's
  // own /api/feedback calls.
  const persistSessionTaste = (saved: Track[], skipped: Track[]) => {
    fetch("/api/taste/session-vector", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved: saved.map((t) => ({ emotionalVector: t.emotionalVector })),
        skipped: skipped.map((t) => ({ emotionalVector: t.emotionalVector })),
      }),
    }).catch(() => {});
  };

  const handleSave = (idx: number, track: Track) => {
    saveTrack(track);
    const newSaved = [...savedTracks, track];
    setSavedTracks(newSaved);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    recomputeOrder(newGone, newSaved, skippedThisSession);
    if (getTopIndex(newGone) === -1) {
      setDone(true);
      persistSessionTaste(newSaved, skippedThisSession);
    }
  };

  const handleSkip = (idx: number, track: Track) => {
    skipTrack(track);
    const newSkipped = [...skippedThisSession, track];
    setSkippedThisSession(newSkipped);
    const newGone = new Set(gone).add(idx);
    setGone(newGone);
    nextCard();
    recomputeOrder(newGone, savedTracks, newSkipped);
    if (getTopIndex(newGone) === -1) {
      setDone(true);
      persistSessionTaste(savedTracks, newSkipped);
    }
  };

  const handleFinishEarly = () => {
    setDone(true);
    persistSessionTaste(savedTracks, skippedThisSession);
  };

  const shareSheet = (
    <ShareSheet
      isOpen={shareSheetOpen}
      onClose={() => setShareSheetOpen(false)}
      track={shareTrack}
      photoUrl={uploadedImageUrl}
    />
  );

  if (done) {
    return (
      <>
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
                alt={t.results.yourVibeAlt}
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
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">{t.results.yourSoundtrack}</p>
                <h1 className="font-display font-black text-white text-2xl">
                  {t.results.songsChosen(savedTracks.length)}
                </h1>
              </>
            ) : (
              <>
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">{t.results.nothingSaved}</p>
                <h1 className="font-display font-black text-white text-2xl">{t.results.tryAnotherPhoto}</h1>
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
                      <Icon
                        name="music_note"
                        className="text-hot-pink text-xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{track.title}</p>
                    <p className="text-white/50 text-xs truncate">{track.artist}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setShareTrack(track);
                        setShareSheetOpen(true);
                      }}
                      aria-label={t.share.rowAria(track.title, track.artist)}
                      className="text-hot-pink/70 hover:text-hot-pink transition-colors"
                    >
                      <Icon name="share" className="text-xl" />
                    </button>
                    <Icon
                      name="favorite"
                      className="text-hot-pink text-lg"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    />
                  </div>
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
                {t.results.openLibrary}
              </button>
            )}
            <button
              onClick={() => router.push("/app")}
              className="w-full border border-white/10 text-white/60 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white/80 active:scale-95 transition-all"
            >
              {t.results.matchAnotherPhoto}
            </button>
          </motion.div>
        </div>
      </div>
        {shareSheet}
      </>
    );
  }

  const orderedIndices =
    remainingOrder ?? displayTracks.map((_, i) => i).filter((i) => !gone.has(i));
  const topIdx = orderedIndices.length > 0 ? orderedIndices[0] : -1;

  return (
    <>
    <AppShell
      header={
        <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-outline-variant/20 lg:left-64">
          <div className="mx-auto max-w-6xl flex justify-between items-center px-4 md:px-6 lg:px-8 py-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
            >
              <Icon name="arrow_back" className="text-hot-pink" />
            </button>
            <h1 className="font-display font-bold text-hot-pink text-sm md:text-base">
              {t.results.tracksLeft(displayTracks.length - gone.size, displayTracks.length)}
            </h1>
            <button
              onClick={handleFinishEarly}
              className="h-10 px-3 flex items-center justify-center rounded-full text-hot-pink text-sm font-display font-semibold hover:bg-white/5 transition-colors"
            >
              {t.results.finishEarly}
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
              vibeIntent={vibeIntent}
              t={t}
            />
          </aside>
        )}

        <div className="flex flex-col flex-1 min-h-0 space-y-3 lg:space-y-5">
          <p className="hidden lg:block text-hot-pink text-xs font-display font-semibold uppercase tracking-widest">
            {t.results.nowPlayingMatch}
          </p>

          <p className="lg:hidden text-center text-on-surface-variant/60 text-[11px]">
            {t.results.swipeHint}
          </p>

          {/* Mobile: tall combined swipe stack; desktop: song card only */}
          <div className="relative flex-1 min-h-[min(560px,calc(100dvh-13.5rem))] lg:h-[540px] lg:flex-none -mx-1 px-1">
            <AnimatePresence>
              {orderedIndices.map((idx, position) => {
                const track = displayTracks[idx];
                const liveScore = liveScores[idx];
                const cardTrack = liveScore !== undefined ? { ...track, matchScore: liveScore } : track;
                return (
                  <SwipeCard
                    key={`${track.previewUrl || track.youtubeId || track.title}-${idx}`}
                    track={cardTrack}
                    isTop={position === 0}
                    stackIndex={position}
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
            t={t}
          />

          <ProgressDots
            total={displayTracks.length}
            topIdx={topIdx}
            gone={gone}
          />
        </div>
      </div>
    </AppShell>
      {shareSheet}
    </>
  );
}
