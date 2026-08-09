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
  "returns-process",
  "delivery",
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
] as const;

export type ExternalTargetId = (typeof EXTERNAL_TARGETS)[number];
