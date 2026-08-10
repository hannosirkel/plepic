import { BasketPageContent } from "../../components/shop/BasketPageContent.js";
import { ShopPageShell } from "../../components/shop/ShopPageShell.js";
import { CartProvider } from "../../lib/cart-store.js";
import { MOCK_SCENARIO_PARAM, parseMockScenario } from "../../lib/mock-cart-actions.js";
import { makeMetadata } from "../../lib/page-shell.js";

export const generateMetadata = makeMetadata("cart");

/**
 * `/cart`. The scenario is resolved on the **server** so a requested state is
 * in the first paint rather than appearing after hydration — see
 * `src/lib/mock-cart-actions.ts` for what `?mock=` is, why it exists, and why
 * it leaves with the mock data layer.
 */
export default async function CartPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <ShopPageShell>
      <CartProvider scenario={parseMockScenario(params[MOCK_SCENARIO_PARAM])}>
        <BasketPageContent />
      </CartProvider>
    </ShopPageShell>
  );
}
