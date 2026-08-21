import { describe, expect, it } from "vitest";

import {
  createCustomerStripePaymentSession,
  type CustomerStripePaymentSessionDependencies,
} from "../src/payment/customer-stripe-payment-session.js";

const unlocked = async <T>(_cartId: string, job: () => Promise<T>): Promise<T> => job();

describe("customer-linked Stripe payment sessions", () => {
  it("creates a missing collection and passes the cart customer to Medusa's payment workflow", async () => {
    let paymentCollectionId: string | null = null;
    const sessionInputs: unknown[] = [];
    const dependencies: CustomerStripePaymentSessionDependencies = {
      loadCart: async () => ({
        id: "cart_example",
        email: "guest@example.test",
        customerId: "cus_medusa_example",
        customerEmail: "guest@example.test",
        customerHasAccount: false,
        paymentCollectionId,
      }),
      createPaymentCollection: async (cartId) => {
        expect(cartId).toBe("cart_example");
        paymentCollectionId = "paycol_example";
      },
      createPaymentSession: async (input) => {
        sessionInputs.push(input);
      },
      loadPaymentCollection: async (id) => ({
        id,
        amount: 25.99,
        currency_code: "eur",
        payment_sessions: sessionInputs.length === 0 ? [] : [{
          id: "payses_example",
          provider_id: "pp_stripe_stripe",
          status: "pending",
          amount: 25.99,
          currency_code: "eur",
          data: { client_secret: "pi_secret_example" },
          context: { customer: { id: "cus_medusa_example" } },
        }],
      }),
      withCartLock: unlocked,
      withRequestLock: unlocked,
    };

    await expect(
      createCustomerStripePaymentSession("cart_example", dependencies),
    ).resolves.toMatchObject({ id: "paycol_example", payment_sessions: [{ id: "payses_example" }] });
    expect(sessionInputs).toEqual([{
      payment_collection_id: "paycol_example",
      provider_id: "pp_stripe_stripe",
      customer_id: "cus_medusa_example",
    }]);
  });

  it.each([
    ["a missing cart", null],
    ["a cart without a customer", {
      id: "cart_example", email: "guest@example.test", customerId: null,
      customerEmail: null, customerHasAccount: false, paymentCollectionId: "paycol_example",
    }],
    ["a cart without an email", {
      id: "cart_example", email: null, customerId: "cus_medusa_example",
      customerEmail: "guest@example.test", customerHasAccount: false,
      paymentCollectionId: "paycol_example",
    }],
    ["a cart without an account classification", {
      id: "cart_example", email: "guest@example.test", customerId: "cus_medusa_example",
      customerEmail: "guest@example.test", customerHasAccount: null,
      paymentCollectionId: "paycol_example",
    }],
  ])("refuses %s before creating anything", async (_case, cart) => {
    let mutations = 0;
    const dependencies: CustomerStripePaymentSessionDependencies = {
      loadCart: async () => cart,
      createPaymentCollection: async () => { mutations += 1; },
      createPaymentSession: async () => { mutations += 1; },
      loadPaymentCollection: async () => { mutations += 1; return {}; },
      withCartLock: unlocked,
      withRequestLock: unlocked,
    };

    await expect(
      createCustomerStripePaymentSession("cart_example", dependencies),
    ).rejects.toThrow("Cart customer email is required for Stripe payment");
    expect(mutations).toBe(0);
  });

  it("refuses an unauthenticated cart associated with a registered customer", async () => {
    let mutations = 0;
    const dependencies: CustomerStripePaymentSessionDependencies = {
      loadCart: async () => ({
        id: "cart_example",
        email: "member@example.test",
        customerId: "cus_registered",
        customerEmail: "member@example.test",
        customerHasAccount: true,
        paymentCollectionId: "paycol_example",
      }),
      createPaymentCollection: async () => { mutations += 1; },
      createPaymentSession: async () => { mutations += 1; },
      loadPaymentCollection: async () => ({ id: "paycol_example", payment_sessions: [] }),
      withCartLock: unlocked,
      withRequestLock: unlocked,
    };

    await expect(
      createCustomerStripePaymentSession("cart_example", dependencies),
    ).rejects.toThrow("Cart customer email is required for Stripe payment");
    expect(mutations).toBe(0);
  });

  it("serializes duplicate requests and reuses the customer-linked Stripe session", async () => {
    let tail = Promise.resolve();
    let sessions = 0;
    const collection = () => ({
      id: "paycol_example",
      amount: 25.99,
      currency_code: "eur",
      payment_sessions: sessions === 0 ? [] : [{
        id: "payses_example",
        provider_id: "pp_stripe_stripe",
        status: "pending",
        amount: 25.99,
        currency_code: "eur",
        data: { client_secret: "pi_secret_example" },
        context: { customer: { id: "cus_guest" } },
      }],
    });
    const withRequestLock: CustomerStripePaymentSessionDependencies["withRequestLock"] = async (
      _cartId,
      job,
    ) => {
      const result = tail.then(job, job);
      tail = result.then(() => undefined, () => undefined);
      return result;
    };
    const dependencies: CustomerStripePaymentSessionDependencies = {
      loadCart: async () => ({
        id: "cart_example",
        email: "guest@example.test",
        customerId: "cus_guest",
        customerEmail: "guest@example.test",
        customerHasAccount: false,
        paymentCollectionId: "paycol_example",
      }),
      createPaymentCollection: async () => undefined,
      createPaymentSession: async () => { sessions += 1; },
      loadPaymentCollection: async () => collection(),
      withCartLock: unlocked,
      withRequestLock,
    };

    await expect(Promise.all([
      createCustomerStripePaymentSession("cart_example", dependencies),
      createCustomerStripePaymentSession("cart_example", dependencies),
    ])).resolves.toHaveLength(2);
    expect(sessions).toBe(1);
  });

  it("replaces a same-total session when the cart customer has changed", async () => {
    let sessionCustomerId = "cus_previous_guest";
    let sessions = 0;
    const dependencies: CustomerStripePaymentSessionDependencies = {
      loadCart: async () => ({
        id: "cart_example",
        email: "current@example.test",
        customerId: "cus_current_guest",
        customerEmail: "current@example.test",
        customerHasAccount: false,
        paymentCollectionId: "paycol_example",
      }),
      createPaymentCollection: async () => undefined,
      createPaymentSession: async () => {
        sessions += 1;
        sessionCustomerId = "cus_current_guest";
      },
      loadPaymentCollection: async () => ({
        id: "paycol_example",
        amount: 25.99,
        currency_code: "eur",
        payment_sessions: [{
          id: "payses_example",
          provider_id: "pp_stripe_stripe",
          status: "pending",
          amount: 25.99,
          currency_code: "eur",
          data: { client_secret: "pi_secret_example" },
          context: { customer: { id: sessionCustomerId } },
        }],
      }),
      withCartLock: unlocked,
      withRequestLock: unlocked,
    };

    await expect(
      createCustomerStripePaymentSession("cart_example", dependencies),
    ).resolves.toMatchObject({ id: "paycol_example" });
    expect(sessions).toBe(1);
  });

  it("fails closed when the payment collection cannot be refetched", async () => {
    const dependencies: CustomerStripePaymentSessionDependencies = {
      loadCart: async () => ({
        id: "cart_example",
        email: "guest@example.test",
        customerId: "cus_medusa_example",
        customerEmail: "guest@example.test",
        customerHasAccount: false,
        paymentCollectionId: "paycol_example",
      }),
      createPaymentCollection: async () => undefined,
      createPaymentSession: async () => undefined,
      loadPaymentCollection: async () => undefined,
      withCartLock: unlocked,
      withRequestLock: unlocked,
    };

    await expect(
      createCustomerStripePaymentSession("cart_example", dependencies),
    ).rejects.toThrow("Stripe payment collection is unavailable");
  });
});
