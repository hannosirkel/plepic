/**
 * Every route the site may link to, every in-page anchor a link may target,
 * and every locale the site is published in.
 *
 * This is the single source of truth for all three. The router, the
 * navigation, the sitemap and the redirect targets are all derived from it;
 * nothing else in the repository may declare a path or a locale. A content
 * file cannot link anywhere that is not listed here, because {@link RouteId}
 * is the only thing a link accepts.
 *
 * Paths are site-relative and always begin with `/`. There is no host, no
 * scheme and no base URL anywhere in this file or in any content file — those
 * come from runtime configuration.
 */

export const ROUTE_PATHS = {
  home: "/",
  lunarBase: "/games/lunar-base",
  about: "/about",
  support: "/support/lunar-base",
  rulebook: "/support/lunar-base/rulebook",
  cart: "/cart",
  checkout: "/checkout",
  legalImprint: "/legal/imprint",
  legalTerms: "/legal/terms",
  legalPrivacy: "/legal/privacy",
  legalShipping: "/legal/shipping",
  legalReturns: "/legal/returns",
} as const;

export type RouteId = keyof typeof ROUTE_PATHS;
export type RoutePath = (typeof ROUTE_PATHS)[RouteId];

/* ------------------------------------------------------------------------
 * Locales — a dimension of the content model, not a copy of it
 * --------------------------------------------------------------------- */

/**
 * Every locale the site is published in.
 *
 * **There are exactly two: the English default and the Estonian edition.**
 * The dimension was declared, tested and served at one locale first, so that
 * adding the second would be a content change and a registration rather than
 * a refactor — see `LOCALE_DEFINITIONS` for what "a registration" means
 * mechanically. `et` is that second edition: the legal set translated for
 * the Estonian consumer, added on the operator's decision of 2026-08-09
 * after the second qualified legal read found consumer-facing terms in
 * English only. It publishes the five legal pages and nothing else.
 *
 * A locale is *not* a language: it is a published edition of this site, keyed
 * by an identifier that is also its URL segment. {@link LocaleDefinition}
 * carries the BCP 47 language tag the edition is written in, because the two
 * are different facts and only one of them belongs in a URL.
 */
export const LOCALES = ["en", "et"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * The locale served at the bare {@link ROUTE_PATHS} — no prefix, no
 * redirect, no negotiation.
 *
 * Exactly one locale may hold that position, and `content.test.ts` asserts
 * it: two locales sharing the unprefixed paths would be two pages competing
 * for one canonical URL, which is the failure mode a locale dimension exists
 * to prevent rather than to introduce.
 */
export const DEFAULT_LOCALE = "en" satisfies Locale;

export interface LocaleDefinition {
  /**
   * BCP 47 language tag. Three things read it and nothing else may invent
   * one: the served document's `lang` attribute, the `hreflang` annotation on
   * a page's alternates, and the collation `localeCompare` sorts a
   * reader-facing list with.
   */
  readonly languageTag: string;
  /**
   * The URL path segment this edition is served under, with its leading
   * slash — or the empty string for the one locale served at the bare route
   * paths.
   *
   * It is declared per locale rather than derived from the key, because
   * "which edition gets the unprefixed URLs" is a decision with consequences
   * for every existing link into this site, and a decision belongs in data
   * where it can be read, not in a rule somewhere that computes it.
   */
  readonly pathPrefix: string;
}

/**
 * The registration point.
 *
 * `Record<Locale, LocaleDefinition>` is **total**: adding a member to
 * {@link LOCALES} makes this object a compile error until the new locale is
 * defined here. Every other locale-keyed registry in the content package is
 * declared the same way (`LocalizedContent<T>` in `schema.ts`), so the type
 * checker — not a checklist, and not review — is what enumerates the work a
 * second locale creates.
 */
export const LOCALE_DEFINITIONS: Readonly<Record<Locale, LocaleDefinition>> = {
  en: { languageTag: "en", pathPrefix: "" },
  /*
   * `en` keeps the unprefixed paths it has always served — every existing
   * link into this site depends on that — and `et` is declared with its own
   * prefix rather than deriving one, per the field's own rule that "which
   * edition gets the unprefixed URLs" is a decision recorded in data.
   */
  et: { languageTag: "et", pathPrefix: "/et" },
};

/**
 * In-page anchors.
 *
 * `aboutgame` and `video_trailer` are spelled the way the old game site spelled
 * them, because existing backlinks carry those fragments and a fragment is not
 * sent to the server — the redirect cannot repair it. The two odd names are
 * load-bearing; do not tidy them.
 *
 * `withdrawal-form`, `legal-guarantee` and `dispute-resolution` are the three
 * anchors the second qualified legal read created work for (M3, M2 and M4).
 * Each is its own section rather than a paragraph appended to an existing one,
 * because `schema.ts`'s `LegalSection.covers` binds one `LegalElement` to one
 * section: an obligation with no section of its own has no home the build
 * check can see disappear.
 */
export const ANCHORS = [
  "aboutgame",
  "video_trailer",
  "how-it-plays",
  "victory-paths",
  "in-the-box",
  "travels-well",
  "reviews",
  "shipping-and-returns",
  "buy",
  "proof",
  "story",
  "team",
  "timeline",
  "newsletter",
  "rules-faq",
  "components",
  "contact",
  "withdrawal",
  "withdrawal-form",
  "returns-process",
  "legal-guarantee",
  "delivery",
  "dispute-resolution",
  "vat",
  "checkout-acknowledgement",
  "processors",
  "consent",
] as const;

export type AnchorId = (typeof ANCHORS)[number];

/**
 * Named external destinations.
 *
 * A content file references one of these by id. The URL behind it comes from
 * runtime configuration, which is what keeps absolute URLs out of content and
 * lets a dead link be repaired without editing copy. The rulebook is
 * deliberately absent from this list: it is a route on this site, not an
 * external link, because "no page links to a file-sharing service" is a
 * completion criterion of the plan.
 *
 * `consumer-disputes-committee` is the one entry any **legal obligation** comes
 * near. Article 6(1)(t) CRD requires the out-of-court body; `/legal/terms`
 * names it in prose, which the operator and the qualified reviewer confirmed on
 * 2026-08-10 is sufficient on its own. The address is a genuine improvement on
 * that and it cannot be written here — this file may name no host — so it is an
 * external target whose URL arrives as deployment configuration. **It is an
 * enhancement, not the disclosure**, so an unconfigured one degrades quietly
 * rather than marking the page incomplete; `src/components/mockups/link-target.ts`
 * states the rule and why no destination on this list is in the other class.
 */
export const EXTERNAL_TARGETS = [
  "kickstarter-campaign",
  "tabletopia-listing",
  "boardgamegeek-entry",
  "retailer-braetspilscafeen",
  "video-trailer",
  "video-tutorial",
  "instagram",
  "facebook",
  "origin-story",
  "consumer-disputes-committee",
] as const;

export type ExternalTargetId = (typeof EXTERNAL_TARGETS)[number];
