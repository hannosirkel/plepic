import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsEnabled } from "../src/lib/analytics.js";
import { addStoreCatalogueLine, cartLinesFromStore } from "../src/lib/cart-store.js";

afterEach(() => {
  setAnalyticsEnabled(false);
  delete (globalThis as { window?: unknown }).window;
});

describe("Medusa cart money boundary", () => {
  /**
   * **The line total, not `unit_price`.** The stored price is net, so a basket
   * built from `unit_price` stated the figure before tax for goods Medusa
   * charges the figure after it for — on the screen whose figures feed the
   * Article 8(2) disclosure block on `/checkout`. `cart.item_total` is line
   * items after discounts **including** tax, which is what `store-checkout.ts`
   * argues for at length and what `store-payment.ts` already read on the
   * confirmation path.
   *
   * The fixture is a European cart: net 25, taxed to 31.
   */
  it("prices each line from Medusa's tax-inclusive line total, not the stored unit price", () => {
    expect(cartLinesFromStore({
      currency_code: "eur",
      item_total: 31,
      items: [{
        id: "line_example",
        title: "Lunar Base",
        unit_price: 25,
        total: 31,
        quantity: 1,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    })).toEqual([{
      id: "line_example",
      variantId: "variant_example",
      productName: "Lunar Base",
      unitAmount: 3100,
      currency: "EUR",
      quantity: 1,
      availability: "InStock",
    }]);
  });

  it("divides a multi-unit line total into a whole unit price", () => {
    const [line] = cartLinesFromStore({
      currency_code: "eur",
      item_total: 93,
      items: [{
        id: "line_example",
        title: "Lunar Base",
        unit_price: 25,
        total: 93,
        quantity: 3,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    });
    expect(line?.unitAmount).toBe(3100);
  });

  /**
   * Two refusals, both of the same species as the checkout's "totals that do
   * not add up": the basket must not state a figure it cannot stand behind.
   *
   * The first is a line whose total does not divide into whole units — a
   * rounded unit price beside an unrounded line total is two answers to "what
   * does one cost?". The second is a set of lines that does not account for the
   * cart's own goods figure, which is Medusa disagreeing with itself.
   */
  it("refuses a line total that does not divide into a whole unit price", () => {
    expect(() => cartLinesFromStore({
      currency_code: "eur",
      item_total: 31.01,
      items: [{
        id: "line_example", title: "Lunar Base", unit_price: 25, total: 31.01, quantity: 2,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    })).toThrow(/whole unit price/);
  });

  it("refuses lines that do not add up to the cart's own goods figure", () => {
    expect(() => cartLinesFromStore({
      currency_code: "eur",
      item_total: 25,
      items: [{
        id: "line_example", title: "Lunar Base", unit_price: 25, total: 31, quantity: 1,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    })).toThrow(/goods figure/);
  });
});

describe("real empty-basket analytics", () => {
  const updatedCart = {
    currency_code: "eur",
    item_total: 31,
    items: [{
      id: "line_example", title: "Lunar Base", unit_price: 25, total: 31, quantity: 1,
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
          // The destination is written onto the cart before the line, so
          // Medusa answers for a real address rather than for none.
          update: vi.fn(async () => ({ cart: { id: "cart_new" } })),
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

    await expect(addStoreCatalogueLine(client(createLineItem) as never, existingCartId, "EE")).resolves.toMatchObject({
      cartId: expectedCartId,
      lines: [{ variantId: "variant_example" }],
    });
    expect(createLineItem).toHaveBeenCalledWith(expectedCartId, { variant_id: "variant_example", quantity: 1 });
    // The measured value is the tax-inclusive one, because that is what the
    // buyer is charged and what every other surface now states.
    expect(Array.from(dataLayer[0] as ArrayLike<unknown>)).toEqual(["event", "add_to_cart", {
      currency: "EUR", value: 31,
      items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 31, quantity: 1 }],
    }]);
  });

  it("emits nothing when Store rejects line creation", async () => {
    const dataLayer: unknown[] = [];
    (globalThis as { window?: unknown }).window = { dataLayer };
    setAnalyticsEnabled(true);
    const createLineItem = vi.fn(async () => { throw new Error("synthetic Store rejection"); });

    await expect(addStoreCatalogueLine(client(createLineItem) as never, null, "EE")).rejects.toThrow("synthetic Store rejection");
    expect(dataLayer).toEqual([]);
  });
});
