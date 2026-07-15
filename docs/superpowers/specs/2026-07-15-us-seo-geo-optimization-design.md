# US SEO/Geo Optimization Design

## Goal

Make VibeSong AI easier for search engines to understand and index for a US, English-language audience without changing the user-facing product flow.

## Primary Market

- Primary locale: `en-US`
- Primary geography: United States
- Primary indexed URL: `/`
- Russian remains an in-app interface option, but this change does not create a separate Russian landing URL.

## Approach

Use the existing Next.js App Router SEO surfaces:

- Root `metadata` in `app/layout.tsx`
- Route-level JSON-LD on the home page
- `app/sitemap.ts`
- `app/robots.ts`

This keeps SEO configuration close to the app shell and avoids static files drifting from route behavior.

## Metadata

The root metadata will describe VibeSong as an AI music matching app for photos, Instagram Stories, TikTok, and short-form social posts. The metadata should include:

- US-oriented English title and description
- `metadataBase` using the production domain
- Canonical URL for `/`
- Open Graph metadata
- Twitter card metadata
- App and publisher names
- Search-friendly keywords that match the actual product

The canonical production URL should use `https://vibe-song.vercel.app` unless a custom domain is configured later.

## Structured Data

The home page will emit JSON-LD for `SoftwareApplication`:

- Name: `VibeSong AI`
- Application category: multimedia/music application
- Operating system: web
- Audience region: US
- Description aligned with the landing page
- Offer data for free start and paid credit packages

The JSON-LD must be static, valid JSON, and embedded server-side so crawlers can read it without client hydration.

## Sitemap

`app/sitemap.ts` will list public, indexable routes:

- `/`
- `/app`
- `/explore`
- `/library`
- `/profile`

Routes with auth-specific or API behavior are excluded. Public app routes can be indexed, but `/` should have the strongest priority.

## Robots

`app/robots.ts` will:

- Allow normal crawling
- Disallow API routes and auth callback routes
- Reference the generated sitemap

## Boundaries

This change will not:

- Add US landing copy sections
- Create city/state landing pages
- Add fake local business data
- Claim a US office, phone number, or address
- Change recommendation logic or localization behavior

## Testing

Verification should include:

- `npm run lint`
- `npm run build`
- Inspect generated metadata files by requesting `/robots.txt` and `/sitemap.xml` in a local server if feasible

## Future Work

If VibeSong gets a custom domain, update `metadataBase`, sitemap URLs, robots sitemap URL, and JSON-LD URL. If the product later targets multiple locales with dedicated URLs, add proper `hreflang` alternates for each locale URL.
