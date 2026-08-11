/**
 * A rendered page in edition X links within edition X — and the function
 * that decides where a link goes is verified against data, not against
 * itself.
 *
 * ## The two-pass history this file carries
 *
 * Pass 1 of this unit's review found the Estonian edition was a one-way
 * door: every anchor on `/et/legal/*` pointed at the unprefixed English URL,
 * and nothing anywhere linked into `/et`. The first fix made the chrome
 * build every link through `localizedHrefFor` and asserted every rendered
 * anchor equals that function's answer. Pass 2 found the tautology in that:
 * the chrome builds its anchors *by calling the same function*, so the
 * assertion proved the wiring and nothing about the function — deleting its
 * fallback branch turned every chrome link on every `/et` page into a 404
 * with the whole suite green.
 *
 * So the guard is now two independent halves, neither of which can be
 * satisfied by the producer agreeing with itself:
 *
 * 1. **The function, against a table.** `localizedLinkFor` is asserted over
 *    every `(locale, route)` pair against an expectation built from the page
 *    registry and `localizedPath` directly, with both branches named and
 *    both proved non-empty.
 * 2. **The render, against the router.** Every href a page actually renders
 *    must resolve to a route the *target* edition publishes and can serve —
 *    `resolveLocalizedRoute` non-null for a prefixed URL, registry
 *    membership for an unprefixed one. That is the property a reader cares
 *    about (the link answers 200), and no comparison against the producer
 *    can give it.
 *
 * Plus the reachability properties from pass 1, which stand: the non-default
 * edition can be walked without leaving it, and every page it publishes has
 * an inbound language-switcher link from its default-edition counterpart.
 * The switcher labels and the Estonian chrome labels are pinned as
 * **literals** here, not read from `chrome-strings.ts` — a pin that imports
 * its expectation from the code under test is the same tautology at lower
 * stakes (pass 2's Minors 1 and 3).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { legalPagesByLocale } from "../../content/legal/index.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
  type Locale,
  type RouteId,
} from "../../content/routes.js";
import { contentFor } from "../../content/schema.js";
import { resolveLocalizedRoute } from "../src/app/localized-routes.js";
import { NO_CONFIGURATION_VALUES } from "../src/lib/configuration-placeholders.js";
import { localizedHrefFor, localizedLinkFor, pagesIn } from "../src/lib/seo.js";
import { localizedPath, parseLocalizedPath, routeIdForPath } from "../src/lib/urls.js";
import { LegalPageContent } from "../src/components/pages/LegalPageContent.js";

const ROUTE_IDS = Object.keys(ROUTE_PATHS) as readonly RouteId[];

/**
 * The switcher labels, as literals. `SiteFooter` renders
 * `LANGUAGE_SWITCHER_LABELS[target]`; asserting against that constant would
 * let it be edited to anything with the suite green.
 */
const EXPECTED_SWITCHER_LABELS: Readonly<Record<Locale, string>> = {
  en: "In English",
  et: "Eesti keeles",
};

/** Every anchor tag in `html` that points into this site, with its href. */
function internalAnchorsIn(html: string): readonly { tag: string; href: string }[] {
  return [...html.matchAll(/<a\s[^>]*>/g)]
    .map((match) => ({
      tag: match[0],
      href: /href="([^"]+)"/.exec(match[0])?.[1] ?? "",
    }))
    .filter((anchor) => anchor.href.startsWith("/"));
}

function renderedPage(locale: Locale, route: string): string {
  const page = contentFor(legalPagesByLocale, locale).find(
    (candidate) => candidate.route === route,
  );
  expect(page, `${locale} does not carry ${route}`).toBeDefined();
  return renderToStaticMarkup(
    <LegalPageContent page={page!} locale={locale} values={NO_CONFIGURATION_VALUES} />,
  );
}

describe("localizedLinkFor answers from the registries, not from itself", () => {
  /**
   * The expectation is built without calling the function under test: the
   * page registry says whether the edition publishes the route, and the two
   * branch outcomes are written with `localizedPath` and bare `ROUTE_PATHS`.
   * Both branches are proved non-empty so neither can rot into vacuity.
   */
  it("matches the expectation table over every (locale, route) pair, both branches", () => {
    let ownEdition = 0;
    let fallback = 0;

    for (const locale of LOCALES) {
      const published = new Set(pagesIn(locale).map((page) => page.route));

      for (const routeId of ROUTE_IDS) {
        const expected = published.has(routeId)
          ? localizedPath(locale, ROUTE_PATHS[routeId])
          : ROUTE_PATHS[routeId];
        if (published.has(routeId)) ownEdition += 1;
        else fallback += 1;

        expect(
          localizedHrefFor(locale, routeId),
          `${locale}:${routeId} must link ${expected}`,
        ).toBe(expected);
      }
    }

    expect(ownEdition, "no pair exercised the own-edition branch").toBeGreaterThan(0);
    expect(fallback, "no pair exercised the fallback branch").toBeGreaterThan(0);
  });

  it("annotates exactly the links that cross editions, with the target's tag", () => {
    for (const locale of LOCALES) {
      const published = new Set(pagesIn(locale).map((page) => page.route));

      for (const routeId of ROUTE_IDS) {
        const { hrefLang } = localizedLinkFor(locale, routeId);
        expect(
          hrefLang,
          `${locale}:${routeId} ${published.has(routeId) ? "stays home and needs no tag" : "crosses editions and must say so"}`,
        ).toBe(
          published.has(routeId)
            ? undefined
            : LOCALE_DEFINITIONS[DEFAULT_LOCALE].languageTag,
        );
      }
    }
  });
});

describe("every edition's pages link within the edition", () => {
  for (const locale of LOCALES) {
    for (const page of contentFor(legalPagesByLocale, locale)) {
      it(`${locale}:${page.route} renders no anchor that leaves the rule`, () => {
        const anchors = internalAnchorsIn(renderedPage(locale, page.route));
        // The guard must not pass by finding nothing to check.
        expect(anchors.length, "the page rendered no internal links at all").toBeGreaterThan(5);

        for (const { href } of anchors) {
          const parsed = parseLocalizedPath(href);
          const routeId = routeIdForPath(parsed.path);
          expect(routeId, `${href} is not a declared route's URL in any locale`).toBeDefined();

          /*
           * The one legitimate cross-edition link is the language switcher,
           * which points at another edition's URL *for this same route*.
           * Everything else must be exactly the link rule's answer — the
           * wiring half of the guard; the rule itself is proved above.
           */
          if (routeId === page.route && parsed.locale !== locale) continue;

          expect(
            href,
            `${locale}:${page.route} links ${routeId ?? "?"} outside its own edition`,
          ).toBe(localizedHrefFor(locale, routeId!));
        }
      });

      /**
       * The reader's property: the link answers, whatever built it. Every
       * href must resolve to a page its target edition publishes and can
       * serve — asked of the router, which is the thing that will actually
       * answer the request, not of the function that produced the href.
       */
      it(`${locale}:${page.route} renders no href its target edition cannot serve`, () => {
        for (const { href } of internalAnchorsIn(renderedPage(locale, page.route))) {
          const parsed = parseLocalizedPath(href);
          const routeId = routeIdForPath(parsed.path);
          expect(routeId, `${href} is no declared route's URL`).toBeDefined();

          if (parsed.locale === DEFAULT_LOCALE) {
            expect(
              pagesIn(DEFAULT_LOCALE).some((candidate) => candidate.route === routeId),
              `${href} names a route the default edition does not publish`,
            ).toBe(true);
          } else {
            const prefix = LOCALE_DEFINITIONS[parsed.locale].pathPrefix.slice(1);
            const segments = parsed.path.split("/").filter((segment) => segment !== "");
            expect(
              resolveLocalizedRoute(prefix, segments),
              `${href} would 404: ${parsed.locale} cannot serve ${parsed.path}`,
            ).not.toBeNull();
          }
        }
      });

      /**
       * Pass 2's Minor 4: an Estonian label pointing at an English document
       * must say so, exactly as the switcher beneath it does. Every rendered
       * anchor whose target lies in another edition carries `hreflang` with
       * the target's tag; every same-edition anchor carries none.
       */
      it(`${locale}:${page.route} annotates every cross-edition anchor with hreflang`, () => {
        for (const { tag, href } of internalAnchorsIn(renderedPage(locale, page.route))) {
          const parsed = parseLocalizedPath(href);
          if (parsed.locale === locale) {
            expect(tag, `${href} stays in its edition yet claims a language`).not.toContain(
              "hrefLang=",
            );
          } else {
            expect(tag, `${href} crosses editions and does not say so`).toContain(
              `hrefLang="${LOCALE_DEFINITIONS[parsed.locale].languageTag}"`,
            );
          }
        }
      });
    }
  }

  it("lets a reader walk the whole non-default edition without leaving it", () => {
    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      const edition = contentFor(legalPagesByLocale, locale);

      for (const page of edition) {
        const hrefs = new Set(
          internalAnchorsIn(renderedPage(locale, page.route)).map((anchor) => anchor.href),
        );
        for (const other of edition) {
          expect(
            hrefs.has(localizedPath(locale, ROUTE_PATHS[other.route])),
            `${locale}:${page.route} has no way to reach ${locale}:${other.route}`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("every non-default edition has inbound links, via the language switcher", () => {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const tag = LOCALE_DEFINITIONS[locale].languageTag;

    for (const page of contentFor(legalPagesByLocale, locale)) {
      const localizedHref = localizedPath(locale, ROUTE_PATHS[page.route]);

      it(`${DEFAULT_LOCALE}:${page.route} links to ${localizedHref}, labelled in the target's language`, () => {
        const html = renderedPage(DEFAULT_LOCALE, page.route);
        const anchor = new RegExp(
          `<a[^>]*href="${localizedHref}"[^>]*>${EXPECTED_SWITCHER_LABELS[locale]}</a>`,
        );
        expect(html, "the default edition never links into the translation").toMatch(anchor);
        expect(html).toContain(`hrefLang="${tag}"`);
        expect(html).toMatch(new RegExp(`<a[^>]*href="${localizedHref}"[^>]* lang="${tag}"`));
      });

      it(`${locale}:${page.route} links back to the default edition the same way`, () => {
        const html = renderedPage(locale, page.route);
        const defaultHref = localizedPath(DEFAULT_LOCALE, ROUTE_PATHS[page.route]);
        const anchor = new RegExp(
          `<a[^>]*href="${defaultHref}"[^>]*>${EXPECTED_SWITCHER_LABELS[DEFAULT_LOCALE]}</a>`,
        );
        expect(html, "the translation has no way back").toMatch(anchor);
      });
    }
  }
});

/**
 * Pass 2's Minor 1, the chrome half: `CHROME_STRINGS.et` could be reverted
 * to the English values wholesale with the suite green, because every
 * assertion that touched it read its expectation from the same table. These
 * are literals, so they pin what the reader of an Estonian page actually
 * meets. The failure-mode strings — the gap marker, the notice, the draft
 * note — are pinned the same way in `legal-pages.test.tsx`, where the
 * unconfigured state is rendered.
 */
/**
 * Total over `Locale`, and that is the point — review pass 3's Minor B.
 *
 * The first version of this pin was written for `"et"` by name. It closed the
 * finding for the edition that existed and gave a **third** edition no pressure
 * at all: `CHROME_STRINGS` is a total `Record<Locale, …>`, so a new locale must
 * supply the *keys* to compile, but nothing would demand the *values* be in
 * that language — and the third edition would ship in exactly the state pass 2
 * filed against the second.
 *
 * Written as a table, adding a locale is a compile error until someone types
 * that edition's chrome out as literals. The `en` column is pinned too: a
 * literal table with a hole where the default edition should be is the same
 * mistake one column over.
 */
const EXPECTED_CHROME: Readonly<
  Record<Locale, { readonly header: readonly string[]; readonly footer: readonly string[] }>
> = {
  en: {
    header: [
      ">About<",
      ">Support<",
      ">Menu<",
      ">Basket<",
      'aria-label="Primary"',
      'aria-label="Plepic Games, home"',
    ],
    footer: [
      'aria-label="Legal"',
      'aria-label="Language"',
      ">Imprint<",
      ">Terms<",
      ">Shipping<",
      ">Returns<",
      ">Privacy<",
    ],
  },
  et: {
    header: [
      ">Meist<",
      ">Klienditugi<",
      ">Menüü<",
      ">Ostukorv<",
      'aria-label="Peamenüü"',
      'aria-label="Plepic Games, avaleht"',
    ],
    footer: [
      'aria-label="Juriidiline teave"',
      'aria-label="Keel"',
      ">Õigusteave<",
      ">Müügitingimused<",
      ">Saatmine<",
      ">Tagastamine<",
      ">Privaatsus<",
    ],
  },
};

describe("each edition's chrome is in its own language", () => {
  for (const locale of LOCALES) {
    const html = renderedPage(locale, "legalReturns");
    const expected = EXPECTED_CHROME[locale];

    it(`${locale}: labels the header in its own language`, () => {
      for (const label of expected.header) {
        expect(html, `the ${locale} header does not carry ${label}`).toContain(label);
      }
    });

    it(`${locale}: labels the footer's legal navigation in its own language`, () => {
      for (const label of expected.footer) {
        expect(html, `the ${locale} footer does not carry ${label}`).toContain(label);
      }
    });
  }
});
