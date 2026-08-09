import { JsonLdScript } from "../../../components/JsonLdScript.js";
import { loadSiteHostConfig } from "../../../config/hosts.js";
import { getRuntimeConfig } from "../../../config/runtime-config.js";
import { ROUTE_PATHS } from "../../../../../content/routes.js";
import { absoluteUrl } from "../../../lib/urls.js";
import { buildProductJsonLd } from "../../../lib/product-jsonld.js";
import { getRequestNonce } from "../../../lib/nonce.js";
import { makeMetadata, RoutePlaceholder } from "../../../lib/page-shell.js";
import { findPage } from "../../../lib/seo.js";

export const generateMetadata = makeMetadata("lunarBase");

/**
 * The one canonical product page. `Product` and `Offer` JSON-LD here reads
 * price, currency and availability from `catalogueMock.offer` — see
 * `src/lib/product-jsonld.ts` for why that is a mock and not yet a real
 * Medusa-backed catalogue value, and why `offers` is absent entirely when no
 * price is configured.
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
    <RoutePlaceholder routeId="lunarBase">
      <JsonLdScript data={jsonLd} nonce={nonce} />
    </RoutePlaceholder>
  );
}
