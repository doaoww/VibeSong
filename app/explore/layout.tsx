import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Photo-to-Song Matches",
  description:
    "Browse real photos matched to songs by VibeSong AI — see what other people's Instagram Stories and TikToks sound like.",
  alternates: { canonical: "/explore" },
  openGraph: {
    url: "/explore",
    title: "Explore Photo-to-Song Matches | VibeSong AI",
    description:
      "Browse real photos matched to songs by VibeSong AI — see what other people's Instagram Stories and TikToks sound like.",
  },
};

export default function ExploreRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
