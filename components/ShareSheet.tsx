"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Track } from "../store/useAppStore";
import { useTranslation } from "../lib/translations/useTranslation";
import { generateShareCardImage } from "../lib/shareCard";
import { canUseWebShareFiles, isIOSSafari, shareToInstagramStory } from "../lib/instagramShare";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  photoUrl: string | null | undefined;
}

type CardStatus = "idle" | "generating" | "ready" | "error";

export default function ShareSheet({ isOpen, onClose, track, photoUrl }: ShareSheetProps) {
  const t = useTranslation();
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<CardStatus>("idle");
  const [canAddToStory, setCanAddToStory] = useState(false);

  useEffect(() => {
    if (!isOpen || !track || !photoUrl) return;
    let cancelled = false;
    setStatus("generating");
    setCanAddToStory(false);

    generateShareCardImage(track, photoUrl)
      .then((blob) => {
        if (cancelled) return;
        setCardBlob(blob);
        setCardUrl(URL.createObjectURL(blob));
        setStatus("ready");
        const file = new File([blob], "vibesong-story.png", { type: "image/png" });
        setCanAddToStory(isIOSSafari(navigator.userAgent) || canUseWebShareFiles(navigator, file));
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, track, photoUrl]);

  useEffect(() => {
    if (!isOpen) {
      setCardBlob(null);
      setStatus("idle");
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (cardUrl) URL.revokeObjectURL(cardUrl);
    };
  }, [cardUrl]);

  const handleAddToStory = async () => {
    if (!cardBlob) return;
    await shareToInstagramStory(cardBlob);
  };

  const handleDownload = () => {
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = "vibesong-story.png";
    a.click();
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

            <div className="rounded-xl overflow-hidden bg-black/40 aspect-[9/16] flex items-center justify-center">
              {status === "generating" && (
                <p className="text-on-surface-variant text-sm">{t.share.generating}</p>
              )}
              {status === "error" && (
                <p className="text-error text-sm px-4 text-center">{t.share.error}</p>
              )}
              {status === "ready" && cardUrl && (
                <img src={cardUrl} alt={t.share.previewAlt} className="w-full h-full object-contain" />
              )}
            </div>

            <div className="space-y-2">
              {canAddToStory && (
                <button
                  onClick={handleAddToStory}
                  disabled={status !== "ready"}
                  className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-95 transition-all glow-pink disabled:opacity-50"
                >
                  {t.share.addToStory}
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={status !== "ready"}
                className="w-full border border-white/10 text-white/80 font-semibold text-sm py-3.5 rounded-full hover:border-white/20 hover:text-white active:scale-95 transition-all disabled:opacity-50"
              >
                {t.share.download}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
