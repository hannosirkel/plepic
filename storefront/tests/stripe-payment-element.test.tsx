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
import { checkout } from "../../content/shop.js";
import { resolveCatalogue, resolveCataloguePlaceholders } from "../src/lib/catalogue.js";
import { destinationForCode } from "../src/lib/destination.js";

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

  /**
   * **The price qualification comes from the order, and this renders the screen
   * to prove it.**
   *
   * Every figure in the summary was priced by Medusa against the confirmed
   * shipping address, so the sentence qualifying them has to be about that
   * address. This page used to take a `destinationCode` prop read from the
   * cookie, which put "No VAT added, delivering to United States" under an
   * Estonian order's figures — the checkout's defect, one screen later, after
   * the contract exists.
   *
   * That fix was originally guarded by a **source-level pin**, and review broke
   * it: two mutations that kept the pinned literal intact and introduced no
   * `destinationCode` reinstated the defect with the entire suite green. The
   * pin could not fail on the behaviour it named, which is worse than no pin,
   * because it reads as coverage. It is gone.
   *
   * What replaces it renders the loaded screen through the `initialDisclosure`
   * seam — the same device `CheckoutPageContent`'s `initialAddress` is, for the
   * same reason: this suite has no DOM, so the effect that fetches the
   * disclosure never runs and the loaded state was unreachable. Both halves are
   * asserted, because the positive one alone passes on a page that names both
   * countries.
   */
  it("qualifies the rendered summary from the order's delivery country", () => {
    const html = renderToStaticMarkup(
      <StripePaymentReturn
        turnstileSiteKey="synthetic-site-key"
        nonce="synthetic-nonce"
        initialDisclosure={{
          currency: "EUR",
          goods: "Lunar Base × 1",
          goodsAmount: 3100,
          shippingAmount: 868,
          orderAmount: 3968,
          taxAmount: 768,
          countryCode: "ee",
          address: "Name, Street and number, 00000, Tallinn, EE",
          analyticsItems: null,
        }}
      />,
    );
    const text = html.replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ");

    // The screen really is the loaded one, or everything below is vacuous.
    expect(text).toContain("Lunar Base × 1");
    expect(text).toContain("€39.68");

    const order = resolveCatalogue(undefined, destinationForCode("ee"));
    expect(text).toContain(order.priceQualifiers);
    expect(
      text,
      "the confirmation page quotes a destination from outside the order it is confirming",
    ).not.toContain(resolveCatalogue().priceQualifiers);
  });

  /**
   * **An order Medusa taxed, for a country this site does not list.**
   *
   * `knownDestinationForCode` exists so this state names no destination rather
   * than defaulting to the operator's — because defaulting it puts "No VAT
   * added" over an order carrying €7.68 of VAT. Review demonstrated that a
   * one-property edit on this page restored exactly that with the suite green,
   * which is why the property it edited no longer exists; this is the belt
   * beside that braces.
   *
   * The figures stay the taxed ones on purpose: the disclosure is Medusa's and
   * is not in doubt. What is in doubt is what may be *said* about it.
   */
  it("names no destination over a taxed order whose country the site does not list", () => {
    const html = renderToStaticMarkup(
      <StripePaymentReturn
        turnstileSiteKey={null}
        nonce={undefined}
        initialDisclosure={{
          currency: "EUR",
          goods: "Lunar Base × 1",
          goodsAmount: 3100,
          shippingAmount: 868,
          orderAmount: 3968,
          taxAmount: 768,
          countryCode: "xx",
          address: "Name, Street and number, 00000, Town, XX",
          analyticsItems: null,
        }}
      />,
    );
    const text = html.replaceAll(/<[^>]+>/g, " ").replaceAll(/\s+/g, " ");

    expect(text).toContain("€39.68");
    expect(text).toContain(checkout.order.qualifierPending);
    expect(
      text,
      "a destination the order was not priced for is named over a taxed order",
    ).not.toContain(destinationForCode("US").name);
    expect(text).not.toContain(resolveCatalogue().priceQualifiers);
  });

  /**
   * And the VAT row is on that screen, breaking the tax out of the two figures
   * above it. Absent — not zero — for an order that attracts none.
   */
  it("renders the VAT row for a taxed order and omits it entirely for an untaxed one", () => {
    const disclosure = {
      currency: "EUR",
      goods: "Lunar Base × 1",
      goodsAmount: 3100,
      shippingAmount: 868,
      orderAmount: 3968,
      taxAmount: 768,
      countryCode: "ee",
      address: "Name, Street and number, 00000, Tallinn, EE",
      analyticsItems: null,
    };
    const taxed = renderToStaticMarkup(
      <StripePaymentReturn turnstileSiteKey={null} nonce={undefined} initialDisclosure={disclosure} />,
    );
    const untaxed = renderToStaticMarkup(
      <StripePaymentReturn
        turnstileSiteKey={null}
        nonce={undefined}
        initialDisclosure={{
          ...disclosure,
          goodsAmount: 2500,
          shippingAmount: 1200,
          orderAmount: 3700,
          taxAmount: 0,
          countryCode: "us",
        }}
      />,
    );

    const vatLabel = resolveCataloguePlaceholders(checkout.order.vatLabel, resolveCatalogue());
    expect(taxed).toContain(vatLabel);
    expect(taxed).toContain("€7.68");
    expect(untaxed, "a formatted zero claims a zero-rating this shop does not apply").not.toContain(
      vatLabel,
    );
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
