"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "../lib/translations/useTranslation";
import Icon from "./Icon";
import type { IconName } from "../lib/materialIconCodepoints";

export default function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslation();

  const NAV_ITEMS: { href: string; icon: IconName; label: string }[] = [
    { href: "/app", icon: "home", label: t.nav.upload },
    { href: "/explore", icon: "explore", label: t.nav.explore },
    { href: "/library", icon: "library_music", label: t.nav.library },
    { href: "/profile", icon: "person", label: t.nav.profile },
  ];

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-outline-variant/20 bg-surface-container-lowest/95 backdrop-blur-xl">
      <div className="px-6 py-5 border-b border-outline-variant/20">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-white"
        >
          <img src="/android-chrome-192x192.png" alt="" className="h-12 w-12 rounded-lg" />
          VibeSong<span className="text-hot-pink">AI</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active =
            pathname === href ||
            (href === "/app" && pathname === "/results");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-display font-semibold text-sm transition-all ${
                active
                  ? "bg-hot-pink text-white glow-pink"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon
                name={icon}
                className="text-[22px]"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-5 border-t border-outline-variant/20">
        <Link
          href="/app"
          className="flex items-center justify-center gap-2 w-full bg-hot-pink text-white py-3 rounded-full font-display font-semibold text-sm glow-pink hover:bg-[#ff4488] transition-colors"
        >
          {t.common.uploadPhotoArrow}
        </Link>
      </div>
    </aside>
  );
}
