import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import {
  StripePaymentElement,
  type StripePaymentElementHandle,
} from "../src/components/shop/StripePaymentElement.js";
import { StripePaymentReturn } from "../src/components/shop/StripePaymentReturn.js";
import { PostPurchaseNewsletterForm } from "../src/components/shop/PostPurchaseNewsletterForm.js";

describe("Stripe Payment Element fail-closed states", () => {
  it("does not mount a payment instrument without the request-time Stripe key", () => {
    const html = renderToStaticMarkup(
      <StripePaymentElement
        ref={createRef<StripePaymentElementHandle>()}
        publishableKey={null}
        clientSecret="pi_example_secret_example"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Payment is unavailable");
    expect(html).not.toContain("iframe");
  });

  it("waits for an amount-bound Medusa payment session before mounting Stripe", () => {
    const html = renderToStaticMarkup(
      <StripePaymentElement
        ref={createRef<StripePaymentElementHandle>()}
        publishableKey="pk_test_example"
        clientSecret={null}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Choose a delivery method to load payment options");
    expect(html).not.toContain("iframe");
  });
});

describe("redirect-based Stripe payment return", () => {
  it("withholds the return action until it can load authoritative order disclosures", () => {
    const html = renderToStaticMarkup(
      <StripePaymentReturn turnstileSiteKey="synthetic-site-key" nonce="synthetic-nonce" />,
    );
    expect(html).toContain("Loading your order details");
    expect(html).not.toContain('data-testid="turnstile-checkout-return"');
    expect(html).not.toContain("Order confirmed");
  });

  it("declares the dedicated payment-safe POST fallback once disclosures load", () => {
    const source = readFileSync(
      new URL("../src/components/shop/StripePaymentReturn.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('action={PAYMENT_RETURN_ORDER_POST_PATH}');
    expect(source).not.toContain('action={CHECKOUT_ORDER_POST_PATH}');
  });
});

describe("post-purchase newsletter opt-in", () => {
  it("is separate from purchase, starts unticked, and requires an affirmative check", () => {
    const html = renderToStaticMarkup(
      <PostPurchaseNewsletterForm
        defaultEmail="buyer@example.test"
        turnstileSiteKey="synthetic-site-key"
        nonce="nonce"
      />,
    );
    expect(html).toContain('name="newsletter-consent"');
    expect(html).not.toMatch(/name="newsletter-consent"[^>]*checked/);
    expect(html).toContain('value="buyer@example.test"');
    expect(html).toContain('data-testid="turnstile-post-purchase-newsletter"');
    expect(html).toContain("This choice does not affect your order");
  });
});
