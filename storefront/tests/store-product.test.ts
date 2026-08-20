import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AddToCartButton,
  claimAddAttempt,
} from "../src/components/shop/AddToCartButton.js";
import { mockCatalogue } from "../src/lib/catalogue.js";
import { VAT_PRICING_COUNTRY_CODE } from "../src/lib/destination.js";
import { assertBrowserMediaOnly } from "../src/lib/store-media.js";
import {
  catalogueProductFromStore,
  loadStoreCatalogueProduct,
  loadStoreProduct,
} from "../src/lib/store-product.js";

/**
 * A Store response as Medusa builds one for a **net**-priced catalogue asked
 * for in a tax context.
 *
 * `calculated_amount` is the stored price, which is the net one;
 * `calculated_amount_with_tax` and `calculated_amount_without_tax` are what
 * `wrapProductsWithTaxPrices` adds once the request names a country with a tax
 * region. Every figure is derived from `NET` and `GROSS` here rather than
 * repeated, so a fixture cannot quietly describe a price nobody sells.
 */
const NET = 25;
const GROSS = 31;

const calculatedPrice = (overrides: Record<string, unknown> = {}) => ({
  currency_code: "eur",
  calculated_amount: NET,
  calculated_amount_without_tax: NET,
  calculated_amount_with_tax: GROSS,
  is_calculated_price_tax_inclusive: false,
  ...overrides,
});

const response = (inventoryQuantity: number) => ({
  products: [{
    id: "prod_lunar_base",
    title: "Lunar Base",
    variants: [{
      id: "variant_lunar_base",
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: inventoryQuantity,
      calculated_price: calculatedPrice(),
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

  /**
   * **Both amounts come from Medusa, and `taxIncluded` no longer comes from the
   * mock.** It used to be copied out of `presentation`, which made
   * `storefront/mock/catalogue.json` a second writer of a fact Medusa owns —
   * and under net pricing that fact is the difference between the two figures
   * this shop quotes.
   */
  it("carries Medusa's two amounts and its own tax-inclusivity flag, not the mock's", () => {
    const resolved = catalogueProductFromStore(response(3), mockCatalogue);

    expect(resolved.price.amount).toBe(NET * 100);
    expect(resolved.price.amountWithTax).toBe(GROSS * 100);
    expect(resolved.price.taxIncluded).toBe(false);

    const inclusive = catalogueProductFromStore(
      {
        products: [{
          id: "prod",
          title: "Lunar Base",
          variants: [{
            id: "variant",
            manage_inventory: false,
            calculated_price: calculatedPrice({
              calculated_amount: GROSS,
              is_calculated_price_tax_inclusive: true,
            }),
          }],
        }],
      },
      mockCatalogue,
    );
    expect(
      inclusive.price.taxIncluded,
      "the flag followed the presentation rather than the response",
    ).toBe(true);
  });

  /**
   * **A response with no with-tax amount is refused, never quietly downgraded
   * to the net figure.**
   *
   * Medusa omits both tax amounts when it has no tax context — no
   * `country_code`, no tax region for it, or `automatic_taxes` off. Falling
   * back to `calculated_amount` would advertise the price before tax as the
   * price a European buyer pays, on every surface, with nothing failing and
   * nothing warning. The misconfiguration would look exactly like a working
   * shop, which is why this is a refusal and not a default.
   */
  it("refuses a response that carries no tax-inclusive price rather than falling back to the net one", () => {
    const untaxed = {
      products: [{
        id: "prod",
        title: "Lunar Base",
        variants: [{
          id: "variant",
          manage_inventory: false,
          calculated_price: { currency_code: "eur", calculated_amount: NET },
        }],
      }],
    };

    expect(() => catalogueProductFromStore(untaxed, mockCatalogue)).toThrow(/tax-inclusive price/);
  });

  it("refuses a response whose tax-inclusivity flag disagrees with its amounts", () => {
    const inconsistent = {
      products: [{
        id: "prod",
        title: "Lunar Base",
        variants: [{
          id: "variant",
          manage_inventory: false,
          // Says the stored price contains the tax, then gives the net one as
          // the stored price. One of the three statements is wrong and there is
          // no way to tell which.
          calculated_price: calculatedPrice({ is_calculated_price_tax_inclusive: true }),
        }],
      }],
    };

    expect(() => catalogueProductFromStore(inconsistent, mockCatalogue)).toThrow(/disagrees/);
  });

  it("refuses a response with no tax-inclusivity flag at all", () => {
    const unflagged = {
      products: [{
        id: "prod",
        title: "Lunar Base",
        variants: [{
          id: "variant",
          manage_inventory: false,
          calculated_price: calculatedPrice({ is_calculated_price_tax_inclusive: undefined }),
        }],
      }],
    };

    expect(() => catalogueProductFromStore(unflagged, mockCatalogue)).toThrow(/contains the tax/);
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
          calculated_price: calculatedPrice(),
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
   * **The tax context, which is what makes the with-tax amount exist at all.**
   *
   * `region_id` lets Medusa compute a price; `country_code` lets it compute the
   * tax on that price. Without the second, `setTaxContext` never populates
   * `req.taxContext`, `wrapProductsWithTaxPrices` returns before writing
   * `calculated_amount_with_tax`, and `catalogueProductFromStore` refuses the
   * whole response.
   *
   * It is asserted as a **fixed** country rather than the visitor's, and that
   * is the point: `/legal/shipping` states the EU gross figure to a reader in
   * Tokyo and `product-jsonld.ts` publishes it to a crawler with no destination
   * at all, so both amounts have to exist for every requester. A request keyed
   * to the visitor would collapse the pair outside the EU. See
   * `VAT_PRICING_COUNTRY_CODE`.
   */
  it("asks for the price in a fixed VAT country, so both amounts exist for every visitor", async () => {
    const store = stubStore();
    try {
      await loadStoreProduct(storeInput);
      await loadStoreCatalogueProduct(storeInput);
    } finally {
      store.restore();
    }

    const asked = productRequests(store.requests).map((url) => url.searchParams.get("country_code"));
    expect(asked).toEqual([
      VAT_PRICING_COUNTRY_CODE.toLowerCase(),
      VAT_PRICING_COUNTRY_CODE.toLowerCase(),
    ]);
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
