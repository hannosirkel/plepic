import { ShopPageShell } from "../../../../components/shop/ShopPageShell.js";
import { StripePaymentReturn } from "../../../../components/shop/StripePaymentReturn.js";
import { makeMetadata } from "../../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("checkout");

export default function StripePaymentReturnPage() {
  return (
    <ShopPageShell>
      <StripePaymentReturn />
    </ShopPageShell>
  );
}
