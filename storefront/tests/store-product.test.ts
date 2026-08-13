import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AddToCartButton,
  claimAddAttempt,
} from "../src/components/shop/AddToCartButton.js";
import { mockCatalogue } from "../src/lib/catalogue.js";
import {
  catalogueProductFromStore,
  loadStoreProduct,
} from "../src/lib/store-product.js";

const response = (inventoryQuantity: number) => ({
  products: [{
    id: "prod_lunar_base",
    title: "Lunar Base",
    variants: [{
      id: "variant_lunar_base",
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: inventoryQuantity,
      calculated_price: { currency_code: "eur", calculated_amount: 25 },
    }],
  }],
});

describe("Store catalogue boundary", () => {
  it("uses Store-calculated EUR price and managed inventory for the live page", () => {
    expect(catalogueProductFromStore(response(3), mockCatalogue)).toMatchObject({
      name: "Lunar Base",
      price: { amount: 2500, currency: "EUR" },
      availability: "InStock",
    });
  });

  it("marks an exhausted managed variant unavailable instead of leaving an addable product", () => {
    expect(catalogueProductFromStore(response(0), mockCatalogue).availability).toBe("OutOfStock");
  });

  it("renders an exhausted variant in the existing CTA slot without an active add action", () => {
    const html = renderToStaticMarkup(
      createElement(AddToCartButton, {
        label: "Add to basket",
        variantId: null,
      }),
    );

    expect(html).toContain("disabled");
    expect(html).toContain("Out of stock");
    expect(html).not.toContain("Add to basket");
  });

  it("synchronously refuses a second add attempt before React can rerender", () => {
    const inFlight = { current: false };
    expect(claimAddAttempt(inFlight)).toBe(true);
    expect(claimAddAttempt(inFlight)).toBe(false);
  });

  it("fails closed when Store supplies no active EUR variant", () => {
    expect(() => catalogueProductFromStore({ products: [{ id: "prod", title: "Lunar Base", variants: [] }] }, mockCatalogue)).toThrow("purchasable");
  });

  it("explicitly requests Medusa's computed price and inventory fields", async () => {
    const originalFetch = globalThis.fetch;
    const requested = { fields: null as string | null };
    globalThis.fetch = async (input) => {
      requested.fields = new URL(String(input)).searchParams.get("fields");
      return new Response(JSON.stringify(response(3)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      await loadStoreProduct({
        backendUrl: "https://store.example.test",
        publishableKey: "pk_example_product",
        presentation: mockCatalogue,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requested.fields?.split(",")).toEqual(
      expect.arrayContaining([
        "+variants.calculated_price",
        "+variants.inventory_quantity",
      ]),
    );
  });
});
