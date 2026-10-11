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
 * ## Why the table is not every route yet
 *
 * A route enters the table when its renderer reads the edition's copy and no
 * other. The legal pages were first: they are projections of `content/legal/*`
 * through one component, so pointing that component at another locale's
 * content was the whole change. The home page followed, once `HomepageMockup`
 * and the sections it composes took a `locale` and read `siteCopyFor(locale)`.
 * The Lunar Base page followed with the same copy source for its page,
 * purchase controls and structured data.
 *
 * Support is not there yet: `SupportPageContent` still imports English
 * content directly. Listing it here would serve the wrong edition's words.
 *
 * The basket and the checkout are absent for the same reason and one more:
 * they are non-indexable, they compose `src/components/shop/`, and
 * `robots.txt` disallows their two literal paths. A `/xx/cart` that 404s
 * needs no robots rule; one that rendered would need one.
 */

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { HomepageMockup } from "../components/mockups/HomepageMockup.js";
import { LunarBaseMockup } from "../components/mockups/LunarBaseMockup.js";
import { JsonLdScript } from "../components/JsonLdScript.js";
import { AddToCartButton } from "../components/shop/AddToCartButton.js";
import { DestinationSelector } from "../components/shop/DestinationSelector.js";
import { LegalPageContent } from "../components/pages/LegalPageContent.js";
import { getRuntimeConfig } from "../config/runtime-config.js";
import { legalPagesByLocale } from "../../../content/legal/index.js";
import { siteCopyFor } from "../../../content/editions.js";
import { ROUTE_PATHS } from "../../../content/routes.js";
import { contentFor, type LegalPage } from "../../../content/schema.js";
import type { Locale, RouteId } from "../../../content/routes.js";
import { mockCatalogue, resolveCatalogue } from "../lib/catalogue.js";
import { placeholderValuesFrom } from "../lib/configuration-placeholders.js";
import { getRequestDestination } from "../lib/destination-request.js";
import { getRequestNonce } from "../lib/nonce.js";
import { lookupPage } from "../lib/seo.js";
import { loadStoreCatalogueProduct } from "../lib/store-product.js";
import { loadStoreProduct } from "../lib/store-product.js";
import { buildProductJsonLd } from "../lib/product-jsonld.js";
import { loadSiteHostConfig } from "../config/hosts.js";
import { absoluteUrl, localizedPath, localeForPathSegment, routeIdForPath } from "../lib/urls.js";

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
export async function LegalRoute({ routeId, locale }: LocalizedRouteProps) {
  const page = lookupLegalPage(routeId, locale);
  if (page === undefined) notFound();

  const config = getRuntimeConfig();
  /*
   * `/legal/shipping` states `{price}`, and `{price}` is destination-dependent
   * — the gross figure for a delivery address in the EU and the net one for
   * any other. A legal page rendered against the default destination for
   * everybody would show a European reader the export figure, one screen away
   * from the product page showing them the European one, and the page that
   * explains VAT presentation is the last place two answers may appear.
   *
   * Reading the cookie makes these routes dynamic. That is a real cost and it
   * is accepted: every other route on this site already reads `headers()` for
   * the CSP nonce, and a cached legal page quoting somebody else's price is
   * not a saving.
   *
   * **The locale goes in too, and it is not decoration.** The qualification
   * `{priceTaxQualifier}` resolves to is prose, and it is the emphasised first
   * line under this page's VAT heading. Resolving it without a locale is what
   * made `/et/legal/shipping` render an English sentence on an approved
   * Estonian legal notice.
   */
  const destination = await getRequestDestination();

  return (
    <LegalPageContent
      page={page}
      locale={locale}
      values={placeholderValuesFrom(config.merchant)}
      externalTargets={config.externalTargets}
      catalogue={resolveCatalogue(undefined, destination, locale)}
    />
  );
}

/**
 * The home page, in one locale.
 *
 * `app/(site)/page.tsx` and the localized router both render this, for the
 * reason {@link LegalRoute} gives: one renderer, so the default edition and a
 * prefixed one cannot come to disagree.
 *
 * The page registry is asked again here, although `resolveLocalizedRoute` has
 * already asked it. An edition that does not publish the home page has, as a
 * rule, no site copy at all, and `siteCopyFor` throws for it: a caller that
 * skipped the resolver would get a 500 where a 404 is the answer.
 *
 * The catalogue is resolved for the locale as well as for the destination,
 * because "VAT included" under the price is one of its words.
 */
export async function HomeRoute({ routeId, locale }: LocalizedRouteProps) {
  if (lookupPage(routeId, locale) === undefined) notFound();

  const runtimeConfig = getRuntimeConfig();
  const [nonce, destination, catalogueProduct] = await Promise.all([
    getRequestNonce(),
    getRequestDestination(),
    loadStoreCatalogueProduct({
      backendUrl: runtimeConfig.medusa.backendUrl,
      publishableKey: runtimeConfig.medusa.publishableKey,
      presentation: mockCatalogue,
    }),
  ]);

  return (
    <HomepageMockup
      locale={locale}
      catalogue={resolveCatalogue(catalogueProduct, destination, locale)}
      turnstileSiteKey={runtimeConfig.turnstile.siteKey}
      nonce={nonce}
      externalTargets={runtimeConfig.externalTargets}
    />
  );
}

/** The product page and its structured data, resolved for one edition. */
export async function LunarBaseRoute({ routeId, locale }: LocalizedRouteProps) {
  const page = lookupPage(routeId, locale);
  if (page === undefined) notFound();

  const runtime = getRuntimeConfig();
  const [nonce, destination, store] = await Promise.all([
    getRequestNonce(),
    getRequestDestination(),
    loadStoreProduct({
      backendUrl: runtime.medusa.backendUrl,
      publishableKey: runtime.medusa.publishableKey,
      presentation: mockCatalogue,
    }),
  ]);
  const catalogue = resolveCatalogue(store.catalogue, destination, locale);
  const analyticsProduct = store.catalogue;
  const copy = siteCopyFor(locale);
  // Keep the crawler's product name tied to the Store name shown on this page.
  const jsonLd = buildProductJsonLd({
    product: store.catalogue,
    url: absoluteUrl(loadSiteHostConfig().baseUrl, localizedPath(locale, ROUTE_PATHS.lunarBase)),
    description: page.description,
  });
  const addLabel = copy.lunarBase.purchase.callsToAction.find((action) => action.emphasis === "primary")?.label;
  if (addLabel === undefined) throw new Error("The product has no primary purchase action");

  return (
    <>
      <LunarBaseMockup
        locale={locale}
        externalTargets={runtime.externalTargets}
        catalogue={catalogue}
        merchant={placeholderValuesFrom(runtime.merchant)}
        destinationSelector={<DestinationSelector destinationCode={destination.code} />}
        primaryPurchaseAction={<AddToCartButton locale={locale} label={addLabel} variantId={store.variantId} analyticsVariantId={store.analyticsVariantId} productName={analyticsProduct.name} unitAmount={analyticsProduct.price.amount} currency={analyticsProduct.price.currency} />}
      />
      <JsonLdScript data={jsonLd} nonce={nonce} />
    </>
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
  Readonly<Record<RouteId, (props: LocalizedRouteProps) => ReactNode | Promise<ReactNode>>>
> = {
  home: HomeRoute,
  lunarBase: LunarBaseRoute,
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
