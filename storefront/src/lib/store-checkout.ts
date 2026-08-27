import { ConfigError } from "../config/env.js";
import {
  declaredParcelMachineMethod,
  deliveryCountries,
  formatAmount,
  type CartTotals,
} from "./cart.js";
import type { createMedusaStoreClient } from "./medusa-client.js";
import { medusaMajorToMinor } from "./store-money.js";

type StoreClient = ReturnType<typeof createMedusaStoreClient>;

export interface GuestCheckoutAddress {
  readonly fullName: string;
  readonly streetAddress: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
  readonly email: string;
}

export interface GuestShippingOption {
  readonly id: string;
  readonly name: string;
  /**
   * The stored amount for this option, in minor units — Medusa's
   * `calculated_price.calculated_amount`, which under this shop's price
   * preferences is the rate **before tax**.
   */
  readonly amount: number;
  /**
   * `calculated_price.calculated_amount_with_tax`, or `null` when Medusa
   * supplies none.
   *
   * **It is `null` today, and that is a finding rather than a defensive
   * branch.** Verified against the installed `@medusajs` packages:
   * `calculated_amount_with_tax` is written by exactly two files in the whole
   * tree — `@medusajs/medusa/dist/api/store/products/helpers.js` and
   * `.../product-variants/helpers.js` — and there is no equivalent for
   * shipping options. `listShippingOptionsForCartWorkflow` sets only `amount`
   * from `calculated_price.calculated_amount` and `is_tax_inclusive` from
   * `calculated_price.is_calculated_price_tax_inclusive`
   * (`@medusajs/core-flows/dist/cart/workflows/list-shipping-options-for-cart.js`).
   * So a **flat-rate option carries no with-tax amount before the method is
   * added**: the tax on delivery exists only once the method is on the cart
   * and Medusa recomputes the cart's totals.
   *
   * The field stays because the absence is Medusa's to change and not ours to
   * assume. If a later version populates it, {@link shippingOptionFigure}
   * reads it and the "+ VAT" branch stops being taken with no other edit.
   */
  readonly amountWithTax: number | null;
  /**
   * `calculated_price.is_calculated_price_tax_inclusive` — whether
   * {@link amount} already contains the tax.
   *
   * **Required to be present.** Without it there is no way to tell the net
   * delivery rate from the gross one, and the defect this replaces was
   * rendering `option.amount` bare while the summary beside it showed the
   * grossed figure. A missing flag is a malformed option, not a default.
   */
  readonly taxInclusive: boolean;
}

/**
 * What a delivery method's price may be *shown* as, and whether that is the
 * whole of it.
 *
 * A bare net rate beside a summary charging the grossed one is the defect this
 * type exists to make unrepresentable: a figure for a delivery method now
 * always arrives with a statement about whether it is final.
 */
export interface ShippingOptionFigure {
  /** Minor units — the number {@link label} states. */
  readonly amount: number;
  /** What a reader sees: either a figure, or a figure explicitly marked "+ VAT". */
  readonly label: string;
  /**
   * True when {@link amount} is the whole charge; false when it is a net rate
   * VAT will be added to, in which case {@link label} says so.
   */
  readonly final: boolean;
}

/** What "+ VAT" is written as when a net rate has to be shown as one. */
export const NET_SHIPPING_SUFFIX = " + VAT";

/** What a zero-priced delivery method is written as. */
export const FREE_SHIPPING_LABEL = "Free";

/**
 * The parcel machine method's display name, as Medusa returns it — read from
 * `mock/shipping.json`, through `declaredParcelMachineMethod`
 * (`./cart.js`), rather than written here.
 *
 * Medusa's option list carries a display name and not a provider id, so the
 * name is the only thing the storefront can recognise the method by. A literal
 * here would be a second copy of a value `backend/src/commerce/shipping-model.ts`
 * declares, and a rename would then stop the method being recognised
 * **silently**: it would still render in the `<select>`, the machine picker
 * would never appear, and the order would go through with no machine chosen.
 * `backend/tests/commerce-shipping-model.test.ts` holds the model to this
 * file, so the two cannot drift apart.
 *
 * Read through `declaredParcelMachineMethod` rather than a second, separate
 * import of the JSON: `./cart.js` already parses and validates
 * `mock/shipping.json`'s `parcelMachine` block (`assertParcelMachine`), and a
 * second unvalidated read here would be a second thing that could silently
 * accept a malformed file.
 */
export const PARCEL_MACHINE_OPTION_NAME = declaredParcelMachineMethod.name;

export function isParcelMachineOption(option: GuestShippingOption): boolean {
  return option.name === PARCEL_MACHINE_OPTION_NAME;
}

/**
 * The figure to render for one delivery option.
 *
 * Four cases, and the second is what actually occurs today for the standard
 * method:
 *
 * 1. **The option is priced at zero** — render {@link FREE_SHIPPING_LABEL},
 *    final, in both zones. There is no VAT on nothing, so the "+ VAT" branch
 *    below would promise a charge that never arrives — checked first and
 *    unconditionally, ahead of the tax-inclusive branches, because a rate of
 *    zero is never a net rate awaiting anything. Reached only by a method the
 *    operator priced at zero, which today is the Omniva parcel machine and is
 *    asserted to be the only one in
 *    `backend/tests/commerce-shipping-model.test.ts`.
 * 2. **Medusa supplied a with-tax amount** — render it; it is final.
 * 3. **It did not, and the delivery address is in the EU** — render the net
 *    rate, explicitly marked. Never bare: a bare net rate beside a grossed
 *    summary is two prices for one thing and the reader cannot tell which is
 *    the charge.
 * 4. **It did not, and the address is outside the EU** — the net rate *is* the
 *    charge, because no EU VAT arises. Render it, final, unmarked. Marking it
 *    would promise a tax that is never added.
 *
 * `vatApplies` comes from `zoneForCountryName` on the address already on the
 * screen — the same `euMember` flag the shipping zone itself is chosen with, so
 * the label and the rate cannot disagree about which side of the border an
 * address is on. It decides a **word**, never an amount.
 */
export function shippingOptionFigure(
  option: GuestShippingOption,
  vatApplies: boolean,
): ShippingOptionFigure {
  if (option.amount === 0) {
    return { amount: 0, label: FREE_SHIPPING_LABEL, final: true };
  }
  if (option.amountWithTax !== null) {
    return {
      amount: option.amountWithTax,
      label: formatAmount(option.amountWithTax, "EUR"),
      final: true,
    };
  }
  if (option.taxInclusive || !vatApplies) {
    return { amount: option.amount, label: formatAmount(option.amount, "EUR"), final: true };
  }
  return {
    amount: option.amount,
    label: `${formatAmount(option.amount, "EUR")}${NET_SHIPPING_SUFFIX}`,
    final: false,
  };
}

export interface AddressBoundTotals {
  readonly addressRevision: string;
  readonly totals: CartTotals;
}

/** Returns totals only while they belong to the address currently on screen. */
export function currentAddressTotals(
  value: AddressBoundTotals | null,
  addressRevision: string | null,
): CartTotals | null {
  return value?.addressRevision === addressRevision ? value.totals : null;
}

function countryCode(countryName: string): string {
  const country = deliveryCountries.find((candidate) => candidate.name === countryName);
  if (country === undefined) throw new ConfigError("The selected delivery country is unavailable");
  return country.code.toLowerCase();
}

function addressPayload(address: GuestCheckoutAddress) {
  return {
    first_name: address.fullName.trim(),
    address_1: address.streetAddress.trim(),
    postal_code: address.postalCode.trim(),
    city: address.city.trim(),
    country_code: countryCode(address.country.trim()),
  };
}

function shippingOptions(value: unknown): readonly GuestShippingOption[] {
  const source = value as { shipping_options?: readonly unknown[] };
  if (!Array.isArray(source.shipping_options) || source.shipping_options.length === 0) {
    throw new ConfigError("Medusa returned no shipping option for this address");
  }
  return source.shipping_options.map((raw) => {
    const option = raw as {
      id?: unknown;
      name?: unknown;
      amount?: unknown;
      calculated_price?: {
        calculated_amount_with_tax?: unknown;
        is_calculated_price_tax_inclusive?: unknown;
      };
    };
    if (
      typeof option.id !== "string" ||
      option.id.length === 0 ||
      typeof option.name !== "string" ||
      option.name.length === 0 ||
      typeof option.amount !== "number"
    ) {
      throw new ConfigError("Medusa returned a malformed shipping option");
    }
    /*
     * The tax-inclusivity flag is **required**, not defaulted. It is the only
     * thing that says whether `amount` is the rate before tax or the rate
     * after it, and rendering the wrong one of those is the defect this read
     * replaces. Medusa puts it on `calculated_price`; the flattened
     * `is_tax_inclusive` the workflow also sets is read as a fallback, because
     * the two are the same value under two names and refusing an option that
     * carries only the second would be pedantry with a checkout attached.
     */
    const calculated = option.calculated_price;
    const flatFlag = (raw as { is_tax_inclusive?: unknown }).is_tax_inclusive;
    const taxInclusive =
      typeof calculated?.is_calculated_price_tax_inclusive === "boolean"
        ? calculated.is_calculated_price_tax_inclusive
        : typeof flatFlag === "boolean"
          ? flatFlag
          : null;
    if (taxInclusive === null) {
      throw new ConfigError("Medusa returned a shipping option that does not say whether its price contains tax");
    }
    const withTax = calculated?.calculated_amount_with_tax;
    return {
      id: option.id,
      name: option.name,
      amount: medusaMajorToMinor(option.amount, "EUR"),
      amountWithTax:
        typeof withTax === "number" ? medusaMajorToMinor(withTax, "EUR") : null,
      taxInclusive,
    } satisfies GuestShippingOption;
  });
}

/** Updates the cart with ephemeral guest details, then asks Medusa what can ship it. */
export async function prepareGuestShipping(
  client: StoreClient,
  cartId: string,
  address: GuestCheckoutAddress,
): Promise<readonly GuestShippingOption[]> {
  const postalAddress = addressPayload(address);
  await client.store.cart.update(cartId, {
    email: address.email.trim(),
    shipping_address: postalAddress,
    billing_address: postalAddress,
  });
  return shippingOptions(await client.store.fulfillment.listCartOptions({ cart_id: cartId }));
}

/**
 * Medusa's authoritative figures, read as the three the Article 8(2) disclosure
 * block actually states.
 *
 * **`item_total`, not `subtotal`.** Medusa's `cart.subtotal` is
 * `item_subtotal + shipping_subtotal`, both **excluding** tax — so it is neither
 * "the price of the goods" nor a figure that adds up with the shipping charge
 * beside it. Prices are stored **net** and the destination's tax region is
 * applied automatically, which makes the difference visible rather than
 * theoretical: for the advertised goods price plus the European Union shipping
 * rate into Estonia, `subtotal` comes back as the two net amounts summed while
 * the buyer is charged both of them grossed, so the checkout stated a price of
 * the goods that was neither what the product page quotes an EU visitor nor
 * consistent with its own total. `content/legal/shipping.ts` says the figure it
 * quotes "is the figure you pay", and `cart.item_total` — line items after
 * discounts, **including** tax — is the field that is that.
 * `backend/tests/commerce-medusa-semantics.test.ts` carries the arithmetic, run
 * through Medusa's own `decorateCartTotals` rather than restated.
 *
 * `storefront/src/lib/store-payment.ts`'s `returnOrderDisclosure` already read
 * `item_total` for the same three figures on the order-confirmation path. This
 * is the checkout path agreeing with it.
 */
export function cartTotals(value: unknown): CartTotals {
  return assertedCartTotals((value as { cart?: unknown }).cart);
}

/**
 * The same refusals, over a cart object rather than a response envelope.
 *
 * Exported because the **confirmation** path needs them too.
 * `returnOrderDisclosure` in `./store-payment.js` renders the same seven
 * figures, including the VAT row, on the last screen before a buyer is
 * charged — and it had none of these checks. The argument for them is not
 * weaker there: it is the same disclosure, after the contract exists, where a
 * reader has even less opportunity to notice that a column does not add up.
 * One implementation, two callers.
 */
export function assertedCartTotals(value: unknown): CartTotals {
  const cart = value as
    | {
        currency_code?: unknown;
        item_total?: unknown;
        item_tax_total?: unknown;
        shipping_total?: unknown;
        shipping_tax_total?: unknown;
        tax_total?: unknown;
        total?: unknown;
      }
    | undefined;
  if (
    cart === undefined ||
    cart === null ||
    typeof cart.currency_code !== "string" ||
    typeof cart.item_total !== "number" ||
    typeof cart.item_tax_total !== "number" ||
    typeof cart.shipping_total !== "number" ||
    typeof cart.shipping_tax_total !== "number" ||
    typeof cart.tax_total !== "number" ||
    typeof cart.total !== "number"
  ) {
    throw new ConfigError("Medusa returned malformed checkout totals");
  }
  const goodsAmount = medusaMajorToMinor(cart.item_total, cart.currency_code);
  const shippingAmount = medusaMajorToMinor(cart.shipping_total, cart.currency_code);
  const orderAmount = medusaMajorToMinor(cart.total, cart.currency_code);
  const taxAmount = medusaMajorToMinor(cart.tax_total, cart.currency_code);
  const goodsTaxAmount = medusaMajorToMinor(cart.item_tax_total, cart.currency_code);
  const shippingTaxAmount = medusaMajorToMinor(cart.shipping_tax_total, cart.currency_code);
  /*
   * The disclosure block puts the figures on one screen, one above the other,
   * immediately above the order button. A buyer reading a goods figure and a
   * shipping figure that do not sum to the total they are asked to accept has
   * been shown something untrue, and Article 8(2) CRD is a disclosure
   * obligation rather than a pricing one — so a set that does not add up is
   * refused here instead of being rendered.
   *
   * **This one still holds under net pricing, and that is the point of keeping
   * it.** `item_total` and `shipping_total` both include their tax, so
   * the grossed goods figure plus the grossed delivery figure is still the
   * total. What changed is that there is now a seventh figure on the screen,
   * and two more ways for the set to be wrong.
   */
  if (goodsAmount + shippingAmount !== orderAmount) {
    throw new ConfigError("Medusa returned checkout totals that do not add up");
  }
  /*
   * The VAT row is a **breakdown of the two figures above it**, not a third
   * addend, and it is worded as one ("Includes VAT at …"). These two refusals
   * are what make that wording true rather than decorative.
   *
   * The first is the one that catches something the refusal above cannot: a
   * tax total that is not exactly the tax on the goods plus the tax on the
   * delivery accounts for something the screen does not show, and the row would
   * then be a figure for nothing a reader can see.
   *
   * The second — the two figures net of their tax, plus that tax, are the
   * total — is **algebraically implied by the other two, and is kept anyway**.
   * It states the invariant from the other direction, so it survives somebody
   * relaxing either of the others; `tests/store-checkout.test.ts` demonstrates
   * the implication rather than pretending to a case that reaches it, which is
   * the honest way to keep a redundant check.
   */
  if (taxAmount !== goodsTaxAmount + shippingTaxAmount) {
    throw new ConfigError("Medusa returned a tax total that is not the tax on the goods and the delivery");
  }
  if ((goodsAmount - goodsTaxAmount) + (shippingAmount - shippingTaxAmount) + taxAmount !== orderAmount) {
    throw new ConfigError("Medusa returned checkout totals whose tax is not contained within them");
  }
  return {
    currency: cart.currency_code.toUpperCase(),
    goodsAmount,
    shippingAmount,
    orderAmount,
    taxAmount,
    shippingTaxAmount,
  };
}

/**
 * Adds exactly the buyer-selected option and returns Medusa's authoritative
 * totals — **or refuses, if the figure the screen showed for that option is
 * not the figure Medusa then charged.**
 *
 * The guard is the point of this signature taking the whole option rather than
 * an id. Fixing the number the `<select>` renders makes today's mismatch go
 * away; it does nothing about tomorrow's, and the mismatch is silent by
 * construction — the option list and the cart totals are two Medusa reads, and
 * nothing compared them. This is the comparison, in the same species as the
 * totals refusals above: a checkout that cannot show a delivery charge it can
 * stand behind shows none, and the order stays unplaceable because
 * `orderMayBePlaced` refuses a screen with no total.
 *
 * The two branches match {@link shippingOptionFigure}'s two kinds of claim:
 *
 * - a **final** figure was shown, so it must equal what was charged; and
 * - a **net** figure marked "+ VAT" was shown, so what was charged, net of its
 *   own tax, must equal it. That is checkable because `shipping_tax_total`
 *   says how much of the charge is tax.
 *
 * `parcelMachineZip` is the one extra fact the Omniva parcel machine method
 * needs to be collectable at all: Medusa's option list carries no field for
 * it, so it travels as `data.parcel_machine_zip` on the shipping-method
 * addition, the way `backend/src/modules/omniva/service.ts`'s
 * `validateFulfillmentData` reads it back. **Refused here, not just in the
 * picker**, because the picker is a `<select>` a script could bypass and a
 * selected parcel machine method with no destination is one
 * `orderMayBePlaced` (`./cart.js`) must never let reach payment either.
 */
export async function addGuestShippingMethod(
  client: StoreClient,
  cartId: string,
  option: GuestShippingOption,
  vatApplies: boolean,
  parcelMachineZip?: string,
): Promise<CartTotals> {
  if (option.id.length === 0) throw new ConfigError("Choose a shipping option");
  if (isParcelMachineOption(option) && !parcelMachineZip) {
    throw new ConfigError("Choose an Omniva parcel machine");
  }
  const totals = cartTotals(
    await client.store.cart.addShippingMethod(cartId, {
      option_id: option.id,
      ...(parcelMachineZip === undefined ? {} : { data: { parcel_machine_zip: parcelMachineZip } }),
    }),
  );
  const shown = shippingOptionFigure(option, vatApplies);
  const charged = totals.shippingAmount;
  if (charged === null) {
    throw new ConfigError("Medusa added the delivery method without charging for it");
  }
  const comparable = shown.final ? charged : charged - (totals.shippingTaxAmount ?? 0);
  if (comparable !== shown.amount) {
    throw new ConfigError(
      `The delivery charge shown (${shown.label}) is not the delivery charge Medusa applied ` +
        `(${formatAmount(charged, totals.currency)}). Nothing has been ordered.`,
    );
  }
  return totals;
}
