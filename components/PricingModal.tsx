"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "../lib/translations/useTranslation";
import Icon from "./Icon";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onAddCredits: (amount: number) => Promise<void>;
  onRefreshCredits: () => Promise<number | null>;
  reason?: "out-of-credits";
}

function getPackages(t: ReturnType<typeof useTranslation>) {
  return [
    {
      id: "starter",
      label: t.pricing.tryIt,
      credits: 10,
      price: "$1.99",
      priceNote: t.pricing.oneTime,
      perMatch: t.pricing.starterPerMatch,
      badge: null as string | null,
      saveBadge: null as string | null,
      popular: false,
      isSubscription: false,
    },
    {
      id: "popular",
      label: t.pricing.popular,
      credits: 50,
      price: "$6.99",
      priceNote: t.pricing.oneTime,
      perMatch: t.pricing.popularPerMatch,
      badge: t.pricing.mostPopularBadge,
      saveBadge: t.pricing.saveBadge,
      popular: true,
      isSubscription: false,
    },
    {
      id: "pro",
      label: t.pricing.proLabel,
      credits: 500,
      price: "$19.99",
      priceNote: t.pricing.oneTime,
      perMatch: t.pricing.proPerMatch,
      badge: t.pricing.bestValue,
      saveBadge: null as string | null,
      popular: false,
      isSubscription: false,
    },
  ];
}

export default function PricingModal({
  isOpen,
  onClose,
  currentCredits,
  onAddCredits,
  onRefreshCredits,
  reason,
}: PricingModalProps) {
  const t = useTranslation();
  const PACKAGES = useMemo(() => getPackages(t), [t]);
  const [selected, setSelected] = useState("popular");
  const selectedPkg = PACKAGES.find((p) => p.id === selected)!;

  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void onRefreshCredits();
  }, [isOpen, onRefreshCredits]);

  const handleContinue = async () => {
    const pkg = selectedPkg;
    setAdding(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout/polar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t.pricing.errorStatus(res.status));
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t.pricing.checkoutFailed);
      setAdding(false);
    }
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
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-cream rounded-t-2xl lg:rounded-2xl p-6 space-y-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-ink"
          >
            <div className="flex justify-between items-center">
              <button
                onClick={onClose}
                className="text-black/50 hover:text-black transition-colors"
              >
                <Icon name="close" />
              </button>
              <h2 className="font-display font-bold text-lg text-ink">
                {reason === "out-of-credits" ? t.pricing.outOfCreditsHeading : t.pricing.getCredits}
              </h2>
              <div className="bg-hot-pink text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 font-display">
                <span>✦</span>
                <span>{currentCredits}</span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-black/50 text-xs font-semibold">{t.pricing.balance}</p>
              <p className="text-hot-pink font-display text-5xl font-bold">
                {currentCredits}✦
              </p>
              <p className="text-black/60 text-sm">{t.pricing.creditsRemaining}</p>
              <p className="text-black/40 text-xs">
                {t.pricing.eachMatchUses}
              </p>
              <div className="inline-flex items-center gap-1.5 mt-2 bg-black/5 text-black/50 text-[11px] font-semibold px-3 py-1 rounded-full">
                <span>✦</span>
                <span>{selectedPkg.isSubscription ? t.pricing.subscriptionExpiry : t.pricing.oneTimeExpiry}</span>
              </div>
            </div>

            <div className="space-y-3">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelected(pkg.id)}
                  className={`relative rounded-xl p-4 cursor-pointer transition-all ${
                    pkg.isSubscription
                      ? "bg-gradient-to-br from-hot-pink/8 to-purple-500/8"
                      : "bg-white"
                  } ${
                    pkg.popular
                      ? "border-2 border-hot-pink"
                      : pkg.isSubscription
                      ? "border-2 border-hot-pink/40"
                      : "border border-black/10"
                  } ${selected === pkg.id ? "ring-2 ring-hot-pink/30" : ""}`}
                >
                  {pkg.badge && (
                    <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-hot-pink text-white">
                      {pkg.badge}
                    </span>
                  )}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-black/50 text-xs font-semibold uppercase tracking-wider">
                          {pkg.label}
                        </p>
                        {pkg.isSubscription && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-hot-pink/15 text-hot-pink">
                            {t.pricing.subscriptionLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <p className="font-display font-bold text-xl text-ink">
                          {pkg.price}
                        </p>
                        <p className="text-black/40 text-xs">{pkg.priceNote}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-black/50 text-xs">
                          {t.pricing.creditsPerMatch(pkg.credits, pkg.perMatch)}
                        </p>
                        {pkg.saveBadge && (
                          <span className="bg-black/5 text-black/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {pkg.saveBadge}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                        selected === pkg.id
                          ? "border-hot-pink bg-hot-pink"
                          : "border-black/20"
                      }`}
                    >
                      {selected === pkg.id && (
                        <Icon
                          name="check"
                          className="text-white"
                          style={{
                            fontSize: "14px",
                            fontVariationSettings: "'FILL' 1, 'wght' 700",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {checkoutError && (
              <p className="text-center text-red-500 text-xs font-medium">
                {checkoutError}
              </p>
            )}

            <button
              onClick={handleContinue}
              disabled={adding || done}
              className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-[0.98] transition-all glow-pink disabled:opacity-70"
            >
              {done
                ? t.pricing.done
                : adding
                ? t.pricing.processing
                : selectedPkg.isSubscription
                ? t.pricing.subscribeFor(selectedPkg.price)
                : t.pricing.getCreditsFor(selectedPkg.credits, selectedPkg.price)}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
