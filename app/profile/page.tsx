"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import PlaylistImport from "../../components/PlaylistImport";
import { useAppStore } from "../../store/useAppStore";
import { useCredits } from "../../lib/useCredits";
import { useAccountSync } from "../../lib/useAccountSync";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import PricingModal from "../../components/PricingModal";
import { useTranslation } from "../../lib/translations/useTranslation";

interface LearnedTaste {
  learnedGenres: string[];
  avoidGenres: string[];
  learnedArtists: string[];
  avoidArtists: string[];
}

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslation();
  const { user } = useAccountSync();
  const { savedSongs, loadFeedback } = useAppStore();
  const { credits, add, refresh } = useCredits();
  const [showPricing, setShowPricing] = useState(false);
  const [showPlaylistImport, setShowPlaylistImport] = useState(false);
  const [learnedTaste, setLearnedTaste] = useState<LearnedTaste | null>(null);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const refreshLearnedTaste = useCallback(() => {
    if (!user) return;
    fetch("/api/taste/learned")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLearnedTaste(data))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    refreshLearnedTaste();
  }, [refreshLearnedTaste]);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleRetakeQuiz = async () => {
    localStorage.removeItem("onboardingDone");
    localStorage.removeItem("seedFeedback");
    localStorage.removeItem("userTaste");
    if (user) {
      await fetch("/api/taste/reset", { method: "POST" }).catch(() => {});
    }
    router.push("/app");
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "user";

  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  return (
    <AppShell
      decor
      header={
        <AppHeader
          credits={credits}
          onCreditsClick={() => setShowPricing(true)}
          center={t.profile.heading}
          showLanguageToggle
          left={
            <button
              onClick={() => history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors lg:hidden"
            >
              <span className="material-symbols-outlined text-on-surface-variant">
                arrow_back
              </span>
            </button>
          }
        />
      }
    >
      <div className="max-w-2xl mx-auto lg:max-w-none">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-hot-pink/15 flex items-center justify-center border-2 border-hot-pink/40">
              <span className="material-symbols-outlined text-5xl text-hot-pink">
                person
              </span>
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-white">
                {t.profile.yourProfileHeading}
              </h1>
              <p className="text-on-surface-variant text-sm mt-2 max-w-sm mx-auto">
                {t.profile.signInPrompt}
              </p>
            </div>
            <a
              href="/app"
              className="flex items-center gap-2 bg-hot-pink text-white font-display font-bold py-4 px-8 rounded-full hover:opacity-90 active:scale-95 transition-all glow-pink"
            >
              {t.profile.signIn}
            </a>
            <StatsCard
              stats={[
                { label: t.profile.statMatches, value: savedSongs.length },
                { label: t.profile.statSaved, value: savedSongs.length },
                { label: t.profile.statCredits, value: credits },
              ]}
            />
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10 lg:items-start space-y-6 lg:space-y-0">
            <div className="flex flex-col items-center lg:items-start space-y-4 pt-2">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-hot-pink"
                />
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-hot-pink/15 border-2 border-hot-pink flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-hot-pink">
                    person
                  </span>
                </div>
              )}
              <div className="text-center lg:text-left">
                <p className="font-display font-bold text-white text-lg">
                  @{displayName.replace(/\s+/g, "").toLowerCase()}
                </p>
              </div>

              <StatsCard
                stats={[
                  { label: t.profile.statMatches, value: savedSongs.length },
                  { label: t.profile.statSaved, value: savedSongs.length },
                  { label: t.profile.statCredits, value: credits },
                ]}
              />

              <button
                onClick={() => setShowPricing(true)}
                className="w-full border border-hot-pink text-hot-pink font-display font-bold py-3 rounded-xl hover:bg-hot-pink/10 active:scale-95 transition-all"
              >
                {t.profile.manageCredits(credits)}
              </button>

              <button
                onClick={() => setShowPlaylistImport(true)}
                className="w-full border border-hot-pink text-hot-pink font-display font-bold py-3 rounded-xl hover:bg-hot-pink/10 active:scale-95 transition-all"
              >
                {t.profile.importPlaylist}
              </button>

              <button
                onClick={handleRetakeQuiz}
                className="w-full border border-white/10 text-white/50 font-semibold text-sm py-3 rounded-xl hover:border-white/20 hover:text-white/70 active:scale-95 transition-all"
              >
                {t.profile.retakeQuiz}
              </button>

              <button
                onClick={handleSignOut}
                className="w-full text-on-surface-variant text-sm hover:text-white transition-colors py-2"
              >
                {t.profile.signOut}
              </button>
            </div>

            <div className="space-y-6">
              {learnedTaste && (
                <TasteSection learnedTaste={learnedTaste} t={t} />
              )}

              {savedSongs.length > 0 && (
                <section className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-display font-bold text-white text-lg">
                      {t.profile.myMatchesHeading}
                    </h2>
                    <a
                      href="/matches"
                      className="text-hot-pink text-xs font-semibold hover:underline"
                    >
                      {t.profile.viewAll}
                    </a>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 gap-2 md:gap-3">
                    {savedSongs.slice(0, 8).map((song, i) => (
                      <div
                        key={i}
                        className="relative aspect-square rounded-lg overflow-hidden bg-surface-container border border-outline-variant/20 hover:border-hot-pink/30 transition-colors"
                      >
                        {song.sourceImage ? (
                          <img
                            src={song.sourceImage}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : song.artwork || song.thumbnail ? (
                          <img
                            src={song.artwork || song.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                        <div className="absolute inset-0 bg-black/30 flex items-end justify-end p-1.5">
                          <span
                            className="material-symbols-outlined text-white text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            music_note
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onAddCredits={add}
        onRefreshCredits={refresh}
      />

      <AnimatePresence>
        {showPlaylistImport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm lg:items-center lg:p-4"
            onClick={() => setShowPlaylistImport(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-surface-container rounded-t-2xl lg:rounded-2xl p-6 space-y-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-display font-bold text-lg text-white">
                  {t.profile.importPlaylist}
                </h2>
                <button
                  onClick={() => setShowPlaylistImport(false)}
                  aria-label={t.share.closeAria}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <PlaylistImport
                compact
                onImported={() => refreshLearnedTaste()}
                onManualFallback={() => {
                  setShowPlaylistImport(false);
                  void handleRetakeQuiz();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function StatsCard({
  stats,
}: {
  stats: { label: string; value: number }[];
}) {
  return (
    <div className="bg-surface-container rounded-xl p-4 w-full border border-outline-variant/20">
      <div className="flex justify-around">
        {stats.map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="font-display font-bold text-2xl text-white">
              {value}
            </p>
            <p className="text-on-surface-variant text-xs">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChipRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "save" | "avoid";
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wide">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              tone === "save"
                ? "bg-hot-pink/15 text-hot-pink"
                : "bg-surface-container-highest text-on-surface-variant"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TasteSection({
  learnedTaste,
  t,
}: {
  learnedTaste: {
    learnedGenres: string[];
    avoidGenres: string[];
    learnedArtists: string[];
    avoidArtists: string[];
  };
  t: ReturnType<typeof useTranslation>;
}) {
  const hasSignal =
    learnedTaste.learnedGenres.length > 0 ||
    learnedTaste.avoidGenres.length > 0 ||
    learnedTaste.learnedArtists.length > 0 ||
    learnedTaste.avoidArtists.length > 0;

  if (!hasSignal) return null;

  return (
    <section className="space-y-4 bg-surface-container-low rounded-xl p-4 border border-outline-variant/20">
      <div>
        <h2 className="font-display font-bold text-white text-lg">
          {t.profile.yourTasteHeading}
        </h2>
        <p className="text-on-surface-variant text-xs mt-0.5">
          {t.profile.learnedFrom}
        </p>
      </div>
      <ChipRow label={t.profile.genresYouSave} items={learnedTaste.learnedGenres} tone="save" />
      <ChipRow label={t.profile.artistsYouSave} items={learnedTaste.learnedArtists} tone="save" />
      <ChipRow label={t.profile.genresAvoiding} items={learnedTaste.avoidGenres} tone="avoid" />
      <ChipRow label={t.profile.artistsAvoiding} items={learnedTaste.avoidArtists} tone="avoid" />
    </section>
  );
}
