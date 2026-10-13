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
import { pagesByLocale } from "../../content/index.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  PLAY_ONLINE_PATH,
  ROUTE_PATHS,
  type Locale,
  type RouteId,
} from "../../content/routes.js";
import { contentFor, finalRouteFor, type Page } from "../../content/schema.js";
import { resolveLocalizedRoute } from "../src/app/localized-routes.js";
import { NO_CONFIGURATION_VALUES } from "../src/lib/configuration-placeholders.js";
import { localizedHrefFor, localizedLinkFor, pagesIn } from "../src/lib/seo.js";
import { localizedPath, parseLocalizedPath, routeIdForPath } from "../src/lib/urls.js";
import { NotFoundContent } from "../src/app/not-found-content.js";
import { LanguageSelector } from "../src/components/LanguageSelector.js";
import { LegalPageContent } from "../src/components/pages/LegalPageContent.js";
import { SiteFooter } from "../src/components/SiteFooter.js";
import { SiteHeader } from "../src/components/SiteHeader.js";
import { HomepageMockup } from "../src/components/mockups/HomepageMockup.js";
import { LunarBaseMockup } from "../src/components/mockups/LunarBaseMockup.js";
import { SupportPageContent } from "../src/components/pages/SupportPageContent.js";
import { RulebookPageContent } from "../src/components/pages/RulebookPageContent.js";
import { BasketPageContent } from "../src/components/shop/BasketPageContent.js";
import { CheckoutPageContent } from "../src/components/shop/CheckoutPageContent.js";
import { CartProvider } from "../src/lib/cart-store.js";

const ROUTE_IDS = Object.keys(ROUTE_PATHS) as readonly RouteId[];

/**
 * The name of each edition's language, as literals. `LanguageSelector`
 * renders `LANGUAGE_SWITCHER_LABELS[edition]`; asserting against that
 * constant would let it be edited to anything with the suite green.
 */
const EXPECTED_SWITCHER_LABELS: Readonly<Record<Locale, string>> = {
  en: "English",
  de: "Deutsch",
  et: "Eesti",
  tlh: "tlhIngan Hol",
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

/**
 * The retired `about` route is replaced by `home`. An edition that publishes
 * its home page keeps the link there, at the address written here.
 */
const RETIRED_ABOUT_HREF: Readonly<Partial<Record<Locale, string>>> = { de: "/de", et: "/et", tlh: "/tlh" };

/** The label of each complete translated edition's language selector, as literals. */
const COMPLETE_EDITIONS = [
  { locale: "de", selectorLabel: "Sprache" },
  { locale: "et", selectorLabel: "Keel" },
  { locale: "tlh", selectorLabel: "Hol" },
] as const;

function renderedPage(locale: Locale, route: RouteId): string {
  const page = contentFor(legalPagesByLocale, locale).find(
    (candidate) => candidate.route === route,
  );
  if (page !== undefined) return renderToStaticMarkup(
    <LegalPageContent page={page} locale={locale} values={NO_CONFIGURATION_VALUES} />,
  );
  switch (route) {
    case "home": return renderToStaticMarkup(<HomepageMockup locale={locale} />);
    case "lunarBase": return renderToStaticMarkup(<LunarBaseMockup locale={locale} />);
    case "support": return renderToStaticMarkup(<SupportPageContent locale={locale} turnstileSiteKey={null} nonce={undefined} merchantContactAddress={null} />);
    case "rulebook": return renderToStaticMarkup(<RulebookPageContent locale={locale} />);
    case "cart": return renderToStaticMarkup(<CartProvider scenario={null} latencyMs={0}><BasketPageContent locale={locale} /></CartProvider>);
    case "checkout": return renderToStaticMarkup(<CartProvider scenario="filled" latencyMs={0}><CheckoutPageContent locale={locale} scenario="filled" latencyMs={0} turnstileSiteKey={null} nonce={undefined} /></CartProvider>);
    default: throw new Error(`No render fixture for ${locale}:${route}`);
  }
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
        const retired = routeId === "about" ? RETIRED_ABOUT_HREF[locale] : undefined;
        const expected = retired ?? (published.has(routeId)
          ? localizedPath(locale, ROUTE_PATHS[routeId])
          : ROUTE_PATHS[routeId]);
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

  /*
   * The annotation is about *crossing*, not about publication, and a retired
   * route is where those two stop coinciding: no edition publishes `/about`,
   * yet the default edition is the one that answers its redirect. So the
   * expectation is derived from which edition actually serves the link — the
   * requested one when it publishes the route, the default one otherwise —
   * and an annotation is required exactly when that differs from the locale
   * being asked. Keying it on `published` alone made `en:about` expect an
   * `hreflang="en"` on a link from an English page to an English URL.
   */
  it("annotates exactly the links that cross editions, with the target's tag", () => {
    for (const locale of LOCALES) {
      const published = new Set(pagesIn(locale).map((page) => page.route));

      for (const routeId of ROUTE_IDS) {
        const servedBy = published.has(routeId) || (routeId === "about" && RETIRED_ABOUT_HREF[locale] !== undefined)
          ? locale : DEFAULT_LOCALE;
        const { hrefLang } = localizedLinkFor(locale, routeId);
        expect(
          hrefLang,
          `${locale}:${routeId} ${servedBy === locale ? "stays home and needs no tag" : "crosses editions and must say so"}`,
        ).toBe(servedBy === locale ? undefined : LOCALE_DEFINITIONS[servedBy].languageTag);
      }
    }
  });

  /*
   * Every edition publishes every route now, so no real pair crosses. The
   * crossing branch is kept honest by withholding one page from each
   * translated edition in turn.
   */
  it("crosses to the default edition, and says so, for a route withheld from an edition", () => {
    const pages = pagesByLocale as Record<Locale, readonly Page[]>;
    for (const { locale } of COMPLETE_EDITIONS) {
      const published = pages[locale];
      expect(localizedLinkFor(locale, "lunarBase")).toEqual({ href: `/${locale}/games/lunar-base` });
      pages[locale] = published.filter((page) => page.route !== "lunarBase");
      try {
        expect(localizedLinkFor(locale, "lunarBase")).toEqual({ href: "/games/lunar-base", hrefLang: "en" });
      } finally {
        pages[locale] = published;
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
       *
       * A retired route answers too, with one 301 to the route that replaced
       * it, so the property is checked against `finalRouteFor` rather than
       * against the href's own route id. Checking the id itself would call a
       * working link broken; dropping the check for retired routes would stop
       * asking the question. The chain-free guarantee that makes one step
       * sufficient is asserted in `content/content.test.ts`.
       */
      it(`${locale}:${page.route} renders no href its target edition cannot serve`, () => {
        for (const { href } of internalAnchorsIn(renderedPage(locale, page.route))) {
          const parsed = parseLocalizedPath(href);
          const routeId = routeIdForPath(parsed.path);
          expect(routeId, `${href} is no declared route's URL`).toBeDefined();

          if (parsed.locale === DEFAULT_LOCALE) {
            const served = finalRouteFor(routeId!);
            expect(
              pagesIn(DEFAULT_LOCALE).some((candidate) => candidate.route === served),
              `${href} resolves to ${served}, which the default edition does not publish`,
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

describe("a complete translated edition keeps its navigation in its own edition", () => {
  for (const { locale, selectorLabel } of COMPLETE_EDITIONS) {
    const selector = new RegExp(`<nav[^>]*aria-label="${selectorLabel}"[^>]*>[\\s\\S]*?</nav>`, "g");

    it(`${locale} publishes every page the default edition does, and its selector carries the label set aside below`, () => {
      expect(pagesByLocale[locale].map((page) => page.route)).toEqual(
        pagesByLocale[DEFAULT_LOCALE].map((page) => page.route),
      );
      // Header and footer: a label that matched nothing would set nothing aside.
      expect(renderedPage(locale, "home").match(selector)).toHaveLength(2);
    });

    for (const page of pagesByLocale[locale]) {
      it(`${locale}:${page.route} has no cross-edition route link outside the selector`, () => {
        const anchors = internalAnchorsIn(renderedPage(locale, page.route).replace(selector, ""));
        expect(anchors.length).toBeGreaterThan(0);
        for (const { href } of anchors) {
          if (href.startsWith("/documents/")) continue;
          // The online game is not a route and has no edition; `tests/play-online.test.tsx` holds its link.
          if (href === PLAY_ONLINE_PATH) continue;
          const path = href.split("#", 1)[0] ?? href;
          const parsed = parseLocalizedPath(path);
          const routeId = routeIdForPath(parsed.path);
          expect(routeId, `${href} is not a declared route`).toBeDefined();
          expect(parsed.locale, `${page.route} links to ${href} outside ${locale}`).toBe(locale);
        }
      });
    }
  }
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
 * The selector itself: what it lists, where each entry leads, and that it is
 * markup and nothing else. The expectations are literals, or are built from
 * the page registry and `localizedPath`, never read back from the component.
 */
describe("the language selector", () => {
  const SELECTOR = /<nav[^>]*aria-label="(?:Language|Sprache|Keel|Hol)"[^>]*>[\s\S]*?<\/nav>/g;
  /** Every selector in `html`, in document order. */
  const selectorsIn = (html: string): readonly string[] => [...html.matchAll(SELECTOR)].map((match) => match[0]);
  /** The first `<header>` or `<footer>` element of `html`, whole. */
  const partOf = (html: string, part: "header" | "footer"): string =>
    new RegExp(`<${part}\\b[\\s\\S]*?</${part}>`).exec(html)?.[0] ?? "";
  /** Each entry of one selector: its label, and where it leads when it is a link. */
  const entriesOf = (selector: string): readonly { label: string; href?: string }[] =>
    [...selector.matchAll(/<(a|span)\b([^>]*)>([^<]*)<\/\1>/g)].map((match) => ({
      label: match[3] ?? "",
      href: /href="([^"]*)"/.exec(match[2] ?? "")?.[1],
    }));

  for (const part of ["header", "footer"] as const) {
    it(`/legal/imprint: the ${part} links Deutsch to the German imprint`, () => {
      const selectors = selectorsIn(partOf(renderedPage("en", "legalImprint"), part));
      expect(selectors).toHaveLength(1);
      expect(selectors[0]).toMatch(
        /<a[^>]* href="\/de\/legal\/imprint" lang="de" hrefLang="de">Deutsch<\/a>/,
      );
    });

    it(`/legal/imprint: the ${part} shows English as current and links Eesti to /et/legal/imprint`, () => {
      const selectors = selectorsIn(partOf(renderedPage("en", "legalImprint"), part));
      expect(selectors, `the ${part} must hold exactly one selector`).toHaveLength(1);
      const selector = selectors[0] ?? "";

      expect(selector).toMatch(/<span[^>]* lang="en" aria-current="true">English<\/span>/);
      expect(selector).toMatch(/<a[^>]* href="\/et\/legal\/imprint" lang="et" hrefLang="et">Eesti<\/a>/);
      expect(selector, "the current edition must not be a link").not.toMatch(/<a[^>]*>English/);
    });

    it(`/et/legal/imprint: the ${part} shows Eesti as current and links English to /legal/imprint`, () => {
      const selectors = selectorsIn(partOf(renderedPage("et", "legalImprint"), part));
      expect(selectors, `the ${part} must hold exactly one selector`).toHaveLength(1);
      const selector = selectors[0] ?? "";

      expect(selector).toMatch(/<span[^>]* lang="et" aria-current="true">Eesti<\/span>/);
      expect(selector).toMatch(/<a[^>]* href="\/legal\/imprint" lang="en" hrefLang="en">English<\/a>/);
      expect(selector, "the current edition must not be a link").not.toMatch(/<a[^>]*>Eesti/);
    });

    it(`/legal/imprint: the ${part} offers tlhIngan Hol with its language tag`, () => {
      const selectors = selectorsIn(partOf(renderedPage("en", "legalImprint"), part));
      expect(selectors).toHaveLength(1);
      expect(selectors[0]).toMatch(
        /<a[^>]* href="\/tlh\/legal\/imprint" lang="tlh" hrefLang="tlh">tlhIngan Hol<\/a>/,
      );
    });
  }

  it("/games/lunar-base: offers all translated product pages, in the header and in the footer", () => {
    for (const html of [
      renderToStaticMarkup(<SiteHeader wordmark="dark" route="lunarBase" />),
      renderToStaticMarkup(<SiteFooter route="lunarBase" />),
    ]) {
      const selectors = selectorsIn(html);
      expect(selectors).toHaveLength(1);
      expect(entriesOf(selectors[0] ?? "")).toEqual([
        { label: "English", href: undefined },
        { label: "Deutsch", href: "/de/games/lunar-base" },
        { label: "Eesti", href: "/et/games/lunar-base" },
        { label: "tlhIngan Hol", href: "/tlh/games/lunar-base" },
      ]);
    }
  });

  /* An edition that lacks the route is not offered on that page. */
  it("/games/lunar-base: offers no Estonian entry while the edition does not publish the page", () => {
    const pages = pagesByLocale as Record<Locale, readonly Page[]>;
    const published = pages.et;
    pages.et = published.filter((page) => page.route !== "lunarBase");
    try {
      for (const html of [
        renderToStaticMarkup(<SiteHeader wordmark="dark" route="lunarBase" />),
        renderToStaticMarkup(<SiteFooter route="lunarBase" />),
      ]) {
        const selectors = selectorsIn(html);
        expect(selectors).toHaveLength(1);
        expect(entriesOf(selectors[0] ?? "")).toEqual([
          { label: "English", href: undefined },
          { label: "Deutsch", href: "/de/games/lunar-base" },
          { label: "tlhIngan Hol", href: "/tlh/games/lunar-base" },
        ]);
        expect(html).not.toContain("/et/games/lunar-base");
      }
    } finally {
      pages.et = published;
    }
  });

  it("lists the edition being read and each other edition that publishes the route, at its own URL", () => {
    let links = 0;

    for (const locale of LOCALES) {
      for (const page of pagesIn(locale)) {
        const expected = LOCALES.filter(
          (edition) => edition === locale || pagesIn(edition).some((other) => other.route === page.route),
        ).map((edition) => ({
          label: EXPECTED_SWITCHER_LABELS[edition],
          href: edition === locale ? undefined : localizedPath(edition, ROUTE_PATHS[page.route]),
        }));
        links += expected.length - 1;

        expect(
          entriesOf(renderToStaticMarkup(<LanguageSelector locale={locale} route={page.route} />)),
          `${locale}:${page.route}`,
        ).toEqual(expected);
      }
    }

    expect(links, "no page offered another edition, so no link was checked").toBeGreaterThan(0);
  });

  it("on the 404, which is no route, links each edition's home page", async () => {
    expect(entriesOf(renderToStaticMarkup(<LanguageSelector locale="en" />))).toEqual([
      { label: "English", href: undefined },
      { label: "Deutsch", href: "/de" },
      { label: "Eesti", href: "/et" },
      { label: "tlhIngan Hol", href: "/tlh" },
    ]);
    expect(entriesOf(renderToStaticMarkup(<LanguageSelector locale="et" />))).toEqual([
      { label: "English", href: "/" },
      { label: "Deutsch", href: "/de" },
      { label: "Eesti", href: undefined },
      { label: "tlhIngan Hol", href: "/tlh" },
    ]);

    const missing = selectorsIn(renderToStaticMarkup(await NotFoundContent({ locale: "et" })));
    expect(missing, "the 404 page must hold the selector").toHaveLength(1);
    expect(entriesOf(missing[0] ?? "")).toEqual([
      { label: "English", href: "/" },
      { label: "Deutsch", href: "/de" },
      { label: "Eesti", href: undefined },
      { label: "tlhIngan Hol", href: "/tlh" },
    ]);
  });

  it("is plain markup: no script, form, select, button or event handler", () => {
    for (const locale of LOCALES) {
      for (const route of [undefined, ...ROUTE_IDS]) {
        const html = renderToStaticMarkup(<LanguageSelector locale={locale} route={route} />);
        expect(html, `${locale}:${route ?? "404"}`).toMatch(/^<nav[^>]*>.*<\/nav>$/s);
        expect(html, `${locale}:${route ?? "404"}`).not.toMatch(/<(?:script|form|select|button|input)\b|\son\w+=/i);
      }
    }
  });
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
  de: {
    header: [
      ">Über uns<",
      ">Hilfe<",
      ">Menü<",
      ">Warenkorb<",
      'aria-label="Hauptnavigation"',
      'aria-label="Plepic Games, Startseite"',
    ],
    footer: [
      'aria-label="Rechtliche Informationen"',
      'aria-label="Sprache"',
      ">Impressum<",
      ">Verkaufsbedingungen<",
      ">Versand und Lieferung<",
      ">Rücksendungen und Widerrufsrecht<",
      ">Datenschutz<",
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
  tlh: {
    header: [
      ">De&#x27;maj<", ">QaH<", ">wIvmeH tetlh<", ">je&#x27;meH ngaSwI&#x27;<",
      'aria-label="wIvmeH rarwI&#x27;mey"', 'aria-label="Plepic Games, tenwal wa&#x27;DIch"',
    ],
    footer: [
      'aria-label="chut De&#x27;"', 'aria-label="Hol"',
      ">chut QIn<", ">ngevmeH chutmey<", ">ngeHmeH mIw, HIjmeH mIw je<",
      ">tep tatlhmeH mIw, je&#x27;Ha&#x27;meH DIb je<", ">De&#x27; QanmeH mIw<",
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
