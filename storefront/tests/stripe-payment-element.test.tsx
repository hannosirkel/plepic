import { renderToStaticMarkup } from "react-dom/server";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import {
  StripePaymentElement,
  type StripePaymentElementHandle,
} from "../src/components/shop/StripePaymentElement.js";
import { StripePaymentReturn } from "../src/components/shop/StripePaymentReturn.js";

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
  it("starts in a non-confirming state until Medusa returns an explicit order", () => {
    const html = renderToStaticMarkup(<StripePaymentReturn />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Confirming your order");
    expect(html).not.toContain("Order confirmed");
  });
});
