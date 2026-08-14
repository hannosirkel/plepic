import { afterEach, describe, expect, it, vi } from "vitest";

interface DataLayerWindow {
  dataLayer?: unknown[];
}

function commands(dataLayer: readonly unknown[]): unknown[][] {
  return dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

async function analytics() {
  vi.resetModules();
  return import("../src/lib/analytics.js");
}

afterEach(() => {
  delete (globalThis as { window?: DataLayerWindow }).window;
});

describe("purchase funnel analytics", () => {
  it("drops commerce before consent and converts integer minor units only after enablement", async () => {
    const dataLayer: unknown[] = [];
    (globalThis as { window?: DataLayerWindow }).window = { dataLayer };
    const emitter = await analytics();

    emitter.emitViewItem({ variantId: "variant_example", name: "Lunar Base", unitAmount: 3499, currency: "eur" });
    expect(dataLayer).toEqual([]);

    emitter.setAnalyticsEnabled(true);
    emitter.emitViewItem({ variantId: "variant_example", name: "Lunar Base", unitAmount: 3499, currency: "eur" });
    expect(commands(dataLayer)).toEqual([["event", "view_item", {
      currency: "EUR", value: 34.99, items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 34.99, quantity: 1 }],
    }]]);
  });

  it("emits only the five closed schemas and deduplicates document-scoped events", async () => {
    const dataLayer: unknown[] = [];
    (globalThis as { window?: DataLayerWindow }).window = { dataLayer };
    const emitter = await analytics();
    emitter.setAnalyticsEnabled(true);
    const item = { variantId: "variant_example", name: "Lunar Base", unitAmount: 2500, currency: "EUR", quantity: 2 } as const;

    emitter.emitViewItem(item);
    emitter.emitViewItem(item);
    emitter.emitAddToCart(item);
    emitter.emitBeginCheckout({ currency: "EUR", value: 5000, items: [item] });
    emitter.emitBeginCheckout({ currency: "EUR", value: 5000, items: [item] });
    emitter.emitPurchase({ transactionId: "order_example", currency: "EUR", value: 5000, items: [item] });
    emitter.emitPurchase({ transactionId: "order_example", currency: "EUR", value: 5000, items: [item] });
    emitter.emitPaymentFailure({ failureStage: "stripe_confirmation", currency: "EUR", value: 5000 });

    expect(commands(dataLayer)).toEqual([
      ["event", "view_item", { currency: "EUR", value: 50, items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 2 }] }],
      ["event", "add_to_cart", { currency: "EUR", value: 50, items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 2 }] }],
      ["event", "begin_checkout", { currency: "EUR", value: 50, items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 2 }] }],
      ["event", "purchase", { transaction_id: "order_example", currency: "EUR", value: 50, items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 2 }] }],
      ["event", "payment_failure", { failure_stage: "stripe_confirmation", currency: "EUR", value: 50 }],
    ]);
  });

  it("notifies mounted product readiness only when consent becomes active", async () => {
    const emitter = await analytics();
    const callback = vi.fn();
    const unsubscribe = emitter.onAnalyticsEnabled(callback);
    expect(callback).not.toHaveBeenCalled();
    emitter.setAnalyticsEnabled(true);
    expect(callback).toHaveBeenCalledTimes(1);
    emitter.setAnalyticsEnabled(false);
    emitter.setAnalyticsEnabled(true);
    expect(callback).toHaveBeenCalledTimes(2);
    unsubscribe();
    emitter.setAnalyticsEnabled(false);
    emitter.setAnalyticsEnabled(true);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("maps only complete authoritative Store lines and drops events again after withdrawal", async () => {
    const dataLayer: unknown[] = [];
    (globalThis as { window?: DataLayerWindow }).window = { dataLayer };
    const emitter = await analytics();
    const lines = [{
      id: "line_private_to_cart",
      variantId: "variant_example",
      productName: "Lunar Base",
      unitAmount: 2500,
      currency: "eur",
      quantity: 2,
      availability: "InStock" as const,
    }];

    expect(emitter.analyticsItemsFromCartLines(lines)).toEqual([{
      variantId: "variant_example", name: "Lunar Base", unitAmount: 2500,
      currency: "EUR", quantity: 2,
    }]);
    expect(emitter.analyticsItemsFromCartLines([{ ...lines[0]!, variantId: undefined }])).toBeNull();
    expect(emitter.analyticsItemsFromCartLines([{ ...lines[0]!, availability: "OutOfStock" }])).toBeNull();

    emitter.setAnalyticsEnabled(true);
    emitter.emitBeginCheckout({ currency: "eur", value: 5000, items: emitter.analyticsItemsFromCartLines(lines)! });
    emitter.setAnalyticsEnabled(false);
    emitter.emitPaymentFailure({ failureStage: "order_completion", currency: "EUR", value: 5000 });
    expect(commands(dataLayer)).toEqual([["event", "begin_checkout", {
      currency: "EUR", value: 50,
      items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 2 }],
    }]]);
  });

  it("reads frozen cart facts without mutation and returns null instead of throwing on malformed access", async () => {
    const emitter = await analytics();
    const line = Object.freeze({
      id: "line_private_to_cart",
      variantId: "variant_example",
      productName: "Lunar Base",
      unitAmount: 2500,
      currency: "EUR",
      quantity: 1,
      availability: "InStock" as const,
    });
    expect(emitter.analyticsItemsFromCartLines(Object.freeze([line]))).toEqual([{
      variantId: "variant_example", name: "Lunar Base", unitAmount: 2500, currency: "EUR", quantity: 1,
    }]);

    const throwingLine = { ...line };
    Object.defineProperty(throwingLine, "currency", {
      get: () => { throw new Error("synthetic malformed Store line"); },
    });
    expect(() => emitter.analyticsItemsFromCartLines([throwingLine])).not.toThrow();
    expect(emitter.analyticsItemsFromCartLines([throwingLine])).toBeNull();
  });

  it("initializes the standard GA queue when consent is active without an existing dataLayer", async () => {
    (globalThis as { window?: DataLayerWindow }).window = {};
    const emitter = await analytics();
    emitter.setAnalyticsEnabled(true);
    emitter.emitAddToCart({ variantId: "variant_example", name: "Lunar Base", unitAmount: 2500, currency: "EUR" });
    expect(commands((globalThis as { window: DataLayerWindow }).window.dataLayer ?? [])).toEqual([
      ["event", "add_to_cart", { currency: "EUR", value: 25, items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 1 }] }],
    ]);
  });

  it("uses the documented gtag command shape and never throws through commerce", async () => {
    const dataLayer: unknown[] = [];
    (globalThis as { window?: DataLayerWindow }).window = { dataLayer };
    const emitter = await analytics();
    emitter.setAnalyticsEnabled(true);
    emitter.emitAddToCart({ variantId: "variant_example", name: "Lunar Base", unitAmount: 2500, currency: "EUR" });

    expect(Array.isArray(dataLayer[0])).toBe(false);
    expect(commands(dataLayer)).toEqual([["event", "add_to_cart", {
      currency: "EUR", value: 25,
      items: [{ item_id: "variant_example", item_name: "Lunar Base", price: 25, quantity: 1 }],
    }]]);

    (globalThis as { window: DataLayerWindow }).window.dataLayer = Object.assign([], {
      push: () => { throw new Error("synthetic analytics sink failure"); },
    });
    expect(() => emitter.emitPaymentFailure({ failureStage: "order_completion", currency: "EUR", value: 2500 })).not.toThrow();
    expect(() => emitter.emitPurchase({ transactionId: "order_sink_failure", currency: "EUR", value: 2500, items: [{
      variantId: "variant_example", name: "Lunar Base", unitAmount: 2500, currency: "EUR",
    }] })).not.toThrow();
    expect(() => emitter.onAnalyticsEnabled(() => { throw new Error("synthetic listener failure"); })).not.toThrow();
  });
});
