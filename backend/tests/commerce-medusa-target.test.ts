import type { MedusaContainer } from "@medusajs/framework/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commerceRecords } from "../src/commerce/configuration.js";
import { MedusaCommerceConfigurationTarget } from "../src/commerce/medusa-target.js";
import { EU_MEMBER_STATE_CODES, SHIPPING_ZONES } from "../src/commerce/shipping-model.js";

/**
 * The binding between the declared configuration and Medusa's own workflows.
 *
 * Every workflow is replaced by a recorder, so what is under test is the part
 * this repository wrote: which workflow each record reaches, whether it creates
 * or updates, and what it refuses. The predeploy Job is an Argo CD sync hook
 * that runs on **every promoted digest**, so "the second run does nothing new"
 * is the property that matters most and is asserted throughout.
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
  batchLinksWorkflow: recorder("batchLinks"),
  updateStoresWorkflow: recorder("updateStores"),
  createLocationFulfillmentSetWorkflow: recorder("createLocationFulfillmentSet"),
  createRegionsWorkflow: recorder("createRegions"),
  createServiceZonesWorkflow: recorder("createServiceZones"),
  createShippingOptionsWorkflow: recorder("createShippingOptions"),
  createShippingProfilesWorkflow: recorder("createShippingProfiles"),
  createStockLocationsWorkflow: recorder("createStockLocations"),
  createTaxRatesWorkflow: recorder("createTaxRates"),
  createTaxRegionsWorkflow: recorder("createTaxRegions"),
  linkSalesChannelsToStockLocationWorkflow: recorder("linkSalesChannelsToStockLocation"),
  updateRegionsWorkflow: recorder("updateRegions"),
  updateTaxRatesWorkflow: recorder("updateTaxRates"),
  updateServiceZonesWorkflow: recorder("updateServiceZones"),
  updateShippingOptionsWorkflow: recorder("updateShippingOptions"),
}));

/*
 * Imported after the mock factory above only in source order: `vi.mock` is
 * hoisted above every import in the file, so these bind to the recorders rather
 * than to Medusa's real workflows.
 */

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
  return new MedusaCommerceConfigurationTarget(container);
}

function record(kind: string, index = 0) {
  const matching = commerceRecords().filter((candidate) => candidate.kind === kind);
  const found = matching[index];
  if (found === undefined) throw new Error(`no ${kind} record at index ${String(index)}`);
  return found;
}

const STORE = [{ id: "store_01", default_sales_channel_id: "sc_01" }];
const LOCATION = [{ id: "sloc_01", name: "Plepic Games" }];
const PROVIDER = [{ id: "manual_manual" }];

beforeEach(() => {
  calls.length = 0;
});

/**
 * The currency's tax treatment does not live on the store.
 *
 * `StoreCurrency` carries `currency_code` and `is_default` and nothing else;
 * `updateStoresWorkflow` strips `is_tax_inclusive` out of the store row and
 * forwards it to the pricing module's `price_preference`. So the preference is
 * what is read to decide whether anything needs writing, and the store's own
 * currency list is handed back unchanged apart from the flag.
 */
describe("applying the currency's tax treatment", () => {
  const CURRENCY_STORE = [
    {
      id: "store_01",
      default_sales_channel_id: "sc_01",
      supported_currencies: [{ currency_code: "eur", is_default: true }],
    },
  ];

  it("sets the EUR price preference tax exclusive", async () => {
    await targetOver({ store: CURRENCY_STORE }).apply(record("store-currency"));

    expect(calls).toEqual([
      {
        workflow: "updateStores",
        input: {
          selector: { id: "store_01" },
          update: {
            supported_currencies: [
              { currency_code: "eur", is_default: true, is_tax_inclusive: false },
            ],
          },
        },
      },
    ]);
  });

  it("writes nothing once the preference already says so", async () => {
    await targetOver({
      store: CURRENCY_STORE,
      price_preference: [
        { id: "prpref_01", attribute: "currency_code", value: "eur", is_tax_inclusive: false },
      ],
    }).apply(record("store-currency"));

    expect(calls).toEqual([]);
  });

  /**
   * The one that matters commercially. A preference left — or turned back — to
   * `true` makes Medusa book VAT *out of* the advertised EUR 25.00 instead of
   * adding it, which is a 19% cut to the net take that nothing on any page
   * shows. Converging it is the whole reason this record is applied first.
   */
  it("rewrites a preference an operator has turned tax inclusive", async () => {
    await targetOver({
      store: CURRENCY_STORE,
      price_preference: [
        { id: "prpref_01", attribute: "currency_code", value: "eur", is_tax_inclusive: true },
      ],
    }).apply(record("store-currency"));

    expect(calls.map((call) => call.workflow)).toEqual(["updateStores"]);
  });

  /**
   * `updateStoresWorkflow` treats `supported_currencies` as a replacement, so a
   * currency an operator added is carried through untouched — and without an
   * `is_tax_inclusive` key, which is how `updatePricePreferencesAsArrayStep`
   * leaves its preference exactly as it found it.
   */
  it("keeps a currency this configuration does not declare, and its preference", async () => {
    await targetOver({
      store: [
        {
          id: "store_01",
          supported_currencies: [
            { currency_code: "eur", is_default: true },
            { currency_code: "usd", is_default: false },
          ],
        },
      ],
    }).apply(record("store-currency"));

    expect(calls[0]?.input).toEqual({
      selector: { id: "store_01" },
      update: {
        supported_currencies: [
          { currency_code: "eur", is_default: true, is_tax_inclusive: false },
          { currency_code: "usd", is_default: false },
        ],
      },
    });
  });

  it("refuses a store that does not support the currency it must price in", async () => {
    await expect(
      targetOver({
        store: [{ id: "store_01", supported_currencies: [{ currency_code: "usd" }] }],
      }).apply(record("store-currency")),
    ).rejects.toThrow(/does not support EUR/);
    expect(calls).toEqual([]);
  });
});

describe("applying the region", () => {
  it("creates one tax-exclusive EUR region carrying the Stripe provider", async () => {
    await targetOver({}).apply(record("region"));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.workflow).toBe("createRegions");
    const [region] = (calls[0]?.input as { regions: Record<string, unknown>[] }).regions;
    expect(region).toMatchObject({
      name: "Worldwide",
      currency_code: "eur",
      automatic_taxes: true,
      is_tax_inclusive: false,
      payment_providers: ["pp_stripe_stripe"],
    });
    expect(region!.countries).toEqual(expect.arrayContaining(["ee", "de", "us"]));
  });

  it("updates the region it already created rather than creating a second", async () => {
    await targetOver({ region: [{ id: "reg_01", name: "Worldwide" }] }).apply(record("region"));

    expect(calls.map((call) => call.workflow)).toEqual(["updateRegions"]);
    expect(calls[0]?.input).toMatchObject({
      selector: { id: "reg_01" },
      update: { is_tax_inclusive: false, payment_providers: ["pp_stripe_stripe"] },
    });
  });
});

/**
 * The tax region and its one rate, which are two rows created by two workflows.
 *
 * Lifted from the catalogue import, so the cases are the import's own: absent
 * region, present region with no rate, present region with a rate. The middle
 * one is the state a run interrupted between the two workflows leaves behind,
 * and the whole reason the two lookups are separate rather than one.
 */
describe("applying a tax region", () => {
  const estonia = () => record("tax-region", EU_MEMBER_STATE_CODES.indexOf("EE"));

  it("creates the region and its default rate when neither exists", async () => {
    await targetOver({}).apply(estonia());

    expect(calls.map((call) => call.workflow)).toEqual(["createTaxRegions", "createTaxRates"]);
    expect(calls[0]?.input).toEqual([{ country_code: "ee" }]);
    expect(calls[1]?.input).toEqual([
      {
        // The identifier the create handed back, not one this test invented.
        tax_region_id: "createTaxRegions_created",
        name: "Estonian VAT",
        code: "EE-VAT",
        rate: 24,
        // `automatic_taxes` applies a region's *default* rate to a line with no
        // matching rate rule, and every line this shop sells is such a line.
        is_default: true,
      },
    ]);
  });

  it("adds the rate to a region something else already created", async () => {
    await targetOver({ tax_region: [{ id: "txreg_ee", country_code: "ee" }] }).apply(estonia());

    expect(calls.map((call) => call.workflow)).toEqual(["createTaxRates"]);
    expect(calls[0]?.input).toMatchObject([{ tax_region_id: "txreg_ee", rate: 24 }]);
  });

  /**
   * The rate rose from 22% to 24% on 1 July 2025. A deployment seeded before
   * that date, or an operator who edited the figure in the Admin, is the case
   * this converges — and it converges rather than creating a second rate,
   * because two default rates in one region is a total nobody can predict.
   */
  it("converges a rate that no longer matches rather than adding a second", async () => {
    await targetOver({
      tax_region: [{ id: "txreg_ee", country_code: "ee" }],
      tax_rate: [{ id: "txrate_ee", tax_region_id: "txreg_ee", code: "EE-VAT", rate: 22 }],
    }).apply(estonia());

    expect(calls.map((call) => call.workflow)).toEqual(["updateTaxRates"]);
    expect(calls[0]?.input).toEqual({
      selector: { id: "txrate_ee" },
      update: { name: "Estonian VAT", rate: 24 },
    });
  });

  it("addresses the country in lower case, the way Medusa stores it", async () => {
    await targetOver({ tax_region: [{ id: "txreg_de", country_code: "de" }] }).apply(
      record("tax-region", EU_MEMBER_STATE_CODES.indexOf("DE")),
    );

    expect(calls.map((call) => call.workflow)).toEqual(["createTaxRates"]);
  });
});

describe("applying the physical origin", () => {
  it("creates the stock location once and leaves an existing one alone", async () => {
    await targetOver({}).apply(record("stock-location"));
    expect(calls.map((call) => call.workflow)).toEqual(["createStockLocations"]);

    calls.length = 0;
    await targetOver({ stock_location: LOCATION }).apply(record("stock-location"));
    expect(calls).toEqual([]);
  });

  /**
   * `validateFulfillmentProvidersStep` runs before **either** shipping option
   * workflow does anything, walking
   * `service_zone.fulfillment_set.locations.fulfillment_providers.id` and
   * throwing `Providers (manual_manual) are not enabled for the service
   * location` when the provider is not there. `batchLinksWorkflow` is the
   * mechanism Medusa's own admin route uses to put it there.
   */
  it("enables the fulfillment provider at that location, once", async () => {
    await targetOver({ stock_location: LOCATION, fulfillment_provider: PROVIDER }).apply(
      record("stock-location-fulfillment-provider"),
    );
    expect(calls).toEqual([
      {
        workflow: "batchLinks",
        input: {
          create: [
            {
              stock_location: { stock_location_id: "sloc_01" },
              fulfillment: { fulfillment_provider_id: "manual_manual" },
            },
          ],
        },
      },
    ]);

    calls.length = 0;
    await targetOver({
      stock_location: [{ ...LOCATION[0], fulfillment_providers: [{ id: "manual_manual" }] }],
      fulfillment_provider: PROVIDER,
    }).apply(record("stock-location-fulfillment-provider"));
    expect(calls).toEqual([]);
  });

  it("refuses to link a provider the deployment never registered", async () => {
    await expect(
      targetOver({ stock_location: LOCATION }).apply(
        record("stock-location-fulfillment-provider"),
      ),
    ).rejects.toThrow(/No fulfillment provider manual_manual is registered/);
    expect(calls).toEqual([]);
  });

  it("refuses to link a provider to a stock location that is not there yet", async () => {
    await expect(
      targetOver({ fulfillment_provider: PROVIDER }).apply(
        record("stock-location-fulfillment-provider"),
      ),
    ).rejects.toThrow(/No stock location named/);
  });

  it("hangs the fulfillment set off that location, and refuses without it", async () => {
    await targetOver({ stock_location: LOCATION }).apply(record("fulfillment-set"));
    expect(calls).toEqual([
      {
        workflow: "createLocationFulfillmentSet",
        input: {
          location_id: "sloc_01",
          fulfillment_set_data: { name: "Plepic Games delivery", type: "shipping" },
        },
      },
    ]);

    calls.length = 0;
    await expect(targetOver({}).apply(record("fulfillment-set"))).rejects.toThrow(
      /No stock location named/,
    );
    expect(calls).toEqual([]);
  });

  it("leaves an existing fulfillment set alone", async () => {
    await targetOver({
      stock_location: LOCATION,
      fulfillment_set: [{ id: "fuset_01", name: "Plepic Games delivery" }],
    }).apply(record("fulfillment-set"));

    expect(calls).toEqual([]);
  });
});

describe("applying the shipping profile", () => {
  /**
   * Existence, not name. The catalogue import binds the **product** to
   * `lowestIdentified("shipping_profile")` and this target binds the **shipping
   * options** to the same row; creating a second, differently named profile
   * beside an operator's own would let the two choose differently, and an option
   * whose profile is not the product's is a cart with no delivery method.
   */
  it("creates a profile only when there is none at all", async () => {
    await targetOver({}).apply(record("shipping-profile"));
    expect(calls).toEqual([
      {
        workflow: "createShippingProfiles",
        input: { data: [{ name: "Default", type: "default" }] },
      },
    ]);

    calls.length = 0;
    await targetOver({ shipping_profile: [{ id: "sp_operator" }] }).apply(
      record("shipping-profile"),
    );
    expect(calls).toEqual([]);
  });
});

describe("linking the default sales channel", () => {
  it("adds the link once and never a second time", async () => {
    await targetOver({ store: STORE, stock_location: LOCATION }).apply(
      record("sales-channel-stock-location"),
    );
    expect(calls).toEqual([
      {
        workflow: "linkSalesChannelsToStockLocation",
        input: { id: "sloc_01", add: ["sc_01"] },
      },
    ]);

    calls.length = 0;
    await targetOver({
      store: STORE,
      stock_location: [{ ...LOCATION[0], sales_channels: [{ id: "sc_01" }] }],
    }).apply(record("sales-channel-stock-location"));
    expect(calls).toEqual([]);
  });

  it("refuses a store with no default sales channel rather than guessing one", async () => {
    await expect(
      targetOver({ store: [{ id: "store_01", default_sales_channel_id: null }] }).apply(
        record("sales-channel-stock-location"),
      ),
    ).rejects.toThrow(/no default sales channel/);
  });
});

describe("applying the service zones", () => {
  it("creates a zone with every country the model puts in it", async () => {
    await targetOver({ fulfillment_set: [{ id: "fuset_01" }] }).apply(record("service-zone"));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.workflow).toBe("createServiceZones");
    const [zone] = (calls[0]?.input as { data: Record<string, unknown>[] }).data;
    expect(zone).toMatchObject({ name: "European Union", fulfillment_set_id: "fuset_01" });
    expect(zone!.geo_zones).toEqual(
      EU_MEMBER_STATE_CODES.map((code) => ({ type: "country", country_code: code.toLowerCase() })),
    );
  });

  it("writes nothing when the zone already covers exactly those countries", async () => {
    await targetOver({
      fulfillment_set: [{ id: "fuset_01" }],
      service_zone: [
        {
          id: "serzo_01",
          name: "European Union",
          geo_zones: EU_MEMBER_STATE_CODES.map((code) => ({ country_code: code.toLowerCase() })),
        },
      ],
    }).apply(record("service-zone"));

    expect(calls).toEqual([]);
  });

  it("converges a zone whose country set has drifted", async () => {
    await targetOver({
      fulfillment_set: [{ id: "fuset_01" }],
      service_zone: [
        { id: "serzo_01", name: "European Union", geo_zones: [{ country_code: "ee" }] },
      ],
    }).apply(record("service-zone"));

    expect(calls.map((call) => call.workflow)).toEqual(["updateServiceZones"]);
    expect(calls[0]?.input).toMatchObject({ selector: { id: "serzo_01" } });
  });

  it("refuses to place a zone with no fulfillment set to place it on", async () => {
    await expect(targetOver({}).apply(record("service-zone"))).rejects.toThrow(
      /No fulfillment set exists/,
    );
  });
});

describe("applying the shipping options", () => {
  const zones = [
    { id: "serzo_eu", name: "European Union" },
    { id: "serzo_world", name: "Rest of world" },
  ];

  it("creates a flat option in its own zone, on the shared shipping profile", async () => {
    await targetOver({
      service_zone: zones,
      shipping_profile: [{ id: "sp_02" }, { id: "sp_01" }],
    }).apply(record("shipping-option", 1));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.workflow).toBe("createShippingOptions");
    expect((calls[0]?.input as Record<string, unknown>[])[0]).toMatchObject({
      name: "Standard delivery",
      service_zone_id: "serzo_world",
      // The lowest identifier, the same tie-break the catalogue import uses to
      // pick the product's profile.
      shipping_profile_id: "sp_01",
      provider_id: "manual_manual",
      price_type: "flat",
      prices: [{ currency_code: "eur", amount: 12 }],
    });
  });

  it("reprices an existing option rather than creating a duplicate", async () => {
    await targetOver({
      service_zone: zones,
      shipping_profile: [{ id: "sp_01" }],
      shipping_option: [
        { id: "so_eu", name: "Standard delivery", service_zone_id: "serzo_eu" },
      ],
    }).apply(record("shipping-option", 0));

    expect(calls).toEqual([
      {
        workflow: "updateShippingOptions",
        input: [
          {
            id: "so_eu",
            name: "Standard delivery",
            prices: [{ currency_code: "eur", amount: 7 }],
          },
        ],
      },
    ]);
  });

  it("prices the two zones at exactly the frozen figures", async () => {
    for (const [index, zone] of SHIPPING_ZONES.entries()) {
      calls.length = 0;
      await targetOver({ service_zone: zones, shipping_profile: [{ id: "sp_01" }] }).apply(
        record("shipping-option", index),
      );
      expect((calls[0]?.input as Record<string, unknown>[])[0]).toMatchObject({
        prices: [{ currency_code: "eur", amount: zone.amountMinor / 100 }],
      });
    }
  });

  it("refuses an option whose zone has not been applied yet", async () => {
    await expect(
      targetOver({ shipping_profile: [{ id: "sp_01" }] }).apply(record("shipping-option", 0)),
    ).rejects.toThrow(/No service zone named/);
  });
});
