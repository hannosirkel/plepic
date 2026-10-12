/**
 * Every page of every prefixed edition, through one route.
 *
 * One optional catch-all rather than a mirrored directory tree per locale,
 * for the reason `content/routes.ts` gives for existing at all: `ROUTE_PATHS`
 * is the only place a path is written, and a second copy of the route tree
 * under `app/et/…` would be a second place — one that can silently gain, lose
 * or misspell a route relative to the first. Here the mapping from a path to a
 * route is `routeIdForPath`, over the same table, in one direction, once.
 *
 * What is servable and what 404s is decided by
 * `src/app/localized-routes.tsx`; this file only asks it and renders the
 * answer. In particular `/en/…` 404s: the default edition's prefix is empty,
 * those are not this site's URLs, and serving them would give every page two
 * canonicals.
 *
 * `searchParams` reaches the basket renderer so `?mock=` selects the same
 * server-rendered state under a prefixed edition as under the default URL.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isTestHost, loadSiteHostConfig } from "../../../config/hosts.js";
import { buildPageMetadata } from "../../../lib/seo.js";
import { getRequestHost } from "../../../lib/request-host.js";
import { CheckoutReturnRoute, LOCALIZED_ROUTE_VIEWS, resolveLocalizedRoute } from "../../localized-routes.js";
import { siteCopyByLocale } from "../../../../../content/editions.js";
import { interfaceCopy } from "../../../../../content/interface.js";
import { localeForPathSegment } from "../../../lib/urls.js";

export const dynamic = "force-dynamic";

interface LocalizedRouteParams {
  readonly locale: string;
  readonly segments?: readonly string[];
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<LocalizedRouteParams>;
}): Promise<Metadata> {
  const { locale, segments } = await params;
  const resolved = resolveLocalizedRoute(locale, segments);

  /*
   * A path that resolves to nothing is about to be a 404. It gets a title,
   * because a document with none shows the raw URL in the browser tab, and it
   * gets `noindex` — and it gets **no canonical and no alternates**, ever.
   *
   * That last clause is load-bearing and was nearly lost. `notFound()` does
   * **not** discard this metadata: a canary canonical placed in this branch
   * reaches the hydrated DOM, so a rendering crawler would be told a canonical
   * exists for a URL that answers 404. `tests/build-and-serve.test.ts` asserts
   * it against the payload the hydration reads, and that assertion has been
   * watched to fail with the canary in place.
   *
   * So this object is built by hand rather than by `buildPageMetadata`, which
   * always attaches both.
   */
  if (resolved === null) {
    const edition = localeForPathSegment(locale);
    const title = (edition === undefined ? interfaceCopy : siteCopyByLocale[edition]?.interface ?? interfaceCopy).notFound.title;
    return { title, robots: { index: false, follow: false } };
  }

  const hostConfig = loadSiteHostConfig();
  const host = await getRequestHost();

  return buildPageMetadata(resolved.routeId, {
    baseUrl: hostConfig.baseUrl,
    isTestHost: host !== undefined && isTestHost(host, hostConfig),
    locale: resolved.locale,
  });
}

export default async function LocalizedPage({
  params,
  searchParams,
}: {
  readonly params: Promise<LocalizedRouteParams>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, segments } = await params;
  const resolved = resolveLocalizedRoute(locale, segments);
  if (resolved === null) notFound();

  const View = resolved.view === "checkoutReturn"
    ? CheckoutReturnRoute
    : LOCALIZED_ROUTE_VIEWS[resolved.routeId];
  /*
   * Unreachable through `resolveLocalizedRoute`, which returns null for a
   * route with no view. Written out rather than asserted away, because the
   * alternative is a non-null assertion on the one line where being wrong
   * means rendering nothing at all.
   */
  if (View === undefined) notFound();

  return <View routeId={resolved.routeId} locale={resolved.locale} searchParams={searchParams} />;
}
