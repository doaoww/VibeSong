"use client";
import { useAppStore } from "../store/useAppStore";

export default function ContrastModeToggle() {
  const { contrastMode, setContrastMode } = useAppStore();

  return (
    <div className="space-y-1.5">
      <p className="text-center text-white/30 text-[11px] font-semibold uppercase tracking-widest">
        Song style
      </p>
      <div className="flex items-center gap-3 justify-center">
        <button
          onClick={() => setContrastMode(false)}
          className={`px-4 py-2 rounded-full text-xs font-semibold font-display transition-all ${
            !contrastMode
              ? "bg-hot-pink text-white glow-pink"
              : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
          }`}
        >
          ✦ Fit the vibe
        </button>
        <button
          onClick={() => setContrastMode(true)}
          className={`px-4 py-2 rounded-full text-xs font-semibold font-display transition-all ${
            contrastMode
              ? "bg-hot-pink text-white glow-pink"
              : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
          }`}
        >
          ⚡ Flip the vibe
        </button>
      </div>
    </div>
  );
}
