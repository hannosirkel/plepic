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

/**
 * The most of one line a single order may carry. A limit, never a stock count.
 *
 * **THIS FIGURE IS NOT AN OPERATOR-FROZEN COMMERCIAL FACT.** It carries the
 * same warning `storefront/mock/shipping.json` carries about its shipping
 * amount, and for the same reason. Every value in `storefront/mock/catalogue.json`
 * comes from Task 1's migration-inputs manifest; this one does not appear
 * there, in `content/`, or anywhere else in the repository. It was chosen only
 * so that the basket's quantity control has a stated upper bound to accept or
 * reject an entry against, and it reaches a buyer's screen — as `max="10"` on
 * the quantity field and inside the message that rejects an out-of-range entry.
 * **It is the operator's to set**, and Task 5 must seed the live cart's
 * per-line limit to match it, exactly as it must for `catalogue.json` and
 * `shipping.json`.
 *
 * It is written **here and nowhere else**: no copy in `content/` repeats it,
 * and the rejection message composes it in at render, so there is no second
 * figure that can disagree with this one.
 */
export const MAX_QUANTITY_PER_LINE = 10;

/** The fewest of one line a basket may hold. Removal is the "Remove" control, not a zero. */
export const MIN_QUANTITY_PER_LINE = 1;

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

/**
 * Refuses to sum two currencies, loudly.
 *
 * `cartTotals` adds a goods figure derived from `storefront/mock/catalogue.json`
 * to a shipping charge declared in `storefront/mock/shipping.json`, and then
 * formats the result in one currency. That is only arithmetic if the two agree.
 * They both say EUR today — and `shipping.json` is, by its own `$comment`, the
 * file in this area most likely to be edited, because its amount is the one
 * figure here still waiting on the operator. An edit that changed its currency
 * and not the catalogue's would otherwise produce a wrong total on the exact
 * screen Article 8(2) CRD requires to be right, silently.
 *
 * So it throws. A checkout that cannot compute an honest total must not render
 * a dishonest one, and this unit's own principle is that the checkout never
 * asserts something that is not true.
 */
function assertOneCurrency(lines: readonly CartLine[], shipping: ShippingMethod): void {
  const mismatch = lines.find((line) => line.currency !== shipping.currency);
  if (mismatch === undefined) return;

  throw new Error(
    `the basket cannot be totalled: line "${mismatch.id}" is priced in ${mismatch.currency} but ` +
      `storefront/mock/shipping.json declares the shipping charge in ${shipping.currency}. ` +
      "Adding them would put a wrong total on the screen Article 8(2) CRD requires to be " +
      "correct. Change the two together, or add a conversion — never sum them.",
  );
}

export function cartTotals(
  lines: readonly CartLine[],
  { hasDeliveryAddress, shipping = declaredShippingMethod }: TotalsOptions,
): CartTotals {
  assertOneCurrency(lines, shipping);

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

/**
 * Clamps an already-numeric quantity into what a basket may hold. `0` means
 * "remove", and a value that is not a finite number is `0` as well.
 *
 * **It is not a parser, and it is not where a typed entry is decided.** It used
 * to answer `1` for a non-finite input, which turned an unparseable entry into
 * "one" and quietly destroyed the four other copies a basket was holding. A
 * value that is not a number is not a quantity, and the honest answer is
 * "nothing", not "one". What a *person typed* is decided by
 * {@link parseQuantityInput}, which rejects rather than reinterprets; this
 * function guards the two places a number arrives from somewhere other than a
 * keystroke — a restored `sessionStorage` entry, and the increment inside
 * `addCatalogueLineAction`.
 */
export function clampQuantity(requested: number): number {
  if (!Number.isFinite(requested)) return 0;
  const whole = Math.trunc(requested);
  if (whole < 0) return 0;
  return Math.min(whole, MAX_QUANTITY_PER_LINE);
}

/* ------------------------------------------------------------------------ */
/* The quantity control                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Why an entry was refused. The basket maps this to copy; nothing here writes
 * a sentence, because `content/` owns the words.
 */
export type QuantityRejection = "empty" | "not-a-whole-number" | "out-of-range";

export type QuantityParse =
  | { readonly ok: true; readonly quantity: number }
  | { readonly ok: false; readonly reason: QuantityRejection };

/**
 * What a person typed into the quantity field, decided.
 *
 * **Rejects; never reinterprets.** A cleared field does not mean "one", `-4`
 * does not mean "empty the basket", `2.5` does not mean "two", and `99` does
 * not mean {@link MAX_QUANTITY_PER_LINE}. Each of those is refused and said
 * so, because the alternative is a basket that silently holds something other
 * than what its owner asked for — and the figures on this screen feed the
 * Article 8(2) disclosure block on `/checkout`.
 */
export function parseQuantityInput(raw: string): QuantityParse {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty" };
  if (!/^[+-]?\d+$/.test(trimmed)) return { ok: false, reason: "not-a-whole-number" };

  const quantity = Number.parseInt(trimmed, 10);
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < MIN_QUANTITY_PER_LINE ||
    quantity > MAX_QUANTITY_PER_LINE
  ) {
    return { ok: false, reason: "out-of-range" };
  }

  return { ok: true, quantity };
}

/**
 * The quantity control's whole behaviour, as data.
 *
 * The control is a text field and a button, which is three states in a trench
 * coat: what the basket holds, what the field currently shows, and whether the
 * last attempt was refused. The defect this replaces kept only the second, so
 * the field went on showing `99` while the basket held `10`.
 *
 * It lives here, apart from React, for one reason: `storefront/` has no DOM in
 * its test environment (no `jsdom`, no browser runner — see the fix report),
 * so a component test can only assert rendered markup. Keeping the decisions
 * in a reducer means the sequences that produced the defect — *type `99`, press
 * Update*; *clear the field, press Update*; *type `-4`, press Update*; *update
 * successfully, watch the field* — are driven directly in
 * `tests/shop-pages.test.tsx`, and `BasketPageContent` is a thin binding over
 * them rather than the only place they exist.
 */
export interface QuantityFieldState {
  /** What the basket holds. */
  readonly settled: number;
  /** What the field shows. */
  readonly draft: string;
  /** Why the last attempt was refused, or `null`. */
  readonly rejection: QuantityRejection | null;
}

export type QuantityFieldEvent =
  /** A keystroke, a paste, a spinner press — anything that changes the field. */
  | { readonly kind: "type"; readonly value: string }
  /** "Update" pressed, or Enter in the field. */
  | { readonly kind: "submit" }
  /** An action landed and the basket now holds this. */
  | { readonly kind: "settle"; readonly quantity: number };

export interface QuantityFieldTransition {
  readonly state: QuantityFieldState;
  /** The quantity to ask the cart for, or `null` when nothing is requested. */
  readonly request: number | null;
}

export function initialQuantityField(quantity: number): QuantityFieldState {
  return { settled: quantity, draft: String(quantity), rejection: null };
}

export function quantityFieldReducer(
  state: QuantityFieldState,
  event: QuantityFieldEvent,
): QuantityFieldTransition {
  switch (event.kind) {
    case "type":
      // Editing clears the refusal: a message about the previous entry, still
      // on screen beside a field that no longer holds it, is a message about
      // nothing.
      return { state: { ...state, draft: event.value, rejection: null }, request: null };

    case "submit": {
      const parsed = parseQuantityInput(state.draft);
      if (!parsed.ok) {
        // The typed text stays. The basket is unchanged and the message says
        // so, and a reader cannot correct an entry they can no longer see.
        return { state: { ...state, rejection: parsed.reason }, request: null };
      }
      // Canonical form, so "05" and "+5" do not linger beside a basket of 5.
      return {
        state: { ...state, draft: String(parsed.quantity), rejection: null },
        request: parsed.quantity,
      };
    }

    case "settle":
      // The one line that closes MAJ-1: whatever the field was showing, the
      // basket has spoken.
      return { state: initialQuantityField(event.quantity), request: null };
  }
}
