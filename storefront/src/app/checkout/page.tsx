import { CheckoutPageContent } from "../../components/shop/CheckoutPageContent.js";
import { ShopPageShell } from "../../components/shop/ShopPageShell.js";
import { getRuntimeConfig } from "../../config/runtime-config.js";
import { CartProvider } from "../../lib/cart-store.js";
import { MOCK_SCENARIO_PARAM, parseMockScenario } from "../../lib/mock-cart-actions.js";
import { getRequestNonce } from "../../lib/nonce.js";
import { makeMetadata } from "../../lib/page-shell.js";

export const generateMetadata = makeMetadata("checkout");

/**
 * `/checkout`. The Turnstile site key and the CSP nonce are read here, per
 * request, and handed down as props — nothing below this file reads
 * `process.env` or `headers()`. Server-side verification of the Turnstile
 * token is Task 5's, exactly as it is for the newsletter and contact forms.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, nonce] = await Promise.all([searchParams, getRequestNonce()]);
  const runtimeConfig = getRuntimeConfig();
  const scenario = parseMockScenario(params[MOCK_SCENARIO_PARAM]);

  return (
    <ShopPageShell>
      <CartProvider scenario={scenario}>
        <CheckoutPageContent
          turnstileSiteKey={runtimeConfig.turnstile.siteKey}
          nonce={nonce}
          scenario={scenario}
        />
      </CartProvider>
    </ShopPageShell>
  );
}
