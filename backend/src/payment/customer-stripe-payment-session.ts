import { MedusaError, tryConvertToNumber } from "@medusajs/framework/utils";

export const STRIPE_PAYMENT_PROVIDER_ID = "pp_stripe_stripe";

export interface CustomerStripeCart {
  readonly id: string;
  readonly email: string | null;
  readonly customerId: string | null;
  readonly customerEmail: string | null;
  readonly customerHasAccount: boolean | null;
  readonly paymentCollectionId: string | null;
}

export interface CustomerStripePaymentSessionDependencies {
  readonly loadCart: (cartId: string) => Promise<CustomerStripeCart | null>;
  readonly createPaymentCollection: (cartId: string) => Promise<void>;
  readonly createPaymentSession: (input: {
    readonly payment_collection_id: string;
    readonly provider_id: typeof STRIPE_PAYMENT_PROVIDER_ID;
    readonly customer_id: string;
  }) => Promise<void>;
  readonly loadPaymentCollection: (paymentCollectionId: string) => Promise<unknown>;
  readonly withCartLock: <T>(cartId: string, job: () => Promise<T>) => Promise<T>;
  readonly withRequestLock: <T>(cartId: string, job: () => Promise<T>) => Promise<T>;
}

interface ValidatedCustomerStripeCart extends CustomerStripeCart {
  readonly customerId: string;
  readonly customerEmail: string;
  readonly email: string;
}

interface StripePaymentCollection {
  readonly id: string;
  readonly amount: unknown;
  readonly currency_code: string;
  readonly payment_sessions: readonly {
    readonly id?: unknown;
    readonly provider_id?: unknown;
    readonly status?: unknown;
    readonly amount?: unknown;
    readonly currency_code?: unknown;
    readonly data?: { readonly client_secret?: unknown } | null;
    readonly context?: { readonly customer?: { readonly id?: unknown } | null } | null;
  }[];
}

const REUSABLE_SESSION_STATUSES = new Set([
  "authorized",
  "captured",
  "pending",
  "pending_authorization",
  "requires_more",
]);

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function requireCustomerCart(
  cart: CustomerStripeCart | null,
  authenticatedCustomerId: string | null,
): ValidatedCustomerStripeCart {
  if (
    !cart?.customerId ||
    !cart.email ||
    !cart.customerEmail ||
    typeof cart.customerHasAccount !== "boolean" ||
    (cart.customerHasAccount
      ? authenticatedCustomerId !== cart.customerId
      : normalizedEmail(cart.email) !== normalizedEmail(cart.customerEmail))
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart customer email is required for Stripe payment",
    );
  }
  return {
    ...cart,
    customerId: cart.customerId,
    customerEmail: cart.customerEmail,
    email: cart.email,
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "object" || value === null)) return null;
  const converted = tryConvertToNumber(value);
  return typeof converted === "number" && Number.isFinite(converted) ? converted : null;
}

function requirePaymentCollection(value: unknown, expectedId: string): StripePaymentCollection {
  const collection = value as Partial<StripePaymentCollection> | null;
  if (
    collection?.id !== expectedId ||
    finiteNumber(collection.amount) === null ||
    typeof collection.currency_code !== "string" ||
    !Array.isArray(collection.payment_sessions)
  ) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Stripe payment collection is unavailable",
    );
  }
  return collection as StripePaymentCollection;
}

function hasReusableStripeSession(
  collection: StripePaymentCollection,
  customerId: string,
): boolean {
  const collectionAmount = finiteNumber(collection.amount);
  return collection.payment_sessions.some((session) =>
    typeof session.id === "string" &&
    session.id.length > 0 &&
    session.provider_id === STRIPE_PAYMENT_PROVIDER_ID &&
    typeof session.status === "string" &&
    REUSABLE_SESSION_STATUSES.has(session.status) &&
    session.context?.customer?.id === customerId &&
    finiteNumber(session.amount) === collectionAmount &&
    typeof session.currency_code === "string" &&
    session.currency_code.toLowerCase() === collection.currency_code.toLowerCase() &&
    typeof session.data?.client_secret === "string" &&
    session.data.client_secret.length > 0,
  );
}

export async function createCustomerStripePaymentSession(
  cartId: string,
  dependencies: CustomerStripePaymentSessionDependencies,
  authenticatedCustomerId: string | null = null,
): Promise<unknown> {
  return dependencies.withRequestLock(cartId, async () => {
    let cart = requireCustomerCart(await dependencies.loadCart(cartId), authenticatedCustomerId);

    if (!cart.paymentCollectionId) {
      await dependencies.createPaymentCollection(cart.id);
    }

    return dependencies.withCartLock(cartId, async () => {
      cart = requireCustomerCart(await dependencies.loadCart(cartId), authenticatedCustomerId);
      const paymentCollectionId = cart.paymentCollectionId;
      if (!paymentCollectionId) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Cart payment collection could not be created",
        );
      }

      let collection = requirePaymentCollection(
        await dependencies.loadPaymentCollection(paymentCollectionId),
        paymentCollectionId,
      );
      if (hasReusableStripeSession(collection, cart.customerId)) return collection;

      await dependencies.createPaymentSession({
        payment_collection_id: paymentCollectionId,
        provider_id: STRIPE_PAYMENT_PROVIDER_ID,
        customer_id: cart.customerId,
      });

      collection = requirePaymentCollection(
        await dependencies.loadPaymentCollection(paymentCollectionId),
        paymentCollectionId,
      );
      if (!hasReusableStripeSession(collection, cart.customerId)) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Stripe payment collection is unavailable",
        );
      }
      return collection;
    });
  });
}
