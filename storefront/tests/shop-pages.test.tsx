/**
 * The basket and the checkout, against the legal pages that specify them.
 *
 * `content/legal/terms.ts` says its checkout section "is written to match the
 * checkout screen exactly". These assertions are what makes that a fact rather
 * than an intention: every sentence, and the order of the Article 8(2)
 * disclosure set, is read **out of the legal content object** and looked for in
 * the rendered markup. Reword the legal page and this suite fails, which is the
 * only arrangement under which "if the consent line changes in the storefront,
 * this page changes in the same commit" can be true in both directions.
 *
 * The route's own composition is asserted here too — the empty, loading, error
 * and unavailable states, and the arithmetic behind the figures — because Task
 * 5 swaps the data layer underneath and is held to changing no page
 * composition. A test that only asked whether the route answered 200 is exactly
 * what let five legal pages ship rendering nothing at all.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { returns } from "../../content/legal/returns.js";
import { shipping } from "../../content/legal/shipping.js";
import { terms } from "../../content/legal/terms.js";
import { basket, checkout } from "../../content/shop.js";
import { BasketPageContent } from "../src/components/shop/BasketPageContent.js";
import { CheckoutPageContent } from "../src/components/shop/CheckoutPageContent.js";
import {
  CARD_STATEMENT,
  CONFIRMATION_PROMISE,
  CONSENT_LINE,
  CONTRACT_FORMATION,
  DELIVERY_ESTIMATE,
  RETURN_POSTAGE,
} from "../src/components/shop/checkout-terms.js";
import {
  cartTotals,
  catalogueLine,
  clampQuantity,
  declaredShippingMethod,
  formatAmount,
  isAvailable,
  MAX_QUANTITY_PER_LINE,
  type CartLine,
} from "../src/lib/cart.js";
import { CartProvider } from "../src/lib/cart-store.js";
import {
  basketForScenario,
  placeMockOrder,
  removeLineAction,
  updateLineQuantityAction,
  type MockScenario,
} from "../src/lib/mock-cart-actions.js";

function visibleText(html: string): string {
  return html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, " ")
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/g, " ")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#x2F;", "/")
    .replaceAll(/\s+/g, " ");
}

function renderBasket(scenario: MockScenario | null): string {
  return renderToStaticMarkup(
    <CartProvider scenario={scenario} latencyMs={0}>
      <BasketPageContent />
    </CartProvider>,
  );
}

function renderCheckout(scenario: MockScenario | null): string {
  return renderToStaticMarkup(
    <CartProvider scenario={scenario} latencyMs={0}>
      <CheckoutPageContent
        turnstileSiteKey={null}
        nonce={undefined}
        scenario={scenario}
        latencyMs={0}
      />
    </CartProvider>,
  );
}

/* ------------------------------------------------------------------------ */
/* The legal page is the specification                                       */
/* ------------------------------------------------------------------------ */

describe("every sentence the checkout owes comes from content/legal, not from a second copy", () => {
  const acknowledgement = terms.body.find(
    (section) => section.anchor === "checkout-acknowledgement",
  );

  it("finds all five obligations in content/legal/terms.ts, returns.ts and shipping.ts", () => {
    expect(acknowledgement, "the checkout-acknowledgement section is gone").toBeDefined();
    for (const [name, sentence] of Object.entries({
      CONTRACT_FORMATION,
      CONSENT_LINE,
      CONFIRMATION_PROMISE,
      CARD_STATEMENT,
      RETURN_POSTAGE,
      DELIVERY_ESTIMATE,
    })) {
      expect(sentence.length, `${name} resolved to nothing`).toBeGreaterThan(40);
    }
  });

  it("takes each sentence verbatim from the legal page, character for character", () => {
    expect(acknowledgement?.body).toContain(CONTRACT_FORMATION);
    expect(acknowledgement?.body).toContain(CONSENT_LINE);
    expect(acknowledgement?.body).toContain(CONFIRMATION_PROMISE);
    expect(acknowledgement?.body).toContain(CARD_STATEMENT);
    expect(
      returns.body.find((section) => section.anchor === "returns-process")?.body,
    ).toContain(RETURN_POSTAGE);
    expect(shipping.body.find((section) => section.anchor === "delivery")?.body).toContain(
      DELIVERY_ESTIMATE,
    );
  });

  /**
   * The whole reason the extraction throws rather than degrading: a checkout
   * that silently stops disclosing something the legal page still claims it
   * discloses is the worst available outcome.
   */
  /**
   * The lookups are by opening words, so a reworded legal paragraph must be a
   * loud failure rather than a checkout that quietly stops disclosing
   * something the legal page still claims it discloses. This is that property
   * stated as a test: no opening this module matches on may become absent.
   */
  it("matches each sentence by an opening that exists exactly once on its page", () => {
    const openings: readonly [readonly string[], string][] = [
      [terms.body.flatMap((section) => section.body), "Placing an order is an offer to buy"],
      [terms.body.flatMap((section) => section.body), "By placing the order you confirm"],
      [terms.body.flatMap((section) => section.body), "You will receive a confirmation by email"],
      [terms.body.flatMap((section) => section.body), "We accept payment by card"],
      [returns.body.flatMap((section) => section.body), "You pay the cost of returning the parcel"],
      [shipping.body.flatMap((section) => section.body), "Orders are dispatched within"],
    ];

    for (const [paragraphs, opening] of openings) {
      const matches = paragraphs.filter((text) => text.startsWith(opening));
      expect(matches, `"${opening}" no longer matches exactly one paragraph`).toHaveLength(1);
    }
  });
});

describe("the checkout renders those sentences to a visitor", () => {
  const text = visibleText(renderCheckout("filled"));

  it("states how the contract is formed", () => {
    expect(text).toContain(CONTRACT_FORMATION);
  });

  it("states the consent line, unedited", () => {
    expect(text).toContain(CONSENT_LINE);
  });

  it("states the confirmation promise", () => {
    expect(text).toContain(CONFIRMATION_PROMISE);
  });

  it("states that we never see or store a card number", () => {
    expect(text).toContain(CARD_STATEMENT);
    expect(text).toContain("We never see or store your card number.");
  });

  it("states who pays return postage, before the order button", () => {
    expect(text).toContain(RETURN_POSTAGE);
    expect(text).toContain("You pay the cost of returning the parcel.");
  });
});

/* ------------------------------------------------------------------------ */
/* Article 8(2)                                                              */
/* ------------------------------------------------------------------------ */

describe("Article 8(2) CRD: the button label", () => {
  it("says that pressing it places an order with an obligation to pay", () => {
    expect(checkout.orderButtonLabel).toBe("Order with obligation to pay");
  });

  it("is not one of the labels the article exists to forbid", () => {
    const forbidden = ["Order", "Buy", "Buy now", "Confirm", "Submit", "Continue", "Pay", "Place order"];
    expect(forbidden).not.toContain(checkout.orderButtonLabel);
    expect(checkout.orderButtonLabel.toLowerCase()).toContain("obligation to pay");
  });

  it("is the accessible name of a real submit button, not a link", () => {
    const html = renderCheckout("filled");
    expect(html).toContain(`<button type="submit"`);
    expect(visibleText(html)).toContain(checkout.orderButtonLabel);
  });
});

describe("Article 8(2) CRD: the six disclosures, immediately above the button", () => {
  const html = renderCheckout("filled");
  /*
   * The order block alone. Two of the six labels ("Delivery address",
   * "Delivery estimate") are also section headings higher up the page, so a
   * whole-page `indexOf` finds the wrong occurrence and would report the six
   * as out of order while they are in it.
   */
  const orderBlock = html.slice(html.indexOf('aria-labelledby="checkout-order-heading"'));
  const text = visibleText(orderBlock);

  /**
   * The order `content/legal/terms.ts` states: "the goods, the price of the
   * goods, the shipping charge, the total, the delivery address and the
   * delivery estimate".
   */
  const ORDERED_LABELS = [
    checkout.order.goodsLabel,
    checkout.order.goodsPriceLabel,
    checkout.order.shippingLabel,
    checkout.order.totalLabel,
    checkout.order.addressLabel,
    checkout.order.estimateLabel,
  ] as const;

  it("shows all six", () => {
    for (const label of ORDERED_LABELS) {
      expect(text, `the order block does not show "${label}"`).toContain(label);
    }
  });

  it("shows them in the order the legal page lists them", () => {
    const positions = ORDERED_LABELS.map((label) => text.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].toSorted((a, b) => a - b));
  });

  it("puts the consent line between the last disclosure and the button, and nothing else", () => {
    const lastDisclosure = text.lastIndexOf(DELIVERY_ESTIMATE);
    const consent = text.indexOf(CONSENT_LINE);
    const button = text.indexOf(checkout.orderButtonLabel);

    expect(lastDisclosure).toBeGreaterThan(-1);
    expect(consent).toBeGreaterThan(lastDisclosure);
    expect(button).toBeGreaterThan(consent);

    // Nothing but the price qualification sits between them. Anything else
    // appearing here is an interposition Article 8(2) does not allow.
    const between = text.slice(lastDisclosure + DELIVERY_ESTIMATE.length, consent).trim();
    expect(between.replace(/\s+/g, " ")).toBe("VAT included where applicable. Shipping calculated at checkout. Non-EU taxes and duties, if any, are not included.");
  });

  it("keeps the pre-contract prose above the disclosure block, never below the button", () => {
    const whole = visibleText(html);
    const button = whole.indexOf(checkout.orderButtonLabel);
    expect(button).toBeGreaterThan(-1);
    for (const sentence of [CONTRACT_FORMATION, RETURN_POSTAGE, CARD_STATEMENT]) {
      expect(
        whole.indexOf(sentence),
        `"${sentence.slice(0, 40)}…" is below the order button`,
      ).toBeLessThan(button);
    }
  });

  it("carries no consent tick box, because the line says the confirmation is given by ordering", () => {
    expect(CONSENT_LINE.startsWith("By placing the order you confirm")).toBe(true);
    expect(html).not.toContain('type="checkbox"');
  });
});

/* ------------------------------------------------------------------------ */
/* Article 6(1)(h) and 6(1)(i)                                               */
/* ------------------------------------------------------------------------ */

describe("Article 6(1)(h): the withdrawal conditions and the model form are reachable before ordering", () => {
  it("links to both from the basket, one step ahead of checkout", () => {
    const html = renderBasket("filled");
    expect(html).toContain('href="/legal/returns#withdrawal"');
    expect(html).toContain('href="/legal/returns#withdrawal-form"');
  });

  it("links to both from the checkout as well", () => {
    const html = renderCheckout("filled");
    expect(html).toContain('href="/legal/returns#withdrawal"');
    expect(html).toContain('href="/legal/returns#withdrawal-form"');
  });

  it("links to the terms and the privacy notice the consent line names", () => {
    const html = renderCheckout("filled");
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('href="/legal/privacy"');
  });

  it("provides the model form rather than restating it — the content lives on /legal/returns", () => {
    const html = renderCheckout("filled");
    expect(visibleText(html)).not.toContain("Model withdrawal form (use only if you wish)");
  });
});

/* ------------------------------------------------------------------------ */
/* The states the checkbox names                                             */
/* ------------------------------------------------------------------------ */

describe("empty is the default state", () => {
  it("renders an empty basket when nothing has been added", () => {
    const text = visibleText(renderBasket(null));
    expect(text).toContain(basket.empty.heading);
    expect(text).not.toContain(basket.summary.heading);
  });

  it("renders an empty checkout when nothing has been added", () => {
    const text = visibleText(renderCheckout(null));
    expect(text).toContain(checkout.empty.heading);
    expect(text).not.toContain(checkout.orderButtonLabel);
  });

  it("starts every delivery-address field empty, with no invented person in it", () => {
    const html = renderCheckout("filled");
    for (const field of checkout.address.fields) {
      expect(html).toContain(`name="${field.name}"`);
    }
    // No value, and no `placeholder` attribute imitating a real name or
    // address. (`data-checkout-placeholder` on the card region is a different
    // attribute and is deliberately kept; the leading space is what separates
    // them.)
    expect(html).not.toMatch(/<input[^>]*value="[^"]+"[^>]*name="(fullName|streetAddress|city)"/);
    expect(html).not.toMatch(/\splaceholder="/);
  });
});

describe("the loading state", () => {
  it("marks the line busy and says what is happening while a quantity updates", () => {
    const html = renderBasket("updating");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(visibleText(html)).toContain(basket.updatingLabel);
  });

  it("says something different while a line is being removed", () => {
    expect(visibleText(renderBasket("removing"))).toContain(basket.removingLabel);
  });

  /**
   * `aria-disabled`, never the `disabled` attribute: a control that becomes
   * `disabled` while it holds focus drops focus to the body, so a keyboard
   * user loses their place mid-action. The handler refuses the second press;
   * the attribute is what tells assistive technology so.
   */
  it("marks the line's controls unavailable without taking focus off them", () => {
    const html = renderBasket("updating");
    expect(html).toContain('aria-disabled="true"');
    expect(html, "a disabled attribute would drop focus mid-action").not.toMatch(
      /<button[^>]*\sdisabled(?:=|\s|>)/,
    );
  });

  it("makes the order button busy and renames it while an order is being placed", () => {
    const html = renderCheckout("placing");
    expect(html).toContain('aria-busy="true"');
    expect(visibleText(html)).toContain(checkout.placingLabel);
  });
});

describe("the error state", () => {
  it("says nothing changed, and leaves the controls usable", () => {
    const html = renderBasket("error");
    const text = visibleText(html);
    expect(html).toContain('role="alert"');
    expect(text).toContain(checkout.errors.actionFailed);
    expect(text).toContain("Nothing has changed.");
    // The line and its controls are still there to retry with.
    expect(text).toContain(basket.updateLabel);
  });

  it("reports a failed order attempt without claiming a charge or an order", () => {
    const text = visibleText(renderCheckout("error"));
    expect(text).toContain(checkout.errors.orderFailed);
    expect(text).toContain("Nothing has been charged.");
  });

  it("never claims an order exists: placing one always fails in this build", async () => {
    expect(await placeMockOrder({ latencyMs: 0 })).toEqual({
      ok: false,
      reason: "payment-not-connected",
    });
    expect(await placeMockOrder({ latencyMs: 0, failing: true })).toEqual({
      ok: false,
      reason: "order-failed",
    });
  });
});

describe("an unavailable line", () => {
  const html = renderBasket("unavailable");

  it("is named as unavailable rather than quietly priced", () => {
    const text = visibleText(html);
    expect(text).toContain(basket.unavailableLabel);
    expect(text).toContain(basket.unavailableNote);
  });

  it("contributes nothing to the goods figure", () => {
    const lines = basketForScenario("unavailable").lines;
    expect(lines.every((line) => !isAvailable(line))).toBe(true);
    expect(cartTotals(lines, { hasDeliveryAddress: true }).goodsAmount).toBe(0);
  });

  it("blocks the way to checkout", () => {
    expect(visibleText(html)).toContain(checkout.errors.unavailableLine);
    expect(html).not.toContain('href="/checkout"');
  });
});

/* ------------------------------------------------------------------------ */
/* Figures                                                                   */
/* ------------------------------------------------------------------------ */

describe("every figure comes from the mock catalogue and the declared shipping method", () => {
  it("declares exactly one shipping method with one flat charge", () => {
    expect(declaredShippingMethod.currency).toBe("EUR");
    expect(Number.isInteger(declaredShippingMethod.amount)).toBe(true);
    expect(declaredShippingMethod.amount).toBeGreaterThan(0);
    expect(declaredShippingMethod.name.length).toBeGreaterThan(0);
  });

  it("withholds the shipping charge and the total until a delivery address exists", () => {
    const lines = [catalogueLine(1)];
    const withoutAddress = cartTotals(lines, { hasDeliveryAddress: false });
    expect(withoutAddress.shippingAmount).toBeNull();
    expect(withoutAddress.orderAmount).toBeNull();
  });

  it("adds the shipping charge to the goods, and nothing else", () => {
    const lines = [catalogueLine(2)];
    const totals = cartTotals(lines, { hasDeliveryAddress: true });
    expect(totals.goodsAmount).toBe(lines[0]!.unitAmount * 2);
    expect(totals.shippingAmount).toBe(declaredShippingMethod.amount);
    expect(totals.orderAmount).toBe(totals.goodsAmount + declaredShippingMethod.amount);
  });

  it("shows the basket the goods figure but never a total, because shipping is not known there", () => {
    const text = visibleText(renderBasket("filled"));
    expect(text).toContain(formatAmount(catalogueLine(1).unitAmount, "EUR"));
    expect(text).toContain(basket.summary.shippingPending);
    expect(text).toContain(basket.summary.totalPending);
  });

  it("shows the checkout that the charge and the total wait on the address", () => {
    const text = visibleText(renderCheckout("filled"));
    expect(text).toContain(checkout.delivery.chargePending);
    expect(text).toContain(checkout.order.totalPending);
  });

  it("carries the same tax qualification the legal page and the product page carry", () => {
    const text = visibleText(renderCheckout("filled"));
    expect(text).toContain("VAT included where applicable");
    expect(text, "an unqualified VAT claim reached the checkout").not.toMatch(
      /VAT included(?! where applicable)/,
    );
  });

  it("clamps a quantity into what a basket may hold", () => {
    expect(clampQuantity(0)).toBe(0);
    expect(clampQuantity(-3)).toBe(0);
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(MAX_QUANTITY_PER_LINE + 5)).toBe(MAX_QUANTITY_PER_LINE);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });
});

/* ------------------------------------------------------------------------ */
/* The mock data layer                                                       */
/* ------------------------------------------------------------------------ */

describe("the mock cart actions are the one seam Task 5 replaces", () => {
  const lines: readonly CartLine[] = [catalogueLine(1)];

  it("updates a quantity", async () => {
    const outcome = await updateLineQuantityAction(lines, "lunar-base", 4, { latencyMs: 0 });
    expect(outcome.ok && outcome.lines[0]?.quantity).toBe(4);
  });

  it("treats a quantity of zero as a removal", async () => {
    const outcome = await updateLineQuantityAction(lines, "lunar-base", 0, { latencyMs: 0 });
    expect(outcome.ok && outcome.lines).toEqual([]);
  });

  it("removes a line", async () => {
    const outcome = await removeLineAction(lines, "lunar-base", { latencyMs: 0 });
    expect(outcome.ok && outcome.lines).toEqual([]);
  });

  it("fails without changing anything when the failing option is set", async () => {
    expect(await removeLineAction(lines, "lunar-base", { latencyMs: 0, failing: true })).toEqual({
      ok: false,
      reason: "action-failed",
    });
  });
});

/* ------------------------------------------------------------------------ */
/* What must not be here                                                     */
/* ------------------------------------------------------------------------ */

describe("no payment instrument data of any kind", () => {
  const html = renderCheckout("filled");

  it("renders the card step as a labelled region with no field in it", () => {
    expect(html).toContain('data-checkout-placeholder="card"');
    expect(html).not.toMatch(/autocomplete="cc-/);
    expect(html).not.toMatch(/name="card(Number|Cvc|Expiry)"/i);
    expect(html).not.toMatch(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b/);
  });

  it("loads no payment script: Stripe is Task 5's", () => {
    expect(html).not.toContain("stripe");
    expect(html.toLowerCase()).not.toContain("js.stripe");
  });
});

describe("no invented customer exists anywhere in this unit", () => {
  it("ships no cart fixture of people, only the catalogue's own product line", () => {
    const line = catalogueLine(1);
    expect(line.productName).toBe("Lunar Base");
    expect(Object.keys(line).toSorted()).toEqual(
      ["availability", "currency", "id", "productName", "quantity", "unitAmount"].toSorted(),
    );
  });

  it("renders no address on either route until a visitor types one", () => {
    expect(visibleText(renderCheckout("filled"))).toContain(checkout.address.missingValue);
  });
});
