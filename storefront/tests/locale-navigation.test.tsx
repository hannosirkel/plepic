/**
 * A rendered page in edition X links within edition X — the guard Major 1 of
 * this unit's code review found missing, and the reason the finding was a
 * Major rather than a nit.
 *
 * The Estonian edition exists to discharge a Language Act § 16 exposure by
 * giving an Estonian consumer the consumer-facing terms in Estonian. As
 * first registered it was a one-way door: every anchor on `/et/legal/*`
 * pointed at the unprefixed English URL, and no page anywhere linked into
 * `/et` — the edition was reachable only from a search result or a typed
 * URL, and the first click took the reader back out. A consumer who cannot
 * navigate to their terms is not served by their existence.
 *
 * Three properties, each of which failed before the fix:
 *
 * 1. **Containment** — every internal anchor a page renders obeys
 *    `localizedHrefFor`'s rule: the rendering edition's own URL wherever
 *    that edition publishes the target, the default edition's URL where it
 *    does not, never a third thing. This is asserted against every anchor,
 *    not a cherry-picked list, so a new chrome link is born covered.
 * 2. **Edition-internal navigation** — an Estonian legal page links to every
 *    other Estonian legal page, so the edition can be walked without leaving
 *    it.
 * 3. **Inbound links** — every page a non-default edition publishes is
 *    linked from its default-edition counterpart, via the language switcher,
 *    labelled in the target's own language and carrying `lang`/`hreflang`
 *    for it. The switcher on the non-default page links back the same way.
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
} from "../../content/routes.js";
import { contentFor } from "../../content/schema.js";
import { LANGUAGE_SWITCHER_LABELS } from "../src/lib/chrome-strings.js";
import { NO_CONFIGURATION_VALUES } from "../src/lib/configuration-placeholders.js";
import { localizedHrefFor, pagesIn } from "../src/lib/seo.js";
import { localizedPath, parseLocalizedPath, routeIdForPath } from "../src/lib/urls.js";
import { LegalPageContent } from "../src/components/pages/LegalPageContent.js";

/** Every `href` in `html` that points into this site. */
function internalHrefsIn(html: string): readonly string[] {
  return [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((href) => href.startsWith("/"));
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

describe("every edition's pages link within the edition", () => {
  for (const locale of LOCALES) {
    for (const page of contentFor(legalPagesByLocale, locale)) {
      it(`${locale}:${page.route} renders no anchor that leaves the rule`, () => {
        const hrefs = internalHrefsIn(renderedPage(locale, page.route));
        // The guard must not pass by finding nothing to check.
        expect(hrefs.length, "the page rendered no internal links at all").toBeGreaterThan(5);

        for (const href of hrefs) {
          const parsed = parseLocalizedPath(href);
          const routeId = routeIdForPath(parsed.path);
          expect(routeId, `${href} is not a declared route's URL in any locale`).toBeDefined();

          /*
           * The one legitimate cross-edition link is the language switcher,
           * which points at another edition's URL *for this same route*.
           * Everything else must be exactly `localizedHrefFor`'s answer.
           */
          if (routeId === page.route && parsed.locale !== locale) {
            const publishes = pagesIn(parsed.locale).some(
              (candidate) => candidate.route === routeId,
            );
            expect(publishes, `${href} advertises an edition that cannot serve it`).toBe(true);
            continue;
          }

          expect(
            href,
            `${locale}:${page.route} links ${routeId ?? "?"} outside its own edition`,
          ).toBe(localizedHrefFor(locale, routeId!));
        }
      });
    }
  }

  it("lets a reader walk the whole non-default edition without leaving it", () => {
    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      const edition = contentFor(legalPagesByLocale, locale);

      for (const page of edition) {
        const hrefs = new Set(internalHrefsIn(renderedPage(locale, page.route)));
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
          `<a[^>]*href="${localizedHref}"[^>]*>${LANGUAGE_SWITCHER_LABELS[locale]}</a>`,
        );
        expect(html, "the default edition never links into the translation").toMatch(anchor);
        expect(html).toContain(`hrefLang="${tag}"`);
        expect(html).toMatch(new RegExp(`<a[^>]*href="${localizedHref}"[^>]* lang="${tag}"`));
      });

      it(`${locale}:${page.route} links back to the default edition the same way`, () => {
        const html = renderedPage(locale, page.route);
        const defaultHref = localizedPath(DEFAULT_LOCALE, ROUTE_PATHS[page.route]);
        const anchor = new RegExp(
          `<a[^>]*href="${defaultHref}"[^>]*>${LANGUAGE_SWITCHER_LABELS[DEFAULT_LOCALE]}</a>`,
        );
        expect(html, "the translation has no way back").toMatch(anchor);
      });
    }
  }
});
