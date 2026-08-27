import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MedusaContainer } from "@medusajs/framework/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT } from "../src/commerce/product-model.js";
import {
  MedusaProductSeedTarget,
  productSeedRecords,
  seedProduct,
  type ProductSeedRecord,
  type ProductSeedTarget,
} from "../src/commerce/seed-product.js";
import { SHIPPING_CURRENCY } from "../src/commerce/shipping-model.js";
import { ESTONIAN_STANDARD_VAT_PERCENT } from "../src/commerce/tax-model.js";

/**
 * The one product this shop sells, and the command that puts it in the database.
 *
 * `npm run configure:commerce` leaves a shop that can price nothing: a migrated
 * Medusa has a store and a sales channel, the configuration adds a region, a tax
 * treatment, the zones and the rates — and no product. `GET /store/products`
 * then returns an empty list, and `storefront/src/lib/store-product.ts` refuses
 * with "Medusa Store response must contain exactly one active product". The
 * catalogue-import Job would have filled the gap, but it needs an archive
 * somebody stages by hand, and nothing may stand between a promoted digest and a
 * shop that works.
 *
 * The chain is the same key-addressed shape as the configuration's, for the same
 * reason: `predeploy` is an Argo CD sync hook that runs on **every** promoted
 * digest, so the second run is the expected path rather than the exception.
 */

interface RunCall {
  readonly workflow: string;
  readonly input: unknown;
}

const calls: RunCall[] = [];

/**
 * Records the call, and — when the container it was handed carries a graph —
 * lets that graph apply it.
 *
 * One stub serves both halves of this file. `vi.mock` is hoisted above every
 * import, so it cannot close over a per-test fake; the container is the only
 * thing the two halves share, exactly as in
 * `commerce-medusa-semantics.test.ts`.
 */
function recorder(workflow: string) {
  return (container: MedusaContainer) => ({
    run: ({ input }: { input: unknown }) => {
      calls.push({ workflow, input });
      const bound = container as unknown as {
        __workflows?: Record<string, (input: unknown) => unknown>;
      };
      const result = bound.__workflows?.[workflow]?.(input);
      return Promise.resolve({ result: result ?? [{ id: `${workflow}_created` }] });
    },
  });
}

vi.mock("@medusajs/medusa/core-flows", () => ({
  createInventoryLevelsWorkflow: recorder("createInventoryLevels"),
  createProductsWorkflow: recorder("createProducts"),
  updateInventoryLevelsWorkflow: recorder("updateInventoryLevels"),
  updateProductsWorkflow: recorder("updateProducts"),
  updateProductVariantsWorkflow: recorder("updateProductVariants"),
}));

interface Rows {
  readonly [entity: string]: readonly Record<string, unknown>[];
}

/** A `query.graph` over fixed rows, filtered the way Medusa's own would be. */
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
  return new MedusaProductSeedTarget(container);
}

/** What `configure:commerce` and Medusa's own defaults leave behind. */
const CONFIGURED: Rows = {
  store: [{ id: "store_01", default_sales_channel_id: "sc_01" }],
  shipping_profile: [{ id: "sp_01", name: "Default" }],
  stock_location: [{ id: "sloc_01", name: "Plepic Games" }],
};

function record<K extends ProductSeedRecord["kind"]>(kind: K) {
  const found = productSeedRecords().find((candidate) => candidate.kind === kind);
  if (found === undefined) throw new Error(`no ${kind} record`);
  return found as Extract<ProductSeedRecord, { kind: K }>;
}

beforeEach(() => {
  calls.length = 0;
});

describe("the product this shop sells", () => {
  it("is Lunar Base at EUR 25.00 net, unmanaged, in a 300 g box", () => {
    expect(PRODUCT).toEqual({
      handle: "lunar-base",
      title: "Lunar Base",
      sku: "PPG01000",
      currency: "EUR",
      amountMinor: 2500,
      manageInventory: false,
      packaging: {
        weightGrams: 300,
        lengthMillimetres: 120,
        widthMillimetres: 120,
        heightMillimetres: 40,
      },
      customs: {
        tariffNumber: "9504400000",
        originCountry: "CHN",
        goodsCategoryCode: "SALE_OF_GOODS",
      },
    });
  });

  /**
   * One currency for the goods and the delivery alike. Two would be two answers
   * to "what does this cost?", and the storefront has no selector to resolve it.
   */
  it("is priced in the currency the shipping is priced in", () => {
    expect(PRODUCT.currency).toBe(SHIPPING_CURRENCY);
  });

  /**
   * The customs facts OMX requires whenever a shipment's destination is
   * outside the EU, and refuses the registration without — mandatory for
   * United States destinations in particular, because the landed cost cannot
   * be calculated without an origin. Nothing consumes these yet; a later task
   * builds the declaration from them.
   *
   * The shape assertions are the ones that would actually catch a malformed
   * edit — a two-letter `originCountry` typed by habit from every other
   * country code in this repository, or a `tariffNumber` with a stray dot or
   * currency-style formatting — rather than merely reading the constant back
   * at itself.
   */
  it("declares the customs facts a shipment outside the EU cannot be registered without", () => {
    expect(PRODUCT.customs.tariffNumber).toBe("9504400000");
    expect(PRODUCT.customs.originCountry).toBe("CHN");
    expect(PRODUCT.customs.goodsCategoryCode).toBe("SALE_OF_GOODS");

    // OMX takes an alpha-3 origin and a numeric HS code. Both are operator
    // declarations, and both are refused by the carrier if malformed -- at
    // fulfilment, per order, which is the expensive place to find out.
    expect(PRODUCT.customs.originCountry).toMatch(/^[A-Z]{3}$/);
    expect(PRODUCT.customs.tariffNumber).toMatch(/^[0-9]{6,10}$/);
  });
});

describe("the declared product seed", () => {
  it("is the same sequence of records on every run", () => {
    expect(productSeedRecords()).toEqual(productSeedRecords());
  });

  it("addresses every record by a key no other record uses", () => {
    const keys = productSeedRecords().map((seed) => `${seed.kind}:${seed.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * The price and the stock statement are both addressed by SKU, so the product
   * — the only record that creates the variant carrying it — has to be first.
   */
  it("declares its records in dependency order", () => {
    expect(productSeedRecords().map((seed) => seed.kind)).toEqual([
      "product",
      "variant-price",
      "variant-stock",
    ]);
  });

  it("applies each record exactly once, in the declared order", async () => {
    const applied: ProductSeedRecord[] = [];
    const target: ProductSeedTarget = {
      apply(seed) {
        applied.push(seed);
        return Promise.resolve();
      },
    };

    const summary = await seedProduct(target);

    expect(summary.records).toBe(productSeedRecords().length);
    expect(applied).toEqual(productSeedRecords());
  });

  it("stops at the first refusal rather than applying the rest", async () => {
    const applied: string[] = [];
    const target: ProductSeedTarget = {
      apply(seed) {
        applied.push(seed.kind);
        return seed.kind === "variant-price"
          ? Promise.reject(new Error("no such variant"))
          : Promise.resolve();
      },
    };

    await expect(seedProduct(target)).rejects.toThrow("no such variant");
    expect(applied).toEqual(["product", "variant-price"]);
  });
});

describe("applying the product", () => {
  it("creates it in the default sales channel and the shared shipping profile", async () => {
    await targetOver(CONFIGURED).apply(record("product"));

    expect(calls.map((call) => call.workflow)).toEqual(["createProducts"]);
    const [product] = (calls[0]?.input as { products: Record<string, unknown>[] }).products;
    expect(product).toMatchObject({
      handle: "lunar-base",
      title: "Lunar Base",
      status: "published",
      weight: 300,
      length: 120,
      width: 120,
      height: 40,
      shipping_profile_id: "sp_01",
      sales_channels: [{ id: "sc_01" }],
    });
    expect(product!.variants).toEqual([
      expect.objectContaining({ sku: "PPG01000", title: "Standard" }),
    ]);
  });

  /**
   * **No media, and no key that would clear any.**
   *
   * The product page renders assets committed to `storefront/public`, and
   * `productImageUrlsFromStore` — the one reader of `images` — feeds a gallery
   * that page does not use. So this command declares none. It is careful to omit
   * the keys rather than send empty ones: `images: []` and `thumbnail: null` are
   * assertions that there are no images, and would wipe media an operator
   * uploaded in the Admin on the next promoted digest.
   */
  it("declares no media, and clears none", async () => {
    await targetOver(CONFIGURED).apply(record("product"));

    const [product] = (calls[0]?.input as { products: Record<string, unknown>[] }).products;
    expect(product).not.toHaveProperty("images");
    expect(product).not.toHaveProperty("thumbnail");
  });

  /**
   * **The fix this command exists to carry.**
   *
   * `src/catalogue-import/medusa-target.ts` sets `sales_channels` in its create
   * branch and omits it in its update branch, so a product whose channel link
   * was dropped by any other path — an Admin edit, a `dismissRemoteLink`, a
   * partially applied workflow — stays dropped for ever, and
   * `GET /store/products` answers the storefront with an empty list while the
   * Admin shows a perfectly healthy published product. The link is therefore
   * re-asserted on **update** as well as on create.
   */
  it("restores the default sales channel on a product that has lost it", async () => {
    await targetOver({
      ...CONFIGURED,
      product: [{ id: "prod_01", handle: "lunar-base", sales_channels: [] }],
    }).apply(record("product"));

    expect(calls.map((call) => call.workflow)).toEqual(["updateProducts"]);
    const [product] = (calls[0]?.input as { products: Record<string, unknown>[] }).products;
    expect(product).toMatchObject({ id: "prod_01", sales_channels: [{ id: "sc_01" }] });
  });

  /**
   * `updateProductsWorkflow` treats `sales_channels` as a **replacement**: it
   * deletes every current link for a product carrying the key and creates the
   * ones given (`@medusajs/core-flows/dist/product/workflows/update-products.js:63-87`
   * and `:296-330`). So the declared channel is added to the ones already there
   * rather than sent alone — restoring a dropped link must not cost an operator
   * a channel they added on purpose.
   */
  it("adds the default channel to an operator's own rather than replacing them", async () => {
    await targetOver({
      ...CONFIGURED,
      product: [
        { id: "prod_01", handle: "lunar-base", sales_channels: [{ id: "sc_wholesale" }] },
      ],
    }).apply(record("product"));

    const [product] = (calls[0]?.input as { products: Record<string, unknown>[] }).products;
    expect(product!.sales_channels).toEqual([{ id: "sc_wholesale" }, { id: "sc_01" }]);
  });

  it("refuses a store with no default sales channel rather than orphaning the product", async () => {
    await expect(
      targetOver({ ...CONFIGURED, store: [{ id: "store_01" }] }).apply(record("product")),
    ).rejects.toThrow(/no default sales channel/);
    expect(calls).toEqual([]);
  });

  it("refuses before configure:commerce has created a shipping profile", async () => {
    await expect(
      targetOver({ store: CONFIGURED.store! }).apply(record("product")),
    ).rejects.toThrow(/configure:commerce/);
    expect(calls).toEqual([]);
  });
});

describe("applying the price and the stock statement", () => {
  const VARIANT: Rows = { variant: [{ id: "var_01", sku: "PPG01000" }] };

  /**
   * The price array is **replaced**, never appended to. Two rows for one
   * currency is two answers to "what does this cost?", and which one Medusa
   * returns is not something this repository gets to decide.
   */
  it("replaces the variant's price array with the one declared price", async () => {
    await targetOver({ ...CONFIGURED, ...VARIANT }).apply(record("variant-price"));

    expect(calls.map((call) => call.workflow)).toEqual(["updateProductVariants"]);
    expect(calls[0]?.input).toEqual({
      product_variants: [
        // Major units: Medusa's own workflows take a decimal amount.
        { id: "var_01", prices: [{ amount: 25, currency_code: "eur" }] },
      ],
    });
  });

  /**
   * Stock is a *statement*, never a count. `manage_inventory: false` is what
   * makes `catalogueProductFromStore` resolve `InStock` without an inventory
   * level existing at all, which is the operator's model: one physical copy
   * fulfilled by hand.
   */
  it("states that inventory is unmanaged and stocks nothing", async () => {
    await targetOver({ ...CONFIGURED, ...VARIANT }).apply(record("variant-stock"));

    expect(calls.map((call) => call.workflow)).toEqual(["updateProductVariants"]);
    expect(calls[0]?.input).toEqual({
      product_variants: [{ id: "var_01", manage_inventory: false }],
    });
  });

  it("names the SKU it cannot find rather than failing further away", async () => {
    await expect(targetOver(CONFIGURED).apply(record("variant-price"))).rejects.toThrow(
      /PPG01000/,
    );
  });
});

/* ------------------------------------------------------------------ *
 * Idempotence, over a graph the records mutate
 * ------------------------------------------------------------------ */

interface Row {
  [field: string]: unknown;
}

/**
 * A Medusa-shaped graph the seed writes into.
 *
 * The recorders above prove which workflow each record reaches; they cannot show
 * what two runs leave behind, because nothing they write is readable by the next
 * record. This one lets each workflow write, so "run it twice and there is one
 * product" is asserted over rows rather than over call counts — which is the
 * property `predeploy` actually needs, being a sync hook on every digest.
 */
function fakeMedusa(): { container: MedusaContainer; rows: Record<string, Row[]> } {
  let sequence = 0;
  const id = (prefix: string) => `${prefix}_${String(++sequence).padStart(2, "0")}`;

  const rows: Record<string, Row[]> = {
    store: [{ id: "store_01", default_sales_channel_id: "sc_01" }],
    shipping_profile: [{ id: "sp_01", name: "Default" }],
    stock_location: [{ id: "sloc_01", name: "Plepic Games" }],
  };
  const table = (entity: string) => (rows[entity] ??= []);

  const workflows: Record<string, (input: never) => unknown> = {
    createProducts: (input: {
      products: (Row & { variants: Row[]; sales_channels?: { id: string }[] })[];
    }) => {
      for (const product of input.products) {
        const { variants, ...rest } = product;
        const productId = id("prod");
        table("product").push({ ...rest, id: productId });
        for (const variant of variants) {
          table("variant").push({ ...variant, id: id("var"), product_id: productId, prices: [] });
        }
      }
    },
    updateProducts: (input: { products: (Row & { id: string })[] }) => {
      for (const update of input.products) {
        const product = table("product").find((row) => row.id === update.id);
        if (product === undefined) throw new Error("no such product");
        Object.assign(product, update);
      }
    },
    updateProductVariants: (input: { product_variants: (Row & { id: string })[] }) => {
      for (const update of input.product_variants) {
        const variant = table("variant").find((row) => row.id === update.id);
        if (variant === undefined) throw new Error("no such variant");
        // `prices` is a replacement in Medusa's own workflow, which is the whole
        // point of asserting it here rather than trusting the call shape.
        Object.assign(variant, update);
      }
    },
    createInventoryLevels: () => undefined,
    updateInventoryLevels: () => undefined,
  };

  const query = {
    graph: ({ entity, filters }: { entity: string; filters?: Record<string, unknown> }) => {
      const matching = table(entity).filter((row) =>
        Object.entries(filters ?? {}).every(([field, value]) => row[field] === value),
      );
      return Promise.resolve({ data: [...matching] });
    },
  };

  const container = {
    resolve: () => query,
    __workflows: workflows,
  } as unknown as MedusaContainer;

  return { container, rows };
}

function runAgainst(medusa: { container: MedusaContainer }): Promise<{ records: number }> {
  return seedProduct(new MedusaProductSeedTarget(medusa.container));
}

describe("running the seed twice", () => {
  it("leaves one product, one price row and one stock statement", async () => {
    const medusa = fakeMedusa();
    await runAgainst(medusa);
    await runAgainst(medusa);

    expect(medusa.rows.product).toHaveLength(1);
    expect(medusa.rows.variant).toHaveLength(1);
    expect(medusa.rows.variant?.[0]?.prices).toEqual([{ amount: 25, currency_code: "eur" }]);
    expect(medusa.rows.variant?.[0]?.manage_inventory).toBe(false);
    expect(medusa.rows.inventory_level ?? []).toEqual([]);
  });

  it("restores the sales-channel link a second run finds missing", async () => {
    const medusa = fakeMedusa();
    await runAgainst(medusa);

    // Whatever dropped it — an Admin edit, a stray `dismissRemoteLink` — the
    // product is now invisible to `GET /store/products` and the storefront
    // refuses to render a catalogue at all.
    medusa.rows.product![0]!.sales_channels = [];

    await runAgainst(medusa);
    expect(medusa.rows.product?.[0]?.sales_channels).toEqual([{ id: "sc_01" }]);
  });
});

/* ------------------------------------------------------------------ *
 * The mock catalogue, which claims to be a contract
 * ------------------------------------------------------------------ */

/**
 * `storefront/mock/catalogue.json` calls itself "a contract, not a fixture" and
 * says every value in it mirrors what the live Medusa catalogue is seeded with.
 * Nothing held it to that: the mock and the seed were written months apart, in
 * two workspaces, and the sentence was the only thing joining them.
 *
 * This is that join. The file is read as **data** rather than as text — a
 * substring check would pass on `"amount": 2500` appearing anywhere, including
 * in the prose of the `$comment` — and compared against the declaration the
 * seed actually applies.
 */
describe("the mock catalogue and the seeded product", () => {
  const mock = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "storefront", "mock", "catalogue.json"), "utf8"),
  ) as {
    product: {
      name: string;
      price: {
        amount: number;
        amountWithTax: number;
        currency: string;
        taxIncluded: boolean;
        vatRatePercent: number;
      };
      availability: string;
    };
  };

  it("names the same product at the same price in the same currency", () => {
    expect(mock.product.name).toBe(PRODUCT.title);
    expect(mock.product.price.amount).toBe(PRODUCT.amountMinor);
    expect(mock.product.price.currency).toBe(PRODUCT.currency);
  });

  /**
   * **The advertised price does not contain the tax**, which is the same
   * decision as the two price preferences in `src/commerce/configuration.ts`,
   * expressed in two workspaces.
   *
   * `storefront/src/lib/store-product.ts` now reads this from Medusa rather
   * than from the mock, so the mock's boolean is no longer load-bearing for a
   * live page — but it is still what every test and every mock-layer render
   * resolves against, and a mock that disagreed with the configuration would
   * make the whole suite prove the wrong model.
   */
  it("agrees that the advertised price does not contain the tax", () => {
    expect(mock.product.price.taxIncluded).toBe(false);
  });

  /**
   * **The two figures the storefront chooses between, and the rate it quotes.**
   *
   * The storefront displays the net figure for a destination outside the EU and
   * the gross one for a destination inside it, and it does that by picking one
   * of two amounts Medusa returned — never by multiplying.
   * `storefront/tests/no-hardcoded-price.test.ts` refuses a rate literal
   * anywhere in `storefront/src/`, which means the gross figure and the
   * percentage the copy quotes have to arrive as **data**, and the mock is
   * where that data lives for every test and every mock-layer render.
   *
   * Data with nothing behind it is the defect this file exists to prevent, so
   * both are derived here rather than compared to literals: the rate is
   * `ESTONIAN_STANDARD_VAT_PERCENT` itself, and the gross figure is the seeded
   * net amount grossed at it. The multiplication is on **this** side of the
   * boundary on purpose — the backend is where the rate is declared and where
   * arithmetic on it belongs.
   */
  it("carries the EU gross figure and the rate the tax model declares", () => {
    expect(mock.product.price.vatRatePercent).toBe(ESTONIAN_STANDARD_VAT_PERCENT);
    expect(mock.product.price.amountWithTax).toBe(
      Math.round(PRODUCT.amountMinor * (1 + ESTONIAN_STANDARD_VAT_PERCENT / 100)),
    );
    expect(
      mock.product.price.amountWithTax,
      "the gross figure is not above the net one, so nothing is being added",
    ).toBeGreaterThan(mock.product.price.amount);
  });

  /**
   * `manage_inventory: false` is why. `catalogueProductFromStore` resolves
   * availability as `!manageInventory || canBackorder || stock > 0`, so an
   * unmanaged variant is `InStock` with no inventory level anywhere.
   */
  it("agrees the product is in stock, which is what unmanaged inventory means", () => {
    expect(mock.product.availability).toBe("InStock");
    expect(PRODUCT.manageInventory).toBe(false);
  });
});
