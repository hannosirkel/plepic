import { ConfigError } from "../config/env.js";
import { deliveryCountries, type CartTotals } from "./cart.js";
import type { createMedusaStoreClient } from "./medusa-client.js";

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
      !Number.isInteger(option.amount) ||
      (option.amount as number) < 0
    ) {
      throw new ConfigError("Medusa returned a malformed shipping option");
    }
    return { id: option.id, name: option.name, amount: option.amount as number };
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

function cartTotals(value: unknown): CartTotals {
  const response = value as {
    cart?: { currency_code?: unknown; subtotal?: unknown; shipping_total?: unknown; total?: unknown };
  };
  const cart = response.cart;
  if (
    cart === undefined ||
    typeof cart.currency_code !== "string" ||
    !Number.isInteger(cart.subtotal) ||
    !Number.isInteger(cart.shipping_total) ||
    !Number.isInteger(cart.total)
  ) {
    throw new ConfigError("Medusa returned malformed checkout totals");
  }
  return {
    currency: cart.currency_code.toUpperCase(),
    goodsAmount: cart.subtotal as number,
    shippingAmount: cart.shipping_total as number,
    orderAmount: cart.total as number,
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
