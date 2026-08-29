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
  PRICE_HEADLINE_SEPARATOR,
  mockCatalogue,
  resolveCatalogue,
  resolveCataloguePlaceholders,
} from "../src/lib/catalogue.js";
import {
  defaultDestination,
  destinationForCode,
  type Destination,
} from "../src/lib/destination.js";

/**
 * Two destinations, and they are the whole axis this file tests.
 *
 * Estonia and the United States are not arbitrary: the second is the
 * operator's declared default, so it is the state an untouched page is in, and
 * the first is an EU member state, so it is the state VAT applies in. The
 * destinations are looked up rather than written as object literals, so a test
 * cannot invent a country the site does not offer.
 */
const EU: Destination = destinationForCode("EE");
const NON_EU: Destination = destinationForCode("US");

describe("mock/catalogue.json: the frozen commercial facts", () => {
  /**
   * **The price is net and there are two amounts, which is the change of
   * 2026-08-18.** `taxIncluded` is `false` — Medusa's
   * `is_calculated_price_tax_inclusive` for a catalogue whose stored prices do
   * not contain the tax — and the file carries both the net figure and the EU
   * gross figure, because the storefront chooses between two amounts and never
   * computes one from the other.
   *
   * The gross figure is asserted **against the rate**, not as a second
   * literal, so this and `vatRatePercent` cannot drift apart here. The other
   * half of that join is in `backend/tests/commerce-product-seed.test.ts`,
   * which holds both of them to `ESTONIAN_STANDARD_VAT_PERCENT` and to the
   * product model.
   */
  it("is exactly one product, priced net in EUR, with the EU gross figure beside it", () => {
    expect(mockCatalogue.name).toBe("Lunar Base");
    expect(mockCatalogue.price.amount).toBe(2500);
    expect(mockCatalogue.price.currency).toBe("EUR");
    expect(mockCatalogue.price.taxIncluded).toBe(false);
    expect(mockCatalogue.price.vatRatePercent).toBe(24);
    expect(mockCatalogue.price.amountWithTax).toBe(
      Math.round(mockCatalogue.price.amount * (1 + mockCatalogue.price.vatRatePercent / 100)),
    );
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
  const eu = resolveCatalogue(mockCatalogue, EU);
  const nonEu = resolveCatalogue(mockCatalogue, NON_EU);

  /**
   * **The figure moves with the destination, and that is the whole model.**
   * There is no such thing as "the price" any more: a delivery address in the
   * EU attracts VAT and one anywhere else does not, so the same catalogue
   * resolves to two figures. Both are asserted against `mockCatalogue`'s own
   * amounts rather than against literals, so this cannot pass by the test and
   * the mock being edited to the same wrong pair.
   */
  it("quotes the gross figure for an EU destination and the net figure elsewhere", () => {
    expect(eu.price).toBe("€31.00");
    expect(nonEu.price).toBe("€25.00");
    expect(eu.price).not.toBe(nonEu.price);
    expect(nonEu.price).toBe(nonEu.priceNet);
    expect(eu.price).toBe(eu.priceGross);
  });

  /**
   * The four destination-independent figures. They are what makes the copy
   * able to *explain* the moving one: `/legal/shipping` states all four to
   * every reader, wherever they are.
   */
  it("resolves the same net, gross, VAT and rate for every destination", () => {
    expect(eu.priceNet).toBe(nonEu.priceNet);
    expect(eu.priceGross).toBe(nonEu.priceGross);
    expect(eu.priceVat).toBe(nonEu.priceVat);
    expect(eu.vatRate).toBe(nonEu.vatRate);
    expect(eu.vatRate).toBe(`${String(mockCatalogue.price.vatRatePercent)}%`);
  });

  /**
   * The VAT figure is the **difference between two amounts Medusa supplied**,
   * never a rate applied to one of them — see `src/lib/catalogue.ts` and
   * `tests/no-hardcoded-price.test.ts`, which refuses a rate literal anywhere
   * in `src/`. The expectation here spells the subtraction rather than the
   * multiplication for the same reason.
   */
  it("states the VAT as the difference between the two amounts, not as a rate applied", () => {
    const difference = mockCatalogue.price.amountWithTax - mockCatalogue.price.amount;
    expect(eu.priceVat).toBe(
      new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(difference / 100),
    );
  });

  it("builds a priceLine carrying the price and its qualifiers", () => {
    expect(eu.priceLine).toContain(eu.price);
    expect(eu.priceLine).toContain(eu.priceQualifiers);
  });

  /**
   * **The mitigation the operator's default depends on.**
   *
   * The selector defaults to the United States, so a European visitor who
   * never touches it is quoted the lower figure and charged the higher one at
   * checkout. The operator chose that knowing the consequence, on the
   * condition that the figure never appears as *the* price: it always carries
   * the destination it belongs to and the tax state that produced it.
   *
   * These assertions are that condition, expressed as a property of the
   * resolver rather than of any one component — so a surface cannot render a
   * qualified figure by remembering to, and cannot render a bare one by
   * forgetting.
   */
  it("names the destination and the tax state beside every figure it resolves", () => {
    expect(eu.priceTaxQualifier).toBe("VAT added, delivering to Estonia");
    expect(nonEu.priceTaxQualifier).toBe("No VAT added, delivering to United States");

    for (const resolved of [eu, nonEu]) {
      expect(resolved.priceTaxQualifier).toContain(resolved.destinationName);
      expect(resolved.priceQualifiers).toContain(resolved.priceTaxQualifier);
      expect(resolved.priceHeadline).toContain(resolved.destinationName);
      expect(resolved.priceLine).toContain(resolved.destinationName);
    }
  });

  /** The two claims that now matter, in both directions. */
  it("says VAT is added for the EU and not added anywhere else", () => {
    expect(eu.vatApplies).toBe(true);
    expect(nonEu.vatApplies).toBe(false);
    expect(eu.priceTaxQualifier).toMatch(/^VAT added/);
    expect(nonEu.priceTaxQualifier).toMatch(/^No VAT added/);
  });

  /**
   * **The secondary "VAT included" note under "Buy for {price}" — added
   * 2026-08-29, and derived from `vatApplies`, the same value that already
   * decides {@link ResolvedCatalogue.price}, rather than from a second flag.**
   *
   * `content/schema.ts` records that a `taxNote` placeholder resolving to a
   * bare "VAT included" was removed on 2026-08-10 because it rendered
   * regardless of destination, stating something false on an export. This is
   * the opposite claim, checked in both directions: present exactly where
   * `price` is the gross figure, empty exactly where it is the net one — so a
   * mutation that made it non-empty unconditionally (reinstating the removed
   * defect) fails the second assertion, and a mutation that made it always
   * empty fails the first.
   */
  it("states 'VAT included' only for the destination whose price includes it", () => {
    expect(eu.vatIncludedNote).toBe("VAT included");
    expect(nonEu.vatIncludedNote).toBe("");
    for (const resolved of [eu, nonEu]) {
      expect(resolved.vatIncludedNote.length > 0).toBe(resolved.vatApplies);
    }
  });

  /**
   * The operator's *format*, not only their words: two lines, the first
   * emphasised, with the figure and the tax qualification above and the
   * shipping and duties sentence below.
   *
   * The fields are pinned **against each other** rather than only against
   * literals, because the failure that actually shipped is a component drawing
   * the boundary somewhere the operator did not. A surface renders
   * `priceHeadline` in two nodes — the figure at display size, the rest at
   * reading size — so the whole line it paints is
   * `price + PRICE_HEADLINE_SEPARATOR + priceTaxQualifier`; if that stops
   * equalling `priceHeadline`, the string the tests assert against and the
   * string a reader sees have parted company.
   */
  it("composes the operator's emphasised line from its parts, per destination", () => {
    for (const resolved of [eu, nonEu]) {
      expect(resolved.priceHeadline).toBe(
        `${resolved.price}${PRICE_HEADLINE_SEPARATOR}${resolved.priceTaxQualifier}`,
      );
    }
    expect(eu.priceHeadline).toBe("€31.00 · VAT added, delivering to Estonia");
    expect(nonEu.priceHeadline).toBe("€25.00 · No VAT added, delivering to United States");
  });

  /**
   * The **fourth** part, and why it is not folded into the shipping note: what
   * the figure is made of and what is *not* in it are two claims, and a
   * component handed them as one string cannot separate them again — the same
   * argument that split the headline from the note in the first place.
   *
   * It is never empty. A destination with no VAT gets the sentence that says
   * so, on the principle `src/lib/cart.ts` states about formatted zeros:
   * "nothing is being stated" and "nothing" are different answers.
   */
  it("carries the net and VAT split as a fourth part, and states it for both destinations", () => {
    expect(eu.priceTaxBreakdown).toBe("€31.00 is €25.00 plus €6.00 VAT at 24%");
    expect(nonEu.priceTaxBreakdown).toBe("€25.00, with no VAT added");

    for (const resolved of [eu, nonEu]) {
      expect(resolved.priceTaxBreakdown.length).toBeGreaterThan(0);
      expect(
        resolved.priceShippingNote,
        "the split was folded into the shipping note, which is the boundary this field exists to keep",
      ).not.toContain(resolved.priceTaxBreakdown);
    }
  });

  /**
   * The unemphasised line is the shipping and duties sentence, the same for
   * every destination because it states a rule rather than a figure. It says
   * VAT is added to shipping inside the EU — which the previous wording,
   * written when the price contained the tax, did not.
   */
  it("keeps the shipping note destination-independent and true of both zones", () => {
    expect(eu.priceShippingNote).toBe(nonEu.priceShippingNote);
    expect(eu.priceShippingNote).toBe(
      "Shipping is calculated at checkout, and VAT is added to it for delivery inside the " +
        "European Union. Non-EU taxes and duties, if any, are not included.",
    );
    expect(eu.priceQualifiers).toContain(eu.priceShippingNote);
  });

  it("carries the product name and a readable availability flag", () => {
    expect(eu.productName).toBe("Lunar Base");
    expect(eu.inStock).toBe(true);
  });

  it("defaults to the operator's declared destination rather than to no destination", () => {
    expect(resolveCatalogue().destinationCode).toBe(defaultDestination.code);
    expect(resolveCatalogue()).toEqual(resolveCatalogue(mockCatalogue, defaultDestination));
  });

  it("resolves a different catalogue when one is passed explicitly, rather than reading module state", () => {
    const otherwise = resolveCatalogue(
      {
        name: "Other Game",
        price: {
          amount: 999,
          amountWithTax: 1199,
          currency: "USD",
          taxIncluded: false,
          vatRatePercent: 20,
        },
        availability: "OutOfStock",
        players: { min: 1, max: 4 },
        playtimeMinutes: 45,
        setupMinutes: 5,
        cardCount: 60,
        ageRange: "8+",
      },
      EU,
    );
    expect(otherwise.productName).toBe("Other Game");
    expect(otherwise.price).toBe("US$11.99");
    expect(otherwise.priceNet).toBe("US$9.99");
    expect(otherwise.vatRate).toBe("20%");
    expect(otherwise.priceHeadline).toBe("US$11.99 · VAT added, delivering to Estonia");
    expect(otherwise.inStock).toBe(false);
  });
});

describe("resolveCataloguePlaceholders", () => {
  const catalogue = resolveCatalogue(mockCatalogue, EU);

  it("resolves every catalogue-sourced placeholder content/schema.ts declares", () => {
    expect(resolveCataloguePlaceholders("{price}", catalogue)).toBe(catalogue.price);
    expect(resolveCataloguePlaceholders("{priceLine}", catalogue)).toBe(catalogue.priceLine);
    expect(resolveCataloguePlaceholders("{productName}", catalogue)).toBe(catalogue.productName);
    expect(resolveCataloguePlaceholders("{priceNet}", catalogue)).toBe(catalogue.priceNet);
    expect(resolveCataloguePlaceholders("{priceGross}", catalogue)).toBe(catalogue.priceGross);
    expect(resolveCataloguePlaceholders("{priceVat}", catalogue)).toBe(catalogue.priceVat);
    expect(resolveCataloguePlaceholders("{vatRate}", catalogue)).toBe(catalogue.vatRate);
    expect(resolveCataloguePlaceholders("{priceTaxQualifier}", catalogue)).toBe(
      catalogue.priceTaxQualifier,
    );
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

/**
 * The set-equality pin, and it is asserted in **both** directions on purpose.
 *
 * It used to name the expected set once, so removing a placeholder from
 * `content/schema.ts` and leaving its resolver in `src/lib/catalogue.ts` — or
 * the reverse — needed only this one literal edited to stay green. `taxNote`
 * was removed from all three places in one change on the operator's answer of
 * 2026-08-10, and the second direction is what makes that a guard rather than a
 * convention: a resolver with no declaration behind it is a token content
 * cannot legally write, and a declaration with no resolver is a brace on a
 * page.
 */
describe("the catalogue resolvers and content/schema.ts's catalogue placeholders are the same set", () => {
  it("resolves exactly the source: \"catalogue\" declarations, in both directions", async () => {
    const { PLACEHOLDERS } = await import("../../content/schema.js");
    const catalogueSourced = Object.entries(PLACEHOLDERS)
      .filter(([, placeholder]) => placeholder.source === "catalogue")
      .map(([token]) => token)
      .toSorted();

    expect(catalogueSourced).toEqual([
      "price",
      "priceGross",
      "priceLine",
      "priceNet",
      "priceTaxQualifier",
      "priceVat",
      "productName",
      "vatRate",
    ]);

    // And nothing resolves that content cannot declare: every declared token
    // comes back changed, and an undeclared one comes back untouched.
    const catalogue = resolveCatalogue();
    for (const token of catalogueSourced) {
      expect(
        resolveCataloguePlaceholders(`{${token}}`, catalogue),
        `{${token}} is declared in content/schema.ts and this module cannot resolve it`,
      ).not.toContain("{");
    }
    expect(
      resolveCataloguePlaceholders("{taxNote}", catalogue),
      "taxNote resolves here but is no longer declared — a resolver for a string no page may write",
    ).toBe("{taxNote}");
  });
});
