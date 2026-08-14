import type { BackendRuntimeConfig } from "./runtime.js";

type StripeConfig = BackendRuntimeConfig["stripe"];

/** One Medusa-owned Stripe provider with immediate capture and Dashboard-managed methods. */
export function stripePaymentModule(config: StripeConfig) {
  return {
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/payment-stripe",
          id: "stripe",
          options: {
            apiKey: config.apiKey,
            webhookSecret: config.webhookSecret,
            capture: true,
            automaticPaymentMethods: true,
            paymentMethodConfiguration: config.paymentMethodConfiguration,
          },
        },
      ],
    },
  } as const;
}
