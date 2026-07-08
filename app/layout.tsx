import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import LocaleInit from "../components/LocaleInit";
import AmplitudeInit from "../components/AmplitudeInit";
import "./globals.css";

// Single family for both display and body roles, on every locale — Cyrillic
// glyphs come from the same font instead of a separate face swapped in for
// :lang(ru), which previously read as two different fonts pasted together.
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "VibeSong AI — Your photo. Your soundtrack.",
  description:
    "Drop any photo. Our AI reads the vibe and finds songs that just fit.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VibeSong",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080808",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${manrope.variable} font-sans min-h-full bg-background text-on-surface antialiased`}
      >
        <LocaleInit />
        <AmplitudeInit />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
