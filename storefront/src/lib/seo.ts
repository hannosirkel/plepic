/**
 * Per-page SEO metadata, built from the same locale-keyed page registry the
 * sitemap and the router read — `pagesByLocale` in `content/index.ts`. Title
 * and description are guaranteed unique within a locale there already
 * (`content/content.test.ts` asserts it), so this module's job is to turn one
 * `Page` in one locale into a `Metadata` object: a self-referencing canonical,
 * the `hreflang` alternates, and Open Graph / Twitter card fields.
 *
 * ## The share card image
 *
 * Two real assets, both 1200x630, both committed by the accepted redesign and
 * — until this unit — referenced by nothing at all: `public/og/publisher-og.png`
 * is the Plepic wordmark on the publisher ground, and `public/og/lunar-base-og.png`
 * is the photographed retail box, cards and tokens on the Lunar Base ground.
 * Neither is fabricated imagery; both are the same assets the pages already
 * paint from, so attaching them breaks no rule this module was written under.
 * The earlier revision's note that "no real photography has landed in this
 * unit" was true when it was written and stopped being true when the redesign
 * merged, which is exactly how a page ends up shipping with no share card and
 * nothing failing.
 *
 * {@link OG_IMAGE_PATHS} maps each route to whichever of the two it belongs
 * to: the three Lunar Base routes get the product card, everything else gets
 * the publisher card. The URL is built from the request's `baseUrl`, so it is
 * absolute — required, since a crawler resolves `og:image` against nothing —
 * without any host being baked into the artifact.
 *
 * The card is `summary_large_image` accordingly. Declaring `summary` while
 * supplying a 1.91:1 asset would crop it to a square thumbnail.
 *
 * `isTestHost` is part of the input rather than a property of the route,
 * because indexability is a property of *this request*: `proxy.ts` sends
 * `X-Robots-Tag: noindex, nofollow` on a test hostname, and a page that
 * simultaneously emitted `<meta name="robots" content="index, follow">` would
 * be arguing with its own header. A test host is never indexable, whatever
 * the page registry says.
 *
 * ## `hreflang` with exactly one locale, and why it is emitted anyway
 *
 * There is one locale. The temptation is to emit no `rel="alternate"` links
 * at all, on the grounds that a set of one has nothing to point at, and the
 * annotations would be a no-op for a crawler. They are emitted regardless,
 * and the reasoning is worth stating because the opposite decision is
 * indistinguishable from having forgotten:
 *
 * - **A one-page set is a valid set, and it is self-referential.** The
 *   `hreflang` protocol requires every page in a set to name every page in
 *   the set *including itself*. `<link rel="alternate" hreflang="en" href="…">`
 *   pointing at this page's own canonical is exactly what a correct set of one
 *   looks like. It is not a placeholder for the real thing; it *is* the real
 *   thing, at n=1.
 * - **`x-default` is not a no-op even at n=1.** It says which URL serves a
 *   reader whose language matches no edition — a statement about this site
 *   that is true and useful today, and that a second locale does not change.
 * - **Absence is the failure mode this unit exists to avoid.** "No alternates
 *   because there is one locale" and "no alternates because nothing computes
 *   them" produce identical HTML. Emitting them means the mechanism is
 *   exercised on every page, on every build, by the tests that already run —
 *   so the unit that adds a second locale adds a key to a registry and reads
 *   the result, rather than discovering on the day that the emitter was never
 *   written.
 *
 * The annotations are computed from which locales actually **publish** the
 * route, never from `LOCALES` wholesale: an edition that does not carry a page
 * must not be advertised as an alternative to it.
 */

import type { Metadata } from "next";

import { pagesByLocale } from "../../../content/index.js";
import { contentFor, type Page } from "../../../content/schema.js";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
  type Locale,
  type RouteId,
} from "../../../content/routes.js";
import { absoluteUrl, canonicalUrl, localizedPath } from "./urls.js";

/** The pages `locale` publishes. Total over `Locale` by construction. */
export function pagesIn(locale: Locale): readonly Page[] {
  return contentFor(pagesByLocale, locale);
}

/** The page `locale` publishes for `routeId`, or `undefined` when it publishes none. */
export function lookupPage(routeId: RouteId, locale: Locale): Page | undefined {
  return pagesIn(locale).find((candidate) => candidate.route === routeId);
}

/**
 * The page `locale` publishes for `routeId`.
 *
 * Throws rather than returning a fallback in another language: a page missing
 * from an edition is a routing decision (404), never a silent substitution.
 * The router calls {@link lookupPage} and 404s; everything that has already
 * established the page exists calls this.
 */
export function findPage(routeId: RouteId, locale: Locale = DEFAULT_LOCALE): Page {
  const page = lookupPage(routeId, locale);
  if (page === undefined) {
    throw new Error(`no page registered for route ${routeId} in locale ${locale}`);
  }
  return page;
}

/** Every locale that publishes `routeId`, in `LOCALES` order. */
export function localesPublishing(routeId: RouteId): readonly Locale[] {
  return LOCALES.filter((locale) => lookupPage(routeId, locale) !== undefined);
}

export interface LocalizedLink {
  /** The path the anchor points at. */
  readonly href: string;
  /**
   * The linked document's language tag -- set exactly when the link had to
   * cross into another edition, `undefined` when it stays in its own. The
   * chrome puts it on the anchor as `hreflang`, the same annotation the
   * language switcher carries, so an Estonian label pointing at an English
   * document says so instead of discarding what this function knew.
   */
  readonly hrefLang?: string;
}

/**
 * The link a page served in `locale` renders for `routeId`.
 *
 * The rule, and the reason it lives beside the page registry rather than in
 * `urls.ts` (which deliberately knows no pages): **a link stays inside its
 * own edition wherever its edition can serve it, and crosses into the
 * default edition only where it cannot.** Before this existed, every anchor
 * on `/et/legal/returns` pointed at the unprefixed English URL -- the footer
 * of the Estonian edition was a set of five exits -- because the chrome built
 * links from bare `ROUTE_PATHS`. Linking a route the edition does *not*
 * publish at the edition's own prefix would be worse: a nav link that 404s.
 *
 * **How this is verified, stated precisely** -- the first revision claimed
 * "every rendered anchor is held to this function's answer", which was true
 * of the wiring and vacuous about the function, since the chrome builds its
 * anchors by calling it. `tests/locale-navigation.test.tsx` now asserts two
 * independent things instead: this function's answer over every
 * `(locale, route)` pair against a table that names both branches without
 * calling it, and that every href a page actually renders resolves to a
 * route the target edition publishes and can serve.
 */
export function localizedLinkFor(locale: Locale, routeId: RouteId): LocalizedLink {
  const target = lookupPage(routeId, locale) !== undefined ? locale : DEFAULT_LOCALE;
  return {
    href: localizedPath(target, ROUTE_PATHS[routeId]),
    hrefLang: target === locale ? undefined : LOCALE_DEFINITIONS[target].languageTag,
  };
}

/** {@link localizedLinkFor}'s path alone, for callers that need no annotation. */
export function localizedHrefFor(locale: Locale, routeId: RouteId): string {
  return localizedLinkFor(locale, routeId).href;
}

/**
 * The `hreflang` map for `routeId`: one entry per publishing locale, keyed by
 * that locale's BCP 47 language tag, plus `x-default`.
 *
 * One function, two callers — the page metadata and the sitemap — so the
 * annotations a crawler reads in the document and the ones it reads in the
 * sitemap cannot disagree. See this module's note on why a set of one is
 * still emitted.
 */
export function alternateLinksFor(
  baseUrl: string,
  routeId: RouteId,
): Readonly<Record<string, string>> {
  const links: Record<string, string> = {};

  for (const locale of localesPublishing(routeId)) {
    links[LOCALE_DEFINITIONS[locale].languageTag] = canonicalUrl(baseUrl, locale, routeId);
  }

  /*
   * `x-default` names the URL served to a reader whose language matches no
   * edition. That is the default locale's URL when the default locale
   * publishes the page — and when it does not, there is no such URL and the
   * honest answer is to say nothing rather than to nominate an arbitrary
   * edition. `content.test.ts` requires the default locale to publish every
   * route, so the second branch is unreachable today and deliberately still
   * written: the day an edition-specific route exists, this is already right.
   */
  if (lookupPage(routeId, DEFAULT_LOCALE) !== undefined) {
    links["x-default"] = canonicalUrl(baseUrl, DEFAULT_LOCALE, routeId);
  }

  return links;
}

/** The intrinsic size of both share cards, and the ratio Open Graph expects. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const PUBLISHER_OG_IMAGE = "/og/publisher-og.png";
const LUNAR_BASE_OG_IMAGE = "/og/lunar-base-og.png";

/**
 * The share card each route carries. Total over `RouteId` by construction, so
 * a route added to `content/routes.ts` cannot reach production without someone
 * choosing which of the two cards it shares — the alternative, a lookup with a
 * default, is how a Lunar Base route quietly ends up wearing the publisher
 * wordmark.
 */
export const OG_IMAGE_PATHS: Readonly<Record<RouteId, string>> = {
  home: PUBLISHER_OG_IMAGE,
  about: PUBLISHER_OG_IMAGE,
  cart: PUBLISHER_OG_IMAGE,
  checkout: PUBLISHER_OG_IMAGE,
  legalImprint: PUBLISHER_OG_IMAGE,
  legalTerms: PUBLISHER_OG_IMAGE,
  legalPrivacy: PUBLISHER_OG_IMAGE,
  legalShipping: PUBLISHER_OG_IMAGE,
  legalReturns: PUBLISHER_OG_IMAGE,
  lunarBase: LUNAR_BASE_OG_IMAGE,
  support: LUNAR_BASE_OG_IMAGE,
  rulebook: LUNAR_BASE_OG_IMAGE,
};

export interface PageMetadataContext {
  readonly baseUrl: string;
  /** From validated host configuration, for *this* request — never a string sniff. */
  readonly isTestHost: boolean;
  /** The edition being served. Required: a canonical that guessed its locale is a wrong canonical. */
  readonly locale: Locale;
}

export function buildPageMetadata(routeId: RouteId, context: PageMetadataContext): Metadata {
  const page = findPage(routeId, context.locale);
  const url = canonicalUrl(context.baseUrl, context.locale, routeId);
  const indexable = page.indexable && !context.isTestHost;
  const image = {
    url: absoluteUrl(context.baseUrl, OG_IMAGE_PATHS[routeId]),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: page.title,
  };

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: url,
      languages: alternateLinksFor(context.baseUrl, routeId),
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: "Plepic Games",
      type: "website",
      locale: LOCALE_DEFINITIONS[context.locale].languageTag,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [image],
    },
  };
}
