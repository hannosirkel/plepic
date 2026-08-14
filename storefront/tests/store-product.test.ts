import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AddToCartButton,
  claimAddAttempt,
} from "../src/components/shop/AddToCartButton.js";
import { mockCatalogue } from "../src/lib/catalogue.js";
import { assertBrowserMediaOnly } from "../src/lib/store-media.js";
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

  it("retains stable variant identity for an exhausted product while disabling purchase", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify(response(0)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    try {
      await expect(loadStoreProduct({
        backendUrl: "https://store.example.test",
        publishableKey: "pk_example_product",
        presentation: mockCatalogue,
      })).resolves.toMatchObject({ variantId: null, analyticsVariantId: "variant_lunar_base" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("renders an exhausted variant in the existing CTA slot without an active add action", () => {
    const html = renderToStaticMarkup(
      createElement(AddToCartButton, {
        label: "Add to basket",
        variantId: null,
        analyticsVariantId: "variant_lunar_base",
        productName: "Lunar Base",
        unitAmount: 2500,
        currency: "EUR",
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

  /**
   * The render leg of the media round trip.
   *
   * `imageUrls` was computed and then read by nobody, so "every product image
   * URL the browser receives is the relative `/store-api/static/` form" was
   * true only because the browser received none. Page composition must not
   * change, so the answer is not to render an image nobody asked for: it is
   * that the product data built here cannot carry a provider URL out of this
   * module at all. A future consumer that forwards `product.thumbnail`
   * unconverted inherits the refusal rather than shipping the URL.
   */
  describe("the media the product data may carry", () => {
    const withMedia = {
      products: [{
        id: "prod_lunar_base",
        title: "Lunar Base",
        thumbnail: "/static/lunar-base-box.webp",
        images: [
          { url: "/static/lunar-base-table.webp" },
          // What Medusa's own file provider hands out by default, and what an
          // S3 or CDN provider would hand out if one were ever configured.
          { url: "http://localhost:9000/static/admin-upload.webp" },
          { url: "https://cdn.example.invalid/lunar-base-box.webp" },
        ],
        variants: [{
          id: "variant_lunar_base",
          manage_inventory: false,
          calculated_price: { currency_code: "eur", calculated_amount: 25 },
        }],
      }],
    };

    async function loadWith(body: unknown): Promise<Awaited<ReturnType<typeof loadStoreProduct>>> {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      try {
        return await loadStoreProduct({
          backendUrl: "https://store.example.test",
          publishableKey: "pk_example_product",
          presentation: mockCatalogue,
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    }

    it("hands back only the relative browser form and drops every other origin", async () => {
      const loaded = await loadWith(withMedia);

      expect(loaded.imageUrls).toEqual([
        "/store-api/static/lunar-base-box.webp",
        "/store-api/static/lunar-base-table.webp",
      ]);
      expect(JSON.stringify(loaded)).not.toContain("localhost:9000");
      expect(JSON.stringify(loaded)).not.toContain("cdn.example.invalid");
    });

    it("refuses a product payload that carries a provider URL, wherever it sits", () => {
      for (const payload of [
        { thumbnail: "/static/lunar-base-box.webp" },
        { catalogue: { hero: "http://localhost:9000/static/admin-upload.webp" } },
        { imageUrls: ["/store-api/static/ok.webp", "/static/leaked.webp"] },
        { nested: [{ deeper: { url: "https://cdn.example.invalid/static/leaked.webp" } }] },
      ]) {
        expect(() => assertBrowserMediaOnly(payload), JSON.stringify(payload)).toThrow(
          /provider media URL/,
        );
      }
    });

    it("admits the product data the page is actually built from", async () => {
      const loaded = await loadWith(withMedia);
      expect(assertBrowserMediaOnly(loaded)).toBe(loaded);
      expect(() => assertBrowserMediaOnly({ imageUrls: ["/store-api/static/box.webp"] })).not.toThrow();
    });
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
