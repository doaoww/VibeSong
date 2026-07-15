import type { Viewport } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import LocaleInit from "../components/LocaleInit";
import AmplitudeInit from "../components/AmplitudeInit";
import { seoMetadata } from "../lib/seo";
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

export const metadata = seoMetadata;

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
        className={`${spaceGrotesk.variable} ${dmSans.variable} font-sans min-h-full bg-background text-on-surface antialiased`}
      >
        <LocaleInit />
        <AmplitudeInit />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
