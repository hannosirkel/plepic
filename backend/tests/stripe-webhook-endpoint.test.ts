import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  STRIPE_PAYMENT_PROVIDER_ID,
  STRIPE_WEBHOOK_PATH,
  stripePaymentModule,
} from "../src/config/payment.js";

/**
 * **One webhook endpoint, reached the same way in both environments.**
 *
 * Delivery differs and the endpoint does not. Live: Stripe posts to
 * `https://<apex>/store-api/hooks/payment/stripe_stripe`, the tunnel carries the
 * whole hostname to the storefront, and the storefront's prefix allowlist strips
 * `/store-api` and forwards the raw request. Test: the public hostname is behind
 * Cloudflare Access and Stripe cannot complete Google SSO, so an operator
 * forwards events with Stripe CLI over WireGuard straight to the test backend's
 * private `externalIP` port — at the same path, with the same signature.
 *
 * What this suite holds is the half that can silently stop being true: that the
 * path is *derived* from the provider the payment module registers rather than
 * written out beside it, that the storefront allowlists the prefix it sits
 * under, and that nothing in the application reads an environment variable, or
 * runs a middleware, that could make one delivery route behave differently from
 * the other.
 */

function backendSource(relative: string): string {
  return readFileSync(join(__dirname, "..", "src", relative), "utf8");
}

function storefrontSource(relative: string): string {
  return readFileSync(join(__dirname, "..", "..", "storefront", "src", relative), "utf8");
}

const config = stripePaymentModule({
  apiKey: "sk_test_example",
  webhookSecret: "whsec_example",
  paymentMethodConfiguration: "pmc_example",
});

describe("the Stripe webhook endpoint", () => {
  it("is the path Medusa serves for the provider this deployment registers", () => {
    const provider = config.options.providers[0];
    expect(provider.resolve).toBe("@medusajs/medusa/payment-stripe");

    /*
     * `@medusajs/payment`'s provider loader keys a provider as
     * `pp_${identifier}${id ? "_" + id : ""}`, and
     * `PaymentModuleService.getWebhookActionAndData` resolves the URL segment
     * back by prefixing `pp_`. So the segment is the key without its prefix,
     * and these two constants have to move together.
     */
    expect(STRIPE_PAYMENT_PROVIDER_ID).toBe(`pp_stripe_${provider.id}`);
    expect(STRIPE_WEBHOOK_PATH).toBe(
      `/hooks/payment/${STRIPE_PAYMENT_PROVIDER_ID.replace(/^pp_/, "")}`,
    );
    expect(STRIPE_WEBHOOK_PATH).toBe("/hooks/payment/stripe_stripe");
  });

  it("names the same provider the storefront initiates its payment session with", () => {
    expect(storefrontSource("lib/store-payment.ts")).toContain(
      `STRIPE_PROVIDER_ID = "${STRIPE_PAYMENT_PROVIDER_ID}"`,
    );
  });

  /**
   * The live route only exists if the storefront's `/store-api` allowlist admits
   * the prefix the webhook sits under. A catch-all is forbidden — it would
   * publish the whole Medusa Admin surface — so the allowlist is an explicit set
   * and `hooks` has to be in it.
   */
  it("sits under a prefix the storefront's /store-api allowlist admits", () => {
    const namespace = STRIPE_WEBHOOK_PATH.split("/")[1];
    expect(namespace).toBe("hooks");

    const transport = storefrontSource("lib/store-api-transport.ts");
    const declared = /ALLOWED_PREFIXES = new Set\(\[([^\]]*)\]\)/.exec(transport)?.[1];
    expect(declared, "the storefront no longer declares ALLOWED_PREFIXES").toBeTypeOf("string");
    expect(declared).toContain(`"${namespace}"`);
  });

  /**
   * The two delivery routes, written out as the two URLs an operator configures,
   * so that a change to either half of the path is visible here as well.
   */
  it("is reached at the same backend path from the public origin and over WireGuard", () => {
    const live = `/store-api${STRIPE_WEBHOOK_PATH}`;
    const test = STRIPE_WEBHOOK_PATH;

    expect(live).toBe("/store-api/hooks/payment/stripe_stripe");
    expect(live.slice("/store-api".length)).toBe(test);
    expect(test).toBe(STRIPE_WEBHOOK_PATH);
  });

  /**
   * Signature verification is the only gate, and it is the same one on both
   * routes. A middleware matching the webhook path would be a second gate — and
   * a Turnstile or origin check would pass behind Cloudflare and refuse a Stripe
   * CLI forward over WireGuard, which is exactly the asymmetry this row exists
   * to prevent.
   */
  it("carries no middleware of this application's own", async () => {
    const middlewares = (await import("../src/api/middlewares.js")).default as unknown as {
      routes: readonly { readonly matcher: string }[];
    };

    for (const route of middlewares.routes) {
      expect(route.matcher, `${route.matcher} may match the webhook`).not.toMatch(/^\/hooks\b/);
      expect(route.matcher).not.toBe("*");
    }
  });

  /**
   * "The application must not need to know which." Nothing that decides where
   * the webhook is served, or how it is verified, may read an environment
   * variable other than the per-environment secret itself — a base URL or an
   * environment name here would be a value baked into an image or a branch
   * between the two delivery routes.
   */
  it("reads no environment variable to decide where it is served", () => {
    const payment = backendSource("config/payment.ts");
    expect(payment).not.toContain("process.env");
    expect(payment).not.toMatch(/MEDUSA_BACKEND_URL|PUBLIC_URL|ENVIRONMENT/);

    // The secret is the one per-environment value, and it arrives at runtime
    // through the shared configuration reader rather than being read here.
    expect(backendSource("config/runtime.ts")).toContain("STRIPE_WEBHOOK_SECRET");
    expect(config.options.providers[0].options.webhookSecret).toBe("whsec_example");
  });
});
