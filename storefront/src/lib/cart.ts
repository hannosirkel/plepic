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
 * the frozen commercial contract the live catalogue is seeded to match.
 * The shipping charge comes from `storefront/mock/shipping.json`: one declared
 * method, **two flat rates on a zone axis** — both operator-supplied on
 * 2026-08-10 — because the plan forbids calculated carrier rates and live
 * carrier rates are out of scope. **No price literal appears in this file**,
 * which is what `tests/no-hardcoded-price.test.ts` enforces across `src/`.
 *
 * ## Every figure here is net, and that is the mock layer's whole scope
 *
 * Both declared shipping rates are **before tax**, on the same rule as the
 * product price: Estonian VAT is added to delivery inside the EU and to nothing
 * else. This module does not add it, and there is no rate here to add — see
 * `./catalogue.js` for why the storefront computes no tax anywhere.
 *
 * The consequence is worth stating plainly rather than discovering. What
 * {@link cartTotals} produces is the bill for a destination that is charged no
 * VAT, which is the rest of the world — the net price of the goods, the
 * rest-of-world delivery rate, and their sum — and it is exactly right for that
 * destination and understated for an EU one. That is tolerable because the only surfaces
 * that use it are the `?mock=` scenarios, which are unreachable on a live
 * hostname (`isMockLayerEnabled`), and the pre-address state of `/checkout`,
 * which states no total at all. **Every figure a real buyer is shown comes from
 * Medusa**: `./cart-store.js` reads `item_total` off the cart and
 * `./store-checkout.js` reads the six checkout totals, because Medusa is the
 * thing that knows the destination's tax.
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
import {
  defaultDestination,
  deliveryCountries,
  type DeliveryCountry,
  type Destination,
} from "./destination.js";
import shippingSource from "../../mock/shipping.json";

/*
 * The country list and its `euMember` flag moved to `./destination.js` when the
 * destination selector arrived. The same list now answers two questions — which
 * shipping zone a confirmed delivery address falls in, and which figure a
 * visitor is quoted before they have entered one — and there may be exactly one
 * of it, for the reason `backend/src/commerce/tax-model.ts` gives for there
 * being one list of member states: an order zoned by one list and taxed by
 * another is an order priced twice.
 *
 * Re-exported rather than repointed in every caller, because the callers here
 * are asking the *shipping* question and this is the module that answers it.
 */
export { deliveryCountries, type DeliveryCountry } from "./destination.js";

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
  /** Medusa's product-variant identifier when this line came from the Store API. */
  readonly variantId?: string;
  readonly productName: string;
  /** Minor units, as the catalogue holds them. */
  readonly unitAmount: number;
  /**
   * The tax contained in {@link unitAmount}, per unit — `0` where none is,
   * and **absent** where nobody has answered.
   *
   * The distinction is the one this module draws everywhere: `0` is "this
   * destination attracts no VAT", which is true of every export, and absent is
   * "no authority has been asked". A line built from the catalogue knows,
   * because the catalogue holds the amount with tax and the amount without and
   * the difference between two declared figures is not a computation of tax. A
   * line from Medusa does not carry it, because on that path every figure the
   * checkout renders comes from `./store-checkout.js` instead.
   */
  readonly taxAmount?: number;
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
  /**
   * Minor units, one per zone, **before tax**. Both are operator-supplied —
   * see the JSON's `$comment`.
   */
  readonly rates: Readonly<Record<ShippingZone, number>>;
  /**
   * The same two rates with the tax the zone attracts, in minor units — the
   * figures a buyer is actually charged.
   *
   * Data, never derived: this workspace has no rate and computes no tax. The
   * two tables are identical for `restOfWorld`, because no EU VAT arises on an
   * export, and that identity is a statement rather than a gap.
   */
  readonly ratesWithTax: Readonly<Record<ShippingZone, number>>;
}

/**
 * The second delivery method, offered to three countries and priced at
 * nothing — `storefront/mock/shipping.json`'s `parcelMachine` block.
 *
 * `name` is the string that crosses the boundary: the storefront cannot
 * import `backend/src/commerce/shipping-model.ts`, so a later task that adds
 * the machine picker recognises this method among the ones Medusa returns by
 * comparing that method's display name to {@link ParcelMachineMethod.name}
 * read from here — see `mock/shipping.json`'s `$comment`.
 */
export interface ParcelMachineMethod {
  readonly id: string;
  readonly name: string;
  /** Minor units. Operator-frozen at `0` — see the JSON's `$comment`. */
  readonly rate: number;
  /** ISO 3166-1 alpha-2, the only zone this method is offered in. */
  readonly countries: readonly string[];
}

interface ShippingFile {
  readonly method: ShippingMethod;
  readonly parcelMachine: ParcelMachineMethod;
}

/**
 * Refuses a shipping file that cannot price an order.
 *
 * Exported for one reason: it is called at **import** over a committed file, so
 * every branch in it is unreachable from a test that only imports the module —
 * and a refusal nothing can reach is decoration wearing a guard's clothes. The
 * neighbours in this file have the same shape and the same problem; this one is
 * exported because it grew a new branch with the tax-inclusive table, and a new
 * unreachable branch is worse than an inherited one.
 *
 * A missing or non-integer rate would otherwise reach a total as `NaN` or
 * `undefined` and be formatted onto the one screen Article 8(2) CRD requires
 * to be right. The same argument as {@link assertOneCurrency}, one step
 * earlier: the file is edited by hand, and by an operator rather than by
 * whoever wrote this.
 */
export function assertPriceable(method: ShippingMethod): ShippingMethod {
  for (const zone of SHIPPING_ZONES) {
    for (const [label, table] of [
      ["rate", method.rates],
      ["tax-inclusive rate", method.ratesWithTax],
    ] as const) {
      const amount = table[zone];
      if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(
          `storefront/mock/shipping.json declares no usable "${zone}" ${label} (got ${String(amount)}). ` +
            "Every zone needs a positive whole number of minor units, or the checkout would put a " +
            "meaningless shipping charge and total on the screen Article 8(2) CRD requires to be correct.",
        );
      }
    }
    if (method.ratesWithTax[zone] < method.rates[zone]) {
      throw new Error(
        `storefront/mock/shipping.json prices the "${zone}" zone lower with tax than without it, ` +
          "so one of the two tables is wrong and the checkout cannot tell which.",
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
 * Refuses a parcel-machine block this checkout could not honestly offer.
 *
 * The same reasoning as {@link assertPriceable}, over a second method
 * `mock/shipping.json` gained on 2026-08-26: it is edited by hand, by an
 * operator, and a block nothing checks is exactly how a malformed `rate` or
 * an empty `countries` list would reach a buyer's screen. Called at
 * **import**, over a committed file — see {@link assertPriceable}'s doc
 * comment for why that makes every branch below unreachable from a test that
 * only imports this module, and why it is exported anyway.
 */
export function assertParcelMachine(method: ParcelMachineMethod): ParcelMachineMethod {
  if (typeof method.name !== "string" || method.name.trim().length === 0) {
    throw new Error(
      `storefront/mock/shipping.json declares no usable parcel machine "name" (got ${JSON.stringify(method.name)}). ` +
        "A method the checkout cannot name is a method it cannot offer.",
    );
  }
  if (!Number.isInteger(method.rate) || method.rate < 0) {
    throw new Error(
      `storefront/mock/shipping.json declares no usable parcel machine "rate" (got ${String(method.rate)}). ` +
        "It must be a whole number of minor units, zero or more, or the checkout would put a " +
        "meaningless charge on the screen Article 8(2) CRD requires to be correct.",
    );
  }
  if (!Array.isArray(method.countries) || method.countries.length === 0) {
    throw new Error(
      'storefront/mock/shipping.json declares no "countries" for the parcel machine method. ' +
        "A method offered nowhere is a method that cannot be sold, and the checkout has no way to tell " +
        "that apart from one nobody has configured yet.",
    );
  }
  for (const code of method.countries) {
    if (typeof code !== "string" || !/^[A-Z]{2}$/.test(code)) {
      throw new Error(
        `storefront/mock/shipping.json's parcel machine "countries" contains ${JSON.stringify(code)}, ` +
          "which is not an ISO 3166-1 alpha-2 country code. A malformed code cannot be matched against " +
          "a delivery address, so the method would silently never appear.",
      );
    }
  }
  return method;
}

/** The one declared parcel machine method — see `storefront/mock/shipping.json`. */
export const declaredParcelMachineMethod: ParcelMachineMethod = assertParcelMachine(
  (shippingSource as ShippingFile).parcelMachine,
);

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
  /**
   * The VAT contained in {@link orderAmount}, or `null` when nobody has
   * answered.
   *
   * **`null` and `0` mean different things and the screen says so.** `null` is
   * "no authority has been asked yet" — this module never computes tax and has
   * no rate to compute it with, so every total it builds itself carries `null`
   * here. `0` is Medusa's answer for a destination outside the EU, where no EU
   * VAT arises at all. Neither renders a VAT row: there is nothing to break
   * down, and a row stating a formatted zero claims a zero-rating this shop
   * does not apply. The row appears only for a positive figure Medusa supplied.
   *
   * It is **inside** {@link goodsAmount} and {@link shippingAmount}, never
   * added to them — see `./store-checkout.js`, which refuses a set of figures
   * where that is not arithmetically true.
   */
  readonly taxAmount: number | null;
  /**
   * The part of {@link taxAmount} that sits inside {@link shippingAmount}.
   *
   * Carried so a delivery method's quoted figure can be checked against what
   * Medusa charged for it even when the quote was a net one — see
   * `shippingOptionFigure` in `./store-checkout.js`.
   */
  readonly shippingTaxAmount: number | null;
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

/**
 * Builds the single-product line the mock catalogue describes, **for a
 * destination**.
 *
 * `unitAmount` is the figure that destination is charged — the catalogue's
 * gross amount inside the EU and its net amount everywhere else. It is a
 * *choice between two amounts the catalogue holds*, exactly as
 * `./catalogue.js` makes it, and no tax is computed here either.
 *
 * A real basket line never comes from here: it comes from Medusa, through
 * `cartLinesFromStore` in `./cart-store.js`. This exists so the mock layer
 * states the same commercial model the live one does — a mock that priced an
 * Estonian basket net would paint a screen no buyer can ever be shown, and the
 * qualification beside it would be the one thing on the page that was false.
 */
export function catalogueLine(
  quantity = 1,
  product: CatalogueProduct = mockCatalogue,
  id = "lunar-base",
  destination: Destination = defaultDestination,
): CartLine {
  return {
    id,
    productName: product.name,
    unitAmount: destination.euMember ? product.price.amountWithTax : product.price.amount,
    // The difference between two amounts the catalogue holds. No rate.
    taxAmount: destination.euMember ? product.price.amountWithTax - product.price.amount : 0,
    currency: product.price.currency,
    quantity,
    availability: product.availability,
  };
}

/**
 * Re-prices the mock basket's lines for a destination. **Mock layer only.**
 *
 * A mock basket is built when the provider mounts, for the destination set on
 * the site. The checkout then asks for a delivery address, and that address may
 * be somewhere else — so the goods figure and the shipping figure would be
 * quoted for two different places, and the qualification beside them could only
 * agree with one.
 *
 * In production this does not arise: once the address is complete and a method
 * is chosen, Medusa returns **every** figure priced against that address, goods
 * included. This is the mock layer doing the same thing with the one product it
 * has — a choice between the two amounts the catalogue holds, not a
 * computation.
 */
export function catalogueLinesForDestination(
  lines: readonly CartLine[],
  destination: Destination,
  product: CatalogueProduct = mockCatalogue,
): readonly CartLine[] {
  return lines.map((line) => ({
    ...line,
    unitAmount: destination.euMember ? product.price.amountWithTax : product.price.amount,
    taxAmount: destination.euMember ? product.price.amountWithTax - product.price.amount : 0,
  }));
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

  /*
   * The **charged** figure, not the quoted-before-tax one. `rates` is what the
   * operator froze and what the legal page describes as a rate; `ratesWithTax`
   * is what a buyer pays, and this screen is the one Article 8(2) CRD requires
   * to state what a buyer pays.
   */
  const shippingAmount =
    deliveryZone !== null && lines.length > 0 ? shipping.ratesWithTax[deliveryZone] : null;
  const shippingTaxAmount =
    deliveryZone !== null && lines.length > 0
      ? shipping.ratesWithTax[deliveryZone] - shipping.rates[deliveryZone]
      : null;

  /*
   * The seventh value, where this module can honestly state one.
   *
   * `content/legal/shipping.ts` promises the VAT amount "is shown separately
   * at checkout", so a screen that charges an EU buyer a tax-inclusive total
   * and shows no VAT row is a screen that does not keep the page's own
   * promise. Every part of it here is the **difference between two declared
   * figures** — the catalogue's two amounts, and the shipping file's two rate
   * tables — never a rate applied to anything.
   *
   * `null` where nobody has answered, and it stays `null` for a basket built
   * from Medusa lines (which carry no per-line tax) and for any state without
   * a delivery zone. That is the same distinction the rest of this module
   * draws: "nothing has been asked" is not "nothing".
   */
  const goodsTaxAmount =
    goodsAmount !== null && lines.every((line) => line.taxAmount !== undefined)
      ? lines.reduce((sum, line) => sum + (line.taxAmount ?? 0) * line.quantity, 0)
      : null;
  const taxAmount =
    goodsTaxAmount === null || shippingTaxAmount === null
      ? null
      : goodsTaxAmount + shippingTaxAmount;

  return {
    currency: lines[0]?.currency ?? shipping.currency,
    goodsAmount,
    shippingAmount,
    orderAmount:
      goodsAmount === null || shippingAmount === null ? null : goodsAmount + shippingAmount,
    taxAmount,
    shippingTaxAmount,
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
 *
 * ## The parcel machine method adds a seventh refusal
 *
 * Task 5 gave the Omniva parcel machine method a second control: the
 * delivery method alone does not name a collectible destination, a specific
 * machine does. `orderMayBePlaced` cannot know Medusa's option list or
 * `isParcelMachineOption` itself — that would import `store-checkout.ts`,
 * which already imports **this** module for {@link ShippingZone}, and a
 * circular import between the two is a defect nothing here should have to
 * survive. So the caller decides, and states the answer as the one thing
 * this function needs: whether a selected method is that one with nothing
 * chosen yet. `CheckoutPageContent` computes it from the selection it
 * already holds, exactly as it already computes {@link addressComplete}
 * from the form rather than handing this function the form itself.
 */
export function orderMayBePlaced({
  lines,
  addressComplete,
  totals,
  parcelMachineNeedsZip = false,
}: {
  readonly lines: readonly CartLine[];
  readonly addressComplete: boolean;
  readonly totals: CartTotals;
  /**
   * True when the buyer has selected the Omniva parcel machine method but not
   * yet chosen a specific machine — a selected method with no collectable
   * destination, which `addGuestShippingMethod` in `./store-checkout.js`
   * refuses to add for the same reason. Defaults to `false` so every caller
   * that predates the parcel machine method — every test in
   * `tests/shop-pages.test.tsx` among them — keeps its existing meaning
   * unchanged.
   */
  readonly parcelMachineNeedsZip?: boolean;
}): boolean {
  if (lines.length === 0) return false;
  if (lines.some((line) => !isAvailable(line))) return false;
  if (!addressComplete) return false;
  if (parcelMachineNeedsZip) return false;
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
