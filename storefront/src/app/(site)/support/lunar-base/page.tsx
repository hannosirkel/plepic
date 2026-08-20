import { SupportPageContent } from "../../../../components/pages/SupportPageContent.js";
import { getRuntimeConfig } from "../../../../config/runtime-config.js";
import { getRequestNonce } from "../../../../lib/nonce.js";
import { makeMetadata } from "../../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("support");

export default async function SupportPage() {
  const runtimeConfig = getRuntimeConfig();
  const nonce = await getRequestNonce();

  return (
    <SupportPageContent
      turnstileSiteKey={runtimeConfig.turnstile.siteKey}
      nonce={nonce}
      merchantContactAddress={runtimeConfig.merchant.contactAddress}
      externalTargets={runtimeConfig.externalTargets}
    />
  );
}
