"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/app", icon: "home", label: "Upload" },
  { href: "/explore", icon: "explore", label: "Explore" },
  { href: "/library", icon: "library_music", label: "Library" },
  { href: "/profile", icon: "person", label: "Profile" },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-outline-variant/20 bg-surface-container-lowest/95 backdrop-blur-xl">
      <div className="px-6 py-5 border-b border-outline-variant/20">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold text-white"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-hot-pink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
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
              <span
                className="material-symbols-outlined text-[22px]"
                style={
                  active ? { fontVariationSettings: "'FILL' 1" } : undefined
                }
              >
                {icon}
              </span>
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
          Upload a photo →
        </Link>
      </div>
    </aside>
  );
}
