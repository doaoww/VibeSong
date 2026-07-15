"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Track } from "../store/useAppStore";
import { useTranslation } from "../lib/translations/useTranslation";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  photoUrl: string | null | undefined;
}

type VideoStatus = "idle" | "generating" | "ready" | "error" | "unavailable";
type SheetPhase = "preview" | "confirmed";

export default function ShareSheet({ isOpen, onClose, track, photoUrl }: ShareSheetProps) {
  const t = useTranslation();
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<SheetPhase>("preview");

  useEffect(() => {
    if (!isOpen || !photoUrl || !track) return;
    let cancelled = false;
    setPhase("preview");

    if (!track.previewUrl) {
      setVideoStatus("unavailable");
      return;
    }

    setVideoStatus("generating");
    const previewUrl = track.previewUrl;

    (async () => {
      try {
        const photoBlob = await fetch(photoUrl).then((r) => r.blob());
        const formData = new FormData();
        formData.append("photo", photoBlob, "photo.jpg");
        formData.append("previewUrl", previewUrl);
        formData.append("startSeconds", String(track.viralMomentSeconds ?? 0));

        const res = await fetch("/api/share-video", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Video generation failed");
        const videoBlob = await res.blob();
        if (cancelled) return;
        setVideoUrl(URL.createObjectURL(videoBlob));
        setVideoStatus("ready");
      } catch {
        if (!cancelled) setVideoStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, photoUrl, track]);

  useEffect(() => {
    if (!isOpen) {
      setVideoStatus("idle");
      setPhase("preview");
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleAddToStoryTap = async () => {
    if (!track) return;
    try {
      await navigator.clipboard.writeText(`${track.title} — ${track.artist}`);
    } catch {
      // Clipboard text copy failing shouldn't block showing the paste
      // instructions — the user can still type the name manually.
    }
    setPhase("confirmed");
  };

  const handleOpenInstagram = () => {
    window.location.href = "https://www.instagram.com/";
  };

  const handleDownloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "vibesong-story.mp4";
    a.click();
  };

  const handleDownloadPhoto = () => {
    if (!photoUrl) return;
    const a = document.createElement("a");
    a.href = photoUrl;
    a.download = "vibesong-story.jpg";
    a.click();
  };

  const showPhotoFallback = videoStatus === "unavailable" || videoStatus === "error";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center lg:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-surface-container rounded-t-2xl lg:rounded-2xl p-6 space-y-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-white">{t.share.heading}</h2>
              <button
                onClick={onClose}
                aria-label={t.share.closeAria}
                className="text-white/50 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black/40 aspect-[9/16] flex items-center justify-center relative">
              {photoUrl && (
                <img src={photoUrl} alt={t.share.previewAlt} className="w-full h-full object-contain" />
              )}
              {videoStatus === "generating" && (
                <p className="absolute bottom-2 inset-x-0 text-center text-on-surface-variant text-xs bg-black/60 py-1">
                  {t.share.generating}
                </p>
              )}
              {videoStatus === "error" && (
                <p className="absolute bottom-2 inset-x-0 text-center text-error text-xs bg-black/60 py-1 px-2">
                  {t.share.error}
                </p>
              )}
            </div>

            {phase === "confirmed" && track ? (
              <div className="space-y-3">
                <p className="text-white text-sm font-semibold">
                  {t.share.copiedConfirmation(track.title, track.artist)}
                </p>
                <p className="text-on-surface-variant text-sm">{t.share.pasteInstructions}</p>
                <button
                  onClick={handleOpenInstagram}
                  className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink"
                >
                  {t.share.openInstagram}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleAddToStoryTap}
                  className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink"
                >
                  {t.share.addToStory}
                </button>
                {showPhotoFallback ? (
                  <button
                    onClick={handleDownloadPhoto}
                    className="w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all"
                  >
                    {t.share.downloadPhoto}
                  </button>
                ) : (
                  <button
                    onClick={handleDownloadVideo}
                    disabled={videoStatus !== "ready"}
                    className="w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all disabled:opacity-50"
                  >
                    {t.share.downloadVideo}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
