"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onAddCredits: (amount: number) => Promise<void>;
}

const PACKAGES = [
  {
    id: "starter",
    label: "Starter",
    credits: 10,
    price: "$1.99",
    perMatch: "$0.20 per match",
    badge: null as string | null,
    saveBadge: null as string | null,
    popular: false,
  },
  {
    id: "popular",
    label: "Popular",
    credits: 50,
    price: "$6.99",
    perMatch: "$0.14 per match",
    badge: "MOST POPULAR",
    saveBadge: "SAVE 30%",
    popular: true,
  },
  {
    id: "pro",
    label: "Pro",
    credits: 200,
    price: "$19.99",
    perMatch: "$0.10 per match",
    badge: "BEST VALUE",
    saveBadge: "SAVE 50%",
    popular: false,
  },
];

export default function PricingModal({
  isOpen,
  onClose,
  currentCredits,
  onAddCredits,
}: PricingModalProps) {
  const [selected, setSelected] = useState("popular");

  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  const handleContinue = async () => {
    const pkg = PACKAGES.find((p) => p.id === selected)!;
    setAdding(true);
    await onAddCredits(pkg.credits);
    setAdding(false);
    setDone(true);
    setTimeout(onClose, 900);
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
                <span className="material-symbols-outlined">close</span>
              </button>
              <h2 className="font-display font-bold text-lg text-ink">
                Get Credits
              </h2>
              <div className="bg-hot-pink text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 font-display">
                <span>✦</span>
                <span>{currentCredits}</span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-black/50 text-xs font-semibold">Balance</p>
              <p className="text-hot-pink font-display text-5xl font-extrabold">
                {currentCredits}✦
              </p>
              <p className="text-black/60 text-sm">credits remaining</p>
              <p className="text-black/40 text-xs">
                Each photo match uses 1 credit
              </p>
              <div className="inline-flex items-center gap-1.5 mt-2 bg-lime/15 text-black/70 text-[11px] font-semibold px-3 py-1 rounded-full">
                <span>🎉</span>
                <span>Beta: credits are free right now</span>
              </div>
            </div>

            <div className="space-y-3">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelected(pkg.id)}
                  className={`relative rounded-xl p-4 cursor-pointer transition-all bg-white ${
                    pkg.popular
                      ? "border-2 border-hot-pink"
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
                      <p className="text-black/50 text-xs font-semibold uppercase tracking-wider">
                        {pkg.label}
                      </p>
                      <p className="font-display font-bold text-base text-ink mt-1">
                        {pkg.credits} Credits · {pkg.price}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-black/50 text-xs">{pkg.perMatch}</p>
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
                        <span
                          className="material-symbols-outlined text-white"
                          style={{
                            fontSize: "14px",
                            fontVariationSettings: "'FILL' 1, 'wght' 700",
                          }}
                        >
                          check
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {["Credits never expire", "Cancel anytime"].map((perk) => (
                <div
                  key={perk}
                  className="flex items-center gap-2 text-black/60 text-sm"
                >
                  <span
                    className="material-symbols-outlined text-lime"
                    style={{
                      fontSize: "18px",
                      fontVariationSettings: "'FILL' 1",
                    }}
                  >
                    check_circle
                  </span>
                  {perk}
                </div>
              ))}
            </div>

            <button
              onClick={handleContinue}
              disabled={adding || done}
              className="w-full bg-hot-pink text-white font-display font-bold py-4 rounded-full text-base hover:bg-[#ff4488] active:scale-[0.98] transition-all glow-pink disabled:opacity-70"
            >
              {done
                ? `✓ ${PACKAGES.find((p) => p.id === selected)!.credits} credits added!`
                : adding
                ? "Adding…"
                : `Get ${PACKAGES.find((p) => p.id === selected)!.credits} credits free →`}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
