/**
 * The sitemap's contract, as a pure function over the same `pages` registry
 * the router and the per-page metadata read — `content/pages.ts` — so the
 * three cannot drift: a route added there is in the sitemap (if indexable)
 * and gets a title and description automatically, and there is no second
 * place that lists routes.
 *
 * The contract, exactly:
 *   - every canonical route appears exactly once;
 *   - `/cart`, `/checkout`, any `/store-api` path, and any non-indexable
 *     route never appear;
 *   - every URL is built on the canonical host, never an alternate host from
 *     the redirect map.
 *
 * `app/sitemap.ts` and `tests/sitemap-contract.test.ts` both call
 * {@link buildSitemapEntries}; the test additionally asserts the contract
 * against a running server (every listed URL answers 200 with a
 * self-referencing canonical), because a pure function cannot check that a
 * route actually renders.
 */

import { pages } from "../../../content/pages.js";
import { ROUTE_PATHS, type RouteId, type RoutePath } from "../../../content/routes.js";
import type { Page } from "../../../content/schema.js";
import { absoluteUrl } from "./urls.js";

export interface SitemapEntry {
  readonly routeId: RouteId;
  readonly path: RoutePath;
  readonly url: string;
}

/** Paths that must never appear in the sitemap, regardless of the page registry. */
const NEVER_INDEXED: ReadonlySet<RouteId> = new Set(["cart", "checkout"]);

export function buildSitemapEntries(
  baseUrl: string,
  allPages: readonly Page[] = pages,
): readonly SitemapEntry[] {
  const seen = new Set<RouteId>();
  const entries: SitemapEntry[] = [];

  for (const page of allPages) {
    if (seen.has(page.route)) {
      throw new Error(`sitemap contract violated: ${page.route} appears more than once in the page registry`);
    }
    seen.add(page.route);

    if (!page.indexable) continue;
    if (NEVER_INDEXED.has(page.route)) {
      throw new Error(`sitemap contract violated: ${page.route} is marked indexable but is never-indexed`);
    }

    const path = ROUTE_PATHS[page.route];
    if (path.startsWith("/store-api")) {
      throw new Error(`sitemap contract violated: ${page.route} resolves under /store-api`);
    }

    entries.push({ routeId: page.route, path, url: absoluteUrl(baseUrl, path) });
  }

  return entries;
}
