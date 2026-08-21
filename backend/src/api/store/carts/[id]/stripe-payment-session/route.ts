import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/core-flows";

import {
  createCustomerStripePaymentSession,
  type CustomerStripeCart,
} from "../../../../../payment/customer-stripe-payment-session.js";

interface QueriedCart {
  readonly id?: unknown;
  readonly customer_id?: unknown;
  readonly email?: unknown;
  readonly customer?: {
    readonly email?: unknown;
    readonly has_account?: unknown;
  } | null;
  readonly payment_collection?: { readonly id?: unknown } | null;
}

function customerStripeCart(value: QueriedCart | undefined): CustomerStripeCart | null {
  if (typeof value?.id !== "string") return null;
  return {
    id: value.id,
    email: typeof value.email === "string" ? value.email : null,
    customerId: typeof value.customer_id === "string" ? value.customer_id : null,
    customerEmail: typeof value.customer?.email === "string" ? value.customer.email : null,
    customerHasAccount:
      typeof value.customer?.has_account === "boolean" ? value.customer.has_account : null,
    paymentCollectionId:
      typeof value.payment_collection?.id === "string" ? value.payment_collection.id : null,
  };
}

function publicPaymentCollection(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const collection = value as Record<string, unknown>;
  if (!Array.isArray(collection.payment_sessions)) return value;
  return {
    ...collection,
    payment_sessions: collection.payment_sessions.map((value: unknown) => {
      if (typeof value !== "object" || value === null) return value;
      const session = { ...(value as Record<string, unknown>) };
      delete session.context;
      return session;
    }),
  };
}

export async function POST(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const locking = req.scope.resolve(Modules.LOCKING);
  const loadCart = async (cartId: string) => {
    const { data } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "customer_id",
        "customer.email",
        "customer.has_account",
        "payment_collection.id",
      ],
      filters: { id: cartId },
    });
    return customerStripeCart(data[0] as QueriedCart | undefined);
  };

  const paymentCollection = await createCustomerStripePaymentSession(req.params.id, {
    loadCart,
    createPaymentCollection: async (cartId) => {
      await createPaymentCollectionForCartWorkflow(req.scope).run({ input: { cart_id: cartId } });
    },
    createPaymentSession: async (input) => {
      await createPaymentSessionsWorkflow(req.scope).run({ input });
    },
    loadPaymentCollection: async (paymentCollectionId) => {
      const { data } = await query.graph({
        entity: "payment_collection",
        fields: [
          "id",
          "amount",
          "currency_code",
          "payment_sessions.id",
          "payment_sessions.provider_id",
          "payment_sessions.status",
          "payment_sessions.amount",
          "payment_sessions.currency_code",
          "payment_sessions.data",
          "payment_sessions.context",
        ],
        filters: { id: paymentCollectionId },
      });
      return data[0];
    },
    withRequestLock: (cartId, job) => locking.execute(`stripe-payment-session:${cartId}`, job),
    withCartLock: (cartId, job) => locking.execute(cartId, job),
  }, req.auth_context?.actor_id ?? null);

  res.status(200).json({ payment_collection: publicPaymentCollection(paymentCollection) });
}
