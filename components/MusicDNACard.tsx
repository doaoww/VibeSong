"use client";
import { motion } from "framer-motion";
import type { EmotionalVector } from "../lib/emotionalVector";

const DNA_LABELS: Array<{ key: keyof EmotionalVector; icon: string; label: string }> = [
  { key: "dreamy",      icon: "✨", label: "Dreamy" },
  { key: "nostalgia",   icon: "🌧", label: "Nostalgic" },
  { key: "cinematic",   icon: "🎞", label: "Cinematic" },
  { key: "intimacy",    icon: "🌙", label: "Intimate" },
  { key: "darkness",    icon: "🖤", label: "Dark" },
  { key: "energy",      icon: "⚡", label: "Energy" },
  { key: "confidence",  icon: "💫", label: "Confident" },
  { key: "danceability",icon: "🎵", label: "Danceable" },
];

interface Props {
  vector: EmotionalVector;
  onContinue: () => void;
}

export default function MusicDNACard({ vector, onContinue }: Props) {
  const sorted = [...DNA_LABELS]
    .sort((a, b) => vector[b.key] - vector[a.key])
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-1">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Your</p>
          <h2 className="font-display text-3xl font-black text-white">Music DNA</h2>
          <p className="text-white/40 text-sm">Every match is tuned to this.</p>
        </div>

        <div className="space-y-3">
          {sorted.map(({ key, icon, label }, i) => {
            const pct = Math.round(vector[key] * 100);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm font-semibold">
                    {icon} {label}
                  </span>
                  <span className="text-white/50 text-xs font-mono">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full bg-hot-pink"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onContinue}
          className="w-full py-4 rounded-full bg-hot-pink text-white font-display font-bold text-base glow-pink active:scale-95 transition-transform"
        >
          Start matching →
        </motion.button>
      </motion.div>
    </div>
  );
}
