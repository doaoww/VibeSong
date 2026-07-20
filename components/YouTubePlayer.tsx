"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "./Icon";

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
  // Starts false regardless of the initial `visible` value so that a card
  // mounted already-visible (the very first card of a stack) still counts
  // as "just became visible" on its first effect run and autoplays, instead
  // of only autoplaying for cards reached later via swipe.
  const prevVisibleRef = useRef(false);

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

  const playYouTube = useCallback(() => {
    if (!iframeRef.current || !youtubeId) return;
    if (playerReady) {
      sendCommand("playVideo");
    } else {
      iframeRef.current.src = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${origin}&autoplay=1&controls=0&start=${start}&rel=0&playsinline=1&modestbranding=1`;
      setPlayerReady(true);
    }
    setIsPlaying(true);
  }, [youtubeId, playerReady, origin, start, sendCommand]);

  // Scoped to this instance's own iframe: an unscoped `message` listener would
  // also react to postMessages from the sibling mobile/desktop YouTubePlayer's
  // iframe (both are mounted at once), corrupting this instance's state.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
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

  // Purely cosmetic progress bar — assumes a 30s preview length and stops
  // ticking at 100%. It must never issue its own pause command: it has no
  // real signal for how long the track actually is, so a YouTube fallback
  // video (often minutes long) would get cut off after 30 seconds for no
  // real reason. Actual stop/end is driven by real events (onEnded, or the
  // user's own toggle) elsewhere.
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((current) => (current >= 100 ? 100 : current + 100 / 30));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  // Autoplay iTunes preview when card becomes top; pause when it leaves.
  // Also covers the YouTube-fallback path: without this, a playing YouTube
  // iframe was never told to pause on swipe-away, so it kept playing under
  // the next card.
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible && !wasVisible) {
      // isPlaying isn't set here for the audio path — the element's own
      // onPlay event (fired only once playback actually starts) is the
      // source of truth, so a silently-blocked autoplay correctly leaves
      // the button showing "Play" instead of lying about it.
      if (hasAudioPreview && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {}); // Browser may block autoplay silently
      } else if (hasYouTube) {
        playYouTube();
      }
    } else if (!visible && wasVisible) {
      // setIsPlaying(false) here is optimistic for the YouTube path (no
      // reliable onPause equivalent for the bare-embed iframe — see the
      // message-listener comment below) but redundant-and-harmless for the
      // audio path, which will also get a real onPause event momentarily.
      if (hasAudioPreview && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } else if (hasYouTube) {
        sendCommand("pauseVideo");
      }
      setIsPlaying(false);
      setProgress(0);
    }
  }, [visible, hasAudioPreview, hasYouTube, sendCommand, playYouTube]);

  const handleToggle = () => {
    const next = !isPlaying;

    // Audio path: no explicit setIsPlaying here either — the <audio>
    // element's onPlay/onPause events below are authoritative.
    if (hasAudioPreview && audioRef.current) {
      if (next) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
      return;
    }

    if (!iframeRef.current || !youtubeId) return;

    if (next) {
      playYouTube();
      return;
    }

    sendCommand("pauseVideo");
    setIsPlaying(false);
    setProgress(0);
  };

  const audio = previewUrl ? (
    <audio
      ref={audioRef}
      src={previewUrl}
      preload="auto"
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
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
        <Icon
          name={isPlaying ? "pause" : "play_arrow"}
          className={iconSize}
          style={{ fontVariationSettings: "'FILL' 1" }}
        />
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex justify-between text-[10px] text-on-surface-variant font-semibold">
          <span className="flex items-center gap-1 truncate">
            <Icon name={hasAudioPreview ? "graphic_eq" : "bolt"} className="text-[13px]" />
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
