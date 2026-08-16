import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { pagesByLocale } from "../../content/index.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
} from "../../content/routes.js";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATHS,
  OG_IMAGE_WIDTH,
  alternateLinksFor,
  buildPageMetadata,
  localesPublishing,
  pagesIn,
} from "../src/lib/seo.js";
import { canonicalUrl } from "../src/lib/urls.js";

const BASE_URL = "https://example.com";
const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));

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

/**
 * The share card, which had no test because it had no implementation.
 *
 * Both PNGs sat in `public/og/` from the redesign onwards, referenced by
 * nothing: every page emitted `og:title`, `og:description`, `og:url` and a
 * `summary` Twitter card with no image at all, and every existing SEO test
 * passed, because none of them asked. That is the shape of defect this row
 * exists to find — the surface is not wrong, it is absent.
 */
describe("the Open Graph share card", () => {
  /**
   * Every edition, not only the default one. The card is chosen by route and
   * its URL is built from the configured base URL, so nothing in the mapping
   * is locale-dependent — but "locale-independent by construction" is an
   * argument rather than an assertion, and the previous revision of this test
   * walked `en` alone, which left every `/et/…` legal page unchecked.
   */
  it("gives every route each edition publishes an image, sized as Open Graph expects", () => {
    let checked = 0;

    for (const locale of LOCALES) {
      for (const page of pagesIn(locale)) {
        const metadata = buildPageMetadata(page.route, {
          baseUrl: BASE_URL,
          isTestHost: false,
          locale,
        });

        const images = metadata.openGraph?.images;
        const where = `${locale} ${page.route}`;
        expect(Array.isArray(images) ? images : [], where).toHaveLength(1);
        expect(Array.isArray(images) ? images[0] : undefined, where).toEqual({
          url: `${BASE_URL}${OG_IMAGE_PATHS[page.route]}`,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: page.title,
        });
        checked += 1;
      }
    }

    // Not vacuous, and specifically: more than the default edition alone, so
    // a registry change that stopped publishing the second edition is visible
    // here rather than silently shrinking the loop to what it used to be.
    expect(checked, "walked no pages at all").toBeGreaterThan(defaultPages.length);
  });

  it("builds the image URL absolutely, from the deployment's configured base URL", () => {
    const other = buildPageMetadata("home", {
      baseUrl: "https://other.example.org",
      isTestHost: false,
      locale: DEFAULT_LOCALE,
    });
    const images = other.openGraph?.images;
    const first = Array.isArray(images) ? images[0] : undefined;
    const url = typeof first === "object" && first !== null && "url" in first ? String(first.url) : "";

    expect(url).toBe("https://other.example.org/og/publisher-og.png");
    expect(() => new URL(url)).not.toThrow();
  });

  it("declares a large card, since a 1.91:1 asset on a summary card is cropped square", () => {
    const metadata = buildPageMetadata("home", {
      baseUrl: BASE_URL,
      isTestHost: false,
      locale: DEFAULT_LOCALE,
    });
    // `Metadata["twitter"]` is a union whose members each declare `card`, but
    // the union itself does not, so read it as a record rather than widening
    // the production type to suit a test.
    const twitter = metadata.twitter as Record<string, unknown> | null | undefined;
    expect(twitter?.card).toBe("summary_large_image");
    expect(twitter?.images).toEqual(metadata.openGraph?.images);
  });

  it("gives the three Lunar Base routes the product card and everything else the publisher card", () => {
    expect(OG_IMAGE_PATHS.lunarBase).toBe("/og/lunar-base-og.png");
    expect(OG_IMAGE_PATHS.support).toBe("/og/lunar-base-og.png");
    expect(OG_IMAGE_PATHS.rulebook).toBe("/og/lunar-base-og.png");
    expect(OG_IMAGE_PATHS.home).toBe("/og/publisher-og.png");
    expect(OG_IMAGE_PATHS.about).toBe("/og/publisher-og.png");
  });

  /**
   * The map is total over `RouteId` at the type level; this is the runtime
   * half — that every route the table declares is a key, and that no key names
   * a file the repository does not actually ship.
   */
  it("names, for every route, a file that exists at the declared Open Graph size", () => {
    expect(Object.keys(OG_IMAGE_PATHS).toSorted()).toEqual(Object.keys(ROUTE_PATHS).toSorted());

    for (const [route, imagePath] of Object.entries(OG_IMAGE_PATHS)) {
      const file = join(storefrontDir, "public", imagePath);
      expect(existsSync(file), `${route} names a missing file: ${imagePath}`).toBe(true);

      // PNG IHDR: an 8-byte signature, then a length and the "IHDR" tag, then
      // width and height as big-endian 32-bit integers.
      const header = readFileSync(file).subarray(0, 24);
      expect(header.subarray(12, 16).toString("ascii"), imagePath).toBe("IHDR");
      expect(header.readUInt32BE(16), `${imagePath} width`).toBe(OG_IMAGE_WIDTH);
      expect(header.readUInt32BE(20), `${imagePath} height`).toBe(OG_IMAGE_HEIGHT);
    }
  });
});
