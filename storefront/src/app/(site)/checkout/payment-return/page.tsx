import { ShopPageShell } from "../../../../components/shop/ShopPageShell.js";
import { StripePaymentReturn } from "../../../../components/shop/StripePaymentReturn.js";
import { getRuntimeConfig } from "../../../../config/runtime-config.js";
import { getRequestNonce } from "../../../../lib/nonce.js";
import { shopCopy } from "../../../../lib/edition-copy.js";
import { makeMetadata } from "../../../../lib/page-shell.js";
import { DEFAULT_LOCALE } from "../../../../../../content/routes.js";

export const generateMetadata = makeMetadata("checkout");

export default async function StripePaymentReturnPage() {
  const [runtimeConfig, nonce] = await Promise.all([getRuntimeConfig(), getRequestNonce()]);
  return (
    <ShopPageShell route="checkout" externalTargets={runtimeConfig.externalTargets}>
      <StripePaymentReturn shopCopy={shopCopy(DEFAULT_LOCALE)} turnstileSiteKey={runtimeConfig.turnstile.siteKey} nonce={nonce} />
    </ShopPageShell>
  );
}
