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
import {
  CHECKOUT_ORDER_POST_PATH,
  isOrderNotPlaced,
  ORDER_NOT_PLACED,
  ORDER_NOT_PLACED_LOCATION,
} from "../src/components/shop/checkout-order-post.js";
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
  deliveryCountries,
  formatAmount,
  initialQuantityField,
  isAvailable,
  MAX_QUANTITY_PER_LINE,
  MIN_QUANTITY_PER_LINE,
  orderMayBePlaced,
  parseQuantityInput,
  quantityFieldReducer,
  SHIPPING_ZONES,
  zoneForCountryName,
  type CartLine,
  type QuantityFieldEvent,
} from "../src/lib/cart.js";
import { CartProvider } from "../src/lib/cart-store.js";
import {
  basketForScenario,
  isMockLayerEnabled,
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

/**
 * A delivery address in the reserved synthetic form the packet requires —
 * `Name`, `Street and number`, `00000`, `Town`, `example@example.com` — with
 * the country left to the caller, because the country is the only field that
 * changes what anybody is charged. No invented person exists here; every value
 * but the country is the same obviously-fake token the served form uses as a
 * validation example.
 */
function addressIn(country: string): Readonly<Record<string, string>> {
  return {
    fullName: "Name",
    streetAddress: "Street and number",
    postalCode: "00000",
    city: "Town",
    country,
    email: "example@example.com",
  };
}

/** The checkout as it renders once an address has been completed. */
function renderCheckoutWithAddress(country: string): string {
  return renderToStaticMarkup(
    <CartProvider scenario="filled" latencyMs={0}>
      <CheckoutPageContent
        turnstileSiteKey={null}
        nonce={undefined}
        scenario="filled"
        latencyMs={0}
        initialAddress={addressIn(country)}
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

  it("keeps its lede on both empty states, not on one of them", () => {
    expect(visibleText(renderBasket(null))).toContain(basket.lede);
    expect(visibleText(renderCheckout(null))).toContain(checkout.lede);
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
   * Adding the first item to an empty basket announced "Updating the
   * quantity…". Nothing was being updated; a line was being created.
   */
  it("distinguishes adding a line from updating one", () => {
    expect(basket.addingLabel).not.toBe(basket.updatingLabel);
    expect(basket.addingLabel).not.toContain("quantity");
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
    expect(cartTotals(lines, { deliveryZone: "europeanUnion" }).goodsAmount).toBe(0);
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
  it("declares exactly one shipping method, flat rates only, one per zone", () => {
    expect(declaredShippingMethod.currency).toBe("EUR");
    expect(declaredShippingMethod.name.length).toBeGreaterThan(0);
    expect(Object.keys(declaredShippingMethod.rates).toSorted()).toEqual(
      [...SHIPPING_ZONES].toSorted(),
    );
    for (const zone of SHIPPING_ZONES) {
      expect(Number.isInteger(declaredShippingMethod.rates[zone])).toBe(true);
      expect(declaredShippingMethod.rates[zone]).toBeGreaterThan(0);
    }
  });

  /**
   * The operator's figures, 2026-08-10, pinned exactly as
   * `tests/catalogue.test.ts` pins the frozen catalogue facts — and for the
   * same reason: Task 5 must seed the live Medusa shipping options to match
   * these two amounts, and a silent edit to either would move what a buyer is
   * charged without moving anything a reader would notice.
   */
  it("carries the operator's two frozen amounts: EUR 7.00 in the EU, EUR 12.00 outside it", () => {
    expect(declaredShippingMethod.rates.europeanUnion).toBe(700);
    expect(declaredShippingMethod.rates.restOfWorld).toBe(1200);
    expect(formatAmount(declaredShippingMethod.rates.europeanUnion, "EUR")).toBe("€7.00");
    expect(formatAmount(declaredShippingMethod.rates.restOfWorld, "EUR")).toBe("€12.00");
  });

  it("withholds the shipping charge and the total until a delivery address exists", () => {
    const lines = [catalogueLine(1)];
    const withoutAddress = cartTotals(lines, { deliveryZone: null });
    expect(withoutAddress.shippingAmount).toBeNull();
    expect(withoutAddress.orderAmount).toBeNull();
  });

  it("adds the zone's shipping charge to the goods, and nothing else", () => {
    const lines = [catalogueLine(2)];
    for (const zone of SHIPPING_ZONES) {
      const totals = cartTotals(lines, { deliveryZone: zone });
      expect(totals.goodsAmount).toBe(lines[0]!.unitAmount * 2);
      expect(totals.shippingAmount).toBe(declaredShippingMethod.rates[zone]);
      expect(totals.orderAmount).toBe(totals.goodsAmount + declaredShippingMethod.rates[zone]);
    }
  });

  it("charges an EU address less than a non-EU one, so the axis is not decorative", () => {
    const lines = [catalogueLine(1)];
    const eu = cartTotals(lines, { deliveryZone: "europeanUnion" });
    const nonEu = cartTotals(lines, { deliveryZone: "restOfWorld" });
    expect(eu.shippingAmount).toBeLessThan(nonEu.shippingAmount!);
    expect(nonEu.orderAmount! - eu.orderAmount!).toBe(
      declaredShippingMethod.rates.restOfWorld - declaredShippingMethod.rates.europeanUnion,
    );
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

  it("clamps an already-numeric quantity into what a basket may hold", () => {
    expect(clampQuantity(0)).toBe(0);
    expect(clampQuantity(-3)).toBe(0);
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(MAX_QUANTITY_PER_LINE + 5)).toBe(MAX_QUANTITY_PER_LINE);
  });

  /**
   * It answered `1`, which is how an unparseable entry became "one" and
   * destroyed four copies of a game. A value that is not a number is not a
   * quantity, and the honest answer is "nothing".
   */
  it("answers nothing, not one, for a value that is not a number", () => {
    expect(clampQuantity(Number.NaN)).toBe(0);
    expect(clampQuantity(Number.POSITIVE_INFINITY)).toBe(0);
  });

  /**
   * `cartTotals` adds a catalogue figure to a `shipping.json` figure and
   * formats the result in one currency. Both files are operator-supplied
   * commercial facts edited by hand, by somebody deciding commerce rather than
   * reading this module — an edit that moved one file's currency and not the
   * other's would otherwise produce a wrong total on the screen Article 8(2)
   * requires to be right.
   */
  it("refuses to add two currencies rather than producing a wrong total", () => {
    const inAnotherCurrency = { ...catalogueLine(1), currency: "SEK" };
    expect(() => cartTotals([inAnotherCurrency], { deliveryZone: "europeanUnion" })).toThrow(/shipping\.json/);
    // The disagreement is caught before the address exists too — the basket
    // page shows a goods figure with no zone at all.
    expect(() => cartTotals([inAnotherCurrency], { deliveryZone: null })).toThrow();
    // And an unavailable line, which contributes nothing to the sum, is still
    // checked: it is priced on the screen beside the ones that do.
    expect(() =>
      cartTotals([{ ...inAnotherCurrency, availability: "OutOfStock" }], { deliveryZone: "restOfWorld" }),
    ).toThrow();
    expect(cartTotals([catalogueLine(1)], { deliveryZone: "europeanUnion" }).currency).toBe(
      declaredShippingMethod.currency,
    );
  });
});

/* ------------------------------------------------------------------------ */
/* The shipping zone, and the country it is decided from                     */
/* ------------------------------------------------------------------------ */

/**
 * **The 27, pinned. This is the most valuable assertion in this area.**
 *
 * The `eu` flag in `storefront/mock/countries.json` selects between two
 * operator-frozen rates that differ by five euro. Nothing on the screen reveals
 * a wrong flag: a customer in a member state marked `false` is simply charged
 * the non-EU rate, is given a correct-looking total, and is bound by it. It is
 * the one field in this unit whose failure mode is a silent mispricing, so the
 * membership list is written out here in full rather than counted, and a member
 * state added or dropped in the data has to be added or dropped here too.
 *
 * The flag means **one of the 27 EU member states** and deliberately not the EU
 * VAT or customs territory. Territories of a member state that ISO 3166-1 lists
 * separately (Åland, the French overseas departments) are `false` and pay the
 * non-EU rate — reported to the operator as a judgment call, and asserted here
 * so it stays a decision rather than becoming an accident.
 */
describe("the EU membership flag is exactly the 27 member states", () => {
  const EU_MEMBER_STATES = [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czechia",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
  ] as const;

  const EU_MEMBER_CODES = [
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
    "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
  ] as const;

  const flagged = deliveryCountries.filter((country) => country.euMember);

  it("is 27 entries, no more and no fewer", () => {
    expect(EU_MEMBER_STATES).toHaveLength(27);
    expect(EU_MEMBER_CODES).toHaveLength(27);
    expect(flagged).toHaveLength(27);
  });

  it("is those 27 by name, exactly", () => {
    expect(flagged.map((country) => country.name).toSorted()).toEqual(
      [...EU_MEMBER_STATES].toSorted(),
    );
  });

  it("is those 27 by ISO 3166-1 alpha-2 code, exactly", () => {
    expect(flagged.map((country) => country.code).toSorted()).toEqual(
      [...EU_MEMBER_CODES].toSorted(),
    );
  });

  it("includes the three that are most often left out", () => {
    for (const member of ["Ireland", "Cyprus", "Malta"]) {
      expect(zoneForCountryName(member), `${member} is a member state`).toBe("europeanUnion");
    }
  });

  it("excludes the four that are most often let in", () => {
    for (const nonMember of ["Norway", "Switzerland", "Iceland", "United Kingdom"]) {
      expect(zoneForCountryName(nonMember), `${nonMember} is not a member state`).toBe("restOfWorld");
    }
  });
});

/**
 * Why the country stopped being a free-text field.
 *
 * Review 1 upheld the `<input>` **on the explicit premise that no rate depended
 * on it**. A rate does now, so the premise is gone: `Estonai`, `eesti` and `EE`
 * would each have been charged the non-EU rate, and overcharging an EU customer
 * five euro through a spelling difference is a defect, not an edge case.
 */
describe("no EU customer can be charged the non-EU rate through a spelling difference", () => {
  it("offers every country, because the legal page says we ship to every country", () => {
    expect(shipping.body.find((section) => section.anchor === "delivery")?.body).toContain(
      "We ship to every country.",
    );
    // The officially assigned ISO 3166-1 alpha-2 set.
    expect(deliveryCountries).toHaveLength(249);
  });

  it("offers each country once, under a name no other country shares", () => {
    expect(new Set(deliveryCountries.map((country) => country.name)).size).toBe(
      deliveryCountries.length,
    );
    expect(new Set(deliveryCountries.map((country) => country.code)).size).toBe(
      deliveryCountries.length,
    );
    for (const country of deliveryCountries) {
      expect(country.code, `"${country.name}" has no alpha-2 code`).toMatch(/^[A-Z]{2}$/);
      expect(country.name.length).toBeGreaterThan(1);
    }
  });

  it("renders the country field as a selection over that list, in the same slot", () => {
    const html = renderCheckout("filled");
    const field = checkout.address.fields.find((entry) => entry.name === "country");

    expect(field?.control).toBe("country");
    expect(html).toMatch(/<select[^>]*name="country"/);
    // Same label, same autoComplete, same required-ness, same error wiring.
    expect(field?.label).toBe("Country");
    expect(html).toMatch(/<select[^>]*autocomplete="country-name"/i);
    expect(html).toMatch(/<select[^>]*required/);
    expect(html).toMatch(
      new RegExp(`<option value=""[^>]*>${checkout.address.countryUnchosen}</option>`),
    );
    for (const name of ["Estonia", "Ireland", "Norway", "United Kingdom"]) {
      expect(html).toContain(`<option value="${name}">${name}</option>`);
    }
  });

  it("is the only field that is a selection: the other five are still typed", () => {
    const selections = checkout.address.fields.filter((field) => field.control === "country");
    expect(selections.map((field) => field.name)).toEqual(["country"]);
  });

  /**
   * The option React marks selected in the first paint is the unchosen one, so
   * a reader who never opens the list is in no zone rather than in whichever
   * country sorts first — and an unchosen country produces no charge at all.
   */
  it("nobody is defaulted into a country, and so nobody is defaulted into a rate", () => {
    const html = renderCheckout("filled");
    expect(html, "a country was selected before anybody chose one").not.toMatch(
      /<option value="[^"]+"[^>]*selected/,
    );
    expect(zoneForCountryName("")).toBeNull();
  });

  /**
   * The property this whole change exists for, stated as one assertion: a
   * misspelling cannot become a price. It is not repaired into a country
   * either — a lookup that repairs its input can repair it wrongly, and this
   * one decides which of two prices somebody pays.
   */
  it("answers no zone at all — never the dearer one — to anything that is not a listed country", () => {
    for (const typed of ["Estonai", "eesti", "EE", "ESTONIA", " Estonia", "Estonia ", "", "  "]) {
      expect(zoneForCountryName(typed), `"${typed}" was priced as a zone`).toBeNull();
    }
    expect(zoneForCountryName("Estonia")).toBe("europeanUnion");
  });

  it("prices no order at all from a country it does not recognise", () => {
    const totals = cartTotals([catalogueLine(1)], { deliveryZone: zoneForCountryName("Estonai") });
    expect(totals.shippingAmount).toBeNull();
    expect(totals.orderAmount).toBeNull();
  });

  it("gives every listed country a zone, so no chosen country is unpriceable", () => {
    for (const country of deliveryCountries) {
      const zone = zoneForCountryName(country.name);
      expect(zone, `"${country.name}" resolved to no zone`).not.toBeNull();
      expect(SHIPPING_ZONES).toContain(zone);
    }
  });

  it("asks a chooser to choose, rather than telling them to enter a dropdown", () => {
    expect(checkout.errors.missingSelectionPrefix).toBe("Choose a ");
    expect(`${checkout.errors.missingSelectionPrefix}country.`).toBe("Choose a country.");
  });
});

/* ------------------------------------------------------------------------ */
/* The Article 8(2) invariant                                                */
/* ------------------------------------------------------------------------ */

/**
 * **THE ARTICLE 8(2) INVARIANT. Do not delete this suite as redundant.**
 *
 * > No order placement can succeed in any state where all six Article 8(2)
 * > values are not displayed as values.
 *
 * The operator resolved the open legal question review 1 raised —
 * `content/legal/terms.ts` says the six are visible "immediately above" the
 * button, while the implementation shows three of them as instructions until
 * the address is complete — and the resolution **ships as this invariant rather
 * than as a paragraph**, because a paragraph decays silently the moment
 * somebody makes the order button optimistic.
 *
 * Today no placement can succeed at all: payment is not connected and
 * `placeMockOrder` always fails. So what is asserted here is the testable half
 * — that the *state* in which an order could be placed is exactly the state in
 * which all six are values, and that the shipping value shown is the one the
 * chosen country's zone dictates.
 */
describe("ARTICLE 8(2) INVARIANT: no order placement succeeds unless all six values are values", () => {
  const lines = [catalogueLine(1)];

  describe("the incomplete-address state", () => {
    const html = renderCheckout("filled");
    const text = visibleText(html);

    it("renders the shipping charge, the total and the delivery address as instructions", () => {
      expect(text).toContain(checkout.delivery.chargePending);
      expect(text).toContain(checkout.order.totalPending);
      expect(text).toContain(checkout.address.missingValue);
    });

    it("shows no shipping value and no total value, in either zone's amount", () => {
      for (const zone of SHIPPING_ZONES) {
        const charge = formatAmount(declaredShippingMethod.rates[zone], "EUR");
        expect(text, `${charge} was disclosed without a delivery address`).not.toContain(charge);
        const total = formatAmount(
          catalogueLine(1).unitAmount + declaredShippingMethod.rates[zone],
          "EUR",
        );
        expect(text, `${total} was disclosed without a delivery address`).not.toContain(total);
      }
    });

    it("places nothing: the invariant refuses it", () => {
      const totals = cartTotals(lines, { deliveryZone: null });
      expect(orderMayBePlaced({ lines, addressComplete: false, totals })).toBe(false);
    });
  });

  describe("the complete-address state", () => {
    it("renders all six as values, and the shipping value the chosen zone dictates", () => {
      for (const [country, zone] of [
        ["Estonia", "europeanUnion"],
        ["Norway", "restOfWorld"],
      ] as const) {
        const html = renderCheckoutWithAddress(country);
        const orderBlock = html.slice(html.indexOf('aria-labelledby="checkout-order-heading"'));
        const text = visibleText(orderBlock);

        const charge = formatAmount(declaredShippingMethod.rates[zone], "EUR");
        const total = formatAmount(
          catalogueLine(1).unitAmount + declaredShippingMethod.rates[zone],
          "EUR",
        );

        // 1 the goods, 2 the price of the goods.
        expect(text).toContain("Lunar Base × 1");
        expect(text).toContain(formatAmount(catalogueLine(1).unitAmount, "EUR"));
        // 3 the shipping charge, and it is this country's, not the other's.
        expect(text, `${country} was not charged ${charge}`).toContain(charge);
        expect(text).not.toContain(
          formatAmount(declaredShippingMethod.rates[zone === "europeanUnion" ? "restOfWorld" : "europeanUnion"], "EUR"),
        );
        // 4 the total.
        expect(text).toContain(total);
        // 5 the delivery address, as a value and without the email address.
        expect(text).toContain(`Name, Street and number, 00000, Town, ${country}`);
        expect(text).not.toContain("example@example.com");
        // 6 the delivery estimate.
        expect(text).toContain(DELIVERY_ESTIMATE);

        // And not one of the three instructions is left on the screen.
        expect(text).not.toContain(checkout.delivery.chargePending);
        expect(text).not.toContain(checkout.order.totalPending);
        expect(text).not.toContain(checkout.address.missingValue);
      }
    });

    it("is the state, and the only state, in which the invariant permits a placement", () => {
      for (const zone of SHIPPING_ZONES) {
        const totals = cartTotals(lines, { deliveryZone: zone });
        expect(orderMayBePlaced({ lines, addressComplete: true, totals })).toBe(true);
      }
    });
  });

  it("refuses every state in which any of the six is not a value", () => {
    const euTotals = cartTotals(lines, { deliveryZone: "europeanUnion" });
    const noZone = cartTotals(lines, { deliveryZone: null });
    const unavailable = [{ ...catalogueLine(1), availability: "OutOfStock" } as const];

    // No basket: there are no goods and no price of the goods to disclose.
    expect(orderMayBePlaced({ lines: [], addressComplete: true, totals: euTotals })).toBe(false);
    // No address: the address, the charge and the total are instructions.
    expect(orderMayBePlaced({ lines, addressComplete: false, totals: noZone })).toBe(false);
    // A complete-looking address whose country yields no zone. This is the
    // state the free-text field made reachable and the one a `null` zone is
    // for: the address is a value, the charge and the total are not.
    expect(orderMayBePlaced({ lines, addressComplete: true, totals: noZone })).toBe(false);
    // A line we cannot supply: the goods disclosed would not be the basket.
    expect(
      orderMayBePlaced({
        lines: unavailable,
        addressComplete: true,
        totals: cartTotals(unavailable, { deliveryZone: "europeanUnion" }),
      }),
    ).toBe(false);
  });

  it("cannot be satisfied by a total the screen never showed", () => {
    // The two nullable disclosures move together, so there is no state in
    // which a total exists without a charge or the reverse.
    for (const zone of [...SHIPPING_ZONES, null]) {
      const totals = cartTotals(lines, { deliveryZone: zone });
      expect(totals.shippingAmount === null).toBe(totals.orderAmount === null);
    }
  });
});

/* ------------------------------------------------------------------------ */
/* The quantity control, driven                                              */
/* ------------------------------------------------------------------------ */

/**
 * The control that was failed, driven as a sequence of interactions rather
 * than looked at as markup.
 *
 * **Why it is driven here and not through a DOM.** Every component assertion
 * in this unit is `renderToStaticMarkup`, and that is what let a control that
 * displayed `99` beside a basket holding `10` ship under a green suite. This
 * package has no DOM in its test environment — no `jsdom`, no browser
 * runner — and adding one is a dependency change outside this pass's grant, so
 * it is named in the fix report rather than done quietly. What is done instead
 * is to put the control's decisions in a reducer (`src/lib/cart.ts`) that
 * `BasketPageContent` is a thin binding over, and drive *that* through the
 * exact sequences the reviewer performed in a browser. A future edit to the
 * component cannot restore the defect without first removing the reducer,
 * which these tests would notice.
 *
 * The three rows below are the reviewer's own reproduction table, verbatim.
 */
describe("the quantity control: typed, cleared, submitted, settled", () => {
  /** Presses the given sequence against a line the basket holds `settled` of. */
  function drive(
    settled: number,
    events: readonly QuantityFieldEvent[],
  ): { state: ReturnType<typeof initialQuantityField>; requests: readonly number[] } {
    let state = initialQuantityField(settled);
    const requests: number[] = [];
    for (const event of events) {
      const transition = quantityFieldReducer(state, event);
      state = transition.state;
      if (transition.request !== null) requests.push(transition.request);
    }
    return { state, requests };
  }

  it("typed 99 and pressed Update: refuses it, and asks the basket for nothing", () => {
    const { state, requests } = drive(5, [{ kind: "type", value: "99" }, { kind: "submit" }]);
    expect(requests, "99 must not become an update at all").toEqual([]);
    expect(state.rejection).toBe("out-of-range");
    expect(state.settled, "the basket was changed by a refused entry").toBe(5);
  });

  it("cleared the field and pressed Update: refuses it — an empty field is not one", () => {
    const { state, requests } = drive(5, [{ kind: "type", value: "" }, { kind: "submit" }]);
    expect(requests, "clearing the field silently rewrote a basket of 5 to 1").toEqual([]);
    expect(state.rejection).toBe("empty");
    expect(state.settled).toBe(5);
  });

  it("typed -4 and pressed Update: refuses it — a negative number is not 'empty the basket'", () => {
    const { state, requests } = drive(5, [{ kind: "type", value: "-4" }, { kind: "submit" }]);
    expect(requests, "-4 emptied the basket").toEqual([]);
    expect(state.rejection).toBe("out-of-range");
    expect(state.settled).toBe(5);
  });

  it("refuses anything that is not a whole number", () => {
    for (const typed of ["2.5", "abc", "1e3", " ", "٣", "3 copies", "0"]) {
      const { requests } = drive(5, [{ kind: "type", value: typed }, { kind: "submit" }]);
      expect(requests, `"${typed}" was interpreted rather than refused`).toEqual([]);
    }
  });

  it("accepts a whole number in range and asks for exactly that", () => {
    for (const quantity of [MIN_QUANTITY_PER_LINE, 4, MAX_QUANTITY_PER_LINE]) {
      const { state, requests } = drive(1, [
        { kind: "type", value: String(quantity) },
        { kind: "submit" },
      ]);
      expect(requests).toEqual([quantity]);
      expect(state.rejection).toBeNull();
    }
  });

  /** MAJ-1's headline property, as one assertion. */
  it("shows what the basket holds once an action lands, never what was typed", () => {
    const { state } = drive(5, [
      { kind: "type", value: "99" },
      { kind: "submit" },
      // The reviewer's basket became 10 because `clampQuantity` clamped it.
      // It cannot now, but whatever a data layer answers, the field follows.
      { kind: "settle", quantity: 10 },
    ]);
    expect(state.draft).toBe("10");
    expect(state.settled).toBe(10);
    expect(state.rejection, "a stale refusal survived the action that resolved it").toBeNull();
  });

  it("keeps the refused text on screen so a reader can correct it", () => {
    const { state } = drive(5, [{ kind: "type", value: "99" }, { kind: "submit" }]);
    expect(state.draft).toBe("99");
  });

  it("drops the message the moment the field is edited again", () => {
    const { state } = drive(5, [
      { kind: "type", value: "99" },
      { kind: "submit" },
      { kind: "type", value: "9" },
    ]);
    expect(state.rejection).toBeNull();
  });

  /**
   * A judgment call, recorded rather than left implicit.
   *
   * When an accepted entry is sent and the *action* then fails (`?mock=error`),
   * no `settle` arrives, so the field keeps the requested quantity while the
   * basket keeps the old one. That is deliberate and it is not the defect
   * MAJ-1 named: the basket-level `role="alert"` says "That did not work.
   * Nothing has changed. Try again in a moment.", every figure on both screens
   * is still derived from the basket rather than the field, and retrying is
   * pressing Update again — which is only possible if the entry is still
   * there. Reverting the field would make "try again" mean "retype it".
   */
  it("keeps an accepted entry in the field when the action itself fails, so a retry is one press", () => {
    const { state, requests } = drive(1, [{ kind: "type", value: "7" }, { kind: "submit" }]);
    expect(requests).toEqual([7]);
    expect(state.draft).toBe("7");
    // No settle: the basket is still whatever it was, and the field is an
    // unsettled intention, not a claim about the basket.
    expect(state.settled).toBe(1);
    // Pressing Update again asks for the same thing rather than something else.
    expect(quantityFieldReducer(state, { kind: "submit" }).request).toBe(7);
  });

  it("normalises an accepted entry, so '05' does not linger beside a basket of 5", () => {
    const { state, requests } = drive(1, [{ kind: "type", value: "05" }, { kind: "submit" }]);
    expect(requests).toEqual([5]);
    expect(state.draft).toBe("5");
  });

  it("parses the same way the field does, at the boundaries", () => {
    expect(parseQuantityInput(String(MIN_QUANTITY_PER_LINE))).toEqual({
      ok: true,
      quantity: MIN_QUANTITY_PER_LINE,
    });
    expect(parseQuantityInput(String(MAX_QUANTITY_PER_LINE))).toEqual({
      ok: true,
      quantity: MAX_QUANTITY_PER_LINE,
    });
    expect(parseQuantityInput(String(MAX_QUANTITY_PER_LINE + 1))).toEqual({
      ok: false,
      reason: "out-of-range",
    });
    expect(parseQuantityInput(String(MIN_QUANTITY_PER_LINE - 1))).toEqual({
      ok: false,
      reason: "out-of-range",
    });
    expect(parseQuantityInput("  7  ")).toEqual({ ok: true, quantity: 7 });
  });

  it("renders the field bound to that state, with the announcement machinery attached", () => {
    const html = renderBasket("filled");
    // The refusal lives in a live region that is always present, so a message
    // put into it is announced — the same anchor the checkout uses.
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<input[^>]*type="number"[^>]*>/);
    expect(html).toContain(`max="${String(MAX_QUANTITY_PER_LINE)}"`);
    expect(html).toContain(`min="${String(MIN_QUANTITY_PER_LINE)}"`);
    // The field shows the quantity the basket holds, at first paint.
    expect(html).toMatch(/<input[^>]*value="1"/);
    // And no refusal is asserted before anything has been typed.
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("states the accepted range in one place, and composes it into the message", () => {
    // The limit is not written into `content/`: a second copy of an operator
    // input is a second thing to disagree with `MAX_QUANTITY_PER_LINE`.
    for (const piece of Object.values(basket.quantityError)) {
      expect(piece, `"${piece}" writes the range into content`).not.toMatch(/\d/);
    }
    const message =
      `${basket.quantityError.prefix}${String(MIN_QUANTITY_PER_LINE)}` +
      `${basket.quantityError.rangeSeparator}${String(MAX_QUANTITY_PER_LINE)}` +
      `${basket.quantityError.suffix}`;
    expect(message).toBe("Enter a whole number of copies, from 1 to 10. Your basket has not been changed.");
  });
});

/* ------------------------------------------------------------------------ */
/* Where ?mock= counts                                                       */
/* ------------------------------------------------------------------------ */

/**
 * MAJ-3. Requesting a scenario writes the requested basket into
 * `sessionStorage`, so the parameter is not free of consequence and the two
 * page files ask this before parsing it. Default deny.
 */
describe("?mock= is honoured only where there is nobody to surprise", () => {
  const testHostnames = ["test.example.com", "test-admin.example.com"];

  it("is inert on a live hostname", () => {
    for (const host of [
      "example.com",
      "www.example.com",
      "example.com:443",
      "some-other-brand.example.org",
      "",
      "   ",
    ]) {
      expect(isMockLayerEnabled(host, testHostnames), `${host} honoured ?mock=`).toBe(false);
    }
    expect(isMockLayerEnabled(undefined, testHostnames)).toBe(false);
  });

  it("is honoured on a hostname the deployment declared as a test hostname", () => {
    for (const host of ["test.example.com", "TEST.EXAMPLE.COM", "test.example.com:8111"]) {
      expect(isMockLayerEnabled(host, testHostnames), `${host} did not honour ?mock=`).toBe(true);
    }
  });

  it("is honoured where a developer runs the server by hand", () => {
    for (const host of ["localhost:3000", "127.0.0.1:4311", "shop.localhost", "[::1]:3000"]) {
      expect(isMockLayerEnabled(host, testHostnames), `${host} did not honour ?mock=`).toBe(true);
    }
  });

  it("denies by default: a deployment that declares no test hostname honours nothing", () => {
    expect(isMockLayerEnabled("example.com", [])).toBe(false);
    expect(isMockLayerEnabled("test.example.com", [])).toBe(false);
  });
});

/* ------------------------------------------------------------------------ */
/* The unhydrated checkout                                                   */
/* ------------------------------------------------------------------------ */

/**
 * MAJ-2. The form's `method` and `action` are the whole fix, and the redirect
 * marker is what keeps the answer honest rather than a silent no-op. The
 * running-server half of this is in `tests/build-and-serve.test.ts`.
 */
describe("a submission the browser makes itself puts nothing in a URL", () => {
  it("declares a POST and an action, so the default GET can never happen", () => {
    const html = renderCheckout("filled");
    const form = /<form\b[^>]*>/.exec(html)?.[0] ?? "";
    expect(form).toContain('method="post"');
    expect(form).toContain(`action="${CHECKOUT_ORDER_POST_PATH}"`);
  });

  it("says no order was placed, in the markup, when the redirect brings a visitor back", () => {
    const html = renderToStaticMarkup(
      <CartProvider scenario={null} latencyMs={0}>
        <CheckoutPageContent
          turnstileSiteKey={null}
          nonce={undefined}
          scenario={null}
          unhydratedOrderAttempt
          latencyMs={0}
        />
      </CartProvider>,
    );
    // Without JavaScript there is no restored basket, so this is the *empty*
    // checkout — and it must still say what happened, or the submission would
    // look like it worked.
    const text = visibleText(html);
    expect(text).toContain(checkout.empty.heading);
    expect(text).toContain(checkout.errors.paymentNotConnected);
    expect(html).toContain('role="alert"');
  });

  it("recognises only its own fixed marker, and never a value a visitor typed", () => {
    expect(isOrderNotPlaced(ORDER_NOT_PLACED)).toBe(true);
    expect(isOrderNotPlaced([ORDER_NOT_PLACED, "ignored"])).toBe(true);
    expect(isOrderNotPlaced(undefined)).toBe(false);
    expect(isOrderNotPlaced("Street and number")).toBe(false);
    expect(ORDER_NOT_PLACED_LOCATION).toBe("/checkout?order=not-placed");
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

  /**
   * Article 8(2) names "the delivery address", and an email address is not
   * part of one. The disclosure value was `FIELDS.map(...).join(", ")` over
   * the whole set, which read "…, Estonia, example@example.com".
   */
  it("keeps the email address out of the field Article 8(2) calls the delivery address", () => {
    const postal = checkout.address.fields.filter((field) => field.inDeliveryAddress);
    const rest = checkout.address.fields.filter((field) => !field.inDeliveryAddress);

    expect(postal.map((field) => field.name)).toEqual([
      "fullName",
      "streetAddress",
      "postalCode",
      "city",
      "country",
    ]);
    expect(rest.map((field) => field.name)).toEqual(["email"]);
    expect(
      postal.map((field) => field.type),
      "an email field is marked as part of the postal address",
    ).not.toContain("email");
  });
});
