import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, ROUTE_PATHS } from "../../content/routes.js";
import { buildRobotsRules } from "../src/lib/robots-contract.js";
import { pagesIn } from "../src/lib/seo.js";
import { localizedPath } from "../src/lib/urls.js";

describe("buildRobotsRules", () => {
  it("disallows everything on a test host and carries no sitemap link", () => {
    const rules = buildRobotsRules({ isTestHost: true, baseUrl: "https://test.example.com" });
    expect(rules).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("allows the live host, excludes cart/checkout/store-api, and points at the sitemap", () => {
    const rules = buildRobotsRules({ isTestHost: false, baseUrl: "https://example.com" });
    expect(rules.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(rules.rules).toMatchObject({ disallow: expect.arrayContaining(["/cart", "/checkout", "/store-api"]) });
    expect(rules.sitemap).toBe("https://example.com/sitemap.xml");
  });

  /** Published commercial routes must remain covered by the generated list. */
  it("disallows every commercial route in every locale that actually publishes it", () => {
    const rules = buildRobotsRules({ isTestHost: false, baseUrl: "https://example.com" });
    const disallowed = new Set(
      Array.isArray(rules.rules) ? [] : [rules.rules?.disallow ?? []].flat(),
    );

    for (const locale of LOCALES) {
      for (const route of ["cart", "checkout"] as const) {
        if (!pagesIn(locale).some((page) => page.route === route)) continue;
        const path = localizedPath(locale, ROUTE_PATHS[route]);
        expect(
          disallowed.has(path),
          `${locale} publishes ${route} at ${path}, which robots.txt does not disallow`,
        ).toBe(true);
      }
    }
  });

  it("reserves commercial paths for every prefixed edition before publication", () => {
    const rules = buildRobotsRules({ isTestHost: false, baseUrl: "https://example.com" });
    const disallowed = Array.isArray(rules.rules) ? [] : rules.rules.disallow;
    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      expect(disallowed).toContain(localizedPath(locale, ROUTE_PATHS.cart));
      expect(disallowed).toContain(localizedPath(locale, ROUTE_PATHS.checkout));
    }
  });
});
