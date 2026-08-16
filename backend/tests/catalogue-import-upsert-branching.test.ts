import type { MedusaContainer } from "@medusajs/framework/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The create-or-update branching that makes the catalogue import rerunnable.
 *
 * `tests/catalogue-import.test.ts` proves idempotency thoroughly, and proves it
 * against `RecordingTarget` — an in-memory fake that keys rows by
 * `${kind}:${key}`. That is the right proof for the half it covers: the import
 * emits natural-keyed records, in a deterministic order, exactly once each. But
 * the target that actually talks to Medusa is `MedusaCatalogueSeedTarget`, and
 * its `upsert` was reached by no test at all — only the two keyless lookups
 * were, through a private-method cast. So if `upsertProduct` took the
 * `createProductsWorkflow` branch on a rerun, the twice-run test would still
 * have passed and the second promoted digest would have created a second
 * product.
 *
 * The predeploy and import Jobs run on every promoted digest, so "the second
 * run creates nothing" is the property with the shortest fuse. Its sibling,
 * `tests/commerce-medusa-target.test.ts`, already gets this treatment; this is
 * the catalogue half.
 *
 * Every workflow is a recorder, so what is under test is which one each record
 * reaches — not whether Medusa accepts the input, which no test in this
 * repository can show and which `tests/commerce-medusa-semantics.test.ts`
 * exists to cover for the configuration side.
 */

interface RunCall {
  readonly workflow: string;
  readonly input: unknown;
}

const calls: RunCall[] = [];

function recorder(workflow: string) {
  return () => ({
    run: ({ input }: { input: unknown }) => {
      calls.push({ workflow, input });
      return Promise.resolve({ result: [{ id: `${workflow}_created` }] });
    },
  });
}

vi.mock("@medusajs/medusa/core-flows", () => ({
  createInventoryLevelsWorkflow: recorder("createInventoryLevels"),
  createProductsWorkflow: recorder("createProducts"),
  createPromotionsWorkflow: recorder("createPromotions"),
  createTaxRatesWorkflow: recorder("createTaxRates"),
  createTaxRegionsWorkflow: recorder("createTaxRegions"),
  updateInventoryLevelsWorkflow: recorder("updateInventoryLevels"),
  updateProductsWorkflow: recorder("updateProducts"),
  updateProductVariantsWorkflow: recorder("updateProductVariants"),
  updatePromotionsWorkflow: recorder("updatePromotions"),
  updateTaxRatesWorkflow: recorder("updateTaxRates"),
}));

/*
 * Imported after the mock factory above only in source order: `vi.mock` is
 * hoisted above every import in the file, so this binds to the recorders
 * rather than to Medusa's real workflows.
 */
import { MedusaCatalogueSeedTarget } from "../src/catalogue-import/medusa-target.js";

interface Rows {
  readonly [entity: string]: readonly Record<string, unknown>[];
}

function targetOver(rows: Rows) {
  const query = {
    graph: ({ entity, filters }: { entity: string; filters?: Record<string, unknown> }) => {
      const entries = rows[entity] ?? [];
      const matching = entries.filter((row) =>
        Object.entries(filters ?? {}).every(([field, value]) => row[field] === value),
      );
      return Promise.resolve({ data: [...matching] });
    },
  };
  const container = { resolve: () => query } as unknown as MedusaContainer;
  return new MedusaCatalogueSeedTarget(container);
}

const PRODUCT = {
  kind: "product",
  key: "lunar-base",
  handle: "lunar-base",
  title: "Lunar Base",
  subtitle: null,
  description: "A strategy card game.",
  sku: "LB-001",
  packaging: {
    weightGrams: 200,
    lengthMillimetres: 120,
    widthMillimetres: 120,
    heightMillimetres: 40,
  },
  media: [{ role: "thumbnail", url: "/static/lunar-base-box.webp" }],
} as const;

const PROMOTION = {
  kind: "promotion",
  key: "LAUNCH10",
  code: "LAUNCH10",
  type: "percentage",
  value: 10,
  expiresAt: null,
} as const;

const STOCK = {
  kind: "variant-stock",
  key: "LB-001",
  sku: "LB-001",
  manageInventory: true,
  quantity: 12,
} as const;

const BASE_ROWS: Rows = {
  shipping_profile: [{ id: "sp_01" }],
  stock_location: [{ id: "sloc_01" }],
  store: [{ id: "store_01", default_sales_channel_id: "sc_01" }],
};

function workflows(): string[] {
  return calls.map((call) => call.workflow);
}

beforeEach(() => {
  calls.length = 0;
});

describe("a product record creates once and updates thereafter", () => {
  it("creates the product when no row carries its handle", async () => {
    const target = targetOver({ ...BASE_ROWS, product: [] });

    await target.upsert(PRODUCT as never);

    expect(workflows()).toEqual(["createProducts"]);
  });

  it("updates the existing row rather than creating a second product", async () => {
    const target = targetOver({ ...BASE_ROWS, product: [{ id: "prod_01", handle: "lunar-base" }] });

    await target.upsert(PRODUCT as never);

    expect(workflows()).toEqual(["updateProducts"]);
    expect(calls[0]?.input).toMatchObject({ products: [{ id: "prod_01", handle: "lunar-base" }] });
  });

  it("matches on the handle, not on any row that happens to exist", async () => {
    const target = targetOver({ ...BASE_ROWS, product: [{ id: "prod_other", handle: "something-else" }] });

    await target.upsert(PRODUCT as never);

    expect(workflows()).toEqual(["createProducts"]);
  });
});

describe("a promotion record creates once and updates thereafter", () => {
  it("creates the coupon when no row carries its code", async () => {
    const target = targetOver({ ...BASE_ROWS, promotion: [] });

    await target.upsert(PROMOTION as never);

    expect(workflows()).toEqual(["createPromotions"]);
  });

  it("updates the existing coupon rather than creating a duplicate code", async () => {
    const target = targetOver({ ...BASE_ROWS, promotion: [{ id: "promo_01", code: "LAUNCH10" }] });

    await target.upsert(PROMOTION as never);

    expect(workflows()).toEqual(["updatePromotions"]);
    expect(calls[0]?.input).toMatchObject({ promotionsData: [{ id: "promo_01", code: "LAUNCH10" }] });
  });
});

describe("a stock record creates one inventory level and then adjusts it", () => {
  const rowsWithVariant = (levels: readonly Record<string, unknown>[]): Rows => ({
    ...BASE_ROWS,
    variant: [
      { id: "var_01", sku: "LB-001", inventory_items: [{ inventory_item_id: "iitem_01" }] },
    ],
    inventory_level: levels,
  });

  it("creates the level when the variant has none at the bound location", async () => {
    const target = targetOver(rowsWithVariant([]));

    await target.upsert(STOCK as never);

    expect(workflows()).toEqual(["updateProductVariants", "createInventoryLevels"]);
  });

  it("adjusts the existing level rather than stacking a second one", async () => {
    const target = targetOver(
      rowsWithVariant([{ id: "ilevel_01", inventory_item_id: "iitem_01", location_id: "sloc_01" }]),
    );

    await target.upsert(STOCK as never);

    expect(workflows()).toEqual(["updateProductVariants", "updateInventoryLevels"]);
    expect(calls[1]?.input).toMatchObject({
      updates: [{ inventory_item_id: "iitem_01", location_id: "sloc_01", stocked_quantity: 12 }],
    });
  });

  it("does not treat another location's level as this one's", async () => {
    const target = targetOver(
      rowsWithVariant([{ id: "ilevel_02", inventory_item_id: "iitem_01", location_id: "sloc_99" }]),
    );

    await target.upsert(STOCK as never);

    expect(workflows()).toEqual(["updateProductVariants", "createInventoryLevels"]);
  });

  /**
   * The price record has no create branch at all — it replaces the variant's
   * whole price array — so the assertion is that it stays that way. Appending
   * would give one variant two prices after two runs, which is the shape of
   * defect a create-vs-update test cannot see because there is no create.
   */
  it("replaces a variant's price array rather than appending to it", async () => {
    const target = targetOver({
      ...BASE_ROWS,
      variant: [{ id: "var_01", sku: "LB-001" }],
    });

    await target.upsert({
      kind: "variant-price",
      key: "LB-001/EUR",
      sku: "LB-001",
      currency: "EUR",
      amountMinor: 2500,
      taxIncluded: true,
    } as never);

    expect(workflows()).toEqual(["updateProductVariants"]);
    const input = calls[0]?.input as { product_variants: { prices: unknown[] }[] };
    expect(input.product_variants[0]?.prices).toEqual([{ amount: 25, currency_code: "eur" }]);
  });
});
