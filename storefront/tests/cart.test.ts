import { describe, expect, it } from "vitest";

import {
  cartTotals,
  catalogueLine,
  catalogueLinesForDestination,
  lineAmount,
  lineChargedAmount,
  type CartLine,
} from "../src/lib/cart.js";
import { destinationForCountryName } from "../src/lib/destination.js";
import { mockCatalogue } from "../src/lib/catalogue.js";

/**
 * **The defect this file exists to make impossible again.**
 *
 * `be08db5` moved `cartTotals`' goods figure to net-plus-a-VAT-addend so the
 * summary stopped changing between destinations, but left `catalogueLine`'s
 * `unitAmount` — what the basket's own "Price" and "Line total" columns
 * render — gross for an EU destination. Two units of a €25.00 net product
 * read €31.00 a line, €62.00 of lines, above a "Price of the goods" row
 * reading €50.00: the screen's own arithmetic disagreed with itself, which is
 * worse than the all-gross screen the decomposition change set out to fix.
 *
 * `sum(unitAmount × quantity) === totals.goodsAmount` is the property that
 * failed. It is asserted here in both directions — an EU destination, where
 * the defect was visible, and an export, where `unitAmount` was already net
 * and the property already held — because a fix that only proved the easy
 * direction would not have caught the regression it replaces.
 */
describe("the basket's lines reconcile with the summary's goods figure", () => {
  const estonia = destinationForCountryName("Estonia")!;
  const unitedStates = destinationForCountryName("United States")!;

  /**
   * **Two assertions, not one, and both are load-bearing.**
   *
   * `expect(line.unitAmount).toBe(mockCatalogue.price.amount)` is anchored to
   * the catalogue's declared net figure directly, independent of anything
   * `cartTotals` does — this is the assertion that catches `catalogueLine`
   * reverting to gross for an EU destination, because `cartTotals`' own
   * `goodsAmount` is now *defined* as `sum(lineAmount)` and so would silently
   * follow `unitAmount` wherever it went, gross included. The reconciliation
   * assertion below it — `lineAmount(line) === totals.goodsAmount` — is what
   * proves the *summary* has not drifted from the *lines*, which is the other
   * half of the property the operator flagged as broken.
   */
  it.each([
    ["an EU destination", estonia, "europeanUnion"],
    ["an export destination", unitedStates, "restOfWorld"],
  ] as const)("holds for %s, at quantity 1", (_label, destination, zone) => {
    const line = catalogueLine(1, mockCatalogue, "lunar-base", destination);
    expect(line.unitAmount, "unitAmount must be net regardless of destination").toBe(
      mockCatalogue.price.amount,
    );
    const totals = cartTotals([line], { deliveryZone: zone });
    expect(totals.goodsAmount).not.toBeNull();
    expect(lineAmount(line)).toBe(totals.goodsAmount);
  });

  it.each([
    ["an EU destination", estonia, "europeanUnion"],
    ["an export destination", unitedStates, "restOfWorld"],
  ] as const)("holds for %s, across a multi-line, multi-unit basket", (_label, destination, zone) => {
    const lines = [
      catalogueLine(2, mockCatalogue, "lunar-base", destination),
      { ...catalogueLine(3, mockCatalogue, "second-line", destination), id: "second-line" },
    ];
    for (const line of lines) {
      expect(line.unitAmount, "unitAmount must be net regardless of destination").toBe(
        mockCatalogue.price.amount,
      );
    }
    const totals = cartTotals(lines, { deliveryZone: zone });
    expect(totals.goodsAmount).toBe(5 * mockCatalogue.price.amount);
    const linesTotal = lines.reduce((sum, line) => sum + lineAmount(line), 0);
    expect(linesTotal).toBe(totals.goodsAmount);
  });

  /**
   * `catalogueLinesForDestination` re-prices an already-built line for a
   * different destination — the checkout's job once an address is entered —
   * and it is a second place `unitAmount` is assigned, so it gets its own
   * proof rather than inheriting `catalogueLine`'s.
   */
  it.each([
    ["an EU destination", estonia, "europeanUnion"],
    ["an export destination", unitedStates, "restOfWorld"],
  ] as const)("holds for %s after catalogueLinesForDestination re-prices the line", (_label, destination, zone) => {
    const repriced = catalogueLinesForDestination([catalogueLine(2)], destination);
    for (const line of repriced) {
      expect(line.unitAmount, "unitAmount must be net regardless of destination").toBe(
        mockCatalogue.price.amount,
      );
    }
    const totals = cartTotals(repriced, { deliveryZone: zone });
    expect(totals.goodsAmount).toBe(2 * mockCatalogue.price.amount);
    const linesTotal = repriced.reduce((sum, line) => sum + lineAmount(line), 0);
    expect(linesTotal).toBe(totals.goodsAmount);
  });

  /**
   * The same property over a **Store-shaped** line — the shape
   * `cartLinesFromStore` (`./store-cart.js`) actually returns, with
   * `unitAmount` net and `taxAmount` the addend it carries alongside it. This
   * module's `cartTotals` is what the real `/cart` and pre-address `/checkout`
   * states run over these lines, so the property has to hold here too, not
   * only over the mock catalogue's own line builders.
   */
  it.each([
    ["an EU destination", 2500, 600, "europeanUnion"],
    ["an export destination", 2500, 0, "restOfWorld"],
  ] as const)("holds for %s over a Store-shaped line", (_label, unitAmount, taxAmount, zone) => {
    const line: CartLine = {
      id: "line_example",
      variantId: "variant_example",
      productName: "Lunar Base",
      unitAmount,
      taxAmount,
      currency: "EUR",
      quantity: 2,
      availability: "InStock",
    };
    const totals = cartTotals([line], { deliveryZone: zone });
    expect(totals.goodsAmount).not.toBeNull();
    expect(lineAmount(line)).toBe(totals.goodsAmount);
  });
});

/**
 * **The regression this file gained a second describe block for.**
 *
 * The 2026-08-29 decomposition made `/cart`'s goods row net and moved its VAT
 * into `taxAmount` — but `taxAmount` is `null` on the basket page, same as
 * `shippingAmount` and `orderAmount`, because no delivery zone exists there
 * yet. An operator caught what that left on screen for an Estonian buyer: a
 * net goods figure, "Calculated at checkout" for shipping, and a sentence
 * promising VAT is added, with no VAT stated anywhere — strictly less
 * information than the gross row the decomposition replaced.
 *
 * `CartTotals.goodsTaxAmount` is the fix: the goods' own VAT, known from the
 * lines already on screen regardless of whether a shipping zone exists. These
 * assertions pin both directions — present and summed correctly for an EU
 * destination with no address yet, and the "no VAT, no row" case for an
 * export — plus the case `taxAmount` already drew the same `null`/`0`
 * distinction for: an unanswered line.
 */
describe("cartTotals states the goods' own VAT before a delivery zone exists", () => {
  const estonia = destinationForCountryName("Estonia")!;
  const unitedStates = destinationForCountryName("United States")!;

  it("is present, before a delivery zone exists, for an EU destination — and equals the lines' own tax", () => {
    const lines = [
      catalogueLine(2, mockCatalogue, "lunar-base", estonia),
      { ...catalogueLine(3, mockCatalogue, "second-line", estonia), id: "second-line" },
    ];
    const totals = cartTotals(lines, { deliveryZone: null });

    // The point of the fix: this is the one screen where `shippingAmount`,
    // `taxAmount` and `orderAmount` are all still `null` — no zone exists —
    // while the goods and their VAT are known regardless.
    expect(totals.shippingAmount).toBeNull();
    expect(totals.orderAmount).toBeNull();
    expect(totals.taxAmount).toBeNull();

    expect(totals.goodsTaxAmount).not.toBeNull();
    const expectedTax = lines.reduce((sum, line) => sum + (line.taxAmount ?? 0) * line.quantity, 0);
    expect(totals.goodsTaxAmount).toBe(expectedTax);
    expect(totals.goodsTaxAmount).toBeGreaterThan(0);
  });

  it("is zero, never null, for an export — where the basket page renders no VAT row", () => {
    const lines = [catalogueLine(2, mockCatalogue, "lunar-base", unitedStates)];
    const totals = cartTotals(lines, { deliveryZone: null });

    // `0` is this destination's genuine answer ("no VAT arises"), not "nobody
    // asked" — the same distinction `taxAmount` already draws. A screen that
    // renders a row only when the figure is a positive number renders none
    // here, exactly as it renders none for an export's `taxAmount`.
    expect(totals.goodsTaxAmount).toBe(0);
    expect(totals.goodsTaxAmount).not.toBeNull();
  });

  it("is null, same as taxAmount, when a line's own tax has not been answered", () => {
    const lines: CartLine[] = [
      {
        id: "line_example",
        productName: "Lunar Base",
        unitAmount: 2500,
        // No `taxAmount` at all — "nobody has been asked", not "none is due".
        currency: "EUR",
        quantity: 1,
        availability: "InStock",
      },
    ];
    const totals = cartTotals(lines, { deliveryZone: "europeanUnion" });
    expect(totals.goodsTaxAmount).toBeNull();
    expect(totals.taxAmount).toBeNull();
  });

  /**
   * The checkout and confirmation path is unaffected by this fix: it is
   * `store-checkout.ts`'s `assertedCartTotals`, not this module, and that
   * function already had every figure it needs from Medusa — `goodsTaxAmount`
   * is exposed there as a value already computed, not a new one, and
   * `tests/store-checkout.test.ts` pins its figures unchanged (each of the
   * three address cases now also pins `goodsTaxAmount` itself, which was
   * previously computed and discarded). This test states the boundary rather
   * than re-proving the other module: `cartTotals` here never has Medusa's
   * shipping tax to reconcile against, so it cannot and does not touch what
   * the checkout renders.
   */
  it("does not touch shippingTaxAmount or taxAmount once a zone is known — those keep meaning what they always did", () => {
    const line = catalogueLine(1, mockCatalogue, "lunar-base", estonia);
    const totals = cartTotals([line], { deliveryZone: "europeanUnion" });
    expect(totals.taxAmount).toBe(totals.goodsTaxAmount! + totals.shippingTaxAmount!);
  });
});

/**
 * `lineChargedAmount` is the one place the gross, tax-inclusive figure is
 * reconstructed — analytics reads it instead of `unitAmount` so reported
 * revenue does not appear to fall by the VAT rate now that the display is
 * net. See its doc comment in `src/lib/cart.ts`.
 */
describe("lineChargedAmount reconstructs the charged figure", () => {
  it("adds the addend back onto the net unit amount", () => {
    const line: CartLine = {
      id: "line_example",
      productName: "Lunar Base",
      unitAmount: 2500,
      taxAmount: 600,
      currency: "EUR",
      quantity: 1,
      availability: "InStock",
    };
    expect(lineChargedAmount(line)).toBe(3100);
  });

  it("treats an absent taxAmount as none due, same as cartTotals does", () => {
    const line: CartLine = {
      id: "line_example",
      productName: "Lunar Base",
      unitAmount: 2500,
      currency: "EUR",
      quantity: 1,
      availability: "InStock",
    };
    expect(lineChargedAmount(line)).toBe(2500);
  });
});
