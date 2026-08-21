import { ConfigError } from "../config/env.js";
import type { createMedusaStoreClient } from "./medusa-client.js";
import { assertedCartTotals } from "./store-checkout.js";
import { medusaMajorToMinor, minorToMedusaMajor } from "./store-money.js";
import type { AnalyticsItem } from "./analytics.js";

type StoreClient = ReturnType<typeof createMedusaStoreClient>;

export const STRIPE_PROVIDER_ID = "pp_stripe_stripe";

export interface ExpectedPaymentTotal {
  readonly amount: number;
  readonly currency: string;
}

export interface StripePaymentSession {
  readonly clientSecret: string;
  readonly paymentCollectionId: string;
  readonly paymentSessionId: string;
}

function currentCart(value: unknown, cartId: string, expected: ExpectedPaymentTotal) {
  const response = value as {
    cart?: {
      id?: unknown;
      total?: unknown;
      currency_code?: unknown;
    };
  };
  const cart = response.cart;
  if (
    cart?.id !== cartId ||
    cart.total !== minorToMedusaMajor(expected.amount, expected.currency) ||
    typeof cart.currency_code !== "string" ||
    cart.currency_code.toUpperCase() !== expected.currency.toUpperCase()
  ) {
    throw new ConfigError("Medusa returned a stale cart before payment");
  }
  return cart as Parameters<StoreClient["store"]["payment"]["initiatePaymentSession"]>[0];
}

function stripeSession(value: unknown, expected: ExpectedPaymentTotal): StripePaymentSession {
  const response = value as {
    payment_collection?: {
      id?: unknown;
      amount?: unknown;
      currency_code?: unknown;
      payment_sessions?: readonly unknown[];
    };
  };
  const collection = response.payment_collection;
  const matching = collection?.payment_sessions?.filter(
    (raw) => (raw as { provider_id?: unknown }).provider_id === STRIPE_PROVIDER_ID,
  );
  const session = matching?.[0] as
    | {
        id?: unknown;
        amount?: unknown;
        currency_code?: unknown;
        data?: { client_secret?: unknown };
      }
    | undefined;
  if (
    typeof collection?.id !== "string" ||
    collection.id.length === 0 ||
    collection.amount !== minorToMedusaMajor(expected.amount, expected.currency) ||
    typeof collection.currency_code !== "string" ||
    collection.currency_code.toUpperCase() !== expected.currency.toUpperCase() ||
    matching?.length !== 1 ||
    typeof session?.id !== "string" ||
    session.id.length === 0 ||
    session.amount !== minorToMedusaMajor(expected.amount, expected.currency) ||
    typeof session.currency_code !== "string" ||
    session.currency_code.toUpperCase() !== expected.currency.toUpperCase() ||
    typeof session.data?.client_secret !== "string" ||
    session.data.client_secret.length === 0
  ) {
    throw new ConfigError("Medusa returned a malformed or stale Stripe payment session");
  }
  return {
    clientSecret: session.data.client_secret,
    paymentCollectionId: collection.id,
    paymentSessionId: session.id,
  };
}

/** Creates or refreshes the one Stripe session only for the total currently displayed. */
export async function initiateStripePayment(
  client: StoreClient,
  cartId: string,
  expected: ExpectedPaymentTotal,
): Promise<StripePaymentSession> {
  if (cartId.length === 0 || !Number.isInteger(expected.amount) || expected.amount < 0) {
    throw new ConfigError("The checkout total is unavailable for payment");
  }
  currentCart(await client.store.cart.retrieve(cartId), cartId, expected);
  return stripeSession(await client.client.fetch(
    `/store/carts/${encodeURIComponent(cartId)}/stripe-payment-session`,
    { method: "POST" },
  ), expected);
}

export interface CompletedStoreOrder {
  readonly orderId: string;
  readonly displayId: number;
}

export interface ReturnOrderDisclosure {
  readonly currency: string;
  readonly goods: string;
  readonly goodsAmount: number;
  readonly shippingAmount: number;
  readonly orderAmount: number;
  /**
   * The VAT contained in {@link orderAmount} — Medusa's `cart.tax_total`,
   * **after the same three refusals the checkout applies**.
   *
   * Zero for an order going outside the EU, where no EU VAT arises, and the
   * return page renders **no row** in that state rather than a row of zero:
   * the same argument `src/lib/cart.ts` makes about formatted zeros, on the
   * last screen a buyer sees before being charged.
   */
  readonly taxAmount: number;
  /**
   * The delivery country, lower-case ISO 3166-1 alpha-2, taken from the
   * confirmed shipping address.
   *
   * It is what the price qualification on this page is derived from. Reading
   * the destination cookie instead put "No VAT added, delivering to United
   * States" under a summary Medusa had priced for an Estonian address — the
   * same defect as on the checkout, one screen later, after the contract
   * exists.
   */
  readonly countryCode: string;
  readonly address: string;
  readonly analyticsItems: readonly AnalyticsItem[] | null;
}

function returnAnalyticsItems(items: readonly unknown[], currency: string): readonly AnalyticsItem[] | null {
  try {
    return items.map((item) => {
      const source = item as Record<string, unknown>;
      if (
        typeof source.variant_id !== "string" || source.variant_id.length === 0 ||
        typeof source.title !== "string" || source.title.length === 0 ||
        !Number.isInteger(source.quantity) ||
        typeof source.unit_price !== "number"
      ) throw new ConfigError("Medusa returned no analytics item metadata");
      return {
        variantId: source.variant_id,
        name: source.title,
        unitAmount: medusaMajorToMinor(source.unit_price, currency),
        currency: currency.toUpperCase(),
        quantity: source.quantity as number,
      };
    });
  } catch {
    return null;
  }
}

/** Validates the current Medusa cart before it can power a return-page order action. */
export function returnOrderDisclosure(value: unknown, cartId: string): ReturnOrderDisclosure {
  const cart = (value as { cart?: Record<string, unknown> }).cart;
  const items = cart?.items;
  const address = cart?.shipping_address as Record<string, unknown> | undefined;
  const methods = cart?.shipping_methods;
  if (
    cart?.id !== cartId || typeof cart.currency_code !== "string" ||
    typeof cart.item_total !== "number" || typeof cart.shipping_total !== "number" ||
    typeof cart.total !== "number" || typeof cart.tax_total !== "number" ||
    !Array.isArray(items) || items.length === 0 ||
    !Array.isArray(methods) || methods.length !== 1 || address === undefined
  ) throw new ConfigError("Medusa returned no complete checkout disclosure");
  const goods = items.map((item) => {
    const source = item as Record<string, unknown>;
    if (typeof source.title !== "string" || !Number.isInteger(source.quantity)) {
      throw new ConfigError("Medusa returned no complete checkout disclosure");
    }
    return `${source.title} × ${String(source.quantity)}`;
  }).join(", ");
  const addressParts = [address.first_name, address.address_1, address.postal_code, address.city, address.country_code];
  if (addressParts.some((part) => typeof part !== "string" || part.length === 0)) {
    throw new ConfigError("Medusa returned no complete checkout disclosure");
  }
  const currency = cart.currency_code as string;
  /*
   * The same refusals the checkout makes, on the same figures — see
   * `assertedCartTotals`. This page renders goods, shipping, a VAT row and a
   * total, and a set that does not add up, or whose stated tax does not
   * account for the tax on the two figures above it, is exactly as false here
   * as it is one screen earlier. It is checked *before* the disclosure is
   * built, so a bad set produces no page rather than a page with a wrong
   * column.
   */
  const totals = assertedCartTotals(cart);
  /*
   * `CartTotals` types these nullable because the *mock* path has states with
   * no answer. A cart that came back from Medusa and passed the refusals above
   * has an answer for all four, so a `null` here is a contradiction rather
   * than a state — refused, not defaulted, because the alternative is a
   * fallback that quietly reintroduces the unchecked figure this replaced.
   */
  if (
    totals.goodsAmount === null ||
    totals.shippingAmount === null ||
    totals.orderAmount === null ||
    totals.taxAmount === null
  ) {
    throw new ConfigError("Medusa returned no complete checkout disclosure");
  }
  return {
    currency: currency.toUpperCase(), goods,
    goodsAmount: totals.goodsAmount,
    shippingAmount: totals.shippingAmount,
    orderAmount: totals.orderAmount,
    taxAmount: totals.taxAmount,
    countryCode: String(address.country_code),
    address: addressParts.map((part) => String(part).toUpperCase() === String(address.country_code).toUpperCase() ? String(part).toUpperCase() : String(part)).join(", "),
    analyticsItems: returnAnalyticsItems(items, currency),
  };
}

export type StripeConfirmation =
  | { readonly ok: true }
  | { readonly ok: false; readonly pending: boolean; readonly reportFailure: boolean; readonly message: string };

function checkoutTurnstileToken(value: string): string {
  const token = value.trim();
  if (token.length === 0 || token.length > 4096) {
    throw new ConfigError("Complete the verification challenge before placing the order.");
  }
  return token;
}

export function stripeConfirmationForStatus(status: string | undefined): StripeConfirmation {
  if (status === "succeeded") return { ok: true };
  if (status === "processing") {
    return {
      ok: false,
      pending: true,
      reportFailure: false,
      message: "Payment is still processing. We are checking the order status.",
    };
  }
  return {
    ok: false,
    pending: false,
    reportFailure: true,
    message: "Payment could not be confirmed. Check the details or choose another method.",
  };
}

/** Serializes server-side PaymentIntent creation while preserving each result. */
export function createSerialPaymentInitializer() {
  let tail: Promise<void> = Promise.resolve();
  return function initialize<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

/** Payment confirmation is the gate: Medusa completion is unreachable on failure. */
export async function confirmAndCompleteStripeOrder(
  confirmPayment: () => Promise<StripeConfirmation>,
  completeOrder: () => Promise<CompletedStoreOrder>,
  onFailure: (stage: "stripe_confirmation" | "order_completion") => void = () => undefined,
): Promise<CompletedStoreOrder> {
  let confirmation: StripeConfirmation;
  try {
    confirmation = await confirmPayment();
  } catch (error: unknown) {
    try { onFailure("stripe_confirmation"); } catch { /* Analytics must not affect checkout. */ }
    throw error;
  }
  if (!confirmation.ok) {
    if (confirmation.reportFailure) {
      try { onFailure("stripe_confirmation"); } catch { /* Analytics must not affect checkout. */ }
    }
    throw new ConfigError(confirmation.message);
  }
  try {
    return await completeOrder();
  } catch (error: unknown) {
    try { onFailure("order_completion"); } catch { /* Analytics must not affect checkout. */ }
    throw error;
  }
}

/** A cart/error response is not an order and must never produce confirmation UI. */
export async function completeStripeOrder(
  client: StoreClient,
  cartId: string,
  turnstileToken: string,
): Promise<CompletedStoreOrder> {
  const result = (await client.store.cart.complete(cartId, undefined, {
    "x-plepic-turnstile-token": checkoutTurnstileToken(turnstileToken),
  })) as {
    type?: unknown;
    order?: { id?: unknown; display_id?: unknown };
  };
  if (
    result.type !== "order" ||
    typeof result.order?.id !== "string" ||
    result.order.id.length === 0 ||
    !Number.isInteger(result.order.display_id)
  ) {
    throw new ConfigError("Medusa did not place the order");
  }
  return { orderId: result.order.id, displayId: result.order.display_id as number };
}
