/**
 * Which routes have a renderer that can serve a locale, and the renderer.
 *
 * ## The defect this file is shaped around
 *
 * Five legal pages rendered a placeholder through three merged pull requests
 * because every test asked only whether the route answered 200 with a
 * canonical, and it did. A localized route is the same defect with a new
 * costume: `/xx/legal/imprint` answering 200 with the English notice is
 * *worse* than 404, because it looks translated.
 *
 * So a route is servable in a locale only when two independent things are
 * true, and both are checked here rather than assumed:
 *
 * 1. the locale's page registry publishes that route
 *    (`pagesByLocale` in `content/index.ts`), and
 * 2. the route appears in {@link LOCALIZED_ROUTE_VIEWS} — that is, it has a
 *    renderer that takes a locale and reads that locale's content.
 *
 * Anything else 404s. `storefront/tests/locale-routing.test.ts` additionally
 * fails the build when a locale publishes a route with no localized
 * renderer, so the silent-404 case is a red test rather than a page a
 * translator wrote and nobody could reach.
 *
 * ## Why the table holds only the legal set today
 *
 * The legal pages are projections of `content/legal/*` through one component,
 * so pointing that component at another locale's content is the whole change.
 * The marketing pages are not: `AboutPageContent`, `SupportPageContent`,
 * `HomepageMockup` and `LunarBaseMockup` import `content/publisher.ts`,
 * `content/lunar-base.ts` and `content/support.ts` directly, and no amount of
 * routing makes those read a locale. Making them locale-aware is a change to
 * those components and those content modules, and both are outside this
 * unit's authority. Listing them here anyway — so the table looked complete —
 * would be exactly the "answers 200 with the wrong words" failure above.
 *
 * The basket and the checkout are absent for the same reason and one more:
 * they are non-indexable, they compose `src/components/shop/`, and
 * `robots.txt` disallows their two literal paths. A `/xx/cart` that 404s
 * needs no robots rule; one that rendered would need one.
 */

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { LegalPageContent } from "../components/pages/LegalPageContent.js";
import { getRuntimeConfig } from "../config/runtime-config.js";
import { legalPagesByLocale } from "../../../content/legal/index.js";
import { contentFor, type LegalPage } from "../../../content/schema.js";
import type { Locale, RouteId } from "../../../content/routes.js";
import { placeholderValuesFrom } from "../lib/configuration-placeholders.js";
import { lookupPage } from "../lib/seo.js";
import { localeForPathSegment, routeIdForPath } from "../lib/urls.js";

/** The legal page `locale` publishes for `routeId`, or `undefined`. */
export function lookupLegalPage(routeId: RouteId, locale: Locale): LegalPage | undefined {
  return contentFor(legalPagesByLocale, locale).find((page) => page.route === routeId);
}

export interface LocalizedRouteProps {
  readonly routeId: RouteId;
  readonly locale: Locale;
}

/**
 * One legal route, in one locale.
 *
 * The default edition's five `page.tsx` files and the localized router both
 * render this, so there is one projection of `content/legal/*` and not two to
 * disagree with each other.
 */
export function LegalRoute({ routeId, locale }: LocalizedRouteProps) {
  const page = lookupLegalPage(routeId, locale);
  if (page === undefined) notFound();

  const config = getRuntimeConfig();

  return (
    <LegalPageContent
      page={page}
      locale={locale}
      values={placeholderValuesFrom(config.merchant)}
      externalTargets={config.externalTargets}
    />
  );
}

/**
 * Routes with a locale-aware renderer, and the renderer for each.
 *
 * `Partial<Record<RouteId, …>>` rather than a total record: absence is the
 * meaningful state, and it must stay easy to leave a route out. A total
 * record would make "every route must claim a localized renderer" a compile
 * error, which is pressure in exactly the wrong direction.
 */
export const LOCALIZED_ROUTE_VIEWS: Partial<
  Readonly<Record<RouteId, (props: LocalizedRouteProps) => ReactNode>>
> = {
  legalImprint: LegalRoute,
  legalTerms: LegalRoute,
  legalShipping: LegalRoute,
  legalReturns: LegalRoute,
  legalPrivacy: LegalRoute,
};

export interface ResolvedLocalizedRoute {
  readonly locale: Locale;
  readonly routeId: RouteId;
}

/**
 * Resolves a prefixed request — the locale segment and the rest of the path —
 * to a route this site will actually serve, or `null`.
 *
 * `null` is a 404, and every path to it is deliberate:
 *
 * - the first segment is not a locale's prefix. Note that the **default**
 *   locale's prefix is empty, so `/en/legal/imprint` lands here: that URL is
 *   not one of this site's, and answering it would give one page two
 *   canonicals;
 * - the remaining path is not a route;
 * - the locale's registry does not publish that route;
 * - the route has no locale-aware renderer.
 */
export function resolveLocalizedRoute(
  localeSegment: string,
  segments: readonly string[] | undefined,
): ResolvedLocalizedRoute | null {
  const locale = localeForPathSegment(localeSegment);
  if (locale === undefined) return null;

  const routeId = routeIdForPath(`/${(segments ?? []).join("/")}`);
  if (routeId === undefined) return null;

  if (lookupPage(routeId, locale) === undefined) return null;
  if (LOCALIZED_ROUTE_VIEWS[routeId] === undefined) return null;

  return { locale, routeId };
}
