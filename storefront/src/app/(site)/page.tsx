import { getRuntimeConfig } from "../../config/runtime-config.js";
import { HomepageMockup } from "../../components/mockups/HomepageMockup.js";
import { mockCatalogue, resolveCatalogue } from "../../lib/catalogue.js";
import { getRequestNonce } from "../../lib/nonce.js";
import { makeMetadata } from "../../lib/page-shell.js";
import { loadStoreCatalogueProduct } from "../../lib/store-product.js";

export const generateMetadata = makeMetadata("home");

export default async function HomePage() {
  const runtimeConfig = getRuntimeConfig();
  const [nonce, catalogueProduct] = await Promise.all([
    getRequestNonce(),
    loadStoreCatalogueProduct({
      backendUrl: runtimeConfig.medusa.backendUrl,
      publishableKey: runtimeConfig.medusa.publishableKey,
      presentation: mockCatalogue,
    }),
  ]);

  return (
    <HomepageMockup
      catalogue={resolveCatalogue(catalogueProduct)}
      turnstileSiteKey={runtimeConfig.turnstile.siteKey}
      nonce={nonce}
    />
  );
}
