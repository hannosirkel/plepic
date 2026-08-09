import { describe, expect, it } from "vitest";

import { buildProductJsonLd } from "../src/lib/product-jsonld.js";
import { serializeInlineJson } from "../src/lib/inline-json.js";

const URL = "https://example.com/games/lunar-base";
const DESCRIPTION = "A 2-6 player strategy card game.";

describe("buildProductJsonLd with a configured offer", () => {
  const jsonLd = buildProductJsonLd({
    catalogue: {
      productName: "Lunar Base",
      offer: { priceAmount: 3900, priceCurrency: "EUR", availability: "InStock" },
    },
    url: URL,
    description: DESCRIPTION,
  });

  it("carries a Product type with an Offer", () => {
    expect(jsonLd["@type"]).toBe("Product");
    expect((jsonLd.offers as Record<string, unknown>)["@type"]).toBe("Offer");
  });

  it("converts minor units to a decimal price string", () => {
    expect((jsonLd.offers as Record<string, unknown>).price).toBe("39.00");
  });

  it("carries the ISO currency code unchanged", () => {
    expect((jsonLd.offers as Record<string, unknown>).priceCurrency).toBe("EUR");
  });

  it("prefixes availability with the schema.org URI", () => {
    expect((jsonLd.offers as Record<string, unknown>).availability).toBe("https://schema.org/InStock");
  });

  it("self-references the canonical product URL on both the product and the offer", () => {
    expect(jsonLd.url).toBe(URL);
    expect((jsonLd.offers as Record<string, unknown>).url).toBe(URL);
  });
});

/**
 * The other half of "an unconfigured deployment must never publish a price
 * that is not real". `tests/runtime-config.test.ts` proves the configuration
 * layer hands back no offer; this proves the structured data then makes no
 * price claim, rather than falling back to some other default further down.
 */
describe("buildProductJsonLd with no configured offer", () => {
  const jsonLd = buildProductJsonLd({
    catalogue: { productName: "Lunar Base", offer: null },
    url: URL,
    description: DESCRIPTION,
  });

  it("is still a Product with a name, description and self-referencing URL", () => {
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("Lunar Base");
    expect(jsonLd.url).toBe(URL);
  });

  it("omits offers entirely rather than publishing a defaulted price", () => {
    expect("offers" in jsonLd).toBe(false);
  });

  it("mentions no price, currency or availability anywhere in the serialized payload", () => {
    const serialized = serializeInlineJson(jsonLd);
    expect(serialized).not.toContain("price");
    expect(serialized).not.toContain("Currency");
    expect(serialized).not.toContain("availability");
    expect(serialized).not.toMatch(/\b\d+\.\d{2}\b/);
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
