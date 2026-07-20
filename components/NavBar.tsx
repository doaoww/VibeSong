"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "../lib/translations/useTranslation";
import Icon from "./Icon";
import type { IconName } from "../lib/materialIconCodepoints";

export default function NavBar() {
  const pathname = usePathname();
  const t = useTranslation();

  const NAV_ITEMS: { href: string; icon: IconName; label: string }[] = [
    { href: "/app", icon: "home", label: t.nav.home },
    { href: "/explore", icon: "explore", label: t.nav.explore },
    { href: "/library", icon: "library_music", label: t.nav.library },
    { href: "/profile", icon: "person", label: t.nav.profile },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-3 pb-4 pt-2 glass-effect border-t border-outline-variant/20 rounded-t-2xl lg:hidden">
      {NAV_ITEMS.map(({ href, icon, label }) => {
        const active =
          pathname === href ||
          (href === "/app" && pathname === "/results");
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all duration-200 active:scale-90 min-w-[4.5rem] ${
              active
                ? "bg-hot-pink text-white glow-pink"
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            <Icon
              name={icon}
              className="text-[22px]"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            />
            <span className="text-[10px] mt-0.5 font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
