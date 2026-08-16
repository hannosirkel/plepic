import { ConfigError } from "../config/env.js";
import { deliveryCountries, type CartTotals } from "./cart.js";
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
  readonly amount: number;
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
    const option = raw as { id?: unknown; name?: unknown; amount?: unknown };
    if (
      typeof option.id !== "string" ||
      option.id.length === 0 ||
      typeof option.name !== "string" ||
      option.name.length === 0 ||
      typeof option.amount !== "number"
    ) {
      throw new ConfigError("Medusa returned a malformed shipping option");
    }
    return { id: option.id, name: option.name, amount: medusaMajorToMinor(option.amount, "EUR") };
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
 * beside it. Under the commerce configuration that landed, prices are tax
 * inclusive and the destination's tax region is applied automatically, which
 * makes the difference visible rather than theoretical: for the advertised goods
 * price plus the European Union shipping rate into Estonia, `subtotal` comes
 * back at the two net amounts summed, so the checkout stated a price of the
 * goods that was neither the advertised figure on the product page nor
 * consistent with its own total. `content/legal/shipping.ts` says the advertised
 * figure "is the price a consumer pays for the goods", and `cart.item_total` —
 * line items after discounts, **including** tax — is the field that is that.
 * `backend/tests/commerce-medusa-semantics.test.ts` carries the arithmetic, run
 * through Medusa's own `decorateCartTotals` rather than restated.
 *
 * `storefront/src/lib/store-payment.ts`'s `returnOrderDisclosure` already read
 * `item_total` for the same three figures on the order-confirmation path. This
 * is the checkout path agreeing with it.
 */
function cartTotals(value: unknown): CartTotals {
  const response = value as {
    cart?: {
      currency_code?: unknown;
      item_total?: unknown;
      shipping_total?: unknown;
      total?: unknown;
    };
  };
  const cart = response.cart;
  if (
    cart === undefined ||
    typeof cart.currency_code !== "string" ||
    typeof cart.item_total !== "number" ||
    typeof cart.shipping_total !== "number" ||
    typeof cart.total !== "number"
  ) {
    throw new ConfigError("Medusa returned malformed checkout totals");
  }
  const goodsAmount = medusaMajorToMinor(cart.item_total, cart.currency_code);
  const shippingAmount = medusaMajorToMinor(cart.shipping_total, cart.currency_code);
  const orderAmount = medusaMajorToMinor(cart.total, cart.currency_code);
  /*
   * The disclosure block puts the three figures on one screen, one above the
   * other, immediately above the order button. A buyer reading a goods figure
   * and a shipping figure that do not sum to the total they are asked to accept
   * has been shown something untrue, and Article 8(2) CRD is a disclosure
   * obligation rather than a pricing one — so a set that does not add up is
   * refused here instead of being rendered.
   */
  if (goodsAmount + shippingAmount !== orderAmount) {
    throw new ConfigError("Medusa returned checkout totals that do not add up");
  }
  return {
    currency: cart.currency_code.toUpperCase(),
    goodsAmount,
    shippingAmount,
    orderAmount,
  };
}

/** Adds exactly the buyer-selected option and returns Medusa's authoritative totals. */
export async function addGuestShippingMethod(
  client: StoreClient,
  cartId: string,
  optionId: string,
): Promise<CartTotals> {
  if (optionId.length === 0) throw new ConfigError("Choose a shipping option");
  return cartTotals(await client.store.cart.addShippingMethod(cartId, { option_id: optionId }));
}
