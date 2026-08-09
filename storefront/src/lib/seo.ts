/**
 * Per-page SEO metadata, built from the same `content/pages.ts` registry the
 * sitemap and the router read — title and description are guaranteed unique
 * there already (`content/content.test.ts` asserts it), so this module's job
 * is only to turn one `Page` into a `Metadata` object: a self-referencing
 * canonical, and Open Graph / Twitter card fields.
 *
 * No product photography is attached here. The plan forbids fabricated
 * imagery, and no real photography has landed in this unit — `openGraph` and
 * `twitter` simply carry no `images` until the design/pages unit supplies a
 * real asset. A card with no image is a smaller card, not a broken one.
 *
 * `isTestHost` is part of the input rather than a property of the route,
 * because indexability is a property of *this request*: `proxy.ts` sends
 * `X-Robots-Tag: noindex, nofollow` on a test hostname, and a page that
 * simultaneously emitted `<meta name="robots" content="index, follow">` would
 * be arguing with its own header. A test host is never indexable, whatever
 * the page registry says.
 */

import type { Metadata } from "next";

import { pages } from "../../../content/pages.js";
import type { Page } from "../../../content/schema.js";
import type { RouteId } from "../../../content/routes.js";
import { ROUTE_PATHS } from "../../../content/routes.js";
import { absoluteUrl } from "./urls.js";

export function findPage(routeId: RouteId): Page {
  const page = pages.find((candidate) => candidate.route === routeId);
  if (page === undefined) {
    throw new Error(`no content/pages.ts entry for route ${routeId}`);
  }
  return page;
}

export interface PageMetadataContext {
  readonly baseUrl: string;
  /** From validated host configuration, for *this* request — never a string sniff. */
  readonly isTestHost: boolean;
}

export function buildPageMetadata(routeId: RouteId, context: PageMetadataContext): Metadata {
  const page = findPage(routeId);
  const url = absoluteUrl(context.baseUrl, ROUTE_PATHS[routeId]);
  const indexable = page.indexable && !context.isTestHost;

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: "Plepic Games",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: page.title,
      description: page.description,
    },
  };
}
