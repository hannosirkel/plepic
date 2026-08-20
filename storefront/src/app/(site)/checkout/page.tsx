import {
  isOrderNotPlaced,
  ORDER_OUTCOME_PARAM,
} from "../../../components/shop/checkout-order-post.js";
import { CheckoutPageContent } from "../../../components/shop/CheckoutPageContent.js";
import { ShopPageShell } from "../../../components/shop/ShopPageShell.js";
import { loadSiteHostConfig } from "../../../config/hosts.js";
import { getRuntimeConfig } from "../../../config/runtime-config.js";
import { CartProvider } from "../../../lib/cart-store.js";
import {
  isMockLayerEnabled,
  MOCK_SCENARIO_PARAM,
  parseMockScenario,
} from "../../../lib/mock-cart-actions.js";
import { getRequestDestination } from "../../../lib/destination-request.js";
import { getRequestNonce } from "../../../lib/nonce.js";
import { makeMetadata } from "../../../lib/page-shell.js";
import { getRequestHost } from "../../../lib/request-host.js";

export const generateMetadata = makeMetadata("checkout");

/**
 * `/checkout`. The Turnstile site key, the CSP nonce and the hostname this
 * request arrived on are read here, per request, and handed down as props —
 * nothing below this file reads `process.env` or `headers()`. Server-side
 * verification of the Turnstile token is Task 5's, exactly as it is for the
 * newsletter and contact forms.
 *
 * Two things are resolved on the server rather than after hydration:
 *
 * - **`?mock=`, and whether it counts at all.** `isMockLayerEnabled` answers
 *   from the same validated `SITE_TEST_HOSTNAMES` set `proxy.ts` uses, read
 *   at runtime like every other per-environment value in this application.
 *   On a live hostname the parameter resolves to `null` and writes nothing;
 *   see `src/lib/mock-cart-actions.ts`.
 * - **the outcome of a submission the browser made itself**, when JavaScript
 *   had not run — see `src/components/shop/checkout-order-post.ts`. The
 *   message is then in the first paint rather than waiting on a script.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, nonce, host, destination] = await Promise.all([
    searchParams,
    getRequestNonce(),
    getRequestHost(),
    getRequestDestination(),
  ]);
  const runtimeConfig = getRuntimeConfig();
  const scenario = isMockLayerEnabled(host, loadSiteHostConfig().testHostnames)
    ? parseMockScenario(params[MOCK_SCENARIO_PARAM])
    : null;

  return (
    <ShopPageShell>
      <CartProvider scenario={scenario} destinationCode={destination.code}>
        <CheckoutPageContent
          turnstileSiteKey={runtimeConfig.turnstile.siteKey}
          nonce={nonce}
          stripePublishableKey={runtimeConfig.stripe.publishableKey}
          scenario={scenario}
          unhydratedOrderAttempt={isOrderNotPlaced(params[ORDER_OUTCOME_PARAM])}
        />
      </CartProvider>
    </ShopPageShell>
  );
}
