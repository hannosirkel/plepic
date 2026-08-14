import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, PromotionStatus } from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createPromotionsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createTaxRatesWorkflow,
  createTaxRegionsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
  updatePromotionsWorkflow,
  updateShippingOptionsWorkflow,
  updateTaxRatesWorkflow,
} from "@medusajs/medusa/core-flows";

import type { CatalogueSeedTarget, SeedRecord } from "./seed.js";

/**
 * Applies seed records to a running Medusa application.
 *
 * Every method is a lookup by natural key followed by a create **or** an
 * update, never a bare create. That is the whole of the idempotency story at
 * this layer: the pure half — that the import emits key-addressed records, in a
 * deterministic order, exactly once each — is proved in
 * `tests/catalogue-import.test.ts` against an in-memory target with the same
 * semantics; this half is the binding to Medusa's own workflows.
 */
export class MedusaCatalogueSeedTarget implements CatalogueSeedTarget {
  constructor(private readonly container: MedusaContainer) {}

  private get query() {
    return this.container.resolve(ContainerRegistrationKeys.QUERY);
  }

  private async one<T>(entity: string, fields: string[], filters: Record<string, unknown>): Promise<T | undefined> {
    const { data } = await this.query.graph({ entity, fields, filters });
    return data[0] as T | undefined;
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
    const profile = await this.one<{ id: string }>("shipping_profile", ["id"], {});
    if (profile === undefined) {
      throw new Error("No shipping profile exists; create one before importing the catalogue");
    }
    return profile.id;
  }

  private async defaultStockLocationId(): Promise<string> {
    const location = await this.one<{ id: string }>("stock_location", ["id"], {});
    if (location === undefined) {
      throw new Error("No stock location exists; create one before importing the catalogue");
    }
    return location.id;
  }

  async upsert(record: SeedRecord): Promise<void> {
    switch (record.kind) {
      case "product":
        return this.upsertProduct(record);
      case "variant-price":
        return this.upsertVariantPrice(record);
      case "variant-stock":
        return this.upsertVariantStock(record);
      case "promotion":
        return this.upsertPromotion(record);
      case "tax-region":
        return this.upsertTaxRegion(record);
      case "shipping-option":
        return this.upsertShippingOption(record);
    }
  }

  private async upsertProduct(record: Extract<SeedRecord, { kind: "product" }>): Promise<void> {
    const thumbnail = record.media.find((entry) => entry.role === "thumbnail")?.url ?? null;
    const images = record.media.map((entry) => ({ url: entry.url }));
    const dimensions = {
      weight: record.packaging.weightGrams,
      length: record.packaging.lengthMillimetres,
      width: record.packaging.widthMillimetres,
      height: record.packaging.heightMillimetres,
    };

    const existing = await this.one<{ id: string }>("product", ["id"], { handle: record.handle });

    if (existing === undefined) {
      await createProductsWorkflow(this.container).run({
        input: {
          products: [
            {
              handle: record.handle,
              title: record.title,
              subtitle: record.subtitle ?? undefined,
              description: record.description ?? undefined,
              status: "published",
              thumbnail: thumbnail ?? undefined,
              images,
              ...dimensions,
              shipping_profile_id: await this.defaultShippingProfileId(),
              sales_channels: [{ id: await this.defaultSalesChannelId() }],
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

    await updateProductsWorkflow(this.container).run({
      input: {
        products: [
          {
            id: existing.id,
            handle: record.handle,
            title: record.title,
            subtitle: record.subtitle ?? undefined,
            description: record.description ?? undefined,
            status: "published",
            thumbnail: thumbnail ?? undefined,
            images,
            ...dimensions,
          },
        ],
      },
    });
  }

  private async variantId(sku: string): Promise<string> {
    const variant = await this.one<{ id: string }>("variant", ["id"], { sku });
    if (variant === undefined) {
      throw new Error(`No product variant carries SKU ${sku}; the product record must be applied first`);
    }
    return variant.id;
  }

  private async upsertVariantPrice(
    record: Extract<SeedRecord, { kind: "variant-price" }>,
  ): Promise<void> {
    await updateProductVariantsWorkflow(this.container).run({
      input: {
        product_variants: [
          {
            id: await this.variantId(record.sku),
            // One advertised price worldwide. Replacing the price array rather
            // than appending is what keeps a second run at one price.
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

  private async upsertVariantStock(
    record: Extract<SeedRecord, { kind: "variant-stock" }>,
  ): Promise<void> {
    const id = await this.variantId(record.sku);
    await updateProductVariantsWorkflow(this.container).run({
      input: { product_variants: [{ id, manage_inventory: record.manageInventory }] },
    });

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

  private async upsertPromotion(
    record: Extract<SeedRecord, { kind: "promotion" }>,
  ): Promise<void> {
    const application_method = {
      type: record.type === "percentage" ? ("percentage" as const) : ("fixed" as const),
      target_type: "order" as const,
      allocation: "across" as const,
      value: record.value,
      currency_code: record.type === "fixed" ? "eur" : undefined,
    };

    const existing = await this.one<{ id: string }>("promotion", ["id"], { code: record.code });

    if (existing === undefined) {
      await createPromotionsWorkflow(this.container).run({
        input: {
          promotionsData: [
            {
              code: record.code,
              type: "standard",
              status: PromotionStatus.ACTIVE,
              is_automatic: false,
              application_method,
            },
          ],
        },
      });
      return;
    }

    await updatePromotionsWorkflow(this.container).run({
      input: {
        promotionsData: [{ id: existing.id, code: record.code, application_method }],
      },
    });
  }

  private async upsertTaxRegion(
    record: Extract<SeedRecord, { kind: "tax-region" }>,
  ): Promise<void> {
    let region = await this.one<{ id: string }>("tax_region", ["id"], {
      country_code: record.countryCode.toLowerCase(),
    });

    if (region === undefined) {
      const { result } = await createTaxRegionsWorkflow(this.container).run({
        input: [{ country_code: record.countryCode.toLowerCase() }],
      });
      region = { id: result[0]!.id };
    }

    const rate = await this.one<{ id: string }>("tax_rate", ["id"], {
      tax_region_id: region.id,
      code: record.code,
    });

    if (rate === undefined) {
      await createTaxRatesWorkflow(this.container).run({
        input: [
          {
            tax_region_id: region.id,
            name: record.name,
            code: record.code,
            rate: record.ratePercent,
            is_default: true,
          },
        ],
      });
      return;
    }

    await updateTaxRatesWorkflow(this.container).run({
      input: {
        selector: { id: rate.id },
        update: { name: record.name, rate: record.ratePercent },
      },
    });
  }

  private async upsertShippingOption(
    record: Extract<SeedRecord, { kind: "shipping-option" }>,
  ): Promise<void> {
    const zone = await this.serviceZoneId(record.zoneName, record.countryCodes);
    const existing = await this.one<{ id: string }>("shipping_option", ["id"], {
      name: record.optionName,
      service_zone_id: zone,
    });

    const prices = [{ currency_code: record.currency.toLowerCase(), amount: record.amountMinor / 100 }];

    if (existing === undefined) {
      await createShippingOptionsWorkflow(this.container).run({
        input: [
          {
            name: record.optionName,
            service_zone_id: zone,
            shipping_profile_id: await this.defaultShippingProfileId(),
            provider_id: "manual_manual",
            // Flat and free only. No carrier interface, quote cache, or
            // fallback contract — ADR 020 records why.
            price_type: "flat",
            type: { label: record.optionName, description: record.optionName, code: "standard" },
            prices,
          },
        ],
      });
      return;
    }

    await updateShippingOptionsWorkflow(this.container).run({
      input: [{ id: existing.id, name: record.optionName, prices }],
    });
  }

  private async serviceZoneId(name: string, countryCodes: readonly string[]): Promise<string> {
    const existing = await this.one<{ id: string }>("service_zone", ["id"], { name });
    if (existing !== undefined) return existing.id;

    const fulfillmentSet = await this.one<{ id: string }>("fulfillment_set", ["id"], {});
    if (fulfillmentSet === undefined) {
      throw new Error("No fulfillment set exists; create one before importing shipping zones");
    }

    const { result } = await createServiceZonesWorkflow(this.container).run({
      input: {
        data: [
          {
            name,
            fulfillment_set_id: fulfillmentSet.id,
            geo_zones: countryCodes.map((code) => ({
              type: "country" as const,
              country_code: code.toLowerCase(),
            })),
          },
        ],
      },
    });
    return result[0]!.id;
  }
}
