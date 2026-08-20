import { BasketPageContent } from "../../../components/shop/BasketPageContent.js";
import { ShopPageShell } from "../../../components/shop/ShopPageShell.js";
import { loadSiteHostConfig } from "../../../config/hosts.js";
import { CartProvider } from "../../../lib/cart-store.js";
import {
  isMockLayerEnabled,
  MOCK_SCENARIO_PARAM,
  parseMockScenario,
} from "../../../lib/mock-cart-actions.js";
import { getRequestDestination } from "../../../lib/destination-request.js";
import { makeMetadata } from "../../../lib/page-shell.js";
import { getRequestHost } from "../../../lib/request-host.js";

export const generateMetadata = makeMetadata("cart");

/**
 * `/cart`. The scenario is resolved on the **server** so a requested state is
 * in the first paint rather than appearing after hydration — see
 * `src/lib/mock-cart-actions.ts` for what `?mock=` is, why it exists, and why
 * it leaves with the mock data layer.
 *
 * Whether it is honoured at all is resolved here too, from the hostname this
 * request arrived on and the deployment's own `SITE_TEST_HOSTNAMES` — read at
 * runtime, like every other per-environment value in this application, never
 * baked into the image. Requesting a scenario writes a basket into
 * `sessionStorage`, so on a live hostname there is no scenario to honour.
 */
export default async function CartPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, host, destination] = await Promise.all([
    searchParams,
    getRequestHost(),
    getRequestDestination(),
  ]);
  const scenario = isMockLayerEnabled(host, loadSiteHostConfig().testHostnames)
    ? parseMockScenario(params[MOCK_SCENARIO_PARAM])
    : null;

  return (
    <ShopPageShell>
      <CartProvider scenario={scenario} destinationCode={destination.code}>
        <BasketPageContent />
      </CartProvider>
    </ShopPageShell>
  );
}
