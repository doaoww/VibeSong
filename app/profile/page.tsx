"use client";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import { useAppStore } from "../../store/useAppStore";
import { getCredits } from "../../lib/credits";
import PricingModal from "../../components/PricingModal";

export default function ProfilePage() {
  const { data: session } = useSession();
  const { savedSongs, loadSavedSongs } = useAppStore();
  const [credits, setCredits] = useState(3);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    setCredits(getCredits());
    loadSavedSongs();
  }, [loadSavedSongs]);

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
        {!session ? (
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
                Connect Spotify to personalize your matches
              </p>
            </div>
            <button
              onClick={() => signIn("spotify")}
              className="flex items-center gap-2 bg-spotify-green text-black font-display font-bold py-4 px-8 rounded-full hover:opacity-90 active:scale-95 transition-all"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                music_note
              </span>
              Connect Spotify
            </button>
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
              {session.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || ""}
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
                  @
                  {session.user?.name?.replace(/\s+/g, "").toLowerCase() ||
                    "user"}
                </p>
                <div className="flex items-center justify-center lg:justify-start gap-1 text-lime text-xs font-semibold mt-1">
                  <span className="w-2 h-2 rounded-full bg-lime" />
                  Connected to Spotify
                </div>
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
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full text-on-surface-variant text-sm hover:text-white transition-colors py-2"
              >
                Sign out
              </button>
            </div>

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
                      ) : song.thumbnail ? (
                        <img
                          src={song.thumbnail}
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
        )}
      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentCredits={credits}
        onCreditsAdded={(newTotal) => setCredits(newTotal)}
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
