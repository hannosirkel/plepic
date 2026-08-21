import { beforeEach, describe, expect, it, vi } from "vitest";

const workflow = vi.hoisted(() => ({
  createCollection: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@medusajs/core-flows", () => ({
  createPaymentCollectionForCartWorkflow: () => ({ run: workflow.createCollection }),
  createPaymentSessionsWorkflow: () => ({ run: workflow.createSession }),
}));

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { POST } from "../src/api/store/carts/[id]/stripe-payment-session/route.js";

describe("customer-linked Stripe Store route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries the cart customer server-side, locks the cart, and returns the native session", async () => {
    let sessionCreated = false;
    workflow.createSession.mockImplementation(async () => { sessionCreated = true; });
    const graph = vi.fn(async (input: { entity: string }) => {
      if (input.entity === "cart") {
        return {
          data: [{
            id: "cart_example",
            email: "guest@example.test",
            customer_id: "cus_guest",
            customer: { email: "guest@example.test", has_account: false },
            payment_collection: { id: "paycol_example" },
          }],
        };
      }
      return {
        data: [{
          id: "paycol_example",
          amount: 25.99,
          currency_code: "eur",
          payment_sessions: sessionCreated ? [{
            id: "payses_example",
            provider_id: "pp_stripe_stripe",
            status: "pending",
            amount: 25.99,
            currency_code: "eur",
            data: { client_secret: "pi_secret_example" },
            context: { customer: { id: "cus_guest" } },
          }] : [],
        }],
      };
    });
    const lockKeys: string[] = [];
    const locking = {
      execute: vi.fn(async <T>(key: string, job: () => Promise<T>) => {
        lockKeys.push(key);
        return job();
      }),
    };
    const scope = {
      resolve: vi.fn((key: string) => {
        if (key === ContainerRegistrationKeys.QUERY) return { graph };
        if (key === Modules.LOCKING) return locking;
        throw new Error(`Unexpected registration: ${key}`);
      }),
    };
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    await POST({
      params: { id: "cart_example" },
      scope,
      auth_context: undefined,
    } as never, { status } as never);

    expect(graph).toHaveBeenCalledWith({
      entity: "cart",
      fields: [
        "id",
        "email",
        "customer_id",
        "customer.email",
        "customer.has_account",
        "payment_collection.id",
      ],
      filters: { id: "cart_example" },
    });
    expect(workflow.createCollection).not.toHaveBeenCalled();
    expect(workflow.createSession).toHaveBeenCalledWith({
      input: {
        payment_collection_id: "paycol_example",
        provider_id: "pp_stripe_stripe",
        customer_id: "cus_guest",
      },
    });
    expect(lockKeys).toEqual([
      "stripe-payment-session:cart_example",
      "cart_example",
    ]);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      payment_collection: expect.objectContaining({ id: "paycol_example" }),
    });
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain("context");
    expect(JSON.stringify(json.mock.calls[0]?.[0])).not.toContain("cus_guest");
  });
});
