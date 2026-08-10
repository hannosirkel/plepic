import { getRuntimeConfig } from "../../config/runtime-config.js";
import { HomepageMockup } from "../../components/mockups/HomepageMockup.js";
import { resolveCatalogue } from "../../lib/catalogue.js";
import { getRequestNonce } from "../../lib/nonce.js";
import { makeMetadata } from "../../lib/page-shell.js";

export const generateMetadata = makeMetadata("home");

export default async function HomePage() {
  const runtimeConfig = getRuntimeConfig();
  const nonce = await getRequestNonce();

  return (
    <HomepageMockup
      catalogue={resolveCatalogue()}
      turnstileSiteKey={runtimeConfig.turnstile.siteKey}
      nonce={nonce}
    />
  );
}
