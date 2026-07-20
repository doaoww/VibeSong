import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Profile",
  description: "Manage your VibeSong AI taste profile, credits, and connected accounts.",
  alternates: { canonical: "/profile" },
  robots: { index: false, follow: true },
  openGraph: {
    url: "/profile",
    title: "Your Profile | VibeSong AI",
    description: "Manage your VibeSong AI taste profile, credits, and connected accounts.",
  },
};

export default function ProfileRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
