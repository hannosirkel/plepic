import { ConfigError } from "../config/env.js";
import {
  declaredParcelMachineMethod,
  declaredPhoneOptionalCountries,
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
  /**
   * The receiver phone number, or `""` where none was collected.
   *
   * **Always present, and always sent** — see {@link addressPayload}, which
   * writes it into both Medusa addresses unconditionally, the same way it
   * writes every other field. Whether the field was actually asked for is a
   * checkout-page decision ({@link phoneRequiredForCountry}), not a decision
   * this type or `addressPayload` makes: by the time an address reaches here
   * the checkout has already validated it, and this module's job is to carry
   * whatever it was given, not to re-decide whether it was required.
   */
  readonly phone: string;
}

/**
 * Whether OMX — Omniva's shipment-registration API — requires a receiver
 * phone number for a delivery address in this country.
 *
 * `false` for exactly four countries: Estonia, Finland, Lithuania and Latvia,
 * where the buyer's email already satisfies the carrier, so asking for a
 * phone number there is friction that costs orders for no carrier benefit.
 * `true` everywhere else, including every country this site did not
 * recognise — an unrecognised code is never treated as one of the four, so a
 * malformed or empty value never *reduces* what a buyer is asked for.
 *
 * The four are read from {@link declaredPhoneOptionalCountries}
 * (`./cart.js`), which in turn reads `storefront/mock/shipping.json`'s
 * `phoneOptionalCountries` — **not** written a second time here — because a
 * second, hand-typed copy of a carrier rule is exactly what let one side of a
 * boundary start asking for something the other side does not. The second
 * reader of that same set is `backend/src/commerce/shipping-model.ts`'s
 * `PHONE_OPTIONAL_COUNTRY_CODES`, which a later task's OMX shipment builder
 * (`backend/src/modules/omniva/shipment.ts`) refuses to register a shipment
 * without a phone outside of; `backend/tests/commerce-shipping-model.test.ts`
 * holds that constant and the JSON file to each other, in both directions.
 *
 * **This function decides presence and nothing else.** OMX itself validates
 * with libphonenumber, refuses special-tariff (800/900-series) ranges and
 * refuses a fixed line for a Baltic destination — carrier rules enforced at
 * fulfilment, in front of the operator who can act on a refusal, deliberately
 * *not* reimplemented in a checkout form where a subtly wrong rule rejects a
 * legitimate customer instead of merely failing to catch an implausible one.
 * `CheckoutPageContent.tsx` checks presence and a leading `+` and stops there.
 */
export function phoneRequiredForCountry(countryCode: string): boolean {
  return !declaredPhoneOptionalCountries.includes(countryCode.trim().toUpperCase());
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

/**
 * What the VAT row's own figure is prefixed with, since 2026-08-29 — a visual
 * echo of {@link NET_SHIPPING_SUFFIX}'s "+", marking the row as an addend to
 * the net goods and shipping rows above it rather than a breakdown of them.
 * `CheckoutPageContent.tsx` and `StripePaymentReturn.tsx` are the two callers;
 * see `content/shop.ts`'s `vatLabel` for the row's term.
 */
export const VAT_ADDEND_PREFIX = "+ ";

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
 * Which delivery method a fresh option list should start selected as, before
 * the buyer has touched the `<select>` themselves.
 *
 * Operator instruction, 2026-08-29: *"For EE/LV/LT, should be standard and
 * parcel machine (default), rest - the standard option only."* The parcel
 * machine method, when it is one of `options` — and it is one of `options`
 * only for Estonia, Latvia and Lithuania, decided entirely server-side by
 * `backend/src/commerce/shipping-model.ts` and never re-derived here from a
 * country code, so this file carries no second copy of that set to drift
 * from the one Medusa actually priced the cart against. `""` — nothing
 * selected, the state a fresh option list has always started in — everywhere
 * the method is absent, which is every country the operator's "rest" covers:
 * the single Standard method there still needs an explicit choice, exactly
 * as it does today.
 *
 * **Chooses a name, not a request.** Preselecting the parcel machine method
 * must not itself add a shipping method to the cart — a machine has not been
 * picked yet, and `addGuestShippingMethod` refuses to add this method
 * without one. The one caller, `CheckoutPageContent.tsx`'s shipping-options
 * effect, calls this exactly once per settled address, in the same state
 * update that records the fetched options — never from an effect keyed on
 * the selection itself — which is what keeps this from re-firing on every
 * render and snapping a buyer who switched to Standard delivery back to the
 * parcel machine.
 */
export function defaultShippingOptionId(options: readonly GuestShippingOption[]): string {
  return options.find(isParcelMachineOption)?.id ?? "";
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

/**
 * `phone` is sent unconditionally, trimmed like every other field —
 * `""` where the checkout did not ask for one, exactly as Medusa already
 * stores an empty string for any address field nobody typed into. It reaches
 * **both** Medusa addresses because both are built from this one object; see
 * {@link GuestCheckoutAddress.phone} for why *whether* it was required is not
 * this function's decision to make.
 */
function addressPayload(address: GuestCheckoutAddress) {
  return {
    first_name: address.fullName.trim(),
    address_1: address.streetAddress.trim(),
    postal_code: address.postalCode.trim(),
    city: address.city.trim(),
    country_code: countryCode(address.country.trim()),
    phone: address.phone.trim(),
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
 * Medusa's authoritative figures, read as the disclosure block actually
 * states them.
 *
 * **`item_total` and `item_tax_total`, not `subtotal` and not `unit_price`.**
 * Medusa's `cart.subtotal` is `item_subtotal + shipping_subtotal`, both
 * **excluding** tax — a combined figure that is neither "the price of the
 * goods" alone nor one that adds up with the shipping charge beside it.
 * Prices are stored **net** and the destination's tax region is applied
 * automatically, so `item_total` — line items after discounts, **including**
 * tax — minus `item_tax_total` is what {@link CartTotals.goodsAmount} reads:
 * the net price of the goods, the same figure for every destination, computed
 * from the one field Medusa actually returns rather than from the stored
 * `unit_price` a discount could have moved away from it.
 * `backend/tests/commerce-medusa-semantics.test.ts` carries the arithmetic, run
 * through Medusa's own `decorateCartTotals` rather than restated.
 *
 * `storefront/src/lib/store-payment.ts`'s `returnOrderDisclosure` already read
 * `item_total`/`item_tax_total` for the same figures on the order-confirmation
 * path. This is the checkout path agreeing with it.
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
  const goodsGrossAmount = medusaMajorToMinor(cart.item_total, cart.currency_code);
  const shippingGrossAmount = medusaMajorToMinor(cart.shipping_total, cart.currency_code);
  const orderAmount = medusaMajorToMinor(cart.total, cart.currency_code);
  const taxAmount = medusaMajorToMinor(cart.tax_total, cart.currency_code);
  const goodsTaxAmount = medusaMajorToMinor(cart.item_tax_total, cart.currency_code);
  const shippingTaxAmount = medusaMajorToMinor(cart.shipping_tax_total, cart.currency_code);
  /*
   * **Net, since 2026-08-29 — operator instruction.** Before this date these
   * two were `item_total`/`shipping_total` themselves: Medusa's gross figures,
   * tax already inside them, and the VAT row beneath them was a breakdown of
   * the two rather than an addend. The decomposition the disclosure block now
   * states is the other way round: an invariant net price of the goods and
   * net shipping charge — the same two figures for every destination — with
   * the VAT a separate row adds to reach the total. `content/shop.ts`'s
   * `vatLabel` changed from "Includes VAT at …" to "VAT at …" in the same
   * change, and would be false against the old, grossed pair.
   */
  const goodsAmount = goodsGrossAmount - goodsTaxAmount;
  const shippingAmount = shippingGrossAmount - shippingTaxAmount;
  /*
   * The disclosure block puts the figures on one screen, one above the other,
   * immediately above the order button. A buyer reading a goods figure, a
   * shipping figure and a VAT figure that do not sum to the total they are
   * asked to accept has been shown something untrue, and Article 8(2) CRD is a
   * disclosure obligation rather than a pricing one — so a set that does not
   * add up is refused here instead of being rendered.
   *
   * **This is the replacement for the pre-2026-08-29 check, not a new one.**
   * That check was `goodsAmount + shippingAmount === orderAmount` over the
   * grossed pair, which is false by construction now that both are net — the
   * two net figures alone are short of the total by exactly the tax. Adding
   * `taxAmount` is what makes the invariant hold again, and it is the
   * operator-mandated decomposition stated as arithmetic.
   */
  if (goodsAmount + shippingAmount + taxAmount !== orderAmount) {
    throw new ConfigError("Medusa returned checkout totals that do not add up");
  }
  /*
   * Unchanged by the 2026-08-29 decomposition change: this refusal never read
   * `goodsAmount` or `shippingAmount` at all, only the three tax fields, so
   * nothing about what those two mean touches it. It catches something the
   * refusal above cannot — a tax total that is not exactly the tax on the
   * goods plus the tax on the delivery accounts for something the screen does
   * not show, and the VAT row would then be a figure for nothing a reader can
   * see.
   */
  if (taxAmount !== goodsTaxAmount + shippingTaxAmount) {
    throw new ConfigError("Medusa returned a tax total that is not the tax on the goods and the delivery");
  }
  /*
   * **The redundant check, carried over with its role exactly swapped.**
   * Before 2026-08-29 this was the first check above — `goodsAmount +
   * shippingAmount === orderAmount` over the *grossed* pair — kept as a
   * restatement of the invariant from the other direction so it would survive
   * somebody relaxing either of the other two. Now that `goodsAmount` and
   * `shippingAmount` are net, that same grossed-pair equation is no longer
   * what the first check states, so it moves here, stated over the net
   * figures with their tax added back: `(goodsAmount + goodsTaxAmount) +
   * (shippingAmount + shippingTaxAmount) === orderAmount`. It is still
   * algebraically implied by the other two — substitute the second check's
   * `taxAmount = goodsTaxAmount + shippingTaxAmount` into the first and this
   * is what falls out — and `tests/store-checkout.test.ts` demonstrates the
   * implication over random figures rather than pretending to a case that
   * reaches it, which is the honest way to keep a redundant check. Preserving
   * it, with its role swapped, is what stops a figure that is individually
   * plausible and collectively wrong — the property the plain replacement of
   * the first check alone would have quietly dropped.
   */
  if ((goodsAmount + goodsTaxAmount) + (shippingAmount + shippingTaxAmount) !== orderAmount) {
    throw new ConfigError(
      "Medusa returned checkout totals whose goods and delivery, taxed, do not sum to the total",
    );
  }
  return {
    currency: cart.currency_code.toUpperCase(),
    goodsAmount,
    shippingAmount,
    orderAmount,
    taxAmount,
    shippingTaxAmount,
    /*
     * Already computed above to check the totals add up — see the two
     * refusals over `goodsTaxAmount + shippingTaxAmount` — and now returned
     * rather than only used and discarded. Neither the checkout nor the
     * confirmation page reads it: both already have the full `taxAmount`
     * Medusa supplied the moment either screen has anything to show, so this
     * is a value with the same number they could reconstruct from it, not one
     * that changes what either renders. It exists on `CartTotals` for the one
     * caller that cannot use `taxAmount` at all — `cart.ts`'s own
     * `cartTotals`, on the pre-address basket — see
     * `CartTotals.goodsTaxAmount`'s doc comment in `./cart.js`.
     */
    goodsTaxAmount,
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
  /*
   * `totals.shippingAmount` is **net** since 2026-08-29 — see
   * `assertedCartTotals`. `shippingOptionFigure`'s two kinds of claim are
   * about what was *charged*, though, so this reconstructs the gross figure
   * from the net one and its own tax before comparing: a **final** shown
   * figure is the whole charge and must equal the gross reconstruction; a
   * **net** figure marked "+ VAT" must equal the net figure directly, with no
   * reconstruction needed at all now that the totals this function reads are
   * already net of their own tax.
   */
  const netCharged = totals.shippingAmount;
  if (netCharged === null) {
    throw new ConfigError("Medusa added the delivery method without charging for it");
  }
  const grossCharged = netCharged + (totals.shippingTaxAmount ?? 0);
  const comparable = shown.final ? grossCharged : netCharged;
  if (comparable !== shown.amount) {
    throw new ConfigError(
      `The delivery charge shown (${shown.label}) is not the delivery charge Medusa applied ` +
        `(${formatAmount(grossCharged, totals.currency)}). Nothing has been ordered.`,
    );
  }
  return totals;
}
