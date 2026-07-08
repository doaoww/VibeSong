"use client";

import Link from "next/link";
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Star from "./Star";
import LanguageToggle from "./LanguageToggle";
import { useTranslation } from "../lib/translations/useTranslation";

function PinkButton({
  children,
  className = "",
  href,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full bg-hot-pink px-7 py-3.5 font-display font-semibold text-white glow-pink hover:bg-[#ff4488] transition-colors ${className}`;

  if (href) {
    return (
      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
        <Link href={href} className={cls}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cls}
    >
      {children}
    </motion.button>
  );
}

function OutlineButton({
  children,
  className = "",
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-transparent px-7 py-3.5 font-display font-semibold text-white transition-colors hover:border-white/70 ${className}`;
  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
      <a href={href ?? "#how"} className={cls}>
        {children}
      </a>
    </motion.div>
  );
}

function CountUp({
  to,
  suffix = "",
  prefix = "",
  className = "",
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const rounded = useTransform(
    mv,
    (v) => `${prefix}${Math.round(v).toLocaleString()}${suffix}`
  );

  useEffect(() => {
    if (inView) {
      const controls = animate(mv, to, { duration: 1.8, ease: "easeOut" });
      return controls.stop;
    }
  }, [inView, to, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  );
}

function LandingNav() {
  const t = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-white">
          <img src="/android-chrome-192x192.png" alt="" className="h-11 w-11 rounded-lg" />
          VibeSong<span className="text-hot-pink">AI</span>
        </Link>
        <div className="hidden items-center gap-6 lg:gap-8 text-sm text-white/70 md:flex">
          <a href="#how" className="hover:text-white transition-colors">
            {t.landing.navHowItWorks}
          </a>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <a href="#features" className="hover:text-white transition-colors">
            {t.landing.navFeatures}
          </a>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <a href="#pricing" className="hover:text-white transition-colors">
            {t.landing.navPricing}
          </a>
        </div>
        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
          <Link
            href="/app"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            {t.landing.navSignIn}
          </Link>
          <LanguageToggle />
          <PinkButton href="/app" className="!px-4 !py-2 text-xs sm:!px-5 sm:!py-2.5 sm:text-sm">
            {t.landing.navTryFree}
          </PinkButton>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Menu"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/5 transition-colors md:hidden"
        >
          <span className="material-symbols-outlined text-[24px]">
            {mobileMenuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="border-t border-white/5 bg-black/90 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col items-start gap-1 px-4 py-4 text-sm text-white/70">
              <a href="#how" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navHowItWorks}
              </a>
              <a href="#features" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navFeatures}
              </a>
              <a href="#pricing" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navPricing}
              </a>
              <div className="my-2 h-px w-full bg-white/10" />
              <Link href="/app" onClick={closeMenu} className="w-full py-2.5 hover:text-white transition-colors">
                {t.landing.navSignIn}
              </Link>
              <div className="py-2">
                <LanguageToggle />
              </div>
              <div onClick={closeMenu} className="mt-2">
                <PinkButton href="/app">
                  {t.landing.navTryFree}
                </PinkButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function Hero() {
  const t = useTranslation();

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 md:pt-44 md:pb-32">
      <Star className="float-slow absolute left-[8%] top-32 h-8 w-8 md:h-10 md:w-10 opacity-90 hidden sm:block" />
      <div
        className="float-slow absolute right-[12%] top-28 h-6 w-6 md:h-8 md:w-8 rounded-full bg-lime hidden sm:block"
        style={{ animationDelay: "1.5s" }}
      />
      <Star
        className="float-slow absolute right-[6%] bottom-40 h-5 w-5 md:h-6 md:w-6 hidden sm:block"
        color="var(--color-lime)"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-7 inline-flex items-center gap-2 rounded-full bg-hot-pink px-4 py-1.5 text-xs font-semibold text-white font-display"
        >
          {t.landing.heroBadge}
        </motion.div>

        <h1 className="font-display text-[13vw] sm:text-7xl md:text-[88px] lg:text-[96px] font-bold leading-[0.95] tracking-tight text-white">
          <span className="block">{t.landing.heroHeadingLine1}</span>
          <span className="block text-hot-pink">{t.landing.heroHeadingLine2}</span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 md:mt-7 max-w-lg text-base md:text-lg leading-relaxed text-white/60"
        >
          {t.landing.heroSubtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 md:mt-9 flex flex-wrap items-center gap-3 md:gap-4"
        >
          <PinkButton href="/app" className="!px-8 !py-4 text-base">
            {t.landing.heroCtaPrimary}
          </PinkButton>
          <OutlineButton href="#how" className="!px-8 !py-4 text-base">
            {t.landing.heroCtaSecondary}
          </OutlineButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-5 md:mt-6 text-sm text-white/40"
        >
          <span className="text-hot-pink">✦</span> {t.landing.heroMicrocopy}
        </motion.p>
      </div>

      <div className="relative mt-14 md:mt-20 overflow-hidden border-y border-white/10 py-5 md:py-6">
        <div className="marquee-track flex whitespace-nowrap font-display text-3xl sm:text-4xl md:text-6xl font-bold uppercase tracking-tight">
          {Array.from({ length: 2 }).map((_, dup) => (
            <div key={dup} className="flex shrink-0 items-center gap-6 md:gap-8 px-4">
              {t.landing.marqueeWords.map(
                (w, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-6 md:gap-8">
                    <span className={i % 2 === 0 ? "text-white" : "text-hot-pink"}>
                      {w}
                    </span>
                    <Star className="h-5 w-5 md:h-6 md:w-6 shrink-0" />
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuizPreview() {
  const t = useTranslation();
  const cards = [
    { n: "01", title: t.landing.yourGenres, chips: [t.landing.genreIndie, t.landing.genreHipHop, t.landing.genreRnb, t.landing.genrePop, t.landing.genreLofi] },
    { n: "02", title: t.landing.yourArtists, chips: ["Frank Ocean", "SZA", t.landing.addMore] },
    { n: "03", title: t.landing.yourMood, chips: [t.landing.moodChill, t.landing.moodHype, t.landing.moodSad, t.landing.moodRomantic] },
  ];

  return (
    <section className="bg-cream py-16 md:py-24 text-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="max-w-4xl font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.05]">
          {t.landing.quizHeadingPre}
          <br />
          {t.landing.quizHeadingWhat}<span className="wavy-underline text-hot-pink">{t.landing.quizHeadingLove}</span>
        </h2>

        <div className="mt-10 md:mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div
              key={c.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className="rounded-2xl bg-white p-6 md:p-7 border border-black/5"
            >
              <div className="font-display text-5xl md:text-6xl font-bold text-hot-pink">
                {c.n}
              </div>
              <div className="mt-3 font-display text-xl md:text-2xl font-bold">{c.title}</div>
              <div className="mt-4 md:mt-5 flex flex-wrap gap-2">
                {c.chips.map((ch) => (
                  <span
                    key={ch}
                    className="rounded-full border border-black/10 bg-black/[0.04] px-3 py-1.5 text-sm"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 md:mt-10">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 font-display font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            {t.landing.takeQuiz}
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const t = useTranslation();
  const steps = [
    {
      n: "01",
      title: t.landing.step1Title,
      body: t.landing.step1Body,
    },
    {
      n: "02",
      title: t.landing.step2Title,
      body: t.landing.step2Body,
    },
    {
      n: "03",
      title: t.landing.step3Title,
      body: t.landing.step3Body,
    },
  ];

  return (
    <section id="how" className="relative overflow-hidden py-16 md:py-28">
      <Star
        className="absolute right-[6%] top-20 h-6 w-6 md:h-8 md:w-8 opacity-70 hidden sm:block"
        color="var(--color-lime)"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-hot-pink font-display">
          {t.landing.howItWorksLabel}
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white">
          {t.landing.howItWorksHeading}
        </h2>

        <div className="mt-12 md:mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="font-display text-7xl sm:text-8xl md:text-[120px] font-light leading-none text-hot-pink">
                {s.n}
              </div>
              <div className="mt-3 font-display text-xl md:text-2xl font-bold text-white">
                {s.title}
              </div>
              <div className="mt-3 text-white/60 leading-relaxed">{s.body}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Examples() {
  const t = useTranslation();
  const cards = [
    { image: "/landing/golden-hour.jpg", song: "Golden Hour", artist: "JVKE", match: "91%", tags: ["Pop", t.landing.tagDreamy] },
    { image: "/landing/blinding-lights.jpg", song: "Blinding Lights", artist: "The Weeknd", match: "88%", tags: [t.landing.tagSynthwave, t.landing.tagCity] },
    { image: "/landing/happiness.jpg", song: "Happiness", artist: "Rex Orange County", match: "94%", tags: ["Indie", t.landing.tagWarm] },
    { image: "/landing/kill-bill.jpg", song: "Kill Bill", artist: "SZA", match: "96%", tags: ["R&B", t.landing.tagMoody] },
  ];

  return (
    <section id="features" className="bg-cream py-16 md:py-28 text-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-hot-pink font-display">
          {t.landing.realMatches}
        </p>
        <h2 className="mt-3 font-display text-4xl sm:text-5xl md:text-6xl font-bold">
          {t.landing.whatPhotosSound}
        </h2>

        <div className="mt-10 md:mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="overflow-hidden rounded-2xl bg-white border border-black/5"
            >
              <div className="relative h-80 sm:h-64 md:h-80">
                <img
                  src={c.image}
                  alt={t.landing.matchAlt(c.song, c.artist)}
                  className="h-full w-full object-cover object-top"
                />
                <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                  {c.tags[0]}
                </div>
              </div>
              <div className="p-4 md:p-5">
                <div className="font-display text-lg font-bold leading-tight">{c.song}</div>
                <div className="text-sm text-black/60">{c.artist}</div>
                <div className="mt-3 md:mt-4 flex items-center justify-between">
                  <div className="flex gap-1.5 flex-wrap">
                    {c.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="font-display text-sm font-bold text-hot-pink">{c.match}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const t = useTranslation();

  return (
    <section className="relative overflow-hidden py-16 md:py-28">
      <Star className="absolute left-[6%] top-16 h-8 w-8 md:h-10 md:w-10 hidden sm:block" />
      <Star
        className="absolute right-[8%] bottom-16 h-6 w-6 md:h-7 md:w-7 hidden sm:block"
        color="var(--color-lime)"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-hot-pink">
              <CountUp to={80} suffix={t.landing.statTracksSuffix} />
            </div>
            <div className="mt-3 text-sm uppercase tracking-widest text-white/50">
              {t.landing.statTracksLabel}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-lime">
              {t.landing.statTimePrefix}
              <CountUp to={5} suffix={t.landing.statTimeSuffix} />
            </div>
            <div className="mt-3 text-sm uppercase tracking-widest text-white/50">
              {t.landing.statTimeLabel}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white">
              <CountUp to={94} suffix="%" />
            </div>
            <div className="mt-3 text-sm uppercase tracking-widest text-white/50">
              {t.landing.statAccuracyLabel}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const t = useTranslation();
  const plans = [
    { name: t.landing.starterLabel, price: "$1.99", credits: t.landing.starterCredits, per: t.landing.starterPrice, popular: false },
    { name: t.landing.popularLabel, price: "$6.99", credits: t.landing.popularCredits, per: t.landing.popularPrice, popular: true },
    { name: t.landing.proLabel, price: "$19.99", credits: t.landing.proCredits, per: t.landing.proPrice, popular: false },
  ];

  return (
    <section id="pricing" className="bg-cream py-16 md:py-28 text-ink">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold">
          {t.landing.simplePricingHeading}
        </h2>
        <p className="mt-3 font-display text-lg md:text-xl italic text-hot-pink">
          {t.landing.simplePricingBody}
        </p>

        <div className="mt-10 md:mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8 }}
              className={`relative rounded-2xl bg-white p-6 md:p-8 border ${
                p.popular ? "border-2 border-hot-pink" : "border-black/5"
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-6 rounded-full bg-hot-pink px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                  {t.landing.mostPopularBadge}
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-black/50">
                {p.name}
              </div>
              <div className="mt-4 font-display text-5xl md:text-6xl font-bold">{p.price}</div>
              <div className="mt-2 text-black/60">{p.credits}</div>
              <div className="mt-1 text-sm text-black/50">{p.per}</div>
              <Link
                href="/app"
                className={`mt-6 md:mt-8 block w-full text-center rounded-full px-6 py-3 font-display font-semibold transition-transform hover:scale-[1.02] ${
                  p.popular ? "bg-hot-pink text-white" : "bg-ink text-white"
                }`}
              >
                {t.landing.getStarted}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  const t = useTranslation();

  return (
    <section className="relative overflow-hidden py-20 md:py-32 text-center">
      <Star className="absolute left-[10%] top-24 h-10 w-10 md:h-12 md:w-12 hidden sm:block" />
      <Star
        className="absolute right-[12%] top-32 h-6 w-6 md:h-8 md:w-8 hidden sm:block"
        color="var(--color-lime)"
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <motion.h2
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-display text-[18vw] sm:text-8xl md:text-9xl lg:text-[140px] font-bold leading-none text-white"
        >
          {t.landing.readyHeading}
        </motion.h2>
        <div className="mt-4 md:mt-6 font-display text-xl md:text-3xl font-bold text-hot-pink">
          {t.landing.findSoundtrack}
        </div>
        <p className="mt-3 text-white/50">{t.landing.finalCtaBody}</p>
        <div className="mt-8 flex justify-center">
          <PinkButton href="/app" className="!px-10 !py-5 text-lg">
            {t.landing.heroCtaPrimary}
          </PinkButton>
        </div>
        <p className="mt-5 text-sm text-white/40">
          <span className="text-hot-pink">✦</span> {t.landing.threeFreeIncluded}
        </p>
      </div>
    </section>
  );
}

function Footer() {
  const t = useTranslation();

  return (
    <footer className="border-t border-white/10 py-8 md:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-6">
          <div className="font-display text-lg font-bold text-white">
            VibeSong<span className="text-hot-pink">AI</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-white/60">
            <Link href="/app" className="hover:text-white transition-colors">
              {t.landing.openApp}
            </Link>
            <a href="#how" className="hover:text-white transition-colors">
              {t.landing.navHowItWorks}
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              {t.landing.navPricing}
            </a>
          </div>
        </div>
        <div className="mt-6 md:mt-8 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-white/40">
          <div>© 2026 VibeSong AI</div>
          <div className="italic">{t.landing.footerTagline}</div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <LandingNav />
      <Hero />
      <QuizPreview />
      <HowItWorks />
      <Examples />
      <Stats />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
