"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Track } from "../store/useAppStore";
import { useTranslation } from "../lib/translations/useTranslation";
import { base64ToBlob, compressImageFile } from "../lib/imageCompression";

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
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
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
        // The original upload can be several MB straight off a phone camera —
        // Vercel's serverless functions hard-reject request bodies over
        // 4.5MB before our route handler even runs. /api/analyze's default
        // compression profile targets 1.5MB because it JSON/base64-encodes
        // the photo (~33% inflation) — this upload is a raw multipart Blob
        // with no such inflation, so we can afford a much gentler profile:
        // 1920px matches the share video's own height (buildShareVideoPlan),
        // so a portrait photo needs little to no upscaling during encode.
        const rawBlob = await fetch(photoUrl).then((r) => r.blob());
        const rawFile = new File([rawBlob], "photo.jpg", { type: rawBlob.type || "image/jpeg" });
        const { base64, mimeType } = await compressImageFile(rawFile, {
          maxDimension: 1920,
          targetBytes: 4 * 1024 * 1024,
          qualitySteps: [0.9, 0.85, 0.75, 0.65],
        });
        const photoBlob = base64ToBlob(base64, mimeType);
        const formData = new FormData();
        formData.append("photo", photoBlob, "photo.jpg");
        formData.append("previewUrl", previewUrl);
        formData.append("startSeconds", String(track.viralMomentSeconds ?? 0));

        const res = await fetch("/api/share-video", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Video generation failed");
        const blob = await res.blob();
        if (cancelled) return;
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
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
      setVideoBlob(null);
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
    // Try the app's custom URL scheme first so the OS opens the native app
    // instead of a browser tab. If Instagram isn't installed (or the scheme
    // doesn't fire), the page stays visible and this timer falls back to
    // the plain web URL — cleared if the app actually took over, since the
    // tab gets backgrounded in that case and this timer never fires.
    // Crucially, the fallback opens in a NEW tab rather than navigating this
    // one away — this tab is the whole VibeSong session (matched songs,
    // this sheet); replacing it with instagram.com would strand the user
    // with no way back except losing all of that.
    const fallbackTimer = setTimeout(() => {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    }, 1500);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) clearTimeout(fallbackTimer);
      },
      { once: true }
    );
    window.location.href = "instagram://app";
  };

  // Mobile browsers (iOS Safari in particular) frequently ignore a plain
  // <a download> click on a blob: URL — nothing visibly happens. The native
  // share sheet's "Save Video"/"Save Image" action is the reliable way to
  // get a file onto the device from a web page, so try that first and only
  // fall back to the anchor-click approach where Web Share's file support
  // isn't available (mainly desktop browsers, where the anchor does work).
  const shareOrDownloadFile = async (file: File, fallbackUrl: string, fallbackName: string) => {
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch {
        // User cancelled the share sheet, or it failed — fall through to a
        // direct download link rather than leaving the tap silent.
      }
    }
    const a = document.createElement("a");
    a.href = fallbackUrl;
    a.download = fallbackName;
    a.click();
  };

  const handleDownloadVideo = () => {
    if (!videoBlob || !videoUrl) return;
    const file = new File([videoBlob], "vibesong-story.mp4", { type: "video/mp4" });
    void shareOrDownloadFile(file, videoUrl, "vibesong-story.mp4");
  };

  const handleDownloadPhoto = async () => {
    if (!photoUrl) return;
    const blob = await fetch(photoUrl).then((r) => r.blob());
    const file = new File([blob], "vibesong-story.jpg", { type: blob.type || "image/jpeg" });
    void shareOrDownloadFile(file, photoUrl, "vibesong-story.jpg");
  };

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

            <div className="mx-auto w-full max-w-[220px] rounded-xl overflow-hidden bg-black/40 aspect-[9/16] flex items-center justify-center relative">
              {photoUrl && (
                <img src={photoUrl} alt={t.share.previewAlt} className="w-full h-full object-contain" />
              )}
              {videoStatus === "generating" && (
                <p className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5 text-center text-hot-pink text-xs font-semibold bg-black/60 py-1.5">
                  <span className="material-symbols-outlined animate-spin text-sm leading-none">
                    progress_activity
                  </span>
                  {t.share.generating}
                </p>
              )}
              {videoStatus === "error" && (
                <p className="absolute bottom-2 inset-x-0 text-center text-error text-xs bg-black/60 py-1 px-2">
                  {t.share.error}
                </p>
              )}
            </div>

            <div className="space-y-2">
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
                <>
                  {videoStatus === "ready" && (
                    <button
                      onClick={handleDownloadVideo}
                      className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink"
                    >
                      {t.share.downloadVideo}
                    </button>
                  )}
                  <button
                    onClick={handleAddToStoryTap}
                    className={
                      videoStatus === "ready"
                        ? "w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all"
                        : "w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink"
                    }
                  >
                    {t.share.addToStory}
                  </button>
                </>
              )}
              {/* Always available regardless of phase or video status — never
                  leave the user without a way to get the photo itself. */}
              <button
                onClick={handleDownloadPhoto}
                className="w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all"
              >
                {t.share.downloadPhoto}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
