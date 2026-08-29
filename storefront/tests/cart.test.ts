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
