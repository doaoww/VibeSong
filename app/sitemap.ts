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
