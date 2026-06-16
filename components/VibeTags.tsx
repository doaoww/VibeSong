"use client";
import { motion } from "framer-motion";

interface VibeTagsProps {
  tags: string[];
  animate?: boolean;
}

const TAG_COLORS: Record<string, string> = {
  Melancholic: "bg-blue-900/40 text-blue-200 border-blue-700/30",
  "High Energy": "bg-orange-900/40 text-orange-200 border-orange-700/30",
  "Golden Hour": "bg-yellow-900/40 text-yellow-200 border-yellow-700/30",
  Chill: "bg-teal-900/40 text-teal-200 border-teal-700/30",
  Romantic: "bg-pink-900/40 text-pink-200 border-pink-700/30",
  Dark: "bg-purple-900/40 text-purple-200 border-purple-700/30",
  Nostalgic: "bg-amber-900/40 text-amber-200 border-amber-700/30",
  Dreamy: "bg-violet-900/40 text-violet-200 border-violet-700/30",
};

export default function VibeTags({ tags, animate = false }: VibeTagsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <motion.span
          key={tag}
          initial={animate ? { opacity: 0, scale: 0.8 } : {}}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: animate ? i * 0.3 : 0, duration: 0.4 }}
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
            TAG_COLORS[tag] ||
            "bg-hot-pink/15 text-hot-pink border-hot-pink/30"
          }`}
        >
          {tag}
        </motion.span>
      ))}
    </div>
  );
}
