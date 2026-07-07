import type { Metadata, Viewport } from "next";
import { Space_Grotesk, DM_Sans, Unbounded, Golos_Text } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import LocaleInit from "../components/LocaleInit";
import AmplitudeInit from "../components/AmplitudeInit";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

// Neither Space Grotesk nor DM Sans ship Cyrillic glyphs, so Russian text was
// falling back to the browser's default system-ui font — much larger and a
// visual mismatch with the Latin UI. These cover the same weight roles for
// :lang(ru) (see globals.css).
const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  variable: "--font-unbounded",
  weight: ["500", "600", "700", "800"],
});

const golosText = Golos_Text({
  subsets: ["cyrillic", "latin"],
  variable: "--font-golos",
  weight: ["400", "500", "600", "700"],
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
        className={`${spaceGrotesk.variable} ${dmSans.variable} ${unbounded.variable} ${golosText.variable} font-sans min-h-full bg-background text-on-surface antialiased`}
      >
        <LocaleInit />
        <AmplitudeInit />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
