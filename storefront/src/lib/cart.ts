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
 * method, **two flat rates on a zone axis** — both operator-supplied on
 * 2026-08-10 — because the plan forbids calculated carrier rates and live
 * carrier rates are out of scope. **No price literal appears in this file**,
 * which is what `tests/no-hardcoded-price.test.ts` enforces across `src/`.
 *
 * ## The zone, and why the country field is a selection
 *
 * Which of the two rates applies is decided by whether the delivery address is
 * in an **EU member state** — one of the 27, which is narrower than "in the
 * EU": Åland and the French outermost regions are in a member state's
 * territory and are charged the higher rate, because {@link DeliveryCountry}'s
 * `euMember` flag is membership and nothing wider. That decision is made
 * **from a country the buyer chose out of
 * `storefront/mock/countries.json`, never from typed text**. A rate driven
 * from a free-text field charges `Estonai`, `eesti` and `EE` the non-EU rate,
 * and overcharging an EU customer by five euro through a spelling difference
 * is a defect rather than an edge case. {@link zoneForCountryName} is
 * therefore total and conservative: a value that is not exactly one of the
 * listed names is **not a zone**, so it produces no charge at all rather than
 * the more expensive one.
 *
 * ## Why the shipping charge and the total are nullable
 *
 * `content/legal/shipping.ts` says shipping "is calculated at checkout once
 * you have entered a delivery address", and `content/legal/terms.ts` requires
 * the shipping charge **and** the total to be on the screen carrying the order
 * button. Both are true at once only if the basket page can say "calculated at
 * checkout" and the checkout page can show a figure the moment the address is
 * complete. So {@link CartTotals.shippingAmount} and
 * {@link CartTotals.orderAmount} are `null` until a delivery zone is known,
 * and {@link orderMayBePlaced} refuses an order while either is `null` — a
 * buyer cannot be bound by a screen that has not yet shown them the total.
 *
 * ## A basket holding something we cannot supply has no price and no total
 *
 * A line whose catalogue availability is not `InStock` is not something we can
 * sell today. Pricing it into a total we could not honour is the failure mode
 * this rule exists to prevent — and so is pricing it at **nothing**, which is
 * what excluding it from the sum used to do: the disclosure block on
 * `/checkout` listed "Lunar Base × 1" as the goods, gave their price as a
 * formatted zero, and gave a total that was the shipping charge on its own.
 * Article 8(2) CRD is a disclosure obligation, so a screen that refuses the
 * order but states a false price has still made the false statement.
 *
 * {@link CartTotals.goodsAmount} is therefore `null` — not `0` — whenever any
 * line cannot be supplied, and {@link CartTotals.orderAmount} follows it. Both
 * screens render an instruction in place of the figure, exactly as they
 * already do for the two amounts that wait on a delivery address. The honest
 * answer to "what do these goods cost?" for a basket we cannot sell is
 * "nothing is being stated", not "nothing".
 */

import { mockCatalogue, type CatalogueAvailability, type CatalogueProduct } from "./catalogue.js";
import countriesSource from "../../mock/countries.json";
import shippingSource from "../../mock/shipping.json";

/**
 * The most of one line a single order may carry. A limit, never a stock count.
 *
 * **Operator-approved, 2026-08-10.** It reached a buyer's screen — as
 * `max="10"` on the quantity field and inside the message that rejects an
 * out-of-range entry — before anybody had allowed it, and it carried a warning
 * saying so. The operator has since allowed this value. **The figure has not
 * changed; only the marking has**, and the warning is gone rather than left
 * standing asking for an input that has been given. Task 5 must seed the live
 * cart's per-line limit to match it, exactly as it must for `catalogue.json`
 * and `shipping.json`.
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

/**
 * Which of the two operator-supplied flat rates an order is charged.
 *
 * Two values and no third: the operator froze EU and non-EU on 2026-08-10 and
 * nothing else. It is **not** a rate table and must not grow into one — weight
 * bands, carrier rates and per-country pricing are all explicitly out of scope.
 */
export type ShippingZone = "europeanUnion" | "restOfWorld";

export const SHIPPING_ZONES: readonly ShippingZone[] = ["europeanUnion", "restOfWorld"];

export interface ShippingMethod {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  /** Minor units, one per zone. Both are operator-supplied — see the JSON's `$comment`. */
  readonly rates: Readonly<Record<ShippingZone, number>>;
}

interface ShippingFile {
  readonly method: ShippingMethod;
}

/**
 * One country a parcel can be sent to, as `storefront/mock/countries.json`
 * holds it.
 *
 * `name` is what the form submits and what the Article 8(2) delivery-address
 * disclosure shows; `code` is ISO 3166-1 alpha-2, carried for Task 5's Medusa
 * regions. **`euMember` means "one of the 27 EU member states"**, and nothing
 * wider — not the VAT territory and not the customs territory. See
 * {@link zoneForCountryName}.
 */
export interface DeliveryCountry {
  readonly code: string;
  readonly name: string;
  readonly euMember: boolean;
}

interface CountriesFile {
  readonly countries: readonly DeliveryCountry[];
}

/**
 * Refuses a shipping file that cannot price an order, at import.
 *
 * A missing or non-integer rate would otherwise reach a total as `NaN` or
 * `undefined` and be formatted onto the one screen Article 8(2) CRD requires
 * to be right. The same argument as {@link assertOneCurrency}, one step
 * earlier: the file is edited by hand, and by an operator rather than by
 * whoever wrote this.
 */
function assertPriceable(method: ShippingMethod): ShippingMethod {
  for (const zone of SHIPPING_ZONES) {
    const amount = method.rates[zone];
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(
        `storefront/mock/shipping.json declares no usable "${zone}" rate (got ${String(amount)}). ` +
          "Every zone needs a positive whole number of minor units, or the checkout would put a " +
          "meaningless shipping charge and total on the screen Article 8(2) CRD requires to be correct.",
      );
    }
  }
  return method;
}

/** The one declared shipping method — see `storefront/mock/shipping.json`. */
export const declaredShippingMethod: ShippingMethod = assertPriceable(
  (shippingSource as ShippingFile).method,
);

/**
 * Every country the delivery-address field offers, in the order it offers
 * them — see `storefront/mock/countries.json`.
 *
 * All of them, because `content/legal/shipping.ts` says "We ship to every
 * country" and narrowing that is a commercial decision the operator has not
 * made.
 */
export const deliveryCountries: readonly DeliveryCountry[] = (countriesSource as CountriesFile)
  .countries;

const COUNTRIES_BY_NAME: ReadonlyMap<string, DeliveryCountry> = new Map(
  deliveryCountries.map((country) => [country.name, country]),
);

/**
 * The zone a delivery address falls in, or `null` when it does not name a
 * country this site knows.
 *
 * **It never guesses, and it never falls back to the more expensive rate.**
 * The country reaching it comes from a `<select>` over
 * {@link deliveryCountries}, so in the served application it is always either
 * empty or an exact member of that list; anything else is a value the form
 * could not have produced, and the honest answer to it is "no zone" — which
 * leaves the shipping charge and the total unshown and the order unplaceable,
 * rather than charging somebody the non-EU rate on a string nobody recognises.
 *
 * The match is exact rather than trimmed, lower-cased or fuzzy **on purpose**:
 * a lookup that repairs its input is a lookup that can repair it wrongly, and
 * this is the function that decides which of two prices a buyer pays.
 */
export function zoneForCountryName(countryName: string): ShippingZone | null {
  const country = COUNTRIES_BY_NAME.get(countryName);
  if (country === undefined) return null;
  return country.euMember ? "europeanUnion" : "restOfWorld";
}

export interface CartTotals {
  readonly currency: string;
  /**
   * Sum of every line, in minor units — or `null` when the basket holds a line
   * we cannot supply, because then there is no price that describes what is in
   * it. See this module's doc comment.
   */
  readonly goodsAmount: number | null;
  /** `null` until a delivery address exists — see this module's doc comment. */
  readonly shippingAmount: number | null;
  /** `null` whenever {@link goodsAmount} or {@link shippingAmount} is. */
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
   * The zone the delivery address falls in, or `null` when there is no address
   * to read one from. The basket page passes `null` (it has no address form);
   * the checkout page passes {@link zoneForCountryName} of the selected
   * country, and `null` while any address field is still incomplete.
   *
   * **`null` is what makes the charge and the total unshown**, which is the
   * state `content/legal/shipping.ts` describes as "calculated at checkout
   * once you have entered a delivery address".
   */
  readonly deliveryZone: ShippingZone | null;
  readonly shipping?: ShippingMethod;
}

/**
 * Refuses to sum two currencies, loudly.
 *
 * `cartTotals` adds a goods figure derived from `storefront/mock/catalogue.json`
 * to a shipping charge declared in `storefront/mock/shipping.json`, and then
 * formats the result in one currency. That is only arithmetic if the two agree.
 * They both say EUR today, and both files are **operator-supplied commercial
 * facts that Task 5 has to seed a live system to match** — which is exactly why
 * this guard stays: they are edited by hand, together, by somebody who is
 * deciding commerce rather than reading this module. An edit that moved one
 * file's currency and not the other's would otherwise produce a wrong total on
 * the exact screen Article 8(2) CRD requires to be right, silently.
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
  { deliveryZone, shipping = declaredShippingMethod }: TotalsOptions,
): CartTotals {
  assertOneCurrency(lines, shipping);

  /*
   * A basket we cannot supply in full is not priced at all — see this module's
   * doc comment. Summing only the available lines produced a figure that
   * described a different basket from the one the same screen was listing, and
   * a formatted zero is a statement about a price rather than its absence.
   */
  const goodsAmount = lines.every((line) => isAvailable(line))
    ? lines.reduce((sum, line) => sum + lineAmount(line), 0)
    : null;

  const shippingAmount =
    deliveryZone !== null && lines.length > 0 ? shipping.rates[deliveryZone] : null;

  return {
    currency: lines[0]?.currency ?? shipping.currency,
    goodsAmount,
    shippingAmount,
    orderAmount:
      goodsAmount === null || shippingAmount === null ? null : goodsAmount + shippingAmount,
  };
}

/**
 * **THE ARTICLE 8(2) INVARIANT — do not delete this as redundant.**
 *
 * > No order placement can succeed in any state where all six Article 8(2)
 * > values are not displayed as values.
 *
 * `content/legal/terms.ts` states that immediately above the order button a
 * buyer sees, on one screen: the goods, the price of the goods, the shipping
 * charge, the total, the delivery address and the delivery estimate. Three of
 * those six are conditional on the delivery address — the shipping charge and
 * the total are `null` without a zone, and the address itself renders as an
 * instruction until it is complete — so there is a real, reachable state in
 * which the screen shows three values and three instructions. Article 8(2)
 * requires the disclosure *before the consumer places his order*, so an order
 * must be unplaceable in exactly that state.
 *
 * It is a **function rather than a paragraph** because it decays silently the
 * moment somebody makes the order button optimistic, or adds a "quick order"
 * path, or removes a check from a submit handler while refactoring. Today no
 * placement can succeed at all — payment is not connected, and
 * `placeMockOrder` always fails — so this is the half that is testable now, and
 * `tests/shop-pages.test.tsx` names the invariant where it drives it.
 *
 * The unavailable-line condition is here too, and belongs here: a line we
 * cannot supply leaves the basket with no price of the goods and no total at
 * all, so the figures a buyer would be bound by do not exist. It is stated
 * twice on purpose — once as the explicit `isAvailable` refusal below and once
 * through {@link CartTotals.goodsAmount} being `null` — because the two say
 * different things. The first is "this order may not be placed"; the second is
 * "this basket has no price". Article 8(2) is a disclosure obligation, so
 * refusing the placement without withholding the figure leaves a false
 * statement on the screen, which is exactly what shipped.
 */
export function orderMayBePlaced({
  lines,
  addressComplete,
  totals,
}: {
  readonly lines: readonly CartLine[];
  readonly addressComplete: boolean;
  readonly totals: CartTotals;
}): boolean {
  if (lines.length === 0) return false;
  if (lines.some((line) => !isAvailable(line))) return false;
  if (!addressComplete) return false;
  return (
    totals.goodsAmount !== null && totals.shippingAmount !== null && totals.orderAmount !== null
  );
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
