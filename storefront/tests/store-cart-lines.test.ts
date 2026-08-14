import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsEnabled } from "../src/lib/analytics.js";
import { addStoreCatalogueLine, cartLinesFromStore } from "../src/lib/cart-store.js";

afterEach(() => {
  setAnalyticsEnabled(false);
  delete (globalThis as { window?: unknown }).window;
});

describe("Medusa cart money boundary", () => {
  it("converts major-unit line prices to integer cents", () => {
    expect(cartLinesFromStore({
      currency_code: "eur",
      items: [{
        id: "line_example",
        title: "Lunar Base",
        unit_price: 25,
        quantity: 1,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    })).toEqual([{
      id: "line_example",
      variantId: "variant_example",
      productName: "Lunar Base",
      unitAmount: 2500,
      currency: "EUR",
      quantity: 1,
      availability: "InStock",
    }]);
  });
});

describe("real empty-basket analytics", () => {
  const updatedCart = {
    currency_code: "eur",
    items: [{
      id: "line_example", title: "Lunar Base", unit_price: 25, quantity: 1,
      variant: { id: "variant_example", manage_inventory: false },
    }],
  };

  function client(createLineItem: ReturnType<typeof vi.fn>) {
    return {
      store: {
        product: { list: vi.fn(async () => ({ products: [{ variants: [{ id: "variant_example" }] }] })) },
        region: { list: vi.fn(async () => ({ regions: [{ id: "region_example" }] })) },
        cart: {
          create: vi.fn(async () => ({ cart: { id: "cart_new" } })),
          createLineItem,
        },
      },
    };
  }

  it.each([
    ["a new cart", null, "cart_new"],
    ["an existing empty cart", "cart_existing", "cart_existing"],
  ] as const)("emits after Store accepts the line for %s", async (_label, existingCartId, expectedCartId) => {
    const dataLayer: unknown[] = [];
    (globalThis as { window?: unknown }).window = { dataLayer };
    setAnalyticsEnabled(true);
    const createLineItem = vi.fn(async () => ({ cart: updatedCart }));

    await expect(addStoreCatalogueLine(client(createLineItem) as never, existingCartId)).resolves.toMatchObject({
      cartId: expectedCartId,
      lines: [{ variantId: "variant_example" }],
    });
    expect(createLineItem).toHaveBeenCalledWith(expectedCartId, { variant_id: "variant_example", quantity: 1 });
    expect(Array.from(dataLayer[0] as ArrayLike<unknown>)).toEqual(["event", "add_to_cart", {
      currency: "EUR", value: 25,
      items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 1 }],
    }]);
  });

  it("emits nothing when Store rejects line creation", async () => {
    const dataLayer: unknown[] = [];
    (globalThis as { window?: unknown }).window = { dataLayer };
    setAnalyticsEnabled(true);
    const createLineItem = vi.fn(async () => { throw new Error("synthetic Store rejection"); });

    await expect(addStoreCatalogueLine(client(createLineItem) as never, null)).rejects.toThrow("synthetic Store rejection");
    expect(dataLayer).toEqual([]);
  });
});
