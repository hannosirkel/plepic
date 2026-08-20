/**
 * The product this deployment sells, as ordered, key-addressed records — and the
 * port that applies them.
 *
 * ## Why this exists at all
 *
 * `npm run configure:commerce` leaves a shop that can price nothing. A migrated
 * Medusa plus that configuration has a store, a sales channel, one region, a tax
 * treatment, twenty-seven tax regions, a stock location, a fulfillment set, a
 * shipping profile and two shipping options — and **no product**.
 * `GET /store/products` returns an empty list, and
 * `storefront/src/lib/store-product.ts` refuses it outright: *"Medusa Store
 * response must contain exactly one active product"*. Every page that reads the
 * catalogue then fails.
 *
 * The catalogue-import Job would fill that gap, but it imports a WooCommerce
 * archive that somebody stages by hand. Nothing that a promoted digest depends
 * on may wait for a human, so the one product is declared here and applied from
 * the predeploy Job, immediately after the configuration it needs.
 *
 * ## Every record is an assertion addressed by a natural key
 *
 * The same shape, and the same reasoning, as `./configuration.ts`: `predeploy`
 * is an Argo CD sync hook that runs again on **every** promoted digest, so the
 * second run is the expected path rather than the exception. A key-addressed
 * upsert is idempotent because the second application of a record is the same
 * assertion as the first, and a run interrupted halfway converges when it is run
 * again.
 *
 * ## What it fixes on the way past
 *
 * `src/catalogue-import/medusa-target.ts` — which these upserts are lifted from
 * — sets `sales_channels` in its **create** branch and omits it in its
 * **update** branch. A product whose channel link was dropped by any other path
 * therefore stays dropped for ever: the Admin shows a healthy published product,
 * `GET /store/products` returns nothing, and the storefront reports that the
 * catalogue is not ready. The link is re-asserted on update here. That import
 * still carries the original; retiring it is a deliberately separate change.
 */

import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

import { PRODUCT, type ProductPackaging } from "./product-model.js";

export type ProductSeedRecord =
  | {
      readonly kind: "product";
      /** The product handle. */
      readonly key: string;
      readonly handle: string;
      readonly title: string;
      readonly sku: string;
      readonly packaging: ProductPackaging;
    }
  | {
      readonly kind: "variant-price";
      /** `<sku>/<currency>`. */
      readonly key: string;
      readonly sku: string;
      readonly currency: string;
      /** Minor units, net of tax. */
      readonly amountMinor: number;
    }
  | {
      readonly kind: "variant-stock";
      /** The variant SKU. */
      readonly key: string;
      readonly sku: string;
      readonly manageInventory: boolean;
      /** `null` whenever inventory is unmanaged; there is nothing to count. */
      readonly quantity: number | null;
    };

/** Applies one record by its natural key. Applying it twice is applying it once. */
export interface ProductSeedTarget {
  apply(record: ProductSeedRecord): Promise<void>;
}

/**
 * The product as records, in dependency order.
 *
 * A pure function of the frozen declaration: the same source produces the same
 * records, in the same order, on every run. The order is not cosmetic — the
 * price and the stock statement are both addressed by SKU, and the product
 * record is the only one that creates the variant carrying it.
 */
export function productSeedRecords(): readonly ProductSeedRecord[] {
  return [
    {
      kind: "product",
      key: PRODUCT.handle,
      handle: PRODUCT.handle,
      title: PRODUCT.title,
      sku: PRODUCT.sku,
      packaging: PRODUCT.packaging,
    },
    {
      kind: "variant-price",
      key: `${PRODUCT.sku}/${PRODUCT.currency}`,
      sku: PRODUCT.sku,
      currency: PRODUCT.currency,
      amountMinor: PRODUCT.amountMinor,
    },
    {
      kind: "variant-stock",
      key: PRODUCT.sku,
      sku: PRODUCT.sku,
      manageInventory: PRODUCT.manageInventory,
      quantity: null,
    },
  ];
}

export interface ProductSeedSummary {
  readonly records: number;
}

/** Applies every record once, in order, and stops at the first refusal. */
export async function seedProduct(target: ProductSeedTarget): Promise<ProductSeedSummary> {
  const records = productSeedRecords();
  for (const record of records) {
    await target.apply(record);
  }
  return { records: records.length };
}

/**
 * Applies the declared product to a running Medusa application.
 *
 * Every method is a lookup by natural key followed by a create **or** an update,
 * never a bare create — the same shape as `./medusa-target.ts` and
 * `src/catalogue-import/medusa-target.ts`.
 */
export class MedusaProductSeedTarget implements ProductSeedTarget {
  constructor(private readonly container: MedusaContainer) {}

  private get query() {
    return this.container.resolve(ContainerRegistrationKeys.QUERY);
  }

  private async one<T>(
    entity: string,
    fields: string[],
    filters: Record<string, unknown>,
  ): Promise<T | undefined> {
    const { data } = await this.query.graph({ entity, fields, filters });
    return data[0] as T | undefined;
  }

  /**
   * The lowest-identified row of an entity that has no natural key here.
   *
   * The same arbitrary-but-stable tie-break `./medusa-target.ts` and the
   * catalogue import both use, and it has to *be* the same one: that file binds
   * the **shipping options** to a profile and this binds the **product**, and a
   * product whose profile is not the options' is a cart Medusa answers with no
   * delivery method at all. PostgreSQL promises nothing about the order of an
   * unfiltered query, so with a second profile present an unsorted lookup could
   * bind differently on a rerun and stop converging.
   */
  private async lowestIdentified(entity: string): Promise<{ id: string } | undefined> {
    const { data } = await this.query.graph({ entity, fields: ["id"], filters: {} });
    const rows = (data as { id: string }[]).filter((row) => typeof row.id === "string");
    return rows.sort((left, right) => left.id.localeCompare(right.id))[0];
  }

  private async defaultSalesChannelId(): Promise<string> {
    const store = await this.one<{ default_sales_channel_id?: string | null }>(
      "store",
      ["id", "default_sales_channel_id"],
      {},
    );
    const id = store?.default_sales_channel_id;
    if (!id) {
      throw new Error("The store has no default sales channel; run Medusa's defaults first");
    }
    return id;
  }

  private async defaultShippingProfileId(): Promise<string> {
    const profile = await this.lowestIdentified("shipping_profile");
    if (profile === undefined) {
      throw new Error(
        "No shipping profile exists; run npm run configure:commerce before seeding the product",
      );
    }
    return profile.id;
  }

  private async defaultStockLocationId(): Promise<string> {
    const location = await this.lowestIdentified("stock_location");
    if (location === undefined) {
      throw new Error(
        "No stock location exists; run npm run configure:commerce before seeding the product",
      );
    }
    return location.id;
  }

  async apply(record: ProductSeedRecord): Promise<void> {
    switch (record.kind) {
      case "product":
        return this.applyProduct(record);
      case "variant-price":
        return this.applyVariantPrice(record);
      case "variant-stock":
        return this.applyVariantStock(record);
    }
  }

  /**
   * Converges the product row, its one variant and its sales-channel link.
   *
   * **Neither `images` nor `thumbnail` is sent, on either branch.** Sending
   * `images: []` is an assertion that the product has no images, and
   * `updateProductsWorkflow` would act on it — so every promoted digest would
   * wipe media an operator had uploaded in the Admin. Omitting the keys leaves
   * whatever is there alone, which is the honest expression of "this command has
   * no opinion about media".
   */
  private async applyProduct(
    record: Extract<ProductSeedRecord, { kind: "product" }>,
  ): Promise<void> {
    const dimensions = {
      weight: record.packaging.weightGrams,
      length: record.packaging.lengthMillimetres,
      width: record.packaging.widthMillimetres,
      height: record.packaging.heightMillimetres,
    };

    const existing = await this.one<{ id: string; sales_channels?: { id?: string }[] }>(
      "product",
      ["id", "sales_channels.id"],
      { handle: record.handle },
    );

    if (existing === undefined) {
      const shippingProfileId = await this.defaultShippingProfileId();
      const salesChannelId = await this.defaultSalesChannelId();
      await createProductsWorkflow(this.container).run({
        input: {
          products: [
            {
              handle: record.handle,
              title: record.title,
              status: "published",
              ...dimensions,
              shipping_profile_id: shippingProfileId,
              sales_channels: [{ id: salesChannelId }],
              options: [{ title: "Edition", values: ["Standard"] }],
              variants: [
                {
                  title: "Standard",
                  sku: record.sku,
                  options: { Edition: "Standard" },
                  ...dimensions,
                },
              ],
            },
          ],
        },
      });
      return;
    }

    /*
     * The link is re-asserted here and not only on create. `updateProductsWorkflow`
     * treats `sales_channels` as a **replacement**: it deletes every current link
     * for a product carrying the key and creates the ones given
     * (`@medusajs/core-flows/dist/product/workflows/update-products.js:63-87`,
     * `:296-330`). So the declared channel is unioned with the ones already
     * present rather than sent alone — restoring a dropped link must not cost an
     * operator a channel they added deliberately.
     */
    const salesChannelId = await this.defaultSalesChannelId();
    const present = (existing.sales_channels ?? [])
      .map((channel) => channel.id)
      .filter((id): id is string => typeof id === "string");
    const salesChannels = present.includes(salesChannelId)
      ? present
      : [...present, salesChannelId];

    await updateProductsWorkflow(this.container).run({
      input: {
        products: [
          {
            id: existing.id,
            handle: record.handle,
            title: record.title,
            status: "published",
            ...dimensions,
            sales_channels: salesChannels.map((id) => ({ id })),
          },
        ],
      },
    });
  }

  private async variantId(sku: string): Promise<string> {
    const variant = await this.one<{ id: string }>("variant", ["id"], { sku });
    if (variant === undefined) {
      throw new Error(
        `No product variant carries SKU ${sku}; the product record must be applied first`,
      );
    }
    return variant.id;
  }

  private async applyVariantPrice(
    record: Extract<ProductSeedRecord, { kind: "variant-price" }>,
  ): Promise<void> {
    await updateProductVariantsWorkflow(this.container).run({
      input: {
        product_variants: [
          {
            id: await this.variantId(record.sku),
            // One advertised price worldwide. Replacing the price array rather
            // than appending is what keeps a second run at one price — two rows
            // for one currency is two answers to "what does this cost?".
            prices: [
              {
                amount: record.amountMinor / 100,
                currency_code: record.currency.toLowerCase(),
              },
            ],
          },
        ],
      },
    });
  }

  private async applyVariantStock(
    record: Extract<ProductSeedRecord, { kind: "variant-stock" }>,
  ): Promise<void> {
    const id = await this.variantId(record.sku);
    await updateProductVariantsWorkflow(this.container).run({
      input: { product_variants: [{ id, manage_inventory: record.manageInventory }] },
    });

    /*
     * Unmanaged inventory has nothing to stock, and this deployment's product is
     * unmanaged. The branch below is kept because the record models a quantity —
     * an operator who ever turns management on gets a converging stock level
     * rather than a variant Medusa reports as out of stock.
     */
    if (!record.manageInventory || record.quantity === null) return;

    const variant = await this.one<{ inventory_items?: { inventory_item_id: string }[] }>(
      "variant",
      ["id", "inventory_items.inventory_item_id"],
      { id },
    );
    const inventoryItemId = variant?.inventory_items?.[0]?.inventory_item_id;
    if (inventoryItemId === undefined) {
      throw new Error(`Variant ${record.sku} has no inventory item to stock`);
    }

    const locationId = await this.defaultStockLocationId();
    const level = await this.one<{ id: string }>("inventory_level", ["id"], {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
    });

    if (level === undefined) {
      await createInventoryLevelsWorkflow(this.container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: inventoryItemId,
              location_id: locationId,
              stocked_quantity: record.quantity,
            },
          ],
        },
      });
      return;
    }

    await updateInventoryLevelsWorkflow(this.container).run({
      input: {
        updates: [
          {
            inventory_item_id: inventoryItemId,
            location_id: locationId,
            stocked_quantity: record.quantity,
          },
        ],
      },
    });
  }
}
