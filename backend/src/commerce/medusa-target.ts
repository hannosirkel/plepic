import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  createLocationFulfillmentSetWorkflow,
  createRegionsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateRegionsWorkflow,
  updateServiceZonesWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows";

import type { CommerceConfigurationTarget, CommerceRecord } from "./configuration.js";

/**
 * Applies the declared commerce configuration to a running Medusa application.
 *
 * Every method is a lookup by natural key followed by a create **or** an update,
 * never a bare create — the same shape, and the same reasoning, as
 * `src/catalogue-import/medusa-target.ts`. The predeploy Job is an Argo CD sync
 * hook that runs on every promoted digest, so the second run is the expected
 * path rather than the exception.
 *
 * The pure half — that the configuration is a deterministic, key-addressed
 * sequence — is proved in `tests/commerce-configuration.test.ts` against an
 * in-memory target. This half is the binding to Medusa's own workflows, and
 * `tests/commerce-medusa-target.test.ts` holds its keyless lookups.
 */
export class MedusaCommerceConfigurationTarget implements CommerceConfigurationTarget {
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
   * Copied deliberately, rule and all, from the catalogue import's own lookup.
   * The import binds the **product** to `lowestIdentified("shipping_profile")`
   * and this binds the **shipping options** to a profile; a shipping option
   * whose profile is not the product's is a cart Medusa answers with no delivery
   * method at all. Sharing one arbitrary-but-stable tie-break is what keeps the
   * two from disagreeing when a second profile exists, which is a perfectly
   * legitimate thing for an operator to have created.
   */
  private async lowestIdentified(entity: string): Promise<{ id: string } | undefined> {
    const { data } = await this.query.graph({ entity, fields: ["id"], filters: {} });
    const rows = (data as { id: string }[]).filter((row) => typeof row.id === "string");
    return rows.sort((left, right) => left.id.localeCompare(right.id))[0];
  }

  async apply(record: CommerceRecord): Promise<void> {
    switch (record.kind) {
      case "region":
        return this.applyRegion(record);
      case "stock-location":
        return this.applyStockLocation(record);
      case "fulfillment-set":
        return this.applyFulfillmentSet(record);
      case "shipping-profile":
        return this.applyShippingProfile(record);
      case "sales-channel-stock-location":
        return this.applySalesChannelLink(record);
      case "service-zone":
        return this.applyServiceZone(record);
      case "shipping-option":
        return this.applyShippingOption(record);
    }
  }

  private async applyRegion(record: Extract<CommerceRecord, { kind: "region" }>): Promise<void> {
    const countries = record.countryCodes.map((code) => code.toLowerCase());
    const existing = await this.one<{ id: string }>("region", ["id"], { name: record.name });

    if (existing === undefined) {
      await createRegionsWorkflow(this.container).run({
        input: {
          regions: [
            {
              name: record.name,
              currency_code: record.currencyCode.toLowerCase(),
              countries,
              automatic_taxes: record.automaticTaxes,
              is_tax_inclusive: record.taxInclusivePrices,
              payment_providers: [...record.paymentProviderIds],
            },
          ],
        },
      });
      return;
    }

    await updateRegionsWorkflow(this.container).run({
      input: {
        selector: { id: existing.id },
        update: {
          name: record.name,
          currency_code: record.currencyCode.toLowerCase(),
          countries,
          automatic_taxes: record.automaticTaxes,
          is_tax_inclusive: record.taxInclusivePrices,
          payment_providers: [...record.paymentProviderIds],
        },
      },
    });
  }

  private async applyStockLocation(
    record: Extract<CommerceRecord, { kind: "stock-location" }>,
  ): Promise<void> {
    const existing = await this.one<{ id: string }>("stock_location", ["id"], {
      name: record.name,
    });
    if (existing !== undefined) return;

    await createStockLocationsWorkflow(this.container).run({
      input: { locations: [{ name: record.name }] },
    });
  }

  private async stockLocationId(name: string): Promise<string> {
    const location = await this.one<{ id: string }>("stock_location", ["id"], { name });
    if (location === undefined) {
      throw new Error(`No stock location named ${name}; its record must be applied first`);
    }
    return location.id;
  }

  private async applyFulfillmentSet(
    record: Extract<CommerceRecord, { kind: "fulfillment-set" }>,
  ): Promise<void> {
    const existing = await this.one<{ id: string }>("fulfillment_set", ["id"], {
      name: record.name,
    });
    if (existing !== undefined) return;

    await createLocationFulfillmentSetWorkflow(this.container).run({
      input: {
        location_id: await this.stockLocationId(record.stockLocationName),
        fulfillment_set_data: { name: record.name, type: record.type },
      },
    });
  }

  private async applyShippingProfile(
    record: Extract<CommerceRecord, { kind: "shipping-profile" }>,
  ): Promise<void> {
    /*
     * Existence rather than name is the condition, on purpose. The shipping
     * options below and the imported product both bind to
     * `lowestIdentified("shipping_profile")`, so what has to hold is that there
     * is at least one profile — creating a second, differently named one beside
     * an operator's own would give the product and the options two profiles to
     * choose between and no guarantee they choose the same.
     */
    const existing = await this.lowestIdentified("shipping_profile");
    if (existing !== undefined) return;

    await createShippingProfilesWorkflow(this.container).run({
      input: { data: [{ name: record.name, type: record.type }] },
    });
  }

  private async shippingProfileId(): Promise<string> {
    const profile = await this.lowestIdentified("shipping_profile");
    if (profile === undefined) {
      throw new Error("No shipping profile exists; its record must be applied first");
    }
    return profile.id;
  }

  /**
   * Reaches the default sales channel from the stock location.
   *
   * Without this link `GET /store/shipping-options` returns nothing for a cart:
   * the query walks sales channel to stock location to fulfillment set to
   * service zone, and an unlinked location breaks the chain at the first step.
   * It is added only when it is missing, because `add`ing a link that already
   * exists is a duplicate rather than a no-op.
   */
  private async applySalesChannelLink(
    record: Extract<CommerceRecord, { kind: "sales-channel-stock-location" }>,
  ): Promise<void> {
    const store = await this.one<{ default_sales_channel_id?: string | null }>(
      "store",
      ["id", "default_sales_channel_id"],
      {},
    );
    const salesChannelId = store?.default_sales_channel_id;
    if (!salesChannelId) {
      throw new Error("The store has no default sales channel; run Medusa's defaults first");
    }

    const locationId = await this.stockLocationId(record.stockLocationName);
    const location = await this.one<{ sales_channels?: { id: string }[] }>(
      "stock_location",
      ["id", "sales_channels.id"],
      { id: locationId },
    );
    const linked = (location?.sales_channels ?? []).some(
      (channel) => channel.id === salesChannelId,
    );
    if (linked) return;

    await linkSalesChannelsToStockLocationWorkflow(this.container).run({
      input: { id: locationId, add: [salesChannelId] },
    });
  }

  private async fulfillmentSetId(): Promise<string> {
    const set = await this.lowestIdentified("fulfillment_set");
    if (set === undefined) {
      throw new Error("No fulfillment set exists; its record must be applied first");
    }
    return set.id;
  }

  /**
   * Converges a zone's geo zones on the declared country set.
   *
   * The update is issued only when the sets differ, so an unchanged run writes
   * nothing — and a run after an accession moves the country from one zone to
   * the other rather than leaving it in both, which would let Medusa answer one
   * address with two prices.
   */
  private async applyServiceZone(
    record: Extract<CommerceRecord, { kind: "service-zone" }>,
  ): Promise<void> {
    const declared = record.countryCodes.map((code) => code.toLowerCase());
    const existing = await this.one<{ id: string; geo_zones?: { country_code?: string }[] }>(
      "service_zone",
      ["id", "geo_zones.country_code"],
      { name: record.name },
    );

    if (existing === undefined) {
      await createServiceZonesWorkflow(this.container).run({
        input: {
          data: [
            {
              name: record.name,
              fulfillment_set_id: await this.fulfillmentSetId(),
              geo_zones: declared.map((code) => ({
                type: "country" as const,
                country_code: code,
              })),
            },
          ],
        },
      });
      return;
    }

    const present = new Set(
      (existing.geo_zones ?? [])
        .map((zone) => zone.country_code)
        .filter((code): code is string => typeof code === "string"),
    );
    const unchanged =
      present.size === declared.length && declared.every((code) => present.has(code));
    if (unchanged) return;

    await updateServiceZonesWorkflow(this.container).run({
      input: {
        selector: { id: existing.id },
        update: {
          name: record.name,
          geo_zones: declared.map((code) => ({ type: "country" as const, country_code: code })),
        },
      },
    });
  }

  private async serviceZoneId(name: string): Promise<string> {
    const zone = await this.one<{ id: string }>("service_zone", ["id"], { name });
    if (zone === undefined) {
      throw new Error(`No service zone named ${name}; its record must be applied first`);
    }
    return zone.id;
  }

  private async applyShippingOption(
    record: Extract<CommerceRecord, { kind: "shipping-option" }>,
  ): Promise<void> {
    const serviceZoneId = await this.serviceZoneId(record.zoneName);
    const existing = await this.one<{ id: string }>("shipping_option", ["id"], {
      name: record.optionName,
      service_zone_id: serviceZoneId,
    });

    const prices = [
      { currency_code: record.currency.toLowerCase(), amount: record.amountMinor / 100 },
    ];

    if (existing === undefined) {
      await createShippingOptionsWorkflow(this.container).run({
        input: [
          {
            name: record.optionName,
            service_zone_id: serviceZoneId,
            shipping_profile_id: await this.shippingProfileId(),
            provider_id: record.providerId,
            // Flat only. No carrier interface, quote cache, or fallback
            // contract — ADR 020 records why.
            price_type: "flat",
            type: {
              label: record.optionName,
              description: record.optionName,
              code: "standard",
            },
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
}
