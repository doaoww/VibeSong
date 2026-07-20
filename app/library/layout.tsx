import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Saved Songs",
  description: "All the songs you've saved from your VibeSong AI photo matches, in one library.",
  alternates: { canonical: "/library" },
  robots: { index: false, follow: true },
  openGraph: {
    url: "/library",
    title: "Your Saved Songs | VibeSong AI",
    description: "All the songs you've saved from your VibeSong AI photo matches, in one library.",
  },
};

export default function LibraryRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
