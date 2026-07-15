# US SEO/Geo Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add US-focused SEO metadata, structured data, sitemap, and robots configuration for VibeSong AI.

**Architecture:** Put SEO constants and JSON-LD builders in `lib/seo.ts` so they can be tested without importing React layouts. Use thin Next.js App Router adapters in `app/layout.tsx`, `app/page.tsx`, `app/sitemap.ts`, and `app/robots.ts`.

**Tech Stack:** Next.js App Router metadata APIs, TypeScript, Node test runner.

## Global Constraints

- Primary locale: `en-US`
- Primary geography: United States
- Primary indexed URL: `/`
- Canonical production URL: `https://vibe-song.vercel.app`
- Do not add fake US address, phone number, or local business claims.
- Do not change recommendation logic, localization behavior, or landing page UX.

---

## File Structure

- Create `lib/seo.ts`: shared site URL, metadata object, public route list, robots disallow list, JSON-LD builder.
- Create `tests/seo.test.mjs`: Node tests for SEO constants and route contracts.
- Modify `app/layout.tsx`: import and export `metadata` from `lib/seo.ts`.
- Modify `app/page.tsx`: render server-side JSON-LD before the client landing page.
- Create `app/sitemap.ts`: generate sitemap entries from `publicSeoRoutes`.
- Create `app/robots.ts`: generate robots config from shared SEO constants.

---

### Task 1: SEO Contract Tests

**Files:**
- Create: `tests/seo.test.mjs`

**Interfaces:**
- Consumes: `seoConfig`, `homeSoftwareApplicationJsonLd`, `publicSeoRoutes`, `robotsDisallowPaths` from `lib/seo.ts`
- Produces: failing tests that define the SEO contract

- [ ] **Step 1: Write the failing test**

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";

const {
  homeSoftwareApplicationJsonLd,
  publicSeoRoutes,
  robotsDisallowPaths,
  seoConfig,
} = await import("../lib/seo.ts");

test("seoConfig targets the US English canonical homepage", () => {
  assert.equal(seoConfig.siteUrl, "https://vibe-song.vercel.app");
  assert.equal(seoConfig.locale, "en_US");
  assert.equal(seoConfig.alternateLocale, "en-US");
  assert.equal(seoConfig.canonicalPath, "/");
  assert.match(seoConfig.title, /AI Music Matcher/i);
  assert.match(seoConfig.description, /Instagram Stories/i);
});

test("publicSeoRoutes exposes only public indexable routes", () => {
  assert.deepEqual(
    publicSeoRoutes.map((route) => route.path),
    ["/", "/app", "/explore", "/library", "/profile"]
  );
  assert.equal(publicSeoRoutes[0].priority, 1);
});

test("robotsDisallowPaths blocks APIs and auth callback internals", () => {
  assert.deepEqual(robotsDisallowPaths, ["/api/", "/auth/callback"]);
});

test("homeSoftwareApplicationJsonLd emits US software application data", () => {
  const jsonLd = homeSoftwareApplicationJsonLd();
  assert.equal(jsonLd["@context"], "https://schema.org");
  assert.equal(jsonLd["@type"], "SoftwareApplication");
  assert.equal(jsonLd.name, "VibeSong AI");
  assert.equal(jsonLd.url, "https://vibe-song.vercel.app/");
  assert.equal(jsonLd.inLanguage, "en-US");
  assert.equal(jsonLd.audience.geographicArea.addressCountry, "US");
  assert.ok(jsonLd.offers.some((offer) => offer.price === "0"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/seo.test.mjs`

Expected: FAIL because `../lib/seo.ts` does not exist.

---

### Task 2: Shared SEO Module

**Files:**
- Create: `lib/seo.ts`

**Interfaces:**
- Produces: `seoConfig`, `publicSeoRoutes`, `robotsDisallowPaths`, `homeSoftwareApplicationJsonLd`

- [ ] **Step 1: Implement minimal shared SEO module**

```typescript
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
};

export const publicSeoRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/app", priority: 0.8, changeFrequency: "weekly" },
  { path: "/explore", priority: 0.7, changeFrequency: "weekly" },
  { path: "/library", priority: 0.4, changeFrequency: "monthly" },
  { path: "/profile", priority: 0.3, changeFrequency: "monthly" },
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
```

- [ ] **Step 2: Run the contract test**

Run: `node --test tests/seo.test.mjs`

Expected: PASS.

---

### Task 3: Wire Next.js SEO Surfaces

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

**Interfaces:**
- Consumes: exports from `lib/seo.ts`
- Produces: Next metadata, JSON-LD, sitemap, and robots responses

- [ ] **Step 1: Replace inline layout metadata**

In `app/layout.tsx`, import `seoMetadata` and export it as `metadata`. Keep the existing viewport unchanged.

- [ ] **Step 2: Render JSON-LD on the home page**

In `app/page.tsx`, call `homeSoftwareApplicationJsonLd()` and render it in a `<script type="application/ld+json">` before `<LandingPage />`.

- [ ] **Step 3: Add sitemap route**

```typescript
import type { MetadataRoute } from "next";
import { absoluteUrl, publicSeoRoutes } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSeoRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
```

- [ ] **Step 4: Add robots route**

```typescript
import type { MetadataRoute } from "next";
import { absoluteUrl, robotsDisallowPaths } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...robotsDisallowPaths],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
```

---

### Task 4: Verification

**Files:**
- Test: `tests/seo.test.mjs`
- Test: app build output

**Interfaces:**
- Consumes: complete implementation
- Produces: verified SEO behavior

- [ ] **Step 1: Run targeted SEO test**

Run: `node --test tests/seo.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Inspect git diff**

Run: `git diff -- app/layout.tsx app/page.tsx app/sitemap.ts app/robots.ts lib/seo.ts tests/seo.test.mjs`

Expected: only SEO-related changes.
