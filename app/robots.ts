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
