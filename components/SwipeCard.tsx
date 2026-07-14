"use client";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useSyncExternalStore } from "react";
import { Track } from "../store/useAppStore";
import YouTubePlayer from "./YouTubePlayer";
import VibeTags from "./VibeTags";
import { useTranslation } from "../lib/translations/useTranslation";

interface SwipeCardProps {
  track: Track;
  onSave: () => void;
  onSkip: () => void;
  isTop: boolean;
  stackIndex: number;
  vibeImageUrl?: string;
  vibeCaption?: string;
  vibeTags?: string[];
}

// The card renders separate mobile/desktop layouts (Tailwind `lg:` breakpoint
// toggles which is visually shown), but both stay mounted at once. Without
// this, each layout got its own YouTubePlayer instance and both received the
// same `visible` prop, so both independently autoplayed/paused the same
// track — two <audio>/iframe elements racing each other, out of sync with
// whichever one the user could actually see and control.
// Server snapshot is `false` to match the server-rendered/pre-hydration
// markup; corrects to the real viewport on the client immediately after.
const desktopQuery = "(min-width: 1024px)";
function subscribeToDesktopQuery(callback: () => void) {
  const mq = window.matchMedia(desktopQuery);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function useIsDesktopViewport() {
  return useSyncExternalStore(
    subscribeToDesktopQuery,
    () => window.matchMedia(desktopQuery).matches,
    () => false
  );
}

// Max possible contribution of each score component, mirroring the weights
// in lib/recommend.ts's scoring layer: photoFit = cosine * 40, tasteFit =
// genreScore*15 + artistScore*10 + aestheticMatch*5 (max 30), storyFit =
// min(3, matches) * 7 * confFactor (max 3*7*1 = 21). Bars show each
// component as a % of its own max so they're visually comparable even
// though the raw point scales differ.
const PHOTO_FIT_MAX = 40;
const TASTE_FIT_MAX = 30;
const STORY_FIT_MAX = 21;

function pctOfMax(score: number | undefined, max: number): number {
  if (typeof score !== "number") return 0;
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
}

function BreakdownBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-baseline">
        <span className="text-on-surface-variant text-[9px] uppercase tracking-wide">
          {label}
        </span>
        <span className="text-white text-[10px] font-semibold tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-hot-pink" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MatchBreakdown({
  track,
  t,
}: {
  track: Track;
  t: ReturnType<typeof useTranslation>;
}) {
  const hasBreakdown =
    typeof track.photoFitScore === "number" &&
    typeof track.tasteFitScore === "number" &&
    typeof track.storyFitScore === "number";

  if (!hasBreakdown) {
    // Fallback for any track without a breakdown (e.g. older cached data) —
    // shows just the overall score, same as the previous single-bar UI.
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-end">
          <span className="text-lime text-[10px] font-semibold uppercase tracking-widest">
            {t.swipe.matchScore}
          </span>
          <span className="text-white font-display font-bold text-base lg:text-lg">
            {track.matchScore}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-hot-pink" style={{ width: `${track.matchScore}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-full">
      <BreakdownBar label={t.swipe.photoFitLabel} pct={pctOfMax(track.photoFitScore, PHOTO_FIT_MAX)} />
      <BreakdownBar label={t.swipe.tasteFitLabel} pct={pctOfMax(track.tasteFitScore, TASTE_FIT_MAX)} />
      <BreakdownBar label={t.swipe.storyFitLabel} pct={pctOfMax(track.storyFitScore, STORY_FIT_MAX)} />
    </div>
  );
}

function CompactBreakdown({
  track,
  t,
}: {
  track: Track;
  t: ReturnType<typeof useTranslation>;
}) {
  const hasBreakdown =
    typeof track.photoFitScore === "number" &&
    typeof track.tasteFitScore === "number" &&
    typeof track.storyFitScore === "number";
  if (!hasBreakdown) return null;

  return (
    <p className="text-on-surface-variant text-[10px] truncate">
      {t.swipe.photoFitLabel} {pctOfMax(track.photoFitScore, PHOTO_FIT_MAX)}% ·{" "}
      {t.swipe.tasteFitLabel} {pctOfMax(track.tasteFitScore, TASTE_FIT_MAX)}% ·{" "}
      {t.swipe.storyFitLabel} {pctOfMax(track.storyFitScore, STORY_FIT_MAX)}%
    </p>
  );
}

export default function SwipeCard({
  track,
  onSave,
  onSkip,
  isTop,
  stackIndex,
  vibeImageUrl,
  vibeCaption,
  vibeTags,
}: SwipeCardProps) {
  const t = useTranslation();
  const isDesktop = useIsDesktopViewport();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const cardOpacity = useTransform(x, [-250, -100, 0, 100, 250], [0, 1, 1, 1, 0]);
  const skipOpacity = useTransform(x, [-100, -20], [1, 0]);
  const saveOpacity = useTransform(x, [20, 100], [0, 1]);
  const coverImage = track.artwork || track.thumbnail;

  useEffect(() => {
    if (!isTop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onSkip();
      if (e.key === "ArrowRight") onSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isTop, onSave, onSkip]);

  const handleDragEnd = (
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    const swipe =
      Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 500;
    if (swipe) {
      if (info.offset.x > 0) onSave();
      else onSkip();
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity: cardOpacity, zIndex: 10 - stackIndex }}
      animate={{ scale: isTop ? 1 : 1 - stackIndex * 0.04, y: stackIndex * 8 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none touch-pan-y"
    >
      <motion.div
        style={{ opacity: skipOpacity }}
        className="absolute top-4 left-4 z-30 border-[3px] border-error text-error rounded-lg px-3 py-1 font-display font-bold text-lg rotate-[-14deg] pointer-events-none lg:top-4 lg:left-4"
      >
        {t.swipe.stampNope}
      </motion.div>
      <motion.div
        style={{ opacity: saveOpacity }}
        className="absolute top-4 right-4 z-30 border-[3px] border-hot-pink text-hot-pink rounded-lg px-3 py-1 font-display font-bold text-lg rotate-[14deg] pointer-events-none lg:top-4 lg:right-4"
      >
        {t.swipe.stampSave}
      </motion.div>

      {/* Mobile: combined photo + song — one swipeable card */}
      <div className="lg:hidden h-full flex flex-col rounded-2xl overflow-hidden border border-hot-pink/20 bg-surface-container glow-pink">
        <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black/40">
          {vibeImageUrl ? (
            <img
              src={vibeImageUrl}
              alt={t.swipe.yourVibeAlt}
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : coverImage ? (
            <img
              src={coverImage}
              alt=""
              className="w-full h-full object-contain opacity-60"
              draggable={false}
            />
          ) : null}

          {(vibeCaption || vibeTags?.length) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-3 pt-10 pointer-events-none">
              {vibeCaption && (
                <p className="text-white italic text-xs leading-snug line-clamp-2 mb-2">
                  {vibeCaption}
                </p>
              )}
              {vibeTags && vibeTags.length > 0 && (
                <VibeTags tags={vibeTags} />
              )}
            </div>
          )}
        </div>

        <div
          className="flex-shrink-0 border-t border-white/10 bg-surface-container/95 backdrop-blur-md p-3 space-y-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5">
            {coverImage ? (
              <img
                src={coverImage}
                alt={track.title}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-white font-display font-bold text-base leading-tight truncate">
                {track.title}
              </h2>
              <p className="text-on-surface-variant text-xs truncate mt-0.5">
                {track.artist}
              </p>
            </div>
            <span className="flex-shrink-0 font-display font-bold text-hot-pink text-sm tabular-nums">
              {track.matchScore}%
            </span>
          </div>

          {track.reason && (
            <p className="text-on-surface-variant italic text-[11px] leading-snug line-clamp-1">
              {track.reason}
            </p>
          )}
          <CompactBreakdown track={track} t={t} />

          {(isTop || stackIndex === 1) && (
            <YouTubePlayer
              youtubeId={track.youtubeId}
              title={track.title}
              startSeconds={track.viralMomentSeconds ?? 0}
              previewUrl={track.previewUrl}
              previewProvider={track.previewProvider}
              visible={isTop && !isDesktop}
              compact
            />
          )}
        </div>
      </div>

      {/* Desktop: album cover hero */}
      <div className="hidden lg:flex relative w-full h-full rounded-xl border border-outline-variant/25 bg-surface-container flex-col items-center p-5 overflow-hidden">
        <div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto">
          <div className="w-full max-w-[220px] aspect-square rounded-xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(255,45,122,0.35)] border border-white/10 flex-shrink-0">
            {coverImage ? (
              <img
                src={coverImage}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant">
                  album
                </span>
              </div>
            )}
          </div>

          <div className="w-full max-w-[240px] mt-4 space-y-2.5 text-center flex-shrink-0">
            <div>
              <h2 className="text-white font-display font-bold text-xl leading-tight">
                {track.title}
              </h2>
              <p className="text-on-surface-variant text-sm mt-0.5">{track.artist}</p>
            </div>

            <p className="text-on-surface-variant italic text-sm leading-snug line-clamp-2">
              {track.reason}
            </p>

            <MatchBreakdown track={track} t={t} />
          </div>
        </div>

        {(isTop || stackIndex === 1) && (
          <div
            className="w-full max-w-[240px] pt-3 flex-shrink-0 border-t border-white/5 mt-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <YouTubePlayer
              youtubeId={track.youtubeId}
              title={track.title}
              startSeconds={track.viralMomentSeconds ?? 0}
              previewUrl={track.previewUrl}
              previewProvider={track.previewProvider}
              visible={isTop && isDesktop}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
