/**
 * The sitemap, generated from the same route table the router and the
 * per-page metadata read. `force-dynamic` matters here as much as it does in
 * the root layout: `sitemap.ts` is cached and can be evaluated at build time
 * by default, which would bake the base URL that happened to be set during
 * `next build` into every environment's sitemap.
 */

import type { MetadataRoute } from "next";

import { loadSiteHostConfig } from "../config/hosts.js";
import { buildSitemapEntries } from "../lib/sitemap-contract.js";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const { baseUrl } = loadSiteHostConfig();
  const entries = buildSitemapEntries(baseUrl);

  return entries.map((entry) => ({ url: entry.url }));
}
