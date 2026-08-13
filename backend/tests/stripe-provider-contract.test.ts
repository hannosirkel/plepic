import { createHmac } from "node:crypto";
import { PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import StripeProviderService from "@medusajs/payment-stripe/dist/services/stripe-provider";

const webhookSecret = "whsec_synthetic_contract_secret";
const webhookPayload = Buffer.from(
  '{"type":"payment_intent.payment_failed","data":{"object":{"id":"pi_synthetic","status":"requires_payment_method","amount":2599,"amount_received":0,"currency":"eur","metadata":{"session_id":"ps_synthetic"}}}}',
);
const stripeSdk = {
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
    cancel: vi.fn(),
    capture: vi.fn(),
  },
  refunds: { create: vi.fn() },
};

function provider() {
  const service = new StripeProviderService({}, {
    apiKey: "sk_test_synthetic_contract_key",
    webhookSecret,
    capture: true,
    automaticPaymentMethods: true,
  });
  Object.assign((service as unknown as { stripe_: object }).stripe_, stripeSdk);
  return service;
}

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_synthetic",
    status: "succeeded",
    amount: 2599,
    amount_received: 2599,
    currency: "eur",
    metadata: { session_id: "ps_synthetic" },
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Medusa Stripe provider lifecycle contract", () => {
  it("creates an immediately captured EUR intent with the operation idempotency key", async () => {
    stripeSdk.paymentIntents.create.mockResolvedValue(paymentIntent());

    const result = await provider().initiatePayment({
      currency_code: "eur",
      amount: 25.99,
      data: { session_id: "ps_synthetic" },
      context: { idempotency_key: "initiate-idempotency-key" },
    });

    expect(result).toMatchObject({
      id: "pi_synthetic",
      status: PaymentSessionStatus.CAPTURED,
    });
    expect(stripeSdk.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2599,
        currency: "eur",
        capture_method: "automatic",
        automatic_payment_methods: { enabled: true },
        metadata: { session_id: "ps_synthetic" },
      }),
      { idempotencyKey: "initiate-idempotency-key" },
    );
  });

  it("authorizes a capturable intent and reports a declined intent as an error", async () => {
    stripeSdk.paymentIntents.retrieve
      .mockResolvedValueOnce(paymentIntent({ status: "requires_capture" }))
      .mockResolvedValueOnce(paymentIntent({
        status: "requires_payment_method",
        last_payment_error: { code: "card_declined" },
      }));
    const service = provider();

    await expect(service.authorizePayment({ data: { id: "pi_authorized" } }))
      .resolves.toMatchObject({ status: PaymentSessionStatus.AUTHORIZED });
    await expect(service.getPaymentStatus({ data: { id: "pi_declined" } }))
      .resolves.toMatchObject({ status: PaymentSessionStatus.ERROR });
    expect(stripeSdk.paymentIntents.retrieve).toHaveBeenNthCalledWith(
      1,
      "pi_authorized",
      { expand: ["payment_method"] },
    );
  });

  it("cancels, captures, and refunds with each operation idempotency key", async () => {
    stripeSdk.paymentIntents.cancel.mockResolvedValue(paymentIntent({ status: "canceled" }));
    stripeSdk.paymentIntents.capture.mockResolvedValue(paymentIntent());
    stripeSdk.refunds.create.mockResolvedValue({ id: "re_synthetic" });
    const service = provider();

    await expect(service.cancelPayment({
      data: { id: "pi_synthetic" },
      context: { idempotency_key: "cancel-idempotency-key" },
    })).resolves.toMatchObject({ data: { status: "canceled" } });
    await expect(service.capturePayment({
      data: { id: "pi_synthetic" },
      context: { idempotency_key: "capture-idempotency-key" },
    })).resolves.toMatchObject({ data: { status: "succeeded" } });
    await expect(service.refundPayment({
      amount: 10.5,
      data: { id: "pi_synthetic", currency: "eur" },
      context: { idempotency_key: "refund-idempotency-key" },
    })).resolves.toMatchObject({ data: { id: "pi_synthetic" } });

    expect(stripeSdk.paymentIntents.cancel).toHaveBeenCalledWith(
      "pi_synthetic",
      { idempotencyKey: "cancel-idempotency-key" },
    );
    expect(stripeSdk.paymentIntents.capture).toHaveBeenCalledWith(
      "pi_synthetic",
      { idempotencyKey: "capture-idempotency-key" },
    );
    expect(stripeSdk.refunds.create).toHaveBeenCalledWith(
      { amount: 1050, payment_intent: "pi_synthetic" },
      { idempotencyKey: "refund-idempotency-key" },
    );
  });

  it("verifies a signed webhook through the provider and returns a failed action without logging it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T10:00:00Z"));
    const timestamp = "1786615200";
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${webhookPayload.toString("utf8")}`)
      .digest("hex");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await provider().getWebhookActionAndData({
      data: {},
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
      rawData: webhookPayload,
    });

    expect(result).toEqual({
      action: PaymentActions.FAILED,
      data: { session_id: "ps_synthetic", amount: 25.99 },
    });
    await expect(provider().getWebhookActionAndData({
      data: {},
      headers: { "stripe-signature": `t=${timestamp},v1=invalid` },
      rawData: webhookPayload,
    })).rejects.toThrow("No signatures found matching the expected signature");
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });
});
