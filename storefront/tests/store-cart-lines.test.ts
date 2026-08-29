import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsEnabled } from "../src/lib/analytics.js";
import { addStoreCatalogueLine } from "../src/lib/cart-store.js";
import { STORE_CART_FIELDS, cartLinesFromStore } from "../src/lib/store-cart.js";

afterEach(() => {
  setAnalyticsEnabled(false);
  delete (globalThis as { window?: unknown }).window;
});

describe("Medusa cart money boundary", () => {
  /**
   * **`subtotal`, not the stored `unit_price` and not `total` either.** The
   * stored `unit_price` is net for the wrong reason — it never asked Medusa's
   * tax engine anything — while `subtotal` is Medusa's own computed net
   * figure for this line, requested alongside `total` and `tax_total` via
   * {@link STORE_CART_FIELDS}. `unitAmount` reads it since the basket-lines
   * fix that followed 2026-08-29, so it agrees with `cartTotals`' "Price of
   * the goods" row for the same basket rather than restating the gross
   * `total` the basket's own "Price" and "Line total" columns used to show
   * above that now-net row. `taxAmount` is unchanged: `total` minus
   * `subtotal`, still the VAT on this line — now an addend onto `unitAmount`
   * rather than a quantity inside it.
   *
   * The fixture is a European cart: net 25, taxed to 31.
   */
  it("prices each line from Medusa's net line subtotal, not the stored unit price or the tax-inclusive total", () => {
    expect(cartLinesFromStore({
      currency_code: "eur",
      item_total: 31,
      items: [{
        id: "line_example",
        title: "Lunar Base",
        unit_price: 25,
        total: 31,
        subtotal: 25,
        quantity: 1,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    })).toEqual([{
      id: "line_example",
      variantId: "variant_example",
      productName: "Lunar Base",
      unitAmount: 2500,
      taxAmount: 600,
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
        subtotal: 75,
        quantity: 3,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    });
    expect(line?.unitAmount).toBe(2500);
    expect(line?.taxAmount).toBe(600);
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
        id: "line_example", title: "Lunar Base", unit_price: 25, total: 31.01, subtotal: 25, quantity: 2,
        variant: { id: "variant_example", manage_inventory: false },
      }],
    })).toThrow(/whole unit price/);
  });

  it("refuses lines that do not add up to the cart's own goods figure", () => {
    expect(() => cartLinesFromStore({
      currency_code: "eur",
      item_total: 25,
      items: [{
        id: "line_example", title: "Lunar Base", unit_price: 25, total: 31, subtotal: 25, quantity: 1,
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
      id: "line_example", title: "Lunar Base", unit_price: 25, total: 31, subtotal: 25, quantity: 1,
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
    /*
     * The third argument is the whole reason this path ever worked. Medusa v2
     * omits per-line totals unless the request asks for them, and `cartLines-
     * FromStore` reads each line's `total` — so an add that forgets the query
     * throws, and the buyer is told the action failed. Asserted here as an
     * exact call rather than "called with the right cart and body", because
     * tolerating a missing third argument is precisely the regression.
     */
    expect(createLineItem).toHaveBeenCalledWith(
      expectedCartId,
      { variant_id: "variant_example", quantity: 1 },
      { fields: STORE_CART_FIELDS },
    );
    // The measured value is the tax-inclusive one — via `lineChargedAmount`,
    // not the now-net `unitAmount` — because that is what the buyer is
    // actually charged, and analytics stays on it deliberately rather than
    // following the basket's net display down. See `lineChargedAmount`'s doc
    // comment in `src/lib/cart.ts`.
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
