import { describe, expect, it } from "vitest";

import { pages } from "../../content/pages.js";
import { ROUTE_PATHS } from "../../content/routes.js";
import { buildSitemapEntries } from "../src/lib/sitemap-contract.js";

const BASE_URL = "https://example.com";

describe("buildSitemapEntries: the sitemap contract", () => {
  const entries = buildSitemapEntries(BASE_URL);

  it("lists every indexable route exactly once", () => {
    const indexableRoutes = pages.filter((page) => page.indexable).map((page) => page.route).toSorted();
    expect(entries.map((entry) => entry.routeId).toSorted()).toEqual(indexableRoutes);
    expect(new Set(entries.map((entry) => entry.routeId)).size).toBe(entries.length);
  });

  it("never lists /cart or /checkout", () => {
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/cart"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/checkout"))).toBe(false);
  });

  it("never lists a /store-api path", () => {
    expect(entries.some((entry) => entry.path.startsWith("/store-api"))).toBe(false);
  });

  it("never lists a non-indexable route", () => {
    const nonIndexable = new Set(pages.filter((page) => !page.indexable).map((page) => page.route));
    expect(entries.some((entry) => nonIndexable.has(entry.routeId))).toBe(false);
  });

  it("builds every URL on the canonical base URL, never an alternate host", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(BASE_URL)).toBe(true);
    }
  });

  it("includes the canonical product page exactly once", () => {
    expect(entries.filter((entry) => entry.routeId === "lunarBase")).toHaveLength(1);
    expect(entries.find((entry) => entry.routeId === "lunarBase")?.path).toBe(ROUTE_PATHS.lunarBase);
  });
});
