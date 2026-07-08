"use client";
import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import DropZone from "../../components/DropZone";
import VibeIntentInput from "../../components/VibeIntentInput";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import VibeTags from "../../components/VibeTags";
import PricingModal from "../../components/PricingModal";
import OnboardingFlow from "../../components/OnboardingFlow";
import Star from "../../components/Star";
import AuthGate from "../../components/AuthGate";
import { useAppStore, ExifData, Track } from "../../store/useAppStore";
import { useCredits } from "../../lib/useCredits";
import { useAccountSync } from "../../lib/useAccountSync";
import ContrastModeToggle from "../../components/ContrastModeToggle";
import { useTranslation } from "../../lib/translations/useTranslation";

type HomeState = "idle" | "uploading" | "analyzing";

export default function AppUploadPage() {
  const t = useTranslation();
  const router = useRouter();
  const { user, status, tasteComplete } = useAccountSync();
  const { credits, loaded, deduct, add, refresh } = useCredits();
  const [pageState, setPageState] = useState<HomeState>("idle");
  const [analyzeTextIdx, setAnalyzeTextIdx] = useState(0);
  const [showPricing, setShowPricing] = useState(false);
  const [pricingReason, setPricingReason] = useState<"out-of-credits" | undefined>(undefined);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const checkoutId = params.get("checkout_id");
      const showTimer = setTimeout(() => setPaymentSuccess(true), 0);
      window.history.replaceState({}, "", "/app");
      const confirmPayment = async () => {
        if (checkoutId) {
          try {
            await fetch("/api/checkout/polar/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checkoutId }),
            });
          } catch (err) {
            console.error("Polar checkout confirmation failed:", err);
          }
        }
        await refresh();
      };
      void confirmPayment();
      const refreshTimers = [1000, 3000, 7000, 12000].map((delay) =>
        setTimeout(() => { void refresh(); }, delay)
      );
      const hideTimer = setTimeout(() => setPaymentSuccess(false), 5000);
      return () => {
        clearTimeout(showTimer);
        refreshTimers.forEach(clearTimeout);
        clearTimeout(hideTimer);
      };
    }
  }, [refresh]);
  // Default true: server renders onboarding in the initial HTML so it appears on first paint.
  // useLayoutEffect hides it synchronously (before next paint) for users who have already completed.
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [completedThisSession, setCompletedThisSession] = useState(false);

  useLayoutEffect(() => {
    const done = localStorage.getItem("onboardingDone") || localStorage.getItem("userTaste");
    // This intentionally runs in layout effect to avoid flashing onboarding for returning users.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (done) setShowOnboarding(false);
  }, []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vibeIntentText, setVibeIntentText] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    objectUrl: string;
    exifData: ExifData;
    thumbnailDataUrl: string;
  } | null>(null);
  // Kept so "Try again" can re-run analysis on the same photo without the
  // user re-selecting a file — cleared on success or manual dismiss.
  const [failedUpload, setFailedUpload] = useState<{
    base64: string;
    mimeType: string;
    objectUrl: string;
    exifData: ExifData;
    thumbnailDataUrl: string;
  } | null>(null);

  const {
    setUploadedImage,
    setVibeProfile,
    setTracks,
    setIsAnalyzing,
    setLikedSeedTracks,
    setOnboardingPrefs,
    savedSongs,
    vibeProfile,
    vibeIntent,
    uploadedImageUrl,
    likedSeedTracks,
    loadFeedback,
    setVibeIntent,
  } = useAppStore();

  // Restore saved songs on mount (DB for signed-in, localStorage for anonymous)
  useEffect(() => { loadFeedback(); }, [loadFeedback]);

  // Restore onboarding prefs from localStorage on mount
  useEffect(() => {
    try {
      const ls = localStorage.getItem("seedFeedback");
      if (ls) {
        const { prefs } = JSON.parse(ls);
        if (prefs?.languagePreference) setOnboardingPrefs(prefs);
      }
    } catch {}
  }, [setOnboardingPrefs]);

  // Priority order:
  // 1. completedThisSession — user just finished the quiz right now
  // 2. tasteComplete === true — DB confirms quiz done (most authoritative)
  // 3. showOnboarding === false — localStorage has "onboardingDone" flag (anonymous completion)
  // 4. tasteComplete === false — signed in but DB says not done → show quiz
  // 5. default: show (new user, still loading)
  const effectiveShowOnboarding =
    status === "authenticated" &&
    !completedThisSession &&
    tasteComplete !== true &&
    showOnboarding;

  useEffect(() => {
    if (pageState !== "analyzing") return;
    const interval = setInterval(() => {
      setAnalyzeTextIdx((i) => (i + 1) % t.home.analyzingTexts.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [pageState, t]);

  const runAnalysis = useCallback(
    async (base64: string, mimeType: string, objectUrl: string, exifData: ExifData, thumbnailDataUrl: string) => {
      setPageState("analyzing");
      setErrorMsg(null);
      setFailedUpload(null);
      setIsAnalyzing(true);
      setUploadedImage(base64, objectUrl, thumbnailDataUrl);
      setVibeIntent(vibeIntentText);

      try {
        const { contrastMode, onboardingPrefs } = useAppStore.getState();
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            mimeType,
            exifData,
            contrastMode,
            vibeIntent: vibeIntentText.trim(),
          }),
        });
        if (!analyzeRes.ok) {
          const errBody = await analyzeRes.json().catch(() => ({}));
          throw new Error(
            errBody.detail || errBody.error || `API ${analyzeRes.status}`
          );
        }
        const vibeData = await analyzeRes.json();
        setVibeProfile(vibeData);

        // Call recommendation engine with the photo vector + matchSignals
        const matchSignals = vibeData.matchSignals ?? {};
        const musicDirection = matchSignals.music_direction ?? { genres: [], references: [], avoid: [] };
        const recommendRes = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoVectorArray: vibeData.photoVectorArray,
            photoConfidence: vibeData.photoConfidence,
            vibeBoosts: {},
            storyIntentTags: matchSignals.story_intent_tags ?? [],
            antiTags: [],
            photoAntiTags: matchSignals.anti_tags ?? [],
            sceneContextTags: matchSignals.scene_context_tags ?? [],
            aestheticTags: matchSignals.modern_aesthetic_tags ?? [],
            moodTags: matchSignals.mood_tags ?? [],
            musicDirection,
            energyBounds: matchSignals.energy_bounds,
            photoBriefEmbedding: vibeData.photoBriefEmbedding ?? null,
          }),
        });
        if (!recommendRes.ok) {
          const errBody = await recommendRes.json().catch(() => ({}));
          throw new Error(errBody.detail || errBody.error || `Recommend API ${recommendRes.status}`);
        }
        const recommendData = await recommendRes.json();
        const recommendedSongs = Array.isArray(recommendData.songs) ? recommendData.songs : [];

        // Map catalog songs to Track format for the existing swipe UI
        const mappedTracks: Track[] = recommendedSongs.map((s: {
          title: string; artist: string; language: string;
          story_intent_tags: string[]; mood_tags: string[]; genre_tags: string[];
          scoreComponents: { finalScore: number; photoFit: number; tasteFit: number; storyFit: number };
          artwork_url: string | null; itunes_preview_url: string | null;
          apple_music_url: string | null; youtube_id: string | null;
        }) => ({
          title: s.title,
          artist: s.artist,
          reason: s.story_intent_tags[0] || s.mood_tags[0] || "Matched to your photo vibe",
          genres: s.genre_tags,
          matchScore: s.scoreComponents.finalScore,
          finalScore: s.scoreComponents.finalScore,
          photoFitScore: s.scoreComponents.photoFit,
          tasteFitScore: s.scoreComponents.tasteFit,
          thumbnail: s.artwork_url || "",
          artwork: s.artwork_url || undefined,
          previewUrl: s.itunes_preview_url || undefined,
          previewProvider: (s.itunes_preview_url ? "itunes" : undefined) as "itunes" | "youtube" | undefined,
          appleMusicUrl: s.apple_music_url || undefined,
          youtubeId: s.youtube_id || undefined,
          sourceImage: uploadedImageUrl || undefined,
        }));
        setTracks(mappedTracks);

        setIsAnalyzing(false);
        router.push("/results");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Analysis failed:", msg);
        add(1); // Refund the credit — analysis didn't complete
        setIsAnalyzing(false);
        setPageState("idle");
        setErrorMsg(t.home.errorRefund);
        setFailedUpload({ base64, mimeType, objectUrl, exifData, thumbnailDataUrl });
      }
    },
    [
      user,
      add,
      setUploadedImage,
      setVibeProfile,
      setTracks,
      setIsAnalyzing,
      router,
      likedSeedTracks,
      t,
      vibeIntentText,
      setVibeIntent,
    ]
  );

  const handleImageReady = useCallback(
    async (base64: string, mimeType: string, objectUrl: string, exifData: ExifData, thumbnailDataUrl: string) => {
      if (credits <= 0) {
        setPendingImage({ base64, mimeType, objectUrl, exifData, thumbnailDataUrl });
        setPricingReason("out-of-credits");
        setShowPricing(true);
        return;
      }
      // Show analyzing screen immediately — don't await deduct() to avoid UI delay.
      // Deduct runs in background; if it fails (race condition) we restore the screen.
      setPageState("uploading");
      deduct().then((ok) => {
        if (!ok) {
          setPageState("idle");
          setPendingImage({ base64, mimeType, objectUrl, exifData, thumbnailDataUrl });
          setPricingReason("out-of-credits");
          setShowPricing(true);
        }
      });
      setTimeout(() => runAnalysis(base64, mimeType, objectUrl, exifData, thumbnailDataUrl), 300);
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
              pendingImage.exifData,
              pendingImage.thumbnailDataUrl
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
                alt={t.home.uploadedAlt}
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

            {vibeIntent && (
              <p className="text-on-surface-variant text-sm italic text-center">
                “{vibeIntent}”
              </p>
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
                {t.home.analyzingTexts[analyzeTextIdx]}
              </motion.p>
            </AnimatePresence>

            <p className="text-on-surface-variant text-sm">
              {t.home.analyzingSubtext}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const needsAuthGate = status === "unauthenticated";

  if (needsAuthGate) {
    return <AuthGate />;
  }

  return (
    <AppShell
      decor
      header={
        <AppHeader
          credits={credits}
          onCreditsClick={() => {
            setPricingReason(undefined);
            setShowPricing(true);
          }}
        />
      }
    >
      {paymentSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2"
        >
          {t.home.creditsAddedToast}
        </motion.div>
      )}

      <div className="space-y-8 lg:space-y-10">
        {/* Desktop: two-column layout */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:items-start">
          <section className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full bg-hot-pink px-3 py-1 text-[11px] font-semibold text-white font-display"
            >
              {t.home.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.05] tracking-tight text-white"
            >
              {t.home.headingLine1}
              <br />
              <span className="text-hot-pink">{t.home.headingLine2}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-on-surface-variant text-sm md:text-base leading-relaxed max-w-md"
            >
              {t.home.subtitle}
            </motion.p>

          </section>

          <section className="space-y-4 mt-6 lg:mt-0">
            {errorMsg && (
              <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-error text-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">
                  error
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{t.home.errorHeading}</p>
                  <p className="opacity-80 text-xs mt-0.5">{errorMsg}</p>
                  {failedUpload && (
                    <button
                      onClick={() => {
                        const upload = failedUpload;
                        setErrorMsg(null);
                        setFailedUpload(null);
                        runAnalysis(upload.base64, upload.mimeType, upload.objectUrl, upload.exifData, upload.thumbnailDataUrl);
                      }}
                      className="mt-2 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                    >
                      {t.common.tryAgain}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setErrorMsg(null); setFailedUpload(null); }}
                  className="text-error/60 hover:text-error"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>
            )}

            <VibeIntentInput
              value={vibeIntentText}
              onChange={setVibeIntentText}
              placeholder={t.home.vibeIntentPlaceholder}
            />

            <DropZone onImageReady={handleImageReady} disabled={loaded && credits <= 0} />

            <ContrastModeToggle />

            <p className="text-center text-xs text-on-surface-variant">
              <span className="text-hot-pink">✦</span> {t.home.freeMatches(credits)}
            </p>
          </section>
        </div>

        {savedSongs.length > 0 && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-base md:text-lg text-white">
                {t.home.recentVibesHeading}
              </h2>
              <a
                href="/library"
                className="text-hot-pink text-xs font-semibold hover:underline"
              >
                {t.home.seeAll}
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


        <div className="relative overflow-hidden border-y border-outline-variant/20 py-4 -mx-4 md:-mx-6 lg:mx-0 lg:rounded-xl lg:border lg:border-outline-variant/20">
          <div className="marquee-track flex whitespace-nowrap font-display text-2xl md:text-3xl font-bold uppercase tracking-tight">
            {Array.from({ length: 2 }).map((_, dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-6 px-3">
                {t.home.marqueeWords.map((w, i) => (
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
        onRefreshCredits={refresh}
        reason={pricingReason}
      />
      {effectiveShowOnboarding && (
        <OnboardingFlow
          onComplete={(completed: boolean) => {
            setShowOnboarding(false);
            if (!completed) return; // abandoned — show again next visit
            setCompletedThisSession(true); // prevent tasteComplete===false from re-showing
            localStorage.setItem("onboardingDone", "1");
          }}
        />
      )}
    </AppShell>
  );
}
