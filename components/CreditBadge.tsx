"use client";
import { motion } from "framer-motion";

interface CreditBadgeProps {
  credits: number;
  onClick?: () => void;
}

export default function CreditBadge({ credits, onClick }: CreditBadgeProps) {
  return (
    <motion.button
      onClick={onClick}
      animate={credits === 0 ? { x: [-3, 3, -3, 3, 0] } : {}}
      transition={{ duration: 0.4 }}
      className="bg-hot-pink text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 glow-pink cursor-pointer font-display"
    >
      <span>✦</span>
      <span>{credits}</span>
    </motion.button>
  );
}
