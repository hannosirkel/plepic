import type { BackendRuntimeConfig } from "./runtime.js";

type StripeConfig = BackendRuntimeConfig["stripe"];

/**
 * The provider's own identifier — `StripeProviderService.identifier` in
 * `@medusajs/payment-stripe`.
 */
const STRIPE_PROVIDER_IDENTIFIER = "stripe";

/** The `id` this deployment registers that provider under. */
const STRIPE_PROVIDER_INSTANCE_ID = "stripe";

/**
 * What the Payment module registers the provider as.
 *
 * `@medusajs/payment`'s provider loader composes the key as
 * `pp_${identifier}${id ? "_" + id : ""}`, so this is `pp_stripe_stripe` and is
 * composed the same way here rather than written out — the storefront names the
 * same string in `storefront/src/lib/store-payment.ts` when it initiates the
 * payment session, and it is a Region's `payment_providers` entry.
 */
export const STRIPE_PAYMENT_PROVIDER_ID =
  `pp_${STRIPE_PROVIDER_IDENTIFIER}_${STRIPE_PROVIDER_INSTANCE_ID}` as const;

/**
 * **The one webhook path, in both environments.**
 *
 * Medusa serves `POST /hooks/payment/:provider` with `preserveRawBody: true`,
 * and `PaymentModuleService.getWebhookActionAndData` resolves that segment back
 * to a provider by prefixing `pp_`. So the segment is the registered key without
 * its prefix, and it is derived here rather than written out: a change to either
 * half above moves the route and this constant together.
 *
 * **The application never learns which environment it is in, and that is the
 * point.** Delivery differs and the endpoint does not:
 *
 * - **live** — Stripe posts to `https://<apex>/store-api/hooks/payment/stripe_stripe`.
 *   The tunnel carries the whole hostname to the storefront, whose `/store-api`
 *   prefix allowlist strips the prefix and forwards the request — method, query,
 *   headers and **raw body byte for byte** — to this path on the backend.
 * - **test** — the public hostname is behind Cloudflare Access and Stripe cannot
 *   complete Google SSO, so an operator forwards events from Stripe CLI over
 *   WireGuard straight to the test backend's private `externalIP` port, at this
 *   same path.
 *
 * Both arrive as the same request at the same route, and the only thing standing
 * between either of them and a payment state change is the provider's signature
 * verification against `STRIPE_WEBHOOK_SECRET` — a per-environment secret
 * delivered at runtime, never baked into an image. No middleware in
 * `src/api/middlewares.ts` matches this path, so there is no second gate that
 * could pass on one route and refuse on the other.
 */
export const STRIPE_WEBHOOK_PATH =
  `/hooks/payment/${STRIPE_PROVIDER_IDENTIFIER}_${STRIPE_PROVIDER_INSTANCE_ID}` as const;

/** One Medusa-owned Stripe provider with immediate capture and Dashboard-managed methods. */
export function stripePaymentModule(config: StripeConfig) {
  return {
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/payment-stripe",
          id: STRIPE_PROVIDER_INSTANCE_ID,
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
