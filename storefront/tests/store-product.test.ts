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
  loadStoreCatalogueProduct,
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

const regions = (...ids: readonly string[]) => ({ regions: ids.map((id) => ({ id })) });

const storeInput = {
  backendUrl: "https://store.example.test",
  publishableKey: "pk_example_product",
  presentation: mockCatalogue,
};

/**
 * The Store backend as the loaders see it: two routes, not one.
 *
 * A stub that answered every URL with a product body was what let the missing
 * pricing context through — the live backend answers such a request with
 * `400 invalid_data: Missing required pricing context to calculate prices -
 * region_id`, and no test could see that because no test looked at the request.
 * Routing by path here is what makes the region lookup, and the query the
 * catalogue request is built from, visible to assertions.
 */
function stubStore(options: {
  readonly product?: unknown;
  readonly regionsBody?: unknown;
} = {}): { readonly requests: URL[]; readonly restore: () => void } {
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const body = url.pathname === "/store/regions"
      ? options.regionsBody ?? regions("region_eu")
      : options.product ?? response(3);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { requests, restore: () => { globalThis.fetch = originalFetch; } };
}

const productRequests = (requests: readonly URL[]) => requests.filter((url) => url.pathname === "/store/products");

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
    const store = stubStore({ product: response(0) });
    try {
      await expect(loadStoreProduct(storeInput)).resolves.toMatchObject({
        variantId: null,
        analyticsVariantId: "variant_lunar_base",
      });
    } finally {
      store.restore();
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
      const store = stubStore({ product: body });
      try {
        return await loadStoreProduct(storeInput);
      } finally {
        store.restore();
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

    it("refuses a provider URL in any media-bearing field, however deep", () => {
      for (const payload of [
        { thumbnail: "/static/lunar-base-box.webp" },
        { catalogue: { hero: "http://localhost:9000/static/admin-upload.webp" } },
        { imageUrls: ["/store-api/static/ok.webp", "/static/leaked.webp"] },
        { catalogue: { images: [{ url: "https://cdn.example.invalid/static/leaked.webp" }] } },
      ]) {
        expect(() => assertBrowserMediaOnly(payload), JSON.stringify(payload)).toThrow(
          /provider media URL/,
        );
      }
    });

    /**
     * The backstop has to cover the origins it claims to cover.
     *
     * Matching only `/static/` caught what `@medusajs/file-local` hands out and
     * nothing else: an S3 URL, a CDN URL and a protocol-relative
     * `//host/static/…` all passed it. `browserMediaUrl` dropped them on the
     * live path, so nothing leaked — but the guard that is supposed to catch a
     * future consumer forwarding one unconverted did not catch these at all.
     */
    it("refuses an absolute media URL whatever its origin and path", () => {
      for (const url of [
        // The shape an S3-style provider hands out: a bucket origin of its own
        // and a path that owes nothing to `/static/`.
        "https://plepic-assets.s3.example.invalid/uploads/box.webp",
        "https://cdn.example.invalid/media/box.webp",
        "//cdn.example.invalid/static/box.webp",
        "http://localhost:9000/static/box.webp",
        "HTTPS://CDN.EXAMPLE.INVALID/box.webp",
      ]) {
        expect(() => assertBrowserMediaOnly({ imageUrls: [url] }), url).toThrow(
          /provider media URL/,
        );
        expect(() => assertBrowserMediaOnly({ thumbnail: url }), url).toThrow(
          /provider media URL/,
        );
      }
    });

    /**
     * And it must not cover what it never claimed to.
     *
     * `product.title` is Admin-editable text that arrives from Medusa, so a
     * product retitled `/static/anything` is ordinary catalogue data. Walking
     * every string in the payload turned that into a thrown error on the one
     * canonical product page — a page taken down by a title.
     */
    it("leaves catalogue text alone, including a product retitled like a media path", async () => {
      const retitled = {
        products: [{
          ...withMedia.products[0],
          title: "/static/anything",
        }],
      };

      const loaded = await loadWith(retitled);

      expect(loaded.catalogue.name).toBe("/static/anything");
      expect(loaded.imageUrls).toEqual([
        "/store-api/static/lunar-base-box.webp",
        "/store-api/static/lunar-base-table.webp",
      ]);
      expect(() =>
        assertBrowserMediaOnly({
          catalogue: { name: "https://cdn.example.invalid/marketing", availability: "InStock" },
          canonical: "https://plepicgames.example/shop/lunar-base",
          jsonLd: { "@type": "Product", url: "https://plepicgames.example/shop/lunar-base" },
        }),
      ).not.toThrow();
    });

    it("admits the product data the page is actually built from", async () => {
      const loaded = await loadWith(withMedia);
      expect(assertBrowserMediaOnly(loaded)).toBe(loaded);
      expect(() => assertBrowserMediaOnly({ imageUrls: ["/store-api/static/box.webp"] })).not.toThrow();
    });
  });

  it("explicitly requests Medusa's computed price and inventory fields", async () => {
    const store = stubStore();
    try {
      await loadStoreProduct(storeInput);
    } finally {
      store.restore();
    }

    expect(productRequests(store.requests)[0]?.searchParams.get("fields")?.split(",")).toEqual(
      expect.arrayContaining([
        "+variants.calculated_price",
        "+variants.inventory_quantity",
      ]),
    );
  });

  /**
   * The pricing context `+variants.calculated_price` is meaningless without.
   *
   * Asking Medusa v2 to compute a price without saying whose price it is, is
   * not a request that returns an unpriced product — it is a 400:
   * `{"type":"invalid_data","message":"Missing required pricing context to
   * calculate prices - region_id"}`. Every catalogue load made exactly that
   * request, so the storefront's readiness probe answered 500 and the
   * deployment sat in `CrashLoopBackOff` from its first replica.
   *
   * These assert the **request**, because the response is not where the defect
   * lived: a stub that answered 200 to anything, which is what this file used
   * to install, reproduced none of it.
   */
  describe("the pricing context a catalogue request must carry", () => {
    it("prices the product page's catalogue in the store's one region", async () => {
      const store = stubStore({ regionsBody: regions("region_eu_only") });
      try {
        await loadStoreProduct(storeInput);
      } finally {
        store.restore();
      }

      expect(productRequests(store.requests)[0]?.searchParams.get("region_id")).toBe("region_eu_only");
    });

    it("prices the home page's catalogue in the store's one region", async () => {
      const store = stubStore({ regionsBody: regions("region_eu_only") });
      try {
        await loadStoreCatalogueProduct(storeInput);
      } finally {
        store.restore();
      }

      expect(productRequests(store.requests)[0]?.searchParams.get("region_id")).toBe("region_eu_only");
    });

    it("authenticates the region lookup with the Store publishable key", async () => {
      const seen: (string | null)[] = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        const headers = new Headers(init?.headers);
        if (url.pathname === "/store/regions") seen.push(headers.get("x-publishable-api-key"));
        return new Response(
          JSON.stringify(url.pathname === "/store/regions" ? regions("region_eu") : response(3)),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      };
      try {
        await loadStoreProduct(storeInput);
      } finally {
        globalThis.fetch = originalFetch;
      }

      expect(seen).toEqual(["pk_example_product"]);
    });

    /**
     * The same refusal `AddToCartButton` already makes before creating a cart.
     * A storefront that guessed a region here would show a price computed in
     * one region and charge the price of whichever region the cart picked.
     */
    it("refuses to guess a region rather than price the catalogue in an arbitrary one", async () => {
      for (const [label, body] of [
        ["no region", regions()],
        ["two regions", regions("region_eu", "region_us")],
      ] as const) {
        const store = stubStore({ regionsBody: body });
        try {
          await expect(loadStoreProduct(storeInput), label).rejects.toThrow("exactly one region");
          await expect(loadStoreCatalogueProduct(storeInput), label).rejects.toThrow("exactly one region");
        } finally {
          store.restore();
        }
        expect(productRequests(store.requests), label).toEqual([]);
      }
    });
  });
});
