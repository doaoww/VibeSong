"use client";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { Track } from "../store/useAppStore";
import YouTubePlayer from "./YouTubePlayer";
import VibeTags from "./VibeTags";

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

function MatchScore({ score }: { score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-end">
        <span className="text-lime text-[10px] font-semibold uppercase tracking-widest">
          Match Score
        </span>
        <span className="text-white font-display font-bold text-base lg:text-lg">
          {score}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-hot-pink"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
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
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const cardOpacity = useTransform(x, [-250, -100, 0, 100, 250], [0, 1, 1, 1, 0]);
  const skipOpacity = useTransform(x, [-100, -20], [1, 0]);
  const saveOpacity = useTransform(x, [20, 100], [0, 1]);

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
      info.offset.x > 0 ? onSave() : onSkip();
    }
  };

  return (
    <motion.div
      style={{
        x,
        rotate,
        opacity: cardOpacity,
        zIndex: 10 - stackIndex,
        scale: isTop ? 1 : 1 - stackIndex * 0.04,
        y: stackIndex * 8,
      }}
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
        NOPE
      </motion.div>
      <motion.div
        style={{ opacity: saveOpacity }}
        className="absolute top-4 right-4 z-30 border-[3px] border-hot-pink text-hot-pink rounded-lg px-3 py-1 font-display font-bold text-lg rotate-[14deg] pointer-events-none lg:top-4 lg:right-4"
      >
        SAVE
      </motion.div>

      {/* Mobile: combined photo + song — one swipeable card */}
      <div className="lg:hidden h-full flex flex-col rounded-2xl overflow-hidden border border-hot-pink/20 bg-surface-container glow-pink">
        <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black/40">
          {vibeImageUrl ? (
            <img
              src={vibeImageUrl}
              alt="Your vibe"
              className="w-full h-full object-contain"
              draggable={false}
            />
          ) : track.thumbnail ? (
            <img
              src={track.thumbnail}
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
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
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

          {(isTop || stackIndex === 1) && (
            <YouTubePlayer
              youtubeId={track.youtubeId}
              title={track.title}
              startSeconds={track.viralMomentSeconds ?? 0}
              visible={isTop}
              compact
            />
          )}
        </div>
      </div>

      {/* Desktop: album cover hero */}
      <div className="hidden lg:flex relative w-full h-full rounded-xl border border-outline-variant/25 bg-surface-container flex-col items-center p-5 overflow-hidden">
        <div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto">
          <div className="w-full max-w-[220px] aspect-square rounded-xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(255,45,122,0.35)] border border-white/10 flex-shrink-0">
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
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

            <MatchScore score={track.matchScore} />
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
              visible={isTop}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
