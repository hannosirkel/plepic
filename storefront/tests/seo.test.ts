import { describe, expect, it } from "vitest";

import { pagesByLocale } from "../../content/index.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
} from "../../content/routes.js";
import { alternateLinksFor, buildPageMetadata, localesPublishing, pagesIn } from "../src/lib/seo.js";
import { canonicalUrl } from "../src/lib/urls.js";

const BASE_URL = "https://example.com";

const defaultPages = pagesIn(DEFAULT_LOCALE);

describe("buildPageMetadata on a live host", () => {
  it("gives every route a title, a description and a self-referencing canonical", () => {
    for (const page of defaultPages) {
      const metadata = buildPageMetadata(page.route, {
        baseUrl: BASE_URL,
        isTestHost: false,
        locale: DEFAULT_LOCALE,
      });
      expect(metadata.title).toBe(page.title);
      expect(metadata.description).toBe(page.description);
      expect(metadata.alternates?.canonical).toBe(`${BASE_URL}${ROUTE_PATHS[page.route]}`);
    }
  });

  it("marks every indexable route index, follow", () => {
    const indexable = defaultPages.filter((page) => page.indexable);
    expect(indexable.length).toBeGreaterThan(0);

    for (const page of indexable) {
      const metadata = buildPageMetadata(page.route, {
        baseUrl: BASE_URL,
        isTestHost: false,
        locale: DEFAULT_LOCALE,
      });
      expect(metadata.robots, page.route).toEqual({ index: true, follow: true });
    }
  });

  it("marks a non-indexable route noindex, nofollow", () => {
    const metadata = buildPageMetadata("cart", {
      baseUrl: BASE_URL,
      isTestHost: false,
      locale: DEFAULT_LOCALE,
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

/**
 * `proxy.ts` sends `X-Robots-Tag: noindex, nofollow` on a configured test
 * hostname. A page that simultaneously emitted `index, follow` in its own
 * metadata would be arguing with that header, and which side a crawler
 * believes is not a question worth having an answer to. On a test host, no
 * route is indexable.
 */
describe("buildPageMetadata on a test host", () => {
  it("marks every route noindex, nofollow, including the ones the registry calls indexable", () => {
    for (const page of defaultPages) {
      const metadata = buildPageMetadata(page.route, {
        baseUrl: BASE_URL,
        isTestHost: true,
        locale: DEFAULT_LOCALE,
      });
      expect(metadata.robots, `${page.route} is indexable on a test host`).toEqual({
        index: false,
        follow: false,
      });
    }
  });

  it("still emits the canonical on the live base URL, never on the test host", () => {
    const metadata = buildPageMetadata("home", {
      baseUrl: BASE_URL,
      isTestHost: true,
      locale: DEFAULT_LOCALE,
    });
    expect(metadata.alternates?.canonical).toBe(`${BASE_URL}/`);
  });
});

/**
 * The `hreflang` surface, at whatever number of locales exists.
 *
 * These assertions are written over `LOCALES` rather than over the literal
 * `"en"`, so they say what the mechanism must do rather than what today's
 * output happens to be — and so the unit that adds a second edition inherits
 * a suite that already checks the thing that changes.
 *
 * The one assertion that *is* pinned to today is the count, and it is pinned
 * on purpose: a second locale appearing without anybody deciding to add one
 * is a failure, not a pass.
 */
describe("hreflang", () => {
  /**
   * Still pinned, now at two: the English default and the Estonian legal
   * edition the operator decided to publish on 2026-08-09. A third locale
   * appearing without anybody deciding to add one is a failure, not a pass.
   */
  it("has exactly the two decided locales registered, and the default is the English one", () => {
    expect([...LOCALES]).toEqual(["en", "et"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("names every publishing locale by its own language tag, plus x-default", () => {
    for (const page of defaultPages) {
      const links = alternateLinksFor(BASE_URL, page.route);
      const publishing = localesPublishing(page.route);
      expect(publishing.length).toBeGreaterThan(0);

      expect(Object.keys(links).toSorted()).toEqual(
        [...publishing.map((locale) => LOCALE_DEFINITIONS[locale].languageTag), "x-default"].toSorted(),
      );

      for (const locale of publishing) {
        expect(links[LOCALE_DEFINITIONS[locale].languageTag]).toBe(
          canonicalUrl(BASE_URL, locale, page.route),
        );
      }
    }
  });

  /**
   * The self-reference is the part a set of one is made of. A page that
   * emitted alternates for every locale *but itself* would be an incomplete
   * set at any n, and at n=1 it would be an empty map — indistinguishable
   * from never having computed one.
   */
  it("includes the page's own locale, so a set of one is still a complete set", () => {
    for (const locale of LOCALES) {
      for (const page of pagesIn(locale)) {
        const metadata = buildPageMetadata(page.route, {
          baseUrl: BASE_URL,
          isTestHost: false,
          locale,
        });
        const languages: Readonly<Record<string, unknown>> = metadata.alternates?.languages ?? {};
        const selfTag = LOCALE_DEFINITIONS[locale].languageTag;
        expect(languages[selfTag], `${page.route} in ${locale} does not name itself`).toBe(
          metadata.alternates?.canonical,
        );
      }
    }
  });

  it("points x-default at the default edition's URL", () => {
    for (const page of defaultPages) {
      expect(alternateLinksFor(BASE_URL, page.route)["x-default"]).toBe(
        canonicalUrl(BASE_URL, DEFAULT_LOCALE, page.route),
      );
    }
  });

  /**
   * An alternate is a promise that a URL exists. Advertising a locale that
   * does not publish the page would be a `hreflang` set pointing at 404s,
   * which is worse than no annotation at all.
   */
  it("advertises no locale that does not publish the page", () => {
    for (const page of defaultPages) {
      const links = alternateLinksFor(BASE_URL, page.route);
      for (const locale of LOCALES) {
        const tag = LOCALE_DEFINITIONS[locale].languageTag;
        const published = pagesIn(locale).some((candidate) => candidate.route === page.route);
        expect(Object.hasOwn(links, tag), `${page.route}: ${locale}`).toBe(published);
      }
    }
  });
});

describe("exactly one canonical per page per locale", () => {
  it("gives no two (locale, route) pairs the same canonical URL", () => {
    const seen = new Map<string, string>();

    for (const locale of LOCALES) {
      for (const page of pagesIn(locale)) {
        const url = canonicalUrl(BASE_URL, locale, page.route);
        const previous = seen.get(url);
        expect(previous, `${url} is the canonical of both ${previous ?? ""} and ${locale}/${page.route}`).toBeUndefined();
        seen.set(url, `${locale}/${page.route}`);
      }
    }
  });

  it("registers every route in the default edition, so nothing is unreachable without a prefix", () => {
    const routes = pagesIn(DEFAULT_LOCALE).map((page) => page.route).toSorted();
    expect(routes).toEqual(Object.keys(ROUTE_PATHS).toSorted());
  });

  it("keeps every other edition's registry a subset of the route table", () => {
    for (const locale of LOCALES) {
      for (const page of pagesIn(locale)) {
        expect(Object.hasOwn(ROUTE_PATHS, page.route), `${locale}: ${page.route}`).toBe(true);
      }
    }
    expect(Object.keys(pagesByLocale).toSorted()).toEqual([...LOCALES].toSorted());
  });
});
