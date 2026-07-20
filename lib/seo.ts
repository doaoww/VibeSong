import type { Metadata } from "next";

export const seoConfig = {
  siteUrl: "https://vibe-song.vercel.app",
  siteName: "VibeSong AI",
  title: "VibeSong AI | AI Music Matcher for Photos and Stories",
  description:
    "Upload a photo and let VibeSong AI find songs that match the mood, color, and energy of your Instagram Stories, TikToks, and social posts.",
  canonicalPath: "/",
  locale: "en_US",
  alternateLocale: "en-US",
  imagePath: "/android-chrome-512x512.png",
} as const;

export const siteUrl = new URL(seoConfig.siteUrl);

export const seoMetadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: seoConfig.siteName,
  title: {
    default: seoConfig.title,
    template: `%s | ${seoConfig.siteName}`,
  },
  description: seoConfig.description,
  keywords: [
    "AI music matcher",
    "photo to song",
    "Instagram Story music",
    "TikTok song finder",
    "music recommendations",
    "soundtrack for photos",
    "US music app",
  ],
  alternates: {
    canonical: seoConfig.canonicalPath,
    languages: {
      "en-US": seoConfig.canonicalPath,
      "x-default": seoConfig.canonicalPath,
    },
  },
  openGraph: {
    type: "website",
    url: seoConfig.canonicalPath,
    siteName: seoConfig.siteName,
    title: seoConfig.title,
    description: seoConfig.description,
    locale: seoConfig.locale,
    images: [
      {
        url: seoConfig.imagePath,
        width: 512,
        height: 512,
        alt: "VibeSong AI app icon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoConfig.title,
    description: seoConfig.description,
    images: [seoConfig.imagePath],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VibeSong",
  },
  category: "music",
  creator: seoConfig.siteName,
  publisher: seoConfig.siteName,
  other: {
    "geo.region": "US",
    "geo.placename": "United States",
  },
};

// /library and /profile are deliberately excluded: they render a signed-in
// user's own data (saved songs, credits, account settings), not content
// that's useful or stable for a search index, and both now set
// `robots: { index: false }` in their own layout.tsx — listing a noindex
// URL in the sitemap is a wasted crawl budget signal, not just harmless.
export const publicSeoRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/app", priority: 0.8, changeFrequency: "weekly" },
  { path: "/explore", priority: 0.7, changeFrequency: "weekly" },
] as const;

export const robotsDisallowPaths = ["/api/", "/auth/callback"] as const;

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString();
}

export function homeSoftwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: seoConfig.siteName,
    url: absoluteUrl(seoConfig.canonicalPath),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    inLanguage: seoConfig.alternateLocale,
    description: seoConfig.description,
    audience: {
      "@type": "Audience",
      geographicArea: {
        "@type": "Country",
        addressCountry: "US",
      },
    },
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Start with free photo-to-song matches.",
      },
      {
        "@type": "Offer",
        price: "1.99",
        priceCurrency: "USD",
        description: "Starter credits for VibeSong AI matches.",
      },
    ],
  };
}
