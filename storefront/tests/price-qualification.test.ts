/**
 * Which destination a screen's figures were priced for — driven directly,
 * because driving it through the components proved impossible.
 *
 * ## Why this file exists
 *
 * The rule is: **the qualification follows whatever priced the figures beside
 * it.** Getting it wrong renders *"No VAT added, delivering to United States"*
 * one line above the order button on a screen showing an Estonian buyer's
 * tax-inclusive figures — a false pre-contract disclosure on the exact screen
 * Article 8(2) CRD is about, and on the confirmation screen after the contract
 * exists.
 *
 * That was fixed inside the two components first, and review then showed the
 * fixes were undefended. Three mutations reinstating the defect left the whole
 * suite green:
 *
 * 1. the return page rendering `resolveCatalogue().priceQualifiers` instead of
 *    the order's;
 * 2. the return page resolving its catalogue from no destination at all; and
 * 3. the checkout collapsing its production `addressBound` rule into the mock
 *    layer's — a no-op in the branch every test exercised, and unreachable in
 *    the branch it broke.
 *
 * The first two were invisible because the storefront suite is Node-only, so
 * the loaded state of that screen could not be rendered at all. The third was
 * invisible because the production path needs a Medusa response no test had.
 * Both are decisions rather than markup, so they moved into pure functions and
 * are exercised here over plain values — every state either screen can be in,
 * including the ones only production reaches.
 */
import { describe, expect, it } from "vitest";

import { checkout } from "../../content/shop.js";
import { resolveCatalogue } from "../src/lib/catalogue.js";
import { destinationForCode, destinationForCountryName } from "../src/lib/destination.js";
import {
  checkoutPriceQualification,
  confirmationPriceQualification,
  type CheckoutQualificationInput,
} from "../src/lib/price-qualification.js";
import type { CartTotals } from "../src/lib/cart.js";

/** Medusa's answer for an Estonian address: goods and delivery both grossed. */
const ESTONIAN_TOTALS: CartTotals = {
  currency: "EUR",
  goodsAmount: 3100,
  shippingAmount: 868,
  orderAmount: 3968,
  taxAmount: 768,
  shippingTaxAmount: 168,
  // Unread by this suite — the checkout and confirmation qualification never
  // consult it, only `taxAmount` — but `CartTotals` requires it now that
  // `cart.ts`'s basket-only VAT figure lives on the same interface. See
  // `CartTotals.goodsTaxAmount`'s doc comment.
  goodsTaxAmount: 600,
};

const ADDRESS_REVISION = "address-estonia";

type StoreInput = Extract<CheckoutQualificationInput, { kind: "store" }>;
type MockInput = Extract<CheckoutQualificationInput, { kind: "mock" }>;

/**
 * The **served** checkout, mid-flow: a complete Estonian delivery address, the
 * destination cookie still on the operator's default, and Medusa's totals
 * present or not depending on the case.
 *
 * The two paths are separate builders because they are separate shapes.
 * `storeTotals` means nothing on the mock path and `deliveryZone` means nothing
 * here, and the union that says so is what stopped the component being able to
 * claim one path while handing over the other's evidence.
 */
function servedCheckout(overrides: Partial<StoreInput> = {}): StoreInput {
  return {
    kind: "store",
    storeTotals: { addressRevision: ADDRESS_REVISION, totals: ESTONIAN_TOTALS },
    addressRevision: ADDRESS_REVISION,
    countryName: "Estonia",
    destinationCode: "US",
    ...overrides,
  };
}

/** The `?mock=` checkout, with the same address and the same cookie. */
function mockCheckout(overrides: Partial<MockInput> = {}): MockInput {
  return {
    kind: "mock",
    addressComplete: true,
    deliveryZone: "europeanUnion",
    countryName: "Estonia",
    destinationCode: "US",
    ...overrides,
  };
}

const ESTONIA = destinationForCountryName("Estonia")!;
const UNITED_STATES = destinationForCode("US");
const estonianQualifier = resolveCatalogue(undefined, ESTONIA).priceQualifiers;
const defaultQualifier = resolveCatalogue(undefined, UNITED_STATES).priceQualifiers;

describe("the checkout's price qualification", () => {
  /**
   * **The state the original defect rendered.** Medusa has priced the cart for
   * an Estonian delivery address; the destination cookie is still the
   * operator's default. The block must say Estonia, and must not say the
   * cookie's answer anywhere.
   */
  it("names the delivery address's destination once Medusa has priced for it", () => {
    const qualification = checkoutPriceQualification(servedCheckout());

    expect(qualification.addressBound).toBe(true);
    expect(qualification.destination).toEqual(ESTONIA);
    expect(qualification.text).toBe(estonianQualifier);
    expect(qualification.text).not.toContain(UNITED_STATES.name);
    expect(qualification.text, "the provisional clause survived an address").not.toContain(
      checkout.order.destinationProvisional,
    );
  });

  /**
   * **The state the reviewer's mutation broke, and the reason the production
   * rule is not "the address looks complete".**
   *
   * A complete address whose delivery method has not been chosen yet has no
   * Medusa totals, so the goods figure on screen is still the **basket's** —
   * priced for the destination set on the site. Claiming Estonia's tax
   * treatment over it is the original defect inverted: the right destination
   * named over the wrong figures.
   *
   * Collapsing `addressBound` to `addressComplete && deliveryZone !== null`
   * turns exactly this case red and nothing else, which is why nothing else
   * caught it.
   */
  it("keeps naming the site's destination while the figures are still the basket's", () => {
    const qualification = checkoutPriceQualification(servedCheckout({ storeTotals: null }));

    expect(qualification.addressBound).toBe(false);
    expect(qualification.destination).toEqual(UNITED_STATES);
    expect(qualification.text).toBe(
      `${defaultQualifier} ${checkout.order.destinationProvisional}`,
    );
    expect(
      qualification.text,
      "the address's destination is claimed over the basket's figures",
    ).not.toContain(ESTONIA.name);
  });

  /**
   * The same thing one step further out: totals exist, but for a **different**
   * address than the one on screen. `currentAddressTotals` already withholds
   * them; this asserts the qualification withholds with them rather than
   * running ahead.
   */
  it("does not follow an address whose totals belong to a previous revision", () => {
    const qualification = checkoutPriceQualification(
      servedCheckout({ addressRevision: "address-changed-since" }),
    );

    expect(qualification.addressBound).toBe(false);
    expect(qualification.destination).toEqual(UNITED_STATES);
  });

  /**
   * The mock layer decides differently and must: its figures come from
   * `src/lib/cart.ts`, which prices them from the completed address's zone the
   * moment there is one, with no Medusa round trip to wait for.
   */
  it("follows the address as soon as the mock layer has priced for it", () => {
    const qualification = checkoutPriceQualification(mockCheckout());

    expect(qualification.addressBound).toBe(true);
    expect(qualification.destination).toEqual(ESTONIA);
    expect(qualification.text).toBe(estonianQualifier);
  });

  it("names the site's destination while the mock layer's address is incomplete", () => {
    const qualification = checkoutPriceQualification(
      mockCheckout({ addressComplete: false, deliveryZone: null, countryName: "" }),
    );

    expect(qualification.addressBound).toBe(false);
    expect(qualification.text).toBe(
      `${defaultQualifier} ${checkout.order.destinationProvisional}`,
    );
  });

  /**
   * **No destination rather than a guess.** An address the site cannot place
   * gets the sentence that names none — never a fallback, because a fallback
   * is a destination that is not the one being charged, which is the whole
   * defect.
   *
   * The served form cannot produce this (its country field is a selection over
   * the same list), which is precisely why it needs a test: it is the branch
   * nothing else can reach.
   */
  it("names no destination at all for an address the site cannot place", () => {
    const qualification = checkoutPriceQualification(mockCheckout({ countryName: "Atlantis" }));

    expect(qualification.destination).toBeNull();
    expect(qualification.text).toBe(checkout.order.qualifierPending);
    expect(qualification.text).not.toContain(UNITED_STATES.name);
  });

  /**
   * An unrecognised **cookie** is the opposite case and takes the opposite
   * answer: it is a value a browser may have mangled rather than an address
   * anybody is being charged against, so it resolves to the declared default —
   * which the page then states beside the figure.
   */
  it("falls back to the declared default for a cookie it does not recognise", () => {
    const qualification = checkoutPriceQualification(
      servedCheckout({ storeTotals: null, destinationCode: "ZZ" }),
    );

    expect(qualification.destination).toEqual(UNITED_STATES);
    expect(qualification.text).toContain(UNITED_STATES.name);
  });

  /**
   * **The rate, and nothing else that came from a catalogue.**
   *
   * This object used to carry the whole `ResolvedCatalogue` the qualification
   * was built from, which meant a screen holding one also held
   * `.priceQualifiers` for `destination ?? defaultDestination` — so rendering
   * that instead of {@link PriceQualification.text} reinstated the defect for
   * an unlisted country in a one-property edit, with the suite green. The
   * catalogue is gone; what is left is the rate, which genuinely does not vary
   * by destination, and the row label already composed from it.
   */
  it("carries the rate and the composed VAT label, and no destination-dependent string", () => {
    for (const input of [
      servedCheckout(),
      servedCheckout({ storeTotals: null }),
      mockCheckout({ countryName: "Atlantis" }),
    ]) {
      const qualification = checkoutPriceQualification(input);
      expect(qualification.vatRate).toBe(resolveCatalogue().vatRate);
      expect(qualification.vatLabel).toContain(qualification.vatRate);
      expect(Object.keys(qualification).toSorted()).toEqual(
        ["addressBound", "destination", "text", "vatLabel", "vatRate"].toSorted(),
      );
    }
  });
});

describe("the confirmation page's price qualification", () => {
  /**
   * **The state the two return-page mutations rendered.** Every figure on that
   * screen came from a cart Medusa priced against a confirmed shipping
   * address, so nothing outside the order gets a say — and the answer must
   * differ from the default, or the assertion proves nothing.
   */
  it("names the country the order was priced for, never the site's destination", () => {
    const qualification = confirmationPriceQualification("ee");

    expect(qualification.addressBound).toBe(true);
    expect(qualification.destination).toEqual(ESTONIA);
    expect(qualification.text).toBe(estonianQualifier);
    expect(qualification.text).not.toBe(defaultQualifier);
    expect(qualification.text).not.toContain(checkout.order.destinationProvisional);
  });

  it("reads the country code in either case, because ISO codes arrive both ways", () => {
    expect(confirmationPriceQualification("EE").destination).toEqual(ESTONIA);
  });

  /**
   * **And it refuses where the checkout refuses.** `destinationForCode` maps an
   * unknown code to the declared default, which on a *confirmed order* would
   * put "No VAT added" over an order that was taxed. The order path therefore
   * uses the strict lookup and gets no destination.
   */
  it("names no destination for a country the site does not list, rather than defaulting", () => {
    for (const code of ["zz", "", "  "]) {
      const qualification = confirmationPriceQualification(code);
      expect(qualification.destination, code).toBeNull();
      expect(qualification.text, code).toBe(checkout.order.qualifierPending);
      expect(qualification.text, code).not.toContain(UNITED_STATES.name);
      // And nothing else on the object names one either — the field that used
      // to is gone. See the checkout's rate test for why.
      expect(JSON.stringify(qualification), code).not.toContain(UNITED_STATES.name);
    }
  });
});
