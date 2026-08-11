import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, ROUTE_PATHS } from "../../content/routes.js";
import { alternateLinksFor, pagesIn } from "../src/lib/seo.js";
import { buildSitemapEntries } from "../src/lib/sitemap-contract.js";
import { canonicalUrl, localizedPath } from "../src/lib/urls.js";

const BASE_URL = "https://example.com";

describe("buildSitemapEntries: the sitemap contract", () => {
  const entries = buildSitemapEntries(BASE_URL);

  it("lists every indexable route of every locale exactly once", () => {
    const expected = LOCALES.flatMap((locale) =>
      pagesIn(locale)
        .filter((page) => page.indexable)
        .map((page) => `${locale}:${page.route}`),
    ).toSorted();

    const actual = entries.map((entry) => `${entry.locale}:${entry.routeId}`).toSorted();
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(entries.length);
  });

  it("never lists /cart or /checkout, in any locale", () => {
    for (const locale of LOCALES) {
      for (const route of ["cart", "checkout"] as const) {
        const path = localizedPath(locale, ROUTE_PATHS[route]);
        expect(entries.some((entry) => entry.path === path)).toBe(false);
      }
    }
  });

  it("never lists a /store-api path", () => {
    expect(entries.some((entry) => entry.path.includes("/store-api"))).toBe(false);
  });

  it("never lists a non-indexable route", () => {
    for (const locale of LOCALES) {
      const nonIndexable = new Set(
        pagesIn(locale).filter((page) => !page.indexable).map((page) => page.route),
      );
      expect(
        entries.some((entry) => entry.locale === locale && nonIndexable.has(entry.routeId)),
      ).toBe(false);
    }
  });

  it("builds every URL on the canonical base URL, never an alternate host", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(BASE_URL)).toBe(true);
    }
  });

  it("includes the canonical product page exactly once per locale that publishes it", () => {
    const product = entries.filter((entry) => entry.routeId === "lunarBase");
    const publishing = LOCALES.filter((locale) =>
      pagesIn(locale).some((page) => page.route === "lunarBase"),
    );
    expect(product).toHaveLength(publishing.length);
    expect(product.map((entry) => entry.locale).toSorted()).toEqual([...publishing].toSorted());

    const defaultEntry = product.find((entry) => entry.locale === DEFAULT_LOCALE);
    expect(defaultEntry?.path).toBe(ROUTE_PATHS.lunarBase);
  });

  it("puts every URL at its locale's own canonical", () => {
    for (const entry of entries) {
      expect(entry.url).toBe(canonicalUrl(BASE_URL, entry.locale, entry.routeId));
      expect(entry.path).toBe(localizedPath(entry.locale, ROUTE_PATHS[entry.routeId]));
    }
  });

  /**
   * One `hreflang` map, two consumers. If the sitemap computed its own, the
   * two would be free to disagree about which editions of a page exist — and
   * a crawler reading both would have no way to tell which was stale.
   */
  it("annotates every entry with the same alternates the page itself emits", () => {
    for (const entry of entries) {
      expect(entry.alternates).toEqual(alternateLinksFor(BASE_URL, entry.routeId));
    }
  });
});
