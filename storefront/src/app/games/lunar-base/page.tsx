import { JsonLdScript } from "../../../components/JsonLdScript.js";
import { LunarBaseMockup } from "../../../components/mockups/LunarBaseMockup.js";
import { loadSiteHostConfig } from "../../../config/hosts.js";
import { getRuntimeConfig } from "../../../config/runtime-config.js";
import { ROUTE_PATHS } from "../../../../../content/routes.js";
import { resolveCatalogue } from "../../../lib/catalogue.js";
import { absoluteUrl } from "../../../lib/urls.js";
import { buildProductJsonLd } from "../../../lib/product-jsonld.js";
import { getRequestNonce } from "../../../lib/nonce.js";
import { makeMetadata } from "../../../lib/page-shell.js";
import { findPage } from "../../../lib/seo.js";

export const generateMetadata = makeMetadata("lunarBase");

/**
 * The one canonical product page. `Product` and `Offer` JSON-LD here reads
 * price, currency and availability from `catalogueMock.offer` — see
 * `src/lib/product-jsonld.ts` for why that is a mock and not yet a real
 * Medusa-backed catalogue value, and why `offers` is absent entirely when no
 * price is configured. The visible page composition (`LunarBaseMockup`)
 * reads its price from a *different* mock — `storefront/mock/catalogue.json`
 * via `resolveCatalogue()` — because the two serve different purposes and
 * different audiences: `catalogueMock` is per-environment configuration
 * (`CATALOGUE_MOCK_PRICE_AMOUNT` and friends) feeding a machine-readable
 * price claim to search engines, and stays `null`/absent until an operator
 * configures it; `mock/catalogue.json` is the fixed contract this unit's
 * page composition is built and tested against, and mirrors what Task 5's
 * live catalogue will actually be seeded with. Both agree on the same
 * frozen commercial facts (see `storefront/mock/catalogue.json`) — see
 * `tests/catalogue.test.ts` — so a visitor never sees the two disagree.
 */
export default async function LunarBasePage() {
  const { baseUrl } = loadSiteHostConfig();
  const runtimeConfig = getRuntimeConfig();
  const page = findPage("lunarBase");
  const nonce = await getRequestNonce();

  const jsonLd = buildProductJsonLd({
    catalogue: runtimeConfig.catalogueMock,
    url: absoluteUrl(baseUrl, ROUTE_PATHS.lunarBase),
    description: page.description,
  });

  return (
    <>
      <LunarBaseMockup catalogue={resolveCatalogue()} />
      <JsonLdScript data={jsonLd} nonce={nonce} />
    </>
  );
}
