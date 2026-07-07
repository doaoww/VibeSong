"use client";
import Image from "next/image";
import AppShell from "../../components/AppShell";
import AppHeader from "../../components/AppHeader";
import Star from "../../components/Star";
import { useTranslation } from "../../lib/translations/useTranslation";
import { en } from "../../lib/translations/en";

const EXPLORE_CARDS = [
  {
    image: "/landing/golden-hour.jpg",
    imagePosition: "object-[50%_30%]",
    gradient: "from-[#5C1B2E] to-[#2A0710]",
    song: "Nights",
    artist: "Frank Ocean",
    match: "91%",
    tags: ["R&B", "Late Night"],
  },
  {
    image: "/landing/blinding-lights.jpg",
    imagePosition: "object-[50%_35%]",
    gradient: "from-[#0F3D8C] to-[#0A1A3A]",
    song: "Blinding Lights",
    artist: "The Weeknd",
    match: "88%",
    tags: ["Synthwave", "City"],
  },
  {
    image: "/landing/happiness.jpg",
    imagePosition: "object-[50%_30%]",
    gradient: "from-[#D9A05B] to-[#7A4A1F]",
    song: "Happiness",
    artist: "Rex Orange County",
    match: "94%",
    tags: ["Indie", "Warm"],
  },
  {
    image: "/landing/kill-bill.jpg",
    imagePosition: "object-[50%_35%]",
    gradient: "from-[#1E1E1E] to-[#000000]",
    song: "Kill Bill",
    artist: "SZA",
    match: "96%",
    tags: ["R&B", "Moody"],
  },
  {
    image: "/landing/blinding-lights.jpg",
    imagePosition: "object-[50%_70%]",
    gradient: "from-[#2D1B4E] to-[#0F0820]",
    song: "Redbone",
    artist: "Childish Gambino",
    match: "89%",
    tags: ["Funk", "Noir"],
  },
  {
    image: "/landing/golden-hour.jpg",
    imagePosition: "object-[50%_68%]",
    gradient: "from-[#1A4D3A] to-[#0A2018]",
    song: "Sunflower",
    artist: "Rex Orange County",
    match: "92%",
    tags: ["Indie", "Soft"],
  },
];

function getTagTranslation(tag: string, t: typeof en): string {
  const tagMap: Record<string, string> = {
    "R&B": t.explore.tagRnb,
    "Late Night": t.explore.tagLateNight,
    "Synthwave": t.explore.tagSynthwave,
    "City": t.explore.tagCity,
    "Indie": t.explore.tagIndie,
    "Warm": t.explore.tagWarm,
    "Moody": t.explore.tagMoody,
    "Funk": t.explore.tagFunk,
    "Noir": t.explore.tagNoir,
    "Soft": t.explore.tagSoft,
  };
  return tagMap[tag] || tag;
}

export default function ExplorePage() {
  const t = useTranslation();

  return (
    <AppShell decor header={<AppHeader showCredits={false} center={t.explore.heading} />}>
      <div className="space-y-6">
        <div>
          <p className="text-hot-pink text-xs font-semibold font-display">
            {t.explore.realMatches}
          </p>
          <h1 className="font-display font-bold text-xl md:text-2xl text-white mt-1">
            {t.explore.whatPhotosSound}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-xl">
            {t.explore.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3 md:gap-4">
          {EXPLORE_CARDS.map((c, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl bg-surface-container border border-outline-variant/20 hover:border-hot-pink/30 transition-colors"
            >
              <div className={`relative h-28 md:h-36 bg-gradient-to-br ${c.gradient}`}>
                <Image
                  src={c.image}
                  alt={`${c.song} by ${c.artist}`}
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className={`absolute inset-0 h-full w-full object-cover ${c.imagePosition}`}
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-35`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-black/10" />
                <div className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {getTagTranslation(c.tags[0], t)}
                </div>
              </div>
              <div className="p-3 md:p-4">
                <div className="font-display font-bold text-sm md:text-base text-white leading-tight truncate">
                  {c.song}
                </div>
                <div className="text-xs text-on-surface-variant truncate">
                  {c.artist}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant">
                    {getTagTranslation(c.tags[1], t)}
                  </span>
                  <span className="font-display text-xs font-bold text-hot-pink">
                    {c.match}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <a
          href="/app"
          className="flex items-center justify-center gap-2 w-full md:w-auto md:max-w-xs bg-hot-pink text-white py-4 px-8 rounded-full font-display font-bold text-sm glow-pink hover:bg-[#ff4488] transition-colors"
        >
          {t.explore.uploadYourPhoto}
          <Star className="h-3 w-3" color="white" />
        </a>
      </div>
    </AppShell>
  );
}
