import { JsonLdScript } from "../../../../components/JsonLdScript.js";
import { LunarBaseMockup } from "../../../../components/mockups/LunarBaseMockup.js";
import { loadSiteHostConfig } from "../../../../config/hosts.js";
import { ROUTE_PATHS } from "../../../../../../content/routes.js";
import { getRuntimeConfig } from "../../../../config/runtime-config.js";
import { mockCatalogue, resolveCatalogue } from "../../../../lib/catalogue.js";
import { placeholderValuesFrom } from "../../../../lib/configuration-placeholders.js";
import { absoluteUrl } from "../../../../lib/urls.js";
import { buildProductJsonLd } from "../../../../lib/product-jsonld.js";
import { getRequestNonce } from "../../../../lib/nonce.js";
import { makeMetadata } from "../../../../lib/page-shell.js";
import { findPage } from "../../../../lib/seo.js";

export const generateMetadata = makeMetadata("lunarBase");

/**
 * The one canonical product page.
 *
 * **The structured data and the visible page read the same catalogue, in the
 * same request.** `mockCatalogue` is `storefront/mock/catalogue.json`'s
 * product; `resolveCatalogue(mockCatalogue)` turns it into the display
 * strings the composition paints, and `buildProductJsonLd` reads the raw
 * figures off the same object for the `Product`/`Offer` block. They cannot
 * disagree, because there is nothing for them to disagree with.
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
  const nonce = await getRequestNonce();
  const catalogue = resolveCatalogue(mockCatalogue);

  const jsonLd = buildProductJsonLd({
    product: mockCatalogue,
    url: absoluteUrl(baseUrl, ROUTE_PATHS.lunarBase),
    description: page.description,
  });

  return (
    <>
      <LunarBaseMockup
        catalogue={catalogue}
        merchant={placeholderValuesFrom(getRuntimeConfig().merchant)}
      />
      <JsonLdScript data={jsonLd} nonce={nonce} />
    </>
  );
}
