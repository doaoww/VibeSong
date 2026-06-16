"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface YouTubePlayerProps {
  youtubeId?: string;
  title: string;
  startSeconds?: number;
  previewUrl?: string;
  previewProvider?: "itunes" | "youtube";
  visible?: boolean;
  compact?: boolean;
}

export default function YouTubePlayer({
  youtubeId,
  title,
  startSeconds = 0,
  previewUrl,
  previewProvider,
  visible = true,
  compact = false,
}: YouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playerReady, setPlayerReady] = useState(Boolean(previewUrl));

  const start = Math.max(0, Math.floor(startSeconds));
  const origin =
    typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
  const hasAudioPreview = Boolean(previewUrl);
  const hasYouTube = Boolean(youtubeId);
  const iframeSrc = hasYouTube
    ? `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${origin}&autoplay=0&controls=0&start=${start}&rel=0&playsinline=1&modestbranding=1`
    : "";

  const sendCommand = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*"
    );
  }, []);

  const handleIframeLoad = useCallback(() => {
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    readyTimerRef.current = setTimeout(() => setPlayerReady(true), 900);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "infoDelivery" && data?.info?.playerState === 0) {
          setIsPlaying(false);
          setProgress(0);
        }
      } catch {
        // Ignore non-JSON browser/player messages.
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((current) => {
          if (current >= 100) {
            if (hasAudioPreview && audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            } else {
              sendCommand("pauseVideo");
            }
            setIsPlaying(false);
            return 0;
          }
          return current + 100 / 30;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, sendCommand, hasAudioPreview]);

  const handleToggle = () => {
    const next = !isPlaying;

    if (hasAudioPreview && audioRef.current) {
      if (next) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
      setIsPlaying(next);
      if (!next) setProgress(0);
      return;
    }

    if (!iframeRef.current || !youtubeId) return;

    if (next) {
      if (playerReady) {
        sendCommand("playVideo");
      } else {
        iframeRef.current.src = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${origin}&autoplay=1&controls=0&start=${start}&rel=0&playsinline=1&modestbranding=1`;
        setPlayerReady(true);
      }
    } else {
      sendCommand("pauseVideo");
    }

    setIsPlaying(next);
    if (!next) setProgress(0);
  };

  const audio = previewUrl ? (
    <audio
      ref={audioRef}
      src={previewUrl}
      preload="auto"
      onEnded={() => {
        setIsPlaying(false);
        setProgress(0);
      }}
      className="hidden"
    />
  ) : null;

  const iframe = iframeSrc ? (
    <iframe
      ref={iframeRef}
      title={title}
      src={iframeSrc}
      allow="autoplay; encrypted-media"
      loading="eager"
      onLoad={handleIframeLoad}
      className="absolute w-px h-px opacity-0 pointer-events-none"
      tabIndex={-1}
    />
  ) : null;

  if (!visible) return hasAudioPreview ? audio : iframe;

  const btnSize = compact ? "w-9 h-9" : "w-11 h-11";
  const iconSize = compact ? "text-[20px]" : "text-[22px]";
  const sourceLabel =
    previewProvider === "itunes" || hasAudioPreview ? "Clean preview" : "Viral hook";
  const readyLabel =
    previewProvider === "itunes" || hasAudioPreview
      ? "Ready"
      : playerReady
      ? "Ready"
      : "Loading...";

  return (
    <div
      className={`w-full flex items-center gap-3 bg-white/5 border border-white/10 ${
        compact ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"
      }`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {audio}
      {iframe}

      <button
        onClick={handleToggle}
        disabled={!hasAudioPreview && !hasYouTube}
        className={`${btnSize} rounded-full bg-hot-pink flex items-center justify-center text-white active:scale-90 transition-transform flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        <span
          className={`material-symbols-outlined ${iconSize}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {isPlaying ? "pause" : "play_arrow"}
        </span>
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex justify-between text-[10px] text-on-surface-variant font-semibold">
          <span className="flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-[13px]">
              {hasAudioPreview ? "graphic_eq" : "bolt"}
            </span>
            <span>{sourceLabel}</span>
          </span>
          {!compact && (
            <span className="flex-shrink-0 tabular-nums">{readyLabel}</span>
          )}
        </div>
        <div className="w-full h-[3px] rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-hot-pink transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
