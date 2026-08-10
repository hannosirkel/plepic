/**
 * Cart state: the shape of a basket, and every figure derived from one.
 *
 * This module is **data and arithmetic only** — no React, no storage, no
 * timers. `src/lib/cart-store.tsx` holds the live state and
 * `src/lib/mock-cart-actions.ts` is the mock data layer Task 5 replaces; both
 * import from here, and neither of them decides what a total is.
 *
 * ## Where the figures come from
 *
 * The product, its price and its stock state come from
 * `storefront/mock/catalogue.json` through {@link ./catalogue.js}, which is
 * the frozen commercial contract Task 5's live catalogue is seeded to match.
 * The shipping charge comes from `storefront/mock/shipping.json`: one declared
 * method with one flat figure, because the plan forbids calculated carrier
 * rates. **No price literal appears in this file**, which is what
 * `tests/no-hardcoded-price.test.ts` enforces across `src/`.
 *
 * ## Why the shipping charge and the total are nullable
 *
 * `content/legal/shipping.ts` says shipping "is calculated at checkout once
 * you have entered a delivery address", and `content/legal/terms.ts` requires
 * the shipping charge **and** the total to be on the screen carrying the order
 * button. Both are true at once only if the basket page can say "calculated at
 * checkout" and the checkout page can show a figure the moment the address is
 * complete. So {@link CartTotals.shippingAmount} and
 * {@link CartTotals.orderAmount} are `null` until an address exists, and the
 * order button refuses to place an order while either is `null` — a buyer
 * cannot be bound by a screen that has not yet shown them the total.
 *
 * ## Unavailable lines are excluded from the total, never silently priced
 *
 * A line whose catalogue availability is not `InStock` is not something we can
 * sell today, so it contributes nothing to the goods figure and blocks the
 * order until it is removed. Pricing it into a total we could not honour is
 * the failure mode this rule exists to prevent.
 */

import { mockCatalogue, type CatalogueAvailability, type CatalogueProduct } from "./catalogue.js";
import shippingSource from "../../mock/shipping.json";

/** The most of one line a single order may carry. A limit, never a stock count. */
export const MAX_QUANTITY_PER_LINE = 10;

export interface CartLine {
  /** Stable within a basket. Task 5 replaces this with the Medusa line item id. */
  readonly id: string;
  readonly productName: string;
  /** Minor units, as the catalogue holds them. */
  readonly unitAmount: number;
  readonly currency: string;
  readonly quantity: number;
  readonly availability: CatalogueAvailability;
}

export interface ShippingMethod {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly currency: string;
}

interface ShippingFile {
  readonly method: ShippingMethod;
}

/** The one declared shipping method — see `storefront/mock/shipping.json`. */
export const declaredShippingMethod: ShippingMethod = (shippingSource as ShippingFile).method;

export interface CartTotals {
  readonly currency: string;
  /** Sum of every available line. Minor units. */
  readonly goodsAmount: number;
  /** `null` until a delivery address exists — see this module's doc comment. */
  readonly shippingAmount: number | null;
  /** `null` whenever {@link shippingAmount} is. */
  readonly orderAmount: number | null;
}

/** True when this line can actually be supplied today. */
export function isAvailable(line: CartLine): boolean {
  return line.availability === "InStock";
}

/** Formats minor units as a currency string. The one formatting entry point. */
export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount / 100);
}

export function lineAmount(line: CartLine): number {
  return line.unitAmount * line.quantity;
}

/** Builds the single-product line the mock catalogue describes. */
export function catalogueLine(
  quantity = 1,
  product: CatalogueProduct = mockCatalogue,
  id = "lunar-base",
): CartLine {
  return {
    id,
    productName: product.name,
    unitAmount: product.price.amount,
    currency: product.price.currency,
    quantity,
    availability: product.availability,
  };
}

export interface TotalsOptions {
  /**
   * Whether a delivery address has been entered. The basket page passes
   * `false` (it has no address form), the checkout page passes whether its own
   * form is complete.
   */
  readonly hasDeliveryAddress: boolean;
  readonly shipping?: ShippingMethod;
}

export function cartTotals(
  lines: readonly CartLine[],
  { hasDeliveryAddress, shipping = declaredShippingMethod }: TotalsOptions,
): CartTotals {
  const goodsAmount = lines
    .filter((line) => isAvailable(line))
    .reduce((sum, line) => sum + lineAmount(line), 0);

  const shippingAmount = hasDeliveryAddress && lines.length > 0 ? shipping.amount : null;

  return {
    currency: lines[0]?.currency ?? shipping.currency,
    goodsAmount,
    shippingAmount,
    orderAmount: shippingAmount === null ? null : goodsAmount + shippingAmount,
  };
}

/** Clamps a requested quantity into what a basket may hold. `0` means "remove". */
export function clampQuantity(requested: number): number {
  if (!Number.isFinite(requested)) return 1;
  const whole = Math.trunc(requested);
  if (whole < 0) return 0;
  return Math.min(whole, MAX_QUANTITY_PER_LINE);
}
