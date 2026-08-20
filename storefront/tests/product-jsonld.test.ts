/**
 * The `Product`/`Offer` block a crawler reads, checked against the catalogue
 * a *person* reads — in one file, importing both.
 *
 * The previous arrangement built this block from four environment variables
 * while the page rendered `storefront/mock/catalogue.json`, and a comment on
 * `src/app/games/lunar-base/page.tsx` claimed `tests/catalogue.test.ts`
 * stopped the two disagreeing. That test imports neither module; the claim
 * was false; and the two did disagree, one request at a time —
 * `"name":"Lunar Base Deluxe"`, `"priceCurrency":"USD"`, `"price":"29.00"`,
 * `"availability":"https://schema.org/OutOfStock"` served alongside "Lunar
 * Base / €25.00, VAT included / In stock". In the default state `offers` was
 * omitted entirely, so the page advertised a price to people and none to
 * search engines.
 *
 * There is now one source. The assertions below are written to fail if that
 * ever stops being true: they compare the structured data against
 * `resolveCatalogue()` — the exact object the product page hands
 * `LunarBaseMockup` — rather than against figures repeated here.
 */
import { describe, expect, it } from "vitest";

import { mockCatalogue, resolveCatalogue } from "../src/lib/catalogue.js";
import { destinationForCode } from "../src/lib/destination.js";
import { buildProductJsonLd } from "../src/lib/product-jsonld.js";
import { serializeInlineJson } from "../src/lib/inline-json.js";

const URL = "https://example.com/games/lunar-base";
const DESCRIPTION = "A 2-6 player strategy card game.";

const jsonLd = buildProductJsonLd({ url: URL, description: DESCRIPTION });
const offer = jsonLd.offers as Record<string, unknown>;

/**
 * The destination this block claims to speak for.
 *
 * Not the default one, and that is the change of 2026-08-18. The page's figure
 * moves with the visitor's destination; a published `Offer.price` may not,
 * because a crawler has no destination and because varying an advertised price
 * by requester is cloaking-adjacent. So the block publishes **one** figure —
 * the gross EU price — and the pin below is against `resolveCatalogue` for an
 * EU destination rather than against the page's own.
 */
const EU_DESTINATION = destinationForCode("EE");

describe("buildProductJsonLd", () => {
  it("carries a Product type with an Offer, in the default state and every other", () => {
    expect(jsonLd["@type"]).toBe("Product");
    expect(offer["@type"]).toBe("Offer");
  });

  /*
   * The expected value is computed from the catalogue, never written here.
   * `tests/no-hardcoded-price.test.ts` scans `src/` only, so the literal
   * decimal price string this assertion used to carry was the exact shape
   * that guard exists to prevent, living one directory outside its reach —
   * and it made the claim below ("none of them names a figure") true of only
   * the second `describe`.
   * `.toFixed(2)` spells the conversion under test independently of the
   * implementation, so this still fails if `buildProductJsonLd` stops
   * dividing by 100 or stops padding to two decimal places.
   */
  it("converts minor units to a decimal price string", () => {
    expect(offer.price).toBe((mockCatalogue.price.amountWithTax / 100).toFixed(2));
  });

  /**
   * **The published price is destination-independent, and says so in the
   * markup.**
   *
   * `Offer.price` alone states a number; under net pricing a consumer-facing
   * offer that does not say which of two numbers it is has told a crawler
   * nothing useful. `priceSpecification` carries the same figure with
   * `valueAddedTaxIncluded: true` beside it.
   */
  it("publishes one figure for every requester, marked as including VAT", () => {
    const specification = offer.priceSpecification as Record<string, unknown>;
    expect(specification["@type"]).toBe("UnitPriceSpecification");
    expect(specification.valueAddedTaxIncluded).toBe(true);
    expect(specification.price).toBe(offer.price);
    expect(specification.priceCurrency).toBe(offer.priceCurrency);
  });

  /**
   * The same product resolved for two destinations gives two different pages
   * and **one** block. That is the property; asserting it here is what stops a
   * later edit reintroducing a per-visitor figure.
   */
  it("publishes the same figure whatever destination the page is being rendered for", () => {
    const eu = resolveCatalogue(mockCatalogue, destinationForCode("EE"));
    const nonEu = resolveCatalogue(mockCatalogue, destinationForCode("US"));
    expect(eu.price).not.toBe(nonEu.price);
    expect(offer.price).toBe((mockCatalogue.price.amountWithTax / 100).toFixed(2));
  });

  it("prefixes availability with the schema.org URI", () => {
    expect(offer.availability).toBe("https://schema.org/InStock");
  });

  it("self-references the canonical product URL on both the product and the offer", () => {
    expect(jsonLd.url).toBe(URL);
    expect(offer.url).toBe(URL);
  });

  it("reads a different product when one is passed, rather than module state", () => {
    const other = buildProductJsonLd({
      product: { ...mockCatalogue, name: "Other Game", availability: "OutOfStock" },
      url: URL,
      description: DESCRIPTION,
    });
    expect(other.name).toBe("Other Game");
    expect((other.offers as Record<string, unknown>).availability).toBe("https://schema.org/OutOfStock");
  });
});

/**
 * The finding this file exists for. Every assertion here compares the two
 * sides directly; none of them names a figure, so they cannot pass by both
 * sides being edited to the same wrong value in this file. That is now true
 * of the `describe` above as well — it was not, and the one assertion that
 * broke it is annotated where it sits.
 */
describe("the structured data and the rendered page cannot disagree", () => {
  // The EU resolution of the same catalogue product — see EU_DESTINATION.
  const rendered = resolveCatalogue(mockCatalogue, EU_DESTINATION);

  it("publishes the same product name the page shows", () => {
    expect(jsonLd.name).toBe(rendered.productName);
  });

  it("publishes a price that formats back to the EU resolution of the same product", () => {
    const amount = offer.price as string;
    const currency = offer.priceCurrency as string;
    const formatted = new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(
      Number.parseFloat(amount),
    );
    expect(formatted).toBe(rendered.price);
  });

  it("publishes the same currency the page's price is denominated in", () => {
    expect(offer.priceCurrency).toBe(mockCatalogue.price.currency);
  });

  it("publishes an availability that agrees with the stock statement the page shows", () => {
    const published = offer.availability as string;
    expect(published.endsWith(rendered.availability)).toBe(true);
    expect(published === "https://schema.org/InStock").toBe(rendered.inStock);
  });

  it("makes a price claim at all — the default state used to make none", () => {
    const serialized = serializeInlineJson(jsonLd);
    expect(serialized).toContain('"@type":"Offer"');
    expect(serialized).toContain('"price"');
    expect(serialized).toContain('"priceCurrency"');
    expect(serialized).toContain('"availability"');
  });
});

describe("serializeInlineJson", () => {
  it("escapes '<' so the payload cannot close its enclosing script tag", () => {
    const closingTag = `</${"script"}>`;
    const serialized = serializeInlineJson({ name: `${closingTag}<script>alert(1)</script>` });
    expect(serialized).not.toContain(closingTag);
    expect(serialized).toContain("\\u003c");
  });

  it("round-trips through JSON.parse unchanged", () => {
    const value = { name: "a < b", nested: { list: ["</x>", 1] } };
    expect(JSON.parse(serializeInlineJson(value))).toEqual(value);
  });
});
