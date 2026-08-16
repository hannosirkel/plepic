import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import type { MedusaContainer } from "@medusajs/framework/types";
import { decorateCartTotals } from "@medusajs/framework/utils";
import { describe, expect, it, vi } from "vitest";

import {
  FULFILLMENT_PROVIDER_ID,
  commerceRecords,
  configureCommerce,
  type CommerceRecord,
} from "../src/commerce/configuration.js";
import { MedusaCommerceConfigurationTarget } from "../src/commerce/medusa-target.js";
import {
  SHIPPING_ZONES,
  shippingAmountMinorForCountry,
} from "../src/commerce/shipping-model.js";

/**
 * What **Medusa** does with the configuration this repository declares.
 *
 * `commerce-configuration.test.ts` checks that the records say what they should
 * and `commerce-medusa-target.test.ts` checks that each record reaches the right
 * workflow — but both replace every core-flow with a recorder, so neither can
 * see a defect that lives in Medusa's reaction to the records rather than in the
 * records themselves. Two such defects reached review on this branch: a shipping
 * option Medusa refuses to create because the fulfillment provider is not
 * enabled at the stock location, and a "tax-inclusive" region whose prices
 * Medusa nonetheless adds VAT on top of.
 *
 * A real Medusa would catch both, and this repository cannot run one:
 * `scripts/validate` has no PostgreSQL and no Redis, and standing either up
 * would put a database between a developer and `npm run test:unit`. So this file
 * takes the two things that *are* in reach and uses them literally rather than
 * restating them:
 *
 * 1. **Medusa's own arithmetic**, imported from `@medusajs/framework/utils`.
 *    `decorateCartTotals` is the function that produces the `item_total`,
 *    `shipping_total` and `total` a cart carries, and it is given the declared
 *    configuration's tax treatment rather than a hand-written boolean.
 * 2. **Medusa's own refusal**, reproduced. The fake below applies every record
 *    in order to a mutable graph and then, at the point a shipping option is
 *    created, runs the check `validateFulfillmentProvidersStep` runs — over the
 *    graph the earlier records actually built, not over rows a test author
 *    arranged. The field path it walks and the message it throws are asserted
 *    against Medusa's shipped source below, so an upgrade that moves either
 *    turns this red rather than leaving it quietly wrong.
 *
 * Neither is a substitute for an integration test. Both fail when the
 * configuration is wrong in the way it was wrong, which is the property the
 * recorders did not have.
 */

/*
 * `__filename` rather than `import.meta.url`: this workspace's tsconfig is
 * `module: Node16` over a package with no `"type": "module"`, so TypeScript
 * types these files as CommonJS and rejects `import.meta`. Vitest supplies both
 * at runtime; only one typechecks.
 */
const require_ = createRequire(__filename);

function medusaSource(specifier: string, ...within: string[]): string {
  const entry = require_.resolve(specifier);
  const root = entry.slice(0, entry.indexOf("/dist/") + "/dist/".length);
  return readFileSync(root + within.join("/"), "utf8");
}

/* ------------------------------------------------------------------ *
 * 1. The graph the configuration builds, and Medusa's refusal of it
 * ------------------------------------------------------------------ */

/**
 * The path `validateFulfillmentProvidersStep` walks from a shipping option's
 * service zone to the providers that may serve it, and the refusal it raises.
 *
 * Held against the shipped file, because the fake below reproduces them.
 */
const VALIDATOR_FIELD_PATH = "fulfillment_set.locations.fulfillment_providers.id";
const VALIDATOR_REFUSAL = "are not enabled for the service location";

interface Row {
  [field: string]: unknown;
}

interface FakeMedusa {
  readonly container: MedusaContainer;
  readonly rows: Record<string, Row[]>;
  readonly writes: string[];
}

/**
 * A Medusa-shaped graph that records mutate.
 *
 * The existing target test filters a fixed row set; this one lets each workflow
 * write, so what a record leaves behind is what the next record reads. That is
 * the only way a missing link between two records is visible at all: every
 * record in isolation was correct on the branch that shipped the defect.
 *
 * `fields` is ignored and whole rows are returned, exactly as the sibling test
 * does — this fake models Medusa's *graph*, not its field projection.
 */
function fakeMedusa(): FakeMedusa {
  let sequence = 0;
  const id = (prefix: string) => `${prefix}_${String(++sequence).padStart(2, "0")}`;

  const rows: Record<string, Row[]> = {
    // What a migrated database has before this configuration runs: Medusa's own
    // default store and sales channel, and the one provider `defineConfig`
    // registers. Nothing else.
    store: [
      {
        id: "store_01",
        default_sales_channel_id: "sc_01",
        supported_currencies: [{ currency_code: "eur", is_default: true }],
      },
    ],
    fulfillment_provider: [{ id: FULFILLMENT_PROVIDER_ID, is_enabled: true }],
  };

  const writes: string[] = [];
  const table = (entity: string) => (rows[entity] ??= []);

  /** The check `validateFulfillmentProvidersStep` performs, over this graph. */
  const providersEnabledForZone = (serviceZoneId: string): string[] => {
    const zone = table("service_zone").find((row) => row.id === serviceZoneId);
    const set = table("fulfillment_set").find((row) => row.id === zone?.fulfillment_set_id);
    const locationIds = (set?.location_ids ?? []) as string[];
    return locationIds.flatMap((locationId) => {
      const location = table("stock_location").find((row) => row.id === locationId);
      return ((location?.fulfillment_providers ?? []) as { id?: string }[])
        .map((provider) => provider.id)
        .filter((value): value is string => typeof value === "string");
    });
  };

  const workflows: Record<string, (input: never) => void> = {
    updateStoresWorkflow: (input: {
      selector: { id: string };
      update: {
        supported_currencies: { currency_code: string; is_tax_inclusive?: boolean }[];
      };
    }) => {
      const store = table("store").find((row) => row.id === input.selector.id);
      if (store === undefined) throw new Error("no such store");
      store.supported_currencies = input.update.supported_currencies.map((currency) => ({
        currency_code: currency.currency_code,
        is_default: true,
      }));
      // `updateStoresWorkflow` forwards the flag to
      // `updatePricePreferencesAsArrayStep`, which upserts on attribute+value
      // and keeps the previous value when the field is absent.
      for (const currency of input.update.supported_currencies) {
        if (currency.is_tax_inclusive === undefined) continue;
        const existing = table("price_preference").find(
          (row) => row.attribute === "currency_code" && row.value === currency.currency_code,
        );
        if (existing === undefined) {
          table("price_preference").push({
            id: id("prpref"),
            attribute: "currency_code",
            value: currency.currency_code,
            is_tax_inclusive: currency.is_tax_inclusive,
          });
        } else {
          existing.is_tax_inclusive = currency.is_tax_inclusive;
        }
      }
    },

    createRegionsWorkflow: (input: { regions: { name: string }[] }) => {
      for (const region of input.regions) table("region").push({ id: id("reg"), ...region });
    },
    updateRegionsWorkflow: () => undefined,

    createStockLocationsWorkflow: (input: { locations: { name: string }[] }) => {
      for (const location of input.locations) {
        table("stock_location").push({
          id: id("sloc"),
          ...location,
          sales_channels: [],
          fulfillment_providers: [],
        });
      }
    },

    batchLinksWorkflow: (input: {
      create: { stock_location: { stock_location_id: string }; fulfillment: { fulfillment_provider_id: string } }[];
    }) => {
      for (const link of input.create) {
        const location = table("stock_location").find(
          (row) => row.id === link.stock_location.stock_location_id,
        );
        if (location === undefined) throw new Error("no such stock location");
        (location.fulfillment_providers as { id: string }[]).push({
          id: link.fulfillment.fulfillment_provider_id,
        });
      }
    },

    createLocationFulfillmentSetWorkflow: (input: {
      location_id: string;
      fulfillment_set_data: { name: string; type: string };
    }) => {
      table("fulfillment_set").push({
        id: id("fuset"),
        ...input.fulfillment_set_data,
        location_ids: [input.location_id],
      });
    },

    createShippingProfilesWorkflow: (input: { data: { name: string; type: string }[] }) => {
      for (const profile of input.data) table("shipping_profile").push({ id: id("sp"), ...profile });
    },

    linkSalesChannelsToStockLocationWorkflow: (input: { id: string; add: string[] }) => {
      const location = table("stock_location").find((row) => row.id === input.id);
      if (location === undefined) throw new Error("no such stock location");
      for (const channel of input.add) {
        (location.sales_channels as { id: string }[]).push({ id: channel });
      }
    },

    createServiceZonesWorkflow: (input: {
      data: { name: string; fulfillment_set_id: string; geo_zones: { country_code: string }[] }[];
    }) => {
      for (const zone of input.data) table("service_zone").push({ id: id("serzo"), ...zone });
    },
    updateServiceZonesWorkflow: () => undefined,

    createShippingOptionsWorkflow: (
      input: { name: string; service_zone_id: string; provider_id: string }[],
    ) => {
      for (const option of input) {
        /*
         * Medusa runs this before it creates anything, and it is the whole
         * reason this file exists: on the branch under review nothing created
         * the `location_fulfillment_provider` link, so this threw on the first
         * shipping option of every predeploy Job on every environment.
         */
        const enabled = providersEnabledForZone(option.service_zone_id);
        if (!enabled.includes(option.provider_id)) {
          throw new Error(`Providers (${option.provider_id}) ${VALIDATOR_REFUSAL}`);
        }
        table("shipping_option").push({ id: id("so"), ...option });
      }
    },
    updateShippingOptionsWorkflow: () => undefined,
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
    // The workflow factories are injected by the module mock below, which reads
    // them off the container so that one fake owns both halves.
    __workflows: workflows,
    __writes: writes,
  } as unknown as MedusaContainer;

  return { container, rows, writes };
}

/*
 * Each core-flow is a thunk that finds the fake on the container it was handed.
 * `vi.mock` is hoisted, so this factory cannot close over a per-test fake; the
 * container is the only thing both halves share.
 */
function workflowStub(name: string) {
  return (container: MedusaContainer) => ({
    run: ({ input }: { input: unknown }) => {
      const bound = container as unknown as {
        __workflows: Record<string, (input: unknown) => void>;
        __writes: string[];
      };
      bound.__writes.push(name);
      bound.__workflows[name]?.(input);
      return Promise.resolve({ result: [] });
    },
  });
}

vi.mock("@medusajs/medusa/core-flows", () => ({
  batchLinksWorkflow: workflowStub("batchLinksWorkflow"),
  createLocationFulfillmentSetWorkflow: workflowStub("createLocationFulfillmentSetWorkflow"),
  createRegionsWorkflow: workflowStub("createRegionsWorkflow"),
  createServiceZonesWorkflow: workflowStub("createServiceZonesWorkflow"),
  createShippingOptionsWorkflow: workflowStub("createShippingOptionsWorkflow"),
  createShippingProfilesWorkflow: workflowStub("createShippingProfilesWorkflow"),
  createStockLocationsWorkflow: workflowStub("createStockLocationsWorkflow"),
  linkSalesChannelsToStockLocationWorkflow: workflowStub(
    "linkSalesChannelsToStockLocationWorkflow",
  ),
  updateRegionsWorkflow: workflowStub("updateRegionsWorkflow"),
  updateServiceZonesWorkflow: workflowStub("updateServiceZonesWorkflow"),
  updateShippingOptionsWorkflow: workflowStub("updateShippingOptionsWorkflow"),
  updateStoresWorkflow: workflowStub("updateStoresWorkflow"),
}));

async function applyAll(records: readonly CommerceRecord[], medusa: FakeMedusa): Promise<void> {
  const target = new MedusaCommerceConfigurationTarget(medusa.container);
  for (const record of records) await target.apply(record);
}

describe("the graph the configuration leaves behind", () => {
  it("walks the path Medusa's own validator walks, and raises its message", () => {
    const source = medusaSource(
      "@medusajs/core-flows",
      "fulfillment",
      "steps",
      "validate-fulfillment-providers.js",
    );
    expect(source).toContain(VALIDATOR_FIELD_PATH);
    expect(source).toContain(VALIDATOR_REFUSAL);
    expect(source).toContain('entryPoint: "service_zone"');
  });

  it("enables the fulfillment provider at the stock location before an option needs it", async () => {
    const medusa = fakeMedusa();
    const summary = await configureCommerce(
      new MedusaCommerceConfigurationTarget(medusa.container),
    );

    expect(summary.records).toBe(commerceRecords().length);
    expect(medusa.rows.shipping_option).toHaveLength(SHIPPING_ZONES.length);
    expect(medusa.rows.stock_location?.[0]?.fulfillment_providers).toEqual([
      { id: FULFILLMENT_PROVIDER_ID },
    ]);
  });

  /**
   * The defect this file was written for, reproduced by deleting exactly the
   * record that fixes it. Without this case the fake proves only that the
   * configuration passes its own check.
   */
  it("is refused by that validator when the provider link is not declared", async () => {
    const withoutTheLink = commerceRecords().filter(
      (record) => record.kind !== "stock-location-fulfillment-provider",
    );
    expect(withoutTheLink).toHaveLength(commerceRecords().length - 1);

    const medusa = fakeMedusa();
    await expect(applyAll(withoutTheLink, medusa)).rejects.toThrow(
      new RegExp(`Providers \\(${FULFILLMENT_PROVIDER_ID}\\) ${VALIDATOR_REFUSAL}`),
    );
    expect(medusa.rows.shipping_option ?? []).toEqual([]);
  });

  /**
   * The predeploy Job is an Argo CD sync hook and runs again on every promoted
   * digest, so the second run is the expected path. It is a no-op for every
   * record kind that compares before it writes — and, honestly, is not one for
   * the region or the shipping options, which re-issue their update
   * unconditionally. Asserting the exact set keeps that statement true.
   */
  it("writes only the two updates it knowingly re-issues on a second run", async () => {
    const medusa = fakeMedusa();
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    medusa.writes.length = 0;
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    expect(medusa.writes).toEqual([
      "updateRegionsWorkflow",
      "updateShippingOptionsWorkflow",
      "updateShippingOptionsWorkflow",
    ]);
  });

  it("refuses to link a fulfillment provider the deployment never registered", async () => {
    const medusa = fakeMedusa();
    medusa.rows.fulfillment_provider = [];

    await expect(applyAll(commerceRecords(), medusa)).rejects.toThrow(
      /No fulfillment provider manual_manual is registered/,
    );
  });
});

/* ------------------------------------------------------------------ *
 * 2. The total a buyer is presented with, computed by Medusa
 * ------------------------------------------------------------------ */

/** The advertised price, from `storefront/mock/catalogue.json`. Minor units. */
const GOODS_AMOUNT_MINOR = 2500;

/**
 * The rule `@medusajs/pricing` resolves a price's tax inclusivity by, applied to
 * the preferences this configuration declares.
 *
 * Restated rather than imported because the function is module-private, and
 * pinned to the shipped source by the test below it. The `region_id` branch is
 * reachable only for a price carrying a `region_id` price rule; neither the
 * product price nor the shipping price carries one, so what governs here is the
 * `currency_code` preference and its absence means `false`.
 */
function declaredTaxInclusivity(currencyCode: string): boolean {
  const preference = commerceRecords().find(
    (record) =>
      record.kind === "store-currency" &&
      record.currencyCode.toLowerCase() === currencyCode.toLowerCase(),
  );
  return preference?.kind === "store-currency" ? preference.taxInclusivePrices : false;
}

interface PresentedTotals {
  readonly goodsMinor: number;
  readonly shippingMinor: number;
  readonly totalMinor: number;
}

/** The three figures the checkout reads, computed the way Medusa computes them. */
function presentedTotals(options: {
  readonly shippingMinor: number;
  readonly vatPercent: number;
  readonly taxInclusive: boolean;
}): PresentedTotals {
  const taxLines = options.vatPercent === 0 ? [] : [{ rate: options.vatPercent }];
  const cart = decorateCartTotals({
    currency_code: "eur",
    items: [
      {
        id: "item",
        unit_price: GOODS_AMOUNT_MINOR / 100,
        quantity: 1,
        is_tax_inclusive: options.taxInclusive,
        tax_lines: taxLines,
      },
    ],
    shipping_methods: [
      {
        id: "method",
        amount: options.shippingMinor / 100,
        is_tax_inclusive: options.taxInclusive,
        tax_lines: taxLines,
      },
    ],
  });

  const minor = (value: unknown) => Math.round(Number(value) * 100);
  return {
    // The same three fields `storefront/src/lib/store-checkout.ts` reads.
    goodsMinor: minor(cart.item_total),
    shippingMinor: minor(cart.shipping_total),
    totalMinor: minor(cart.total),
  };
}

/**
 * The three address cases the checkbox names, with the exact total each is
 * presented with before payment — and with the destination's VAT rate varied
 * underneath each of them, because that is the claim being tested.
 *
 * `content/legal/shipping.ts`: *"It is the same figure for every visitor, in
 * every country, and it does not change according to where you are or where you
 * ask us to send the parcel."* A single asserted number per country cannot show
 * that; a number that is the same across every rate the destination might carry
 * can. The rates are the range of EU VAT standard rates plus zero, which is what
 * a destination with no seeded tax region resolves to.
 */
describe("the exact total presented before payment", () => {
  const VAT_PERCENTS = [0, 17, 20, 22, 24, 27] as const;

  const cases: readonly {
    readonly label: string;
    readonly countryCode: string;
    readonly shippingMinor: number;
    readonly totalMinor: number;
  }[] = [
    // An included country: an EU member state.
    { label: "Estonia", countryCode: "EE", shippingMinor: 700, totalMinor: 3200 },
    // A second member state, so the zone is not one country wide.
    { label: "Germany", countryCode: "DE", shippingMinor: 700, totalMinor: 3200 },
    /*
     * The checkbox asks for "an excluded one". NO COUNTRY IS EXCLUDED — the
     * operator's decision is worldwide delivery — so the case is the nearest
     * thing the model has: a delivery address inside the European Union that is
     * not in an EU *member state*. It is served, at the rest-of-world rate,
     * rather than refused.
     */
    { label: "French Guiana", countryCode: "GF", shippingMinor: 1200, totalMinor: 3700 },
    { label: "Åland Islands", countryCode: "AX", shippingMinor: 1200, totalMinor: 3700 },
    // A non-EU country.
    { label: "United States", countryCode: "US", shippingMinor: 1200, totalMinor: 3700 },
    { label: "Japan", countryCode: "JP", shippingMinor: 1200, totalMinor: 3700 },
  ];

  it.each(cases)(
    "presents $label EUR $shippingMinor of shipping on a $totalMinor total, at every VAT rate",
    ({ countryCode, shippingMinor, totalMinor }) => {
      expect(shippingAmountMinorForCountry(countryCode)).toBe(shippingMinor);

      for (const vatPercent of VAT_PERCENTS) {
        expect(
          presentedTotals({
            shippingMinor,
            vatPercent,
            taxInclusive: declaredTaxInclusivity("EUR"),
          }),
          `${countryCode} at ${String(vatPercent)}%`,
        ).toEqual({ goodsMinor: GOODS_AMOUNT_MINOR, shippingMinor, totalMinor });
      }
    },
  );

  /**
   * The negative control, and the defect that reached review: with the currency
   * preference left at Medusa's `false` default, the very same configuration
   * charges an Estonian address EUR 39.04 for a page advertising EUR 25.00.
   *
   * This is here so that "the flag is set" is never again the whole of the
   * evidence. If the flag stops being load-bearing, this goes red too.
   */
  it("would charge VAT on top of the advertised price without that preference", () => {
    const configured = presentedTotals({ shippingMinor: 700, vatPercent: 22, taxInclusive: true });
    const unset = presentedTotals({ shippingMinor: 700, vatPercent: 22, taxInclusive: false });

    expect(configured).toEqual({ goodsMinor: 2500, shippingMinor: 700, totalMinor: 3200 });
    expect(unset).toEqual({ goodsMinor: 3050, shippingMinor: 854, totalMinor: 3904 });
    expect(declaredTaxInclusivity("EUR")).toBe(true);
  });

  /**
   * `storefront/src/lib/store-checkout.ts` refuses to render a disclosure whose
   * three figures do not sum, and `content/legal/terms.ts` lists all three among
   * what a buyer sees above the order button. That the sum holds is a property
   * of Medusa's arithmetic, so it is checked against Medusa's arithmetic.
   */
  it("produces three figures that add up, which is what the checkout requires", () => {
    for (const zone of SHIPPING_ZONES) {
      for (const vatPercent of VAT_PERCENTS) {
        const totals = presentedTotals({
          shippingMinor: zone.amountMinor,
          vatPercent,
          taxInclusive: declaredTaxInclusivity("EUR"),
        });
        expect(totals.goodsMinor + totals.shippingMinor, zone.name).toBe(totals.totalMinor);
      }
    }
  });

  it("resolves inclusivity by the rule the pricing module actually applies", () => {
    const source = medusaSource("@medusajs/pricing", "services", "pricing-module.js");

    // The region preference is consulted only for a price that carries a
    // `region_id` rule; neither price this deployment writes does.
    expect(source).toContain("if (regionRule && regionPreference) {");
    expect(source).toContain("return currencyPreference.is_tax_inclusive;");

    // And the fallback when neither preference matches is `false`, which is why
    // the currency preference has to be written rather than left alone.
    const model = medusaSource("@medusajs/pricing", "models", "price-preference.js");
    expect(model).toContain("is_tax_inclusive: utils_1.model.boolean().default(false)");
  });
});
