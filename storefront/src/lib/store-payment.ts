import { ConfigError } from "../config/env.js";
import type { createMedusaStoreClient } from "./medusa-client.js";
import { minorToMedusaMajor } from "./store-money.js";

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
  const cart = currentCart(await client.store.cart.retrieve(cartId), cartId, expected);
  return stripeSession(
    await client.store.payment.initiatePaymentSession(cart, {
      provider_id: STRIPE_PROVIDER_ID,
    }),
    expected,
  );
}

export interface CompletedStoreOrder {
  readonly orderId: string;
  readonly displayId: number;
}

export type StripeConfirmation =
  | { readonly ok: true }
  | { readonly ok: false; readonly pending: boolean; readonly message: string };

export function stripeConfirmationForStatus(status: string | undefined): StripeConfirmation {
  if (status === "succeeded") return { ok: true };
  if (status === "processing") {
    return {
      ok: false,
      pending: true,
      message: "Payment is still processing. We are checking the order status.",
    };
  }
  return {
    ok: false,
    pending: false,
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
): Promise<CompletedStoreOrder> {
  const confirmation = await confirmPayment();
  if (!confirmation.ok) throw new ConfigError(confirmation.message);
  return completeOrder();
}

/** A cart/error response is not an order and must never produce confirmation UI. */
export async function completeStripeOrder(
  client: StoreClient,
  cartId: string,
): Promise<CompletedStoreOrder> {
  const result = (await client.store.cart.complete(cartId)) as {
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

/** Allows redirect/asynchronous methods time to settle, but confirms only a Medusa order. */
export async function completeStripeOrderWithRetry(
  client: StoreClient,
  cartId: string,
  options: { readonly attempts?: number; readonly delayMs?: number } = {},
): Promise<CompletedStoreOrder> {
  const attempts = options.attempts ?? 40;
  const delayMs = options.delayMs ?? 1500;
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isInteger(delayMs) || delayMs < 0) {
    throw new ConfigError("The payment completion retry policy is invalid");
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await completeStripeOrder(client, cartId);
    } catch (error: unknown) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}
