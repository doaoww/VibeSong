"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import { useAppStore } from "../../store/useAppStore";
import { useCredits } from "../../lib/useCredits";
import { useAccountSync } from "../../lib/useAccountSync";
import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import PricingModal from "../../components/PricingModal";

interface LearnedTaste {
  learnedGenres: string[];
  avoidGenres: string[];
  learnedArtists: string[];
  avoidArtists: string[];
}

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAccountSync();
  const { savedSongs, loadFeedback } = useAppStore();
  const { credits, add } = useCredits();
  const [showPricing, setShowPricing] = useState(false);
  const [learnedTaste, setLearnedTaste] = useState<LearnedTaste | null>(null);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/taste/learned")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLearnedTaste(data))
      .catch(() => {});
  }, [user]);

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
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
          center="Profile"
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
                Your Profile
              </h1>
              <p className="text-on-surface-variant text-sm mt-2 max-w-sm mx-auto">
                Sign in to see your matches and credits
              </p>
            </div>
            <a
              href="/app"
              className="flex items-center gap-2 bg-hot-pink text-white font-display font-bold py-4 px-8 rounded-full hover:opacity-90 active:scale-95 transition-all glow-pink"
            >
              Sign in
            </a>
            <StatsCard
              stats={[
                { label: "Matches", value: savedSongs.length },
                { label: "Saved", value: savedSongs.length },
                { label: "Credits", value: credits },
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
                  { label: "Matches", value: savedSongs.length },
                  { label: "Saved", value: savedSongs.length },
                  { label: "Credits", value: credits },
                ]}
              />

              <button
                onClick={() => setShowPricing(true)}
                className="w-full border border-hot-pink text-hot-pink font-display font-bold py-3 rounded-xl hover:bg-hot-pink/10 active:scale-95 transition-all"
              >
                Manage Credits · {credits} left
              </button>

              <button
                onClick={handleSignOut}
                className="w-full text-on-surface-variant text-sm hover:text-white transition-colors py-2"
              >
                Sign out
              </button>
            </div>

            <div className="space-y-6">
              {learnedTaste && (
                <TasteSection learnedTaste={learnedTaste} />
              )}

              {savedSongs.length > 0 && (
                <section className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="font-display font-bold text-white text-lg">
                      My Matches
                    </h2>
                    <a
                      href="/library"
                      className="text-hot-pink text-xs font-semibold hover:underline"
                    >
                      View All
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
      />
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
}: {
  learnedTaste: {
    learnedGenres: string[];
    avoidGenres: string[];
    learnedArtists: string[];
    avoidArtists: string[];
  };
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
          Your Taste
        </h2>
        <p className="text-on-surface-variant text-xs mt-0.5">
          Learned from what you save and skip
        </p>
      </div>
      <ChipRow label="Genres you save" items={learnedTaste.learnedGenres} tone="save" />
      <ChipRow label="Artists you save" items={learnedTaste.learnedArtists} tone="save" />
      <ChipRow label="Genres we're avoiding" items={learnedTaste.avoidGenres} tone="avoid" />
      <ChipRow label="Artists we're avoiding" items={learnedTaste.avoidArtists} tone="avoid" />
    </section>
  );
}
