/**
 * The sitemap's contract, as a pure function over the same locale-keyed
 * `pagesByLocale` registry the router and the per-page metadata read, so the
 * three cannot drift: a route added there is in the sitemap (if indexable)
 * and gets a title and description automatically, and there is no second
 * place that lists routes or locales.
 *
 * The contract, exactly:
 *   - every canonical route appears exactly once **per locale that publishes
 *     it**, at that locale's own URL;
 *   - `/cart`, `/checkout`, any `/store-api` path, and any non-indexable
 *     route never appear, in any locale;
 *   - every URL is built on the canonical host, never an alternate host from
 *     the redirect map;
 *   - every entry carries the same `hreflang` alternates the page itself
 *     emits, because both come from `alternateLinksFor` in `./seo.ts`.
 *
 * `app/sitemap.ts` and `tests/sitemap-contract.test.ts` both call
 * {@link buildSitemapEntries}; the test additionally asserts the contract
 * against a running server (every listed URL answers 200 with a
 * self-referencing canonical), because a pure function cannot check that a
 * route actually renders.
 */

import { LOCALES, ROUTE_PATHS, type Locale, type RouteId } from "../../../content/routes.js";
import { alternateLinksFor, pagesIn } from "./seo.js";
import { canonicalUrl, localizedPath } from "./urls.js";

export interface SitemapEntry {
  readonly routeId: RouteId;
  readonly locale: Locale;
  /** The path as served in this locale — prefixed for every edition but the default one. */
  readonly path: string;
  readonly url: string;
  /** `hreflang` map, identical to the one the page's own metadata emits. */
  readonly alternates: Readonly<Record<string, string>>;
}

/** Paths that must never appear in the sitemap, regardless of the page registry. */
const NEVER_INDEXED: ReadonlySet<RouteId> = new Set(["cart", "checkout"]);

export function buildSitemapEntries(
  baseUrl: string,
  locales: readonly Locale[] = LOCALES,
): readonly SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  for (const locale of locales) {
    const seen = new Set<RouteId>();

    for (const page of pagesIn(locale)) {
      if (seen.has(page.route)) {
        throw new Error(
          `sitemap contract violated: ${page.route} appears more than once in the ${locale} page registry`,
        );
      }
      seen.add(page.route);

      if (!page.indexable) continue;
      if (NEVER_INDEXED.has(page.route)) {
        throw new Error(
          `sitemap contract violated: ${page.route} is marked indexable in ${locale} but is never-indexed`,
        );
      }

      const path = ROUTE_PATHS[page.route];
      if (path.startsWith("/store-api")) {
        throw new Error(`sitemap contract violated: ${page.route} resolves under /store-api`);
      }

      entries.push({
        routeId: page.route,
        locale,
        path: localizedPath(locale, path),
        url: canonicalUrl(baseUrl, locale, page.route),
        alternates: alternateLinksFor(baseUrl, page.route),
      });
    }
  }

  return entries;
}
