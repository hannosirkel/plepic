import { describe, expect, it } from "vitest";

import { stripePaymentModule } from "../src/config/payment.js";

describe("Stripe payment module configuration", () => {
  it("registers one immediate-capture automatic-method provider", () => {
    expect(
      stripePaymentModule({
        apiKey: "sk_test_example",
        webhookSecret: "whsec_example",
        paymentMethodConfiguration: "pmc_example",
      }),
    ).toEqual({
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: "sk_test_example",
              webhookSecret: "whsec_example",
              capture: true,
              automaticPaymentMethods: true,
              paymentMethodConfiguration: "pmc_example",
            },
          },
        ],
      },
    });
  });
});
