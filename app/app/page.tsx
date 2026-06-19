"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DropZone from "../../components/DropZone";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import VibeTags from "../../components/VibeTags";
import PricingModal from "../../components/PricingModal";
import TasteSetup, { UserTaste } from "../../components/TasteSetup";
import SongSwipeOnboarding, { SeedSong } from "../../components/SongSwipeOnboarding";
import Star from "../../components/Star";
import AuthGate from "../../components/AuthGate";
import { useAppStore, ExifData } from "../../store/useAppStore";
import { useCredits } from "../../lib/useCredits";
import { useAccountSync } from "../../lib/useAccountSync";

type HomeState = "idle" | "uploading" | "analyzing";

const ANALYZING_TEXTS = [
  "Reading the vibe...",
  "Analyzing mood & energy...",
  "Searching millions of tracks...",
  "Curating your soundtrack...",
];

const QUICK_PROMPTS = [
  "Sunset Drive",
  "Cyberpunk Night",
  "Rainy Window",
  "Gym Energy",
];

const MARQUEE_WORDS = ["MOOD", "ENERGY", "VIBE", "SOUND", "FEELING", "COLOR"];

export default function AppUploadPage() {
  const router = useRouter();
  const { user, status, tasteComplete } = useAccountSync();
  const { credits, deduct, add } = useCredits();
  const [pageState, setPageState] = useState<HomeState>("idle");
  const [analyzeTextIdx, setAnalyzeTextIdx] = useState(0);
  const [showPricing, setShowPricing] = useState(false);
  const [showTasteSetup, setShowTasteSetup] = useState(() =>
    typeof window !== "undefined" ? !localStorage.getItem("userTaste") : false
  );
  const [showSongSwipe, setShowSongSwipe] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    objectUrl: string;
    exifData: ExifData;
  } | null>(null);

  const {
    setUploadedImage,
    setVibeProfile,
    setTracks,
    setIsAnalyzing,
    savedSongs,
    vibeProfile,
    uploadedImageUrl,
  } = useAppStore();

  const effectiveShowTasteSetup =
    tasteComplete === null ? showTasteSetup : !tasteComplete;

  useEffect(() => {
    if (pageState !== "analyzing") return;
    const interval = setInterval(() => {
      setAnalyzeTextIdx((i) => (i + 1) % ANALYZING_TEXTS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [pageState]);

  const runAnalysis = useCallback(
    async (base64: string, mimeType: string, objectUrl: string, exifData: ExifData) => {
      setPageState("analyzing");
      setErrorMsg(null);
      setIsAnalyzing(true);
      setUploadedImage(base64, objectUrl);

      try {
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mimeType, exifData }),
        });
        if (!analyzeRes.ok) {
          const errBody = await analyzeRes.json().catch(() => ({}));
          throw new Error(
            errBody.detail || errBody.error || `API ${analyzeRes.status}`
          );
        }
        const vibeData = await analyzeRes.json();
        setVibeProfile(vibeData);

        let tracks = vibeData.musicDNA?.tracks || [];

        const storedTasteRaw = localStorage.getItem("userTaste");
        const discoveryStyle: UserTaste["discoveryStyle"] = storedTasteRaw
          ? JSON.parse(storedTasteRaw)?.discoveryStyle ?? "balanced"
          : "balanced";

        const searchRes = await fetch("/api/search-tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tracks, discoveryStyle }),
        });
        const ytData = await searchRes.json();
        const ytTracks = Array.isArray(ytData) ? ytData : ytData.found || [];
        setTracks(ytTracks);

        setIsAnalyzing(false);
        router.push("/results");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Analysis failed:", msg);
        setIsAnalyzing(false);
        setPageState("idle");
        setErrorMsg(msg);
      }
    },
    [
      user,
      setUploadedImage,
      setVibeProfile,
      setTracks,
      setIsAnalyzing,
      router,
    ]
  );

  const handleImageReady = useCallback(
    async (base64: string, mimeType: string, objectUrl: string, exifData: ExifData) => {
      if (credits <= 0) {
        setPendingImage({ base64, mimeType, objectUrl, exifData });
        setShowPricing(true);
        return;
      }
      const ok = await deduct();
      if (!ok) {
        setPendingImage({ base64, mimeType, objectUrl, exifData });
        setShowPricing(true);
        return;
      }
      setPageState("uploading");
      setTimeout(() => runAnalysis(base64, mimeType, objectUrl, exifData), 300);
    },
    [credits, deduct, runAnalysis]
  );

  const handleCreditsAdded = async (amount: number) => {
    await add(amount);
    if (pendingImage) {
      const ok = await deduct();
      if (ok) {
        setPageState("uploading");
        setTimeout(
          () =>
            runAnalysis(
              pendingImage.base64,
              pendingImage.mimeType,
              pendingImage.objectUrl,
              pendingImage.exifData
            ),
          300
        );
      }
      setPendingImage(null);
    }
  };

  if (pageState === "analyzing") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col overflow-hidden z-50">
        <div className="mx-auto w-full max-w-3xl h-full flex flex-col">
          {uploadedImageUrl && (
            <div className="relative h-1/2 lg:h-[55%] flex-shrink-0">
              <img
                src={uploadedImageUrl}
                alt="Your upload"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
              <div className="absolute top-4 right-4">
                <div className="bg-hot-pink text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 font-display glow-pink">
                  <span>✦</span>
                  <span>{credits}</span>
                </div>
              </div>
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 border-4 border-hot-pink pointer-events-none"
              />
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-start pt-6 px-6 space-y-5">
            {vibeProfile?.vibeTags && (
              <VibeTags tags={vibeProfile.vibeTags} animate />
            )}

            <div className="flex items-end gap-1 h-10">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ height: ["20%", "100%", "40%", "80%", "20%"] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.06,
                  }}
                  className="w-1.5 bg-hot-pink rounded-full"
                  style={{ minHeight: 4 }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={analyzeTextIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-white font-display font-bold text-xl md:text-2xl text-center"
              >
                {ANALYZING_TEXTS[analyzeTextIdx]}
              </motion.p>
            </AnimatePresence>

            <p className="text-on-surface-variant text-sm">
              This takes about 5 seconds
            </p>
          </div>
        </div>
      </div>
    );
  }

  const needsAuthGate = !effectiveShowTasteSetup && !showSongSwipe && status === "unauthenticated";

  if (needsAuthGate) {
    return <AuthGate />;
  }

  return (
    <AppShell
      decor
      header={
        <AppHeader
          credits={credits}
          onCreditsClick={() => setShowPricing(true)}
        />
      }
    >
      <div className="space-y-8 lg:space-y-10">
        {/* Desktop: two-column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
          <section className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-hot-pink px-3 py-1 text-[11px] font-semibold text-white font-display"
            >
              ✦ AI Music Matching
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight text-white"
            >
              Your photo.
              <br />
              <span className="text-hot-pink">Your soundtrack.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-on-surface-variant text-sm md:text-base leading-relaxed max-w-md"
            >
              Drop any photo. Our AI reads the vibe and finds songs that just
              fit.
            </motion.p>

            <section className="space-y-3 hidden lg:block">
              <h2 className="font-display font-bold text-base text-white">
                Quick Prompts
              </h2>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={prompt}
                    onClick={() =>
                      router.push(
                        `/results?prompt=${encodeURIComponent(prompt)}`
                      )
                    }
                    className={`px-4 py-2 rounded-full text-xs font-semibold font-display transition-all hover:scale-105 active:scale-95 ${
                      i === 0
                        ? "text-white bg-hot-pink glow-pink"
                        : "bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-white hover:border-white/30"
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          </section>

          <section className="space-y-4 mt-6 lg:mt-0">
            {errorMsg && (
              <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-error text-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">
                  error
                </span>
                <div>
                  <p className="font-semibold">Analysis failed</p>
                  <p className="opacity-80 text-xs mt-0.5">{errorMsg}</p>
                </div>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="ml-auto text-error/60 hover:text-error"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>
            )}

            <DropZone onImageReady={handleImageReady} />

            <p className="text-center text-xs text-on-surface-variant">
              <span className="text-hot-pink">✦</span> {credits} free matches ·
              Any photo works
            </p>
          </section>
        </div>

        {savedSongs.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-base md:text-lg text-white">
                Recent Vibes
              </h2>
              <a
                href="/library"
                className="text-hot-pink text-xs font-semibold hover:underline"
              >
                See all
              </a>
            </div>
            <div className="flex overflow-x-auto gap-3 scroll-hide pb-1 lg:grid lg:grid-cols-4 xl:grid-cols-6 lg:overflow-visible">
              {savedSongs.slice(0, 6).map((song, i) => (
                <div
                  key={i}
                  className="relative flex-shrink-0 w-36 lg:w-auto h-44 rounded-xl overflow-hidden border border-outline-variant/20 hover:border-hot-pink/50 transition-all cursor-pointer"
                >
                  {song.sourceImage ? (
                    <img
                      src={song.sourceImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-surface-container-highest" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-white font-bold text-xs truncate">
                      {song.title}
                    </p>
                    <p className="text-on-surface-variant text-[10px] truncate">
                      {song.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3 lg:hidden">
          <h2 className="font-display font-bold text-base text-white">
            Quick Prompts
          </h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={prompt}
                onClick={() =>
                  router.push(`/results?prompt=${encodeURIComponent(prompt)}`)
                }
                className={`px-4 py-2 rounded-full text-xs font-semibold font-display transition-all hover:scale-105 active:scale-95 ${
                  i === 0
                    ? "text-white bg-hot-pink glow-pink"
                    : "bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-white hover:border-white/30"
                }`}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        <div className="relative overflow-hidden border-y border-outline-variant/20 py-4 -mx-4 md:-mx-6 lg:mx-0 lg:rounded-xl lg:border lg:border-outline-variant/20">
          <div className="marquee-track flex whitespace-nowrap font-display text-2xl md:text-3xl font-extrabold uppercase tracking-tight">
            {Array.from({ length: 2 }).map((_, dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-6 px-3">
                {MARQUEE_WORDS.map((w, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-6">
                    <span
                      className={i % 2 === 0 ? "text-white" : "text-hot-pink"}
                    >
                      {w}
                    </span>
                    <Star className="h-4 w-4 shrink-0" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onAddCredits={handleCreditsAdded}
      />
      {effectiveShowTasteSetup && (
        <TasteSetup
          onComplete={(taste) => {
            setShowTasteSetup(false);
            setShowSongSwipe(true);
            if (user?.id) {
              fetch("/api/taste", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(taste),
              }).catch(() => {});
            }
          }}
        />
      )}
      {!effectiveShowTasteSetup && showSongSwipe && (
        <SongSwipeOnboarding
          onComplete={(savedSeeds: SeedSong[], skippedSeeds: SeedSong[]) => {
            const payload = { saved: savedSeeds, skipped: skippedSeeds };
            localStorage.setItem("seedFeedback", JSON.stringify(payload));
            setShowSongSwipe(false);
            if (user?.id) {
              fetch("/api/seed-feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
                .then(() => localStorage.removeItem("seedFeedback"))
                .catch(() => {});
            }
          }}
        />
      )}
    </AppShell>
  );
}
