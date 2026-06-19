"use client";

import Image from "next/image";
import CreditBadge from "./CreditBadge";

interface AppHeaderProps {
  credits?: number;
  onCreditsClick?: () => void;
  showCredits?: boolean;
  center?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export default function AppHeader({
  credits = 0,
  onCreditsClick,
  showCredits = true,
  center,
  left,
  right,
}: AppHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-outline-variant/20 lg:left-64">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 md:px-6 lg:px-8 py-3">
        {left ?? (
          <a href="/app" className="flex items-center gap-2 lg:hidden">
            <Image
              src="/logo.png"
              alt="VibeSong"
              width={32}
              height={32}
              unoptimized
              className="rounded-xl ring-1 ring-hot-pink/30"
            />
            <span className="font-display text-base font-bold text-white">
              VibeSong<span className="text-hot-pink">AI</span>
            </span>
          </a>
        )}

        {/* Desktop page title */}
        {center ? (
          <span className="font-display font-bold text-sm text-white lg:text-lg lg:flex-1 lg:ml-0">
            {center}
          </span>
        ) : (
          <span className="hidden lg:block font-display font-bold text-lg text-white flex-1">
            Upload
          </span>
        )}

        {right ?? (
          showCredits ? (
            <CreditBadge credits={credits} onClick={onCreditsClick} />
          ) : (
            <div className="w-16" />
          )
        )}
      </div>
    </header>
  );
}
