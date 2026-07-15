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
