import { makeMetadata, RoutePlaceholder } from "../../lib/page-shell.js";

export const generateMetadata = makeMetadata("cart");

export default function CartPage() {
  return <RoutePlaceholder routeId="cart" />;
}
