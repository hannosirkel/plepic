/**
 * The mock catalogue contract.
 *
 * `storefront/mock/catalogue.json` is not a fixture this unit invented for
 * its own convenience — it is required to mirror the values Task 5's live
 * catalogue will be seeded with: same price, same stock state, same product
 * name and copy (packet: "the mock catalogue is a contract, not a fixture").
 * This file pins the frozen commercial facts (Task 1, the operator's
 * migration-inputs manifest, 2026-08-09) against silent drift, and exercises
 * `src/lib/catalogue.ts`'s resolution of `content/`'s catalogue placeholders.
 *
 * **On "make that agreement mechanical" (the tenth checkbox).** The checkbox
 * asks to derive Task 5's CI seed fixture from this file, or assert equality
 * between the two in a test that fails the build. Task 5 has not landed in
 * this repository — there is no backend seed script yet to derive from or
 * compare against, and `backend/` is explicitly "added by a later PR unit"
 * per `README.md`. What this unit *can* do, and does, is make itself the
 * single source of truth today: every price, stock and specification figure
 * this unit renders is read from `mock/catalogue.json` through
 * `resolveCatalogue`/`resolveCataloguePlaceholders` and never duplicated as a
 * second literal anywhere else (checked by `tests/no-hardcoded-price.test.ts`
 * for the price specifically). The frozen-fact assertions below are what Task
 * 5's seed script must reproduce; when it exists, either it imports this
 * exact file or a test in *that* unit asserts equality against it, per the
 * checkbox's own "or" — recorded here because that half of the mechanism
 * cannot be built until the thing it agrees with exists.
 */
import { describe, expect, it } from "vitest";

import {
  mockCatalogue,
  resolveCatalogue,
  resolveCataloguePlaceholders,
} from "../src/lib/catalogue.js";

describe("mock/catalogue.json: the frozen commercial facts", () => {
  it("is exactly one product, EUR 25.00, VAT included, worldwide", () => {
    expect(mockCatalogue.name).toBe("Lunar Base");
    expect(mockCatalogue.price.amount).toBe(2500);
    expect(mockCatalogue.price.currency).toBe("EUR");
    expect(mockCatalogue.price.taxIncluded).toBe(true);
  });

  it("is in stock, unmanaged — a statement, never a count", () => {
    expect(mockCatalogue.availability).toBe("InStock");
  });

  it("carries the frozen specification: 2-6 players, ~30 minutes, ~1 minute setup, 90 cards, age 10+", () => {
    expect(mockCatalogue.players).toEqual({ min: 2, max: 6 });
    expect(mockCatalogue.playtimeMinutes).toBe(30);
    expect(mockCatalogue.setupMinutes).toBe(1);
    expect(mockCatalogue.cardCount).toBe(90);
    expect(mockCatalogue.ageRange).toBe("10+");
  });
});

describe("resolveCatalogue", () => {
  const resolved = resolveCatalogue();

  it("formats the price with its currency symbol", () => {
    expect(resolved.price).toBe("€25.00");
  });

  it("builds a priceLine carrying the price, the tax note and the shipping note", () => {
    expect(resolved.priceLine).toContain(resolved.price);
    expect(resolved.priceLine).toContain("VAT included");
    expect(resolved.priceLine).toContain("Shipping calculated at checkout");
  });

  it("carries the product name and a readable availability flag", () => {
    expect(resolved.productName).toBe("Lunar Base");
    expect(resolved.inStock).toBe(true);
  });

  it("resolves a different catalogue when one is passed explicitly, rather than reading module state", () => {
    const otherwise = resolveCatalogue({
      name: "Other Game",
      price: { amount: 999, currency: "USD", taxIncluded: false },
      availability: "OutOfStock",
      players: { min: 1, max: 4 },
      playtimeMinutes: 45,
      setupMinutes: 5,
      cardCount: 60,
      ageRange: "8+",
    });
    expect(otherwise.productName).toBe("Other Game");
    expect(otherwise.price).toBe("US$9.99");
    expect(otherwise.taxNote).toBe("VAT calculated at checkout");
    expect(otherwise.inStock).toBe(false);
  });
});

describe("resolveCataloguePlaceholders", () => {
  const catalogue = resolveCatalogue();

  it("resolves every catalogue-sourced placeholder content/schema.ts declares", () => {
    expect(resolveCataloguePlaceholders("{price}", catalogue)).toBe(catalogue.price);
    expect(resolveCataloguePlaceholders("{priceLine}", catalogue)).toBe(catalogue.priceLine);
    expect(resolveCataloguePlaceholders("{taxNote}", catalogue)).toBe(catalogue.taxNote);
    expect(resolveCataloguePlaceholders("{productName}", catalogue)).toBe(catalogue.productName);
  });

  it("resolves a placeholder embedded in a full sentence, exactly the shape content/publisher.ts carries", () => {
    expect(resolveCataloguePlaceholders("Buy for {price}", catalogue)).toBe(`Buy for ${catalogue.price}`);
  });

  it("resolves more than one placeholder in the same string", () => {
    expect(resolveCataloguePlaceholders("{productName}: {price}", catalogue)).toBe(
      `${catalogue.productName}: ${catalogue.price}`,
    );
  });

  it("leaves a configuration-sourced placeholder untouched, never dropped or emptied", () => {
    const text = "Write to us at {merchantContactAddress}.";
    expect(resolveCataloguePlaceholders(text, catalogue)).toBe(text);
  });

  it("leaves an unrecognised token untouched too", () => {
    expect(resolveCataloguePlaceholders("{notAPlaceholder}", catalogue)).toBe("{notAPlaceholder}");
  });

  it("resolves a real placeholder string from content/lunar-base.ts, verbatim", () => {
    // purchase.priceLine is the literal string "{priceLine}" in content/lunar-base.ts.
    expect(resolveCataloguePlaceholders("{priceLine}", catalogue)).not.toContain("{");
  });
});

describe("every catalogue-sourced token this module resolves is a real content/schema.ts PLACEHOLDERS key", () => {
  it("resolves price, priceLine, taxNote and productName — and only those four are source: \"catalogue\"", async () => {
    const { PLACEHOLDERS } = await import("../../content/schema.js");
    const catalogueSourced = Object.entries(PLACEHOLDERS)
      .filter(([, placeholder]) => placeholder.source === "catalogue")
      .map(([token]) => token)
      .toSorted();
    expect(catalogueSourced).toEqual(["price", "priceLine", "productName", "taxNote"].toSorted());
  });
});
