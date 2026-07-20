import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upload a Photo & Find Your Song",
  description:
    "Upload a photo or video and VibeSong AI reads the mood, color, and energy to match it with songs for your Instagram Story or TikTok in seconds.",
  alternates: { canonical: "/app" },
  openGraph: {
    url: "/app",
    title: "Upload a Photo & Find Your Song | VibeSong AI",
    description:
      "Upload a photo or video and VibeSong AI reads the mood, color, and energy to match it with songs for your Instagram Story or TikTok in seconds.",
  },
};

export default function AppRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
