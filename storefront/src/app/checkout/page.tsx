import { makeMetadata, RoutePlaceholder } from "../../lib/page-shell.js";

export const generateMetadata = makeMetadata("checkout");

export default function CheckoutPage() {
  return <RoutePlaceholder routeId="checkout" />;
}
