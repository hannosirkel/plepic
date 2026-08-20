import { JsonLdScript } from "../../../../components/JsonLdScript.js";
import { LunarBaseMockup } from "../../../../components/mockups/LunarBaseMockup.js";
import { loadSiteHostConfig } from "../../../../config/hosts.js";
import { ROUTE_PATHS } from "../../../../../../content/routes.js";
import { getRuntimeConfig } from "../../../../config/runtime-config.js";
import { mockCatalogue, resolveCatalogue } from "../../../../lib/catalogue.js";
import { placeholderValuesFrom } from "../../../../lib/configuration-placeholders.js";
import { absoluteUrl } from "../../../../lib/urls.js";
import { buildProductJsonLd } from "../../../../lib/product-jsonld.js";
import { getRequestDestination } from "../../../../lib/destination-request.js";
import { getRequestNonce } from "../../../../lib/nonce.js";
import { loadStoreProduct } from "../../../../lib/store-product.js";
import { AddToCartButton } from "../../../../components/shop/AddToCartButton.js";
import { DestinationSelector } from "../../../../components/shop/DestinationSelector.js";
import { makeMetadata } from "../../../../lib/page-shell.js";
import { findPage } from "../../../../lib/seo.js";

export const generateMetadata = makeMetadata("lunarBase");

/**
 * The one canonical product page.
 *
 * **The structured data and visible page read the same Store product in the
 * same request.** The committed catalogue remains only the deterministic
 * test-host presentation and the editorial game-specification source.
 *
 * They *did* disagree. The JSON-LD used to be built from four environment
 * variables (`CATALOGUE_MOCK_PRICE_AMOUNT` and friends) while the page read
 * the mock catalogue, and one request to this page served
 * a different product name, a different currency, a different amount and
 * `"availability":"OutOfStock"` to a crawler, alongside the catalogue's own
 * name, amount and "In stock" for a person. In the default state — nothing
 * configured — `offers` was omitted altogether, so the page advertised a
 * price to people and none at all to search engines. A comment here claimed
 * `tests/catalogue.test.ts` prevented that; that test imports neither module
 * and the claim was false. `tests/product-jsonld.test.ts` now imports the
 * JSON-LD builder *and* the catalogue the page renders and fails if the two
 * ever differ.
 */
export default async function LunarBasePage() {
  const { baseUrl } = loadSiteHostConfig();
  const page = findPage("lunarBase");
  const [nonce, destination] = await Promise.all([getRequestNonce(), getRequestDestination()]);
  const runtime = getRuntimeConfig();
  // Both environments read their own Store database. Browser baselines use a
  // synthetic Medusa server in the Playwright harness, never a page fallback.
  const store = await loadStoreProduct({
    backendUrl: runtime.medusa.backendUrl,
    publishableKey: runtime.medusa.publishableKey,
    presentation: mockCatalogue,
  });
  const catalogue = resolveCatalogue(store.catalogue, destination);
  const analyticsProduct = store.catalogue;

  const jsonLd = buildProductJsonLd({
    product: store.catalogue,
    url: absoluteUrl(baseUrl, ROUTE_PATHS.lunarBase),
    description: page.description,
  });

  return (
    <>
      <LunarBaseMockup
        externalTargets={runtime.externalTargets}
        catalogue={catalogue}
        merchant={placeholderValuesFrom(runtime.merchant)}
        destinationSelector={<DestinationSelector destinationCode={destination.code} />}
        primaryPurchaseAction={<AddToCartButton label="Add to basket" variantId={store.variantId} analyticsVariantId={store.analyticsVariantId} productName={analyticsProduct.name} unitAmount={analyticsProduct.price.amount} currency={analyticsProduct.price.currency} />}
      />
      <JsonLdScript data={jsonLd} nonce={nonce} />
    </>
  );
}
