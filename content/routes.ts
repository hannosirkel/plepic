/**
 * Every route the site may link to, and every in-page anchor a link may
 * target.
 *
 * This is the single source of truth for both. The router, the navigation, the
 * sitemap and the redirect targets are all derived from it; nothing else in the
 * repository may declare a path. A content file cannot link anywhere that is
 * not listed here, because {@link RouteId} is the only thing a link accepts.
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
  "consumer-disputes-committee",
] as const;

export type ExternalTargetId = (typeof EXTERNAL_TARGETS)[number];
