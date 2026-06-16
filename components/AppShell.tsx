"use client";

import { ReactNode } from "react";
import NavBar from "./NavBar";
import AppSidebar from "./AppSidebar";

interface AppShellProps {
  children: ReactNode;
  header?: ReactNode;
  /** Extra bottom padding for floating CTAs (e.g. library export) */
  bottomPad?: "default" | "large";
  decor?: boolean;
}

export default function AppShell({
  children,
  header,
  bottomPad = "default",
  decor = false,
}: AppShellProps) {
  const pb =
    bottomPad === "large"
      ? "pb-32 lg:pb-10"
      : "pb-28 lg:pb-10";

  return (
    <div className={`min-h-screen bg-background ${pb}`}>
      {/* Desktop sidebar */}
      <AppSidebar />

      <div className="lg:pl-64">
        {header}

        <main className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8 pt-[4.5rem] relative">
          {decor && <PageDecor />}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <NavBar />
      </div>
    </div>
  );
}

function PageDecor() {
  return (
    <>
      <div
        className="float-slow pointer-events-none absolute right-[10%] top-24 h-3 w-3 rounded-full bg-hot-pink opacity-60 hidden md:block"
        aria-hidden
      />
      <div
        className="float-slow pointer-events-none absolute left-[15%] bottom-40 h-2 w-2 rounded-full bg-lime opacity-50 hidden md:block"
        style={{ animationDelay: "1.5s" }}
        aria-hidden
      />
    </>
  );
}
