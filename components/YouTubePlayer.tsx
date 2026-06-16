"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface YouTubePlayerProps {
  youtubeId: string;
  title: string;
  startSeconds?: number;
  /** When false, renders only the preload iframe (no UI). Used for next-card buffering. */
  visible?: boolean;
  compact?: boolean;
}

export default function YouTubePlayer({
  youtubeId,
  title,
  startSeconds = 0,
  visible = true,
  compact = false,
}: YouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  // True once iframe has loaded + 900ms init window for YouTube's internal JS
  const [playerReady, setPlayerReady] = useState(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = Math.max(0, Math.floor(startSeconds));
  const origin =
    typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";

  // Single src — never changes after mount. start= sets the initial seek position.
  const iframeSrc = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${origin}&autoplay=0&controls=0&start=${start}&rel=0&playsinline=1&modestbranding=1`;

  // Send a postMessage command to the embedded player
  const sendCommand = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*"
    );
  }, []);

  // After iframe DOM-loads, give YouTube 900ms to init its internal player JS
  const handleIframeLoad = useCallback(() => {
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    readyTimerRef.current = setTimeout(() => setPlayerReady(true), 900);
  }, []);

  // Listen for "video ended" so we can reset the UI
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        // playerState 0 = ended
        if (data?.event === "infoDelivery" && data?.info?.playerState === 0) {
          setIsPlaying(false);
          setProgress(0);
        }
      } catch {
        // non-JSON messages from other sources — ignore
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Reset everything when the track changes
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setPlayerReady(false);
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
  }, [youtubeId]);

  // Progress bar tick (30-second preview window)
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            sendCommand("pauseVideo");
            setIsPlaying(false);
            return 0;
          }
          return p + 100 / 30;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, sendCommand]);

  const handleToggle = () => {
    if (!iframeRef.current) return;
    const next = !isPlaying;

    if (next) {
      // PLAY
      if (playerReady) {
        // Best path: postMessage play — no src reload, instant start
        sendCommand("playVideo");
      } else {
        // Fallback: swap src with autoplay=1 (only fires before player initializes)
        iframeRef.current.src = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${origin}&autoplay=1&controls=0&start=${start}&rel=0&playsinline=1&modestbranding=1`;
        // Mark ready so subsequent toggles use postMessage
        setPlayerReady(true);
      }
    } else {
      // PAUSE — postMessage always works, regardless of playerReady
      sendCommand("pauseVideo");
    }

    setIsPlaying(next);
    if (!next) setProgress(0);
  };

  // Shared iframe element
  const iframe = (
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
  );

  // Preload-only mode: keep the iframe alive in DOM, no UI
  if (!visible) return iframe;

  const btnSize = compact ? "w-9 h-9" : "w-11 h-11";
  const iconSize = compact ? "text-[20px]" : "text-[22px]";

  return (
    <div
      className={`w-full flex items-center gap-3 bg-white/5 border border-white/10 ${
        compact ? "rounded-lg px-3 py-2" : "rounded-xl px-4 py-3"
      }`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {iframe}

      <button
        onClick={handleToggle}
        className={`${btnSize} rounded-full bg-hot-pink flex items-center justify-center text-white active:scale-90 transition-transform flex-shrink-0`}
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
            <span>⚡</span>
            <span>Viral hook</span>
          </span>
          {!compact && (
            <span className="flex-shrink-0 tabular-nums">
              {playerReady ? "Ready" : "Loading…"}
            </span>
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
