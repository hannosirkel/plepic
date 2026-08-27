import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import type { MedusaContainer } from "@medusajs/framework/types";
import { decorateCartTotals } from "@medusajs/framework/utils";
import { describe, expect, it, vi } from "vitest";

import {
  MANUAL_FULFILLMENT_PROVIDER_ID,
  commerceRecords,
  configureCommerce,
  type CommerceRecord,
} from "../src/commerce/configuration.js";
import { MedusaCommerceConfigurationTarget } from "../src/commerce/medusa-target.js";
import {
  EU_MEMBER_STATE_CODES,
  OMNIVA_FULFILLMENT_PROVIDER_ID,
  SHIPPING_ZONES,
  shippingAmountMinorForCountry,
} from "../src/commerce/shipping-model.js";
import { TAX_PROVIDER_ID } from "../src/commerce/tax-model.js";

/**
 * What **Medusa** does with the configuration this repository declares.
 *
 * `commerce-configuration.test.ts` checks that the records say what they should
 * and `commerce-medusa-target.test.ts` checks that each record reaches the right
 * workflow — but both replace every core-flow with a recorder, so neither can
 * see a defect that lives in Medusa's reaction to the records rather than in the
 * records themselves. Three such defects have now reached review or live: a
 * shipping option Medusa refuses to create because the fulfillment provider is
 * not enabled at the stock location, a "tax-inclusive" region whose prices
 * Medusa nonetheless adds VAT on top of, and — this one reached **live** — a
 * tax region carrying no `provider_id`, which turns every catalogue request
 * naming a country into an HTTP 500.
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
    // default store and sales channel, and the two providers
    // `medusa-config.ts` registers since 2026-08-26 — `manual_manual`, which
    // `defineConfig` supplied by default until a fulfillment module was
    // declared to add Omniva, and `omniva_omniva` itself. Nothing else.
    store: [
      {
        id: "store_01",
        default_sales_channel_id: "sc_01",
        supported_currencies: [{ currency_code: "eur", is_default: true }],
      },
    ],
    fulfillment_provider: [
      { id: MANUAL_FULFILLMENT_PROVIDER_ID, is_enabled: true },
      { id: OMNIVA_FULFILLMENT_PROVIDER_ID, is_enabled: true },
    ],
    /**
     * The tax provider `@medusajs/tax`'s own loader registers and enables on
     * every boot, before it reads any `providers` option: `providers/system.js`
     * under the key `tp_${identifier}`, upserted into `tax_provider` with
     * `is_enabled: true`. It is present here for the same reason
     * `fulfillment_provider` is — because the configuration must reference it
     * and never creates it.
     */
    tax_provider: [{ id: TAX_PROVIDER_ID, is_enabled: true }],
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

  /**
   * The `price_preference` upsert both region workflows perform.
   *
   * `createRegionsWorkflow` strips `is_tax_inclusive` off the region row and
   * forwards it to `createPricePreferencesWorkflow` as
   * `{ attribute: "region_id", value: <region id>, is_tax_inclusive }`
   * (`@medusajs/core-flows/dist/region/workflows/create-regions.js:67-88`), and
   * `updateRegionsWorkflow` does the same through
   * `updatePricePreferencesWorkflow` whenever the field is present at all
   * (`update-regions.js:56-75`). Modelling it is what makes the region flag
   * visible here as the live hazard it is rather than as a statement of intent.
   */
  const setRegionPreference = (regionId: string, isTaxInclusive: unknown) => {
    if (isTaxInclusive === undefined) return;
    const existing = table("price_preference").find(
      (row) => row.attribute === "region_id" && row.value === regionId,
    );
    if (existing === undefined) {
      table("price_preference").push({
        id: id("prpref"),
        attribute: "region_id",
        value: regionId,
        is_tax_inclusive: isTaxInclusive,
      });
      return;
    }
    existing.is_tax_inclusive = isTaxInclusive;
  };

  const workflows: Record<string, (input: never) => unknown> = {
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

    createRegionsWorkflow: (input: {
      regions: { name: string; is_tax_inclusive?: boolean }[];
    }) => {
      for (const region of input.regions) {
        const { is_tax_inclusive, ...rest } = region;
        const regionId = id("reg");
        table("region").push({ id: regionId, ...rest });
        setRegionPreference(regionId, is_tax_inclusive);
      }
    },
    updateRegionsWorkflow: (input: {
      selector: { id: string };
      update: { is_tax_inclusive?: boolean };
    }) => {
      setRegionPreference(input.selector.id, input.update.is_tax_inclusive);
    },

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

    createTaxRegionsWorkflow: (input: { country_code: string }[]) =>
      input.map((region) => {
        // `parent_id` and `provider_id` are whatever the caller passed and
        // `null` when it passed nothing — the module applies no default, which
        // is the entire defect this models.
        const row = { id: id("txreg"), parent_id: null, provider_id: null, ...region };
        table("tax_region").push(row);
        return row;
      }),
    updateTaxRegionsWorkflow: (input: { id: string; provider_id?: string | null }[]) =>
      input.map((update) => {
        const region = table("tax_region").find((row) => row.id === update.id);
        if (region === undefined) throw new Error("no such tax region");
        Object.assign(region, update);
        return region;
      }),
    createTaxRatesWorkflow: (
      input: { tax_region_id: string; name: string; code: string; rate: number }[],
    ) =>
      input.map((rate) => {
        const row = { id: id("txrate"), ...rate };
        table("tax_rate").push(row);
        return row;
      }),
    updateTaxRatesWorkflow: (input: {
      selector: { id: string };
      update: { name: string; rate: number };
    }) => {
      const rate = table("tax_rate").find((row) => row.id === input.selector.id);
      if (rate === undefined) throw new Error("no such tax rate");
      Object.assign(rate, input.update);
    },
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
        __workflows: Record<string, (input: unknown) => unknown>;
        __writes: string[];
      };
      bound.__writes.push(name);
      // The rows a workflow creates are its `result`, because a caller reads
      // them: `applyTaxRegion` takes the identifier of the tax region it just
      // created straight off `result[0]`, so a stub that always answered `[]`
      // would fail on the create path and pass on the update path.
      const result = bound.__workflows[name]?.(input);
      return Promise.resolve({ result: result ?? [] });
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
  createTaxRatesWorkflow: workflowStub("createTaxRatesWorkflow"),
  createTaxRegionsWorkflow: workflowStub("createTaxRegionsWorkflow"),
  linkSalesChannelsToStockLocationWorkflow: workflowStub(
    "linkSalesChannelsToStockLocationWorkflow",
  ),
  updateRegionsWorkflow: workflowStub("updateRegionsWorkflow"),
  updateTaxRatesWorkflow: workflowStub("updateTaxRatesWorkflow"),
  updateTaxRegionsWorkflow: workflowStub("updateTaxRegionsWorkflow"),
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

  it("enables both fulfillment providers at the stock location before an option needs either", async () => {
    const medusa = fakeMedusa();
    const summary = await configureCommerce(
      new MedusaCommerceConfigurationTarget(medusa.container),
    );

    expect(summary.records).toBe(commerceRecords().length);
    expect(medusa.rows.shipping_option).toHaveLength(
      commerceRecords().filter((record) => record.kind === "shipping-option").length,
    );
    expect(medusa.rows.stock_location?.[0]?.fulfillment_providers).toEqual([
      { id: MANUAL_FULFILLMENT_PROVIDER_ID },
      { id: OMNIVA_FULFILLMENT_PROVIDER_ID },
    ]);
  });

  /**
   * The defect this file was written for, reproduced by deleting exactly the
   * records that fix it — both of them, one per provider since 2026-08-26.
   * Without this case the fake proves only that the configuration passes its
   * own check.
   */
  it("is refused by that validator when neither provider link is declared", async () => {
    const withoutTheLinks = commerceRecords().filter(
      (record) => record.kind !== "stock-location-fulfillment-provider",
    );
    expect(withoutTheLinks).toHaveLength(commerceRecords().length - 2);

    const medusa = fakeMedusa();
    // The manual link is missing too, and the manual method is the first
    // shipping option `commerceRecords()` declares, so that is the provider
    // the validator names first.
    await expect(applyAll(withoutTheLinks, medusa)).rejects.toThrow(
      new RegExp(`Providers \\(${MANUAL_FULFILLMENT_PROVIDER_ID}\\) ${VALIDATOR_REFUSAL}`),
    );
    expect(medusa.rows.shipping_option ?? []).toEqual([]);
  });

  /**
   * **No price this deployment holds may be tax inclusive — including by the
   * back door.**
   *
   * `@medusajs/pricing`'s `isTaxInclusive` reads the `region_id` preference
   * ahead of the `currency_code` one for any price carrying a `region_id` price
   * rule (`services/pricing-module.js:1191`). Neither price written here carries
   * one *today*, which is exactly what makes the region flag dangerous: it is
   * one region-scoped price away from being the flag that decides, and the
   * failure it produces is silent. A cart would total the advertised EUR 25.00
   * and book EUR 4.84 of VAT out of it — a 19% cut to the net take with every
   * figure on every page unchanged.
   *
   * So the assertion is over the preferences the configuration actually leaves
   * behind, not over the record that declares one of them: `createRegionsWorkflow`
   * and `updateRegionsWorkflow` both write that row, and this walks the graph
   * they wrote.
   */
  it("leaves no tax-inclusive price preference behind, for the region or the currency", async () => {
    const medusa = fakeMedusa();
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    const preferences = medusa.rows.price_preference ?? [];
    // Non-vacuity: the region preference has to be *there* and `false`, because
    // "no such row" and "a row saying false" are different futures — Medusa's
    // model default for a missing preference is `false` today, but an absent row
    // is not something this configuration asserted.
    expect(
      preferences.map((row) => ({
        attribute: row.attribute,
        is_tax_inclusive: row.is_tax_inclusive,
      })),
    ).toEqual(
      expect.arrayContaining([
        { attribute: "region_id", is_tax_inclusive: false },
        { attribute: "currency_code", is_tax_inclusive: false },
      ]),
    );
    expect(preferences.filter((row) => row.is_tax_inclusive === true)).toEqual([]);
  });

  /**
   * **The tax provider, which is what turned a priced catalogue into a 500.**
   *
   * `wrapProductsWithTaxPrices` calls `TaxModuleService.getTaxLines` for any
   * `/store/products` request that carries a tax context, and that method ends
   * at `getTaxLinesFromProvider(parentRegion.provider_id, …)`, which resolves
   * the string out of the Awilix container. A region row carrying `NULL` is
   * therefore not an untaxed price — it is `Could not resolve 'null'` and an
   * HTTP 500 on every catalogue load the storefront makes.
   *
   * {@link taxLinesForCountry} is that path, run over the rows
   * `configureCommerce` actually wrote rather than over the records it declared.
   * The distinction is the whole point: `presentedTotals` further down derives
   * its VAT from the *declaration*, so it was green throughout — a configuration
   * can declare 24 % correctly and still write a row Medusa cannot serve.
   */
  const RESOLUTION_FAILURE = /Could not resolve 'null'/;

  /**
   * `TaxModuleService.getTaxLines`, reproduced over the fake's graph.
   *
   * The three branches are Medusa's own, in its order: no parent region means
   * no tax line and no error (`if (!parentRegion) return []`), a parent region
   * means its `provider_id` is resolved out of the container, and only then are
   * the region's default rates returned.
   */
  function taxLinesForCountry(medusa: FakeMedusa, countryCode: string): { rate: number }[] {
    const parentRegion = (medusa.rows.tax_region ?? []).find(
      (row) => row.country_code === countryCode && (row.province_code ?? null) === null,
    );
    if (parentRegion === undefined) return [];

    const providerId = parentRegion.provider_id as string | null;
    const provider = (medusa.rows.tax_provider ?? []).find((row) => row.id === providerId);
    if (provider === undefined) throw new Error(`Could not resolve '${String(providerId)}'`);

    return (medusa.rows.tax_rate ?? [])
      .filter((row) => row.tax_region_id === parentRegion.id && row.is_default === true)
      .map((row) => ({ rate: row.rate as number }));
  }

  it("walks the path Medusa's tax module walks, and raises its message", () => {
    const service = medusaSource("@medusajs/tax", "services", "tax-module-service.js");
    // The provider is read off the *parent region row*, not off configuration.
    expect(service).toContain("this.getTaxLinesFromProvider(parentRegion.provider_id");
    // A destination with no region is `[]`, which is why "no VAT outside the EU"
    // is an answer rather than this same failure.
    expect(service).toContain("if (!parentRegion) {");

    const providerService = medusaSource("@medusajs/tax", "services", "tax-provider.js");
    expect(providerService).toContain("return this.__container__[providerId];");
    expect(providerService).toContain("Unable to retrieve the tax provider with id: ${providerId}");

    // And the key the loader registers, which is where `tp_system` comes from.
    const loader = medusaSource("@medusajs/tax", "loaders", "providers.js");
    expect(loader).toContain("const key = `tp_${klass.identifier}");
    expect(medusaSource("@medusajs/tax", "providers", "system.js")).toContain(
      'SystemTaxService.identifier = "system"',
    );
    expect(TAX_PROVIDER_ID).toBe("tp_system");
  });

  /**
   * Two statements from Medusa's own source that together say the omission is a
   * defect and not a preference: its Admin route refuses a top-level region
   * without a provider, and it ships a data migration that backfills exactly
   * this value onto regions that have none.
   *
   * That migration is also why the repair has to live in the predeploy Job.
   * `medusa db:migrate` records it in `script_migrations` and never re-runs it,
   * and in this deployment it ran before `configure:commerce` had created a
   * single region.
   */
  it("names the provider Medusa itself requires and backfills", () => {
    const validators = medusaSource("@medusajs/medusa", "api", "admin", "tax-regions", "validators.js");
    expect(validators).toContain("Provider is required when creating a non-province tax region.");

    const backfill = medusaSource(
      "@medusajs/medusa",
      "migration-scripts",
      "migrate-tax-region-provider.js",
    );
    expect(backfill).toContain(`provider_id: "${TAX_PROVIDER_ID}"`);
  });

  it("resolves a tax line through the system provider for every EU destination", async () => {
    const medusa = fakeMedusa();
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    for (const code of EU_MEMBER_STATE_CODES) {
      expect(taxLinesForCountry(medusa, code.toLowerCase()), code).toEqual([{ rate: 24 }]);
    }

    // Non-vacuity in the other direction: the twenty-seven rows all name the
    // provider, rather than the loop above passing because some other branch
    // returned early.
    expect(medusa.rows.tax_region).toHaveLength(EU_MEMBER_STATE_CODES.length);
    expect(
      (medusa.rows.tax_region ?? []).every((row) => row.provider_id === TAX_PROVIDER_ID),
    ).toBe(true);
  });

  /**
   * The state live is in, reproduced by putting exactly one row back the way
   * the shipped release wrote it. Without this case the test above proves only
   * that the fake agrees with itself.
   */
  it("raises Medusa's resolution failure for a region left without a provider", async () => {
    const medusa = fakeMedusa();
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    const estonia = (medusa.rows.tax_region ?? []).find((row) => row.country_code === "ee");
    expect(estonia).toBeDefined();
    estonia!.provider_id = null;

    expect(() => taxLinesForCountry(medusa, "ee")).toThrow(RESOLUTION_FAILURE);
  });

  /**
   * A second run over the graph the *shipped* release left behind: twenty-seven
   * regions with a rate each and no provider. This is the promotion path the
   * operator will run, and it has to end with every row repaired.
   */
  it("repairs regions a previous release created without a provider", async () => {
    const medusa = fakeMedusa();
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));
    for (const row of medusa.rows.tax_region ?? []) row.provider_id = null;
    expect(() => taxLinesForCountry(medusa, "ee")).toThrow(RESOLUTION_FAILURE);

    medusa.writes.length = 0;
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    expect(
      medusa.writes.filter((write) => write === "updateTaxRegionsWorkflow"),
    ).toHaveLength(EU_MEMBER_STATE_CODES.length);
    for (const code of EU_MEMBER_STATE_CODES) {
      expect(taxLinesForCountry(medusa, code.toLowerCase()), code).toEqual([{ rate: 24 }]);
    }
  });

  /**
   * A destination outside the EU is the one case where a missing tax region is
   * the right answer rather than this defect: `getTaxLines` returns `[]` before
   * it ever reads a provider, so no tax line arises and none is expected.
   */
  it("returns no tax line, and no failure, for a destination outside the EU", async () => {
    const medusa = fakeMedusa();
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    expect(taxLinesForCountry(medusa, "us")).toEqual([]);
  });

  /**
   * The predeploy Job is an Argo CD sync hook and runs again on every promoted
   * digest, so the second run is the expected path. It is a no-op for every
   * record kind that compares before it writes — and, honestly, is not one for
   * the region, the shipping options or the tax rates, which re-issue their
   * update unconditionally. Asserting the exact set keeps that statement true.
   *
   * The twenty-seven `updateTaxRatesWorkflow` calls are the cost of lifting the
   * catalogue import's tax-region upsert unchanged rather than teaching it to
   * compare first. They are named here rather than hidden behind a count, so a
   * reader watching the event bus is told what to expect.
   */
  it("writes only the updates it knowingly re-issues on a second run", async () => {
    const medusa = fakeMedusa();
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    medusa.writes.length = 0;
    await configureCommerce(new MedusaCommerceConfigurationTarget(medusa.container));

    expect(medusa.writes).toEqual([
      "updateRegionsWorkflow",
      ...EU_MEMBER_STATE_CODES.map(() => "updateTaxRatesWorkflow"),
      // One per shipping option: two for the parcel machine zone (Standard
      // delivery and the free Omniva method), one each for European Union and
      // Rest of world.
      "updateShippingOptionsWorkflow",
      "updateShippingOptionsWorkflow",
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

/** The **net** advertised price, from `src/commerce/product-model.ts`. Minor units. */
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

/**
 * The VAT rate a delivery address is charged, **read from the configuration**
 * rather than written here.
 *
 * A destination with no declared tax region resolves to no rate at all, which is
 * exactly what Medusa does with it: `automatic_taxes` looks the address up in
 * the tax module and finds nothing, so the cart carries no tax line. That is the
 * rest-of-world answer and it is the right one — no EU VAT is due on an export.
 */
function declaredVatPercent(countryCode: string): number {
  const declared = commerceRecords().find(
    (record) =>
      record.kind === "tax-region" &&
      record.countryCode.toUpperCase() === countryCode.toUpperCase(),
  );
  return declared?.kind === "tax-region" ? declared.ratePercent : 0;
}

interface PresentedTotals {
  readonly goodsMinor: number;
  readonly shippingMinor: number;
  readonly itemTaxMinor: number;
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
    // The same three fields `storefront/src/lib/store-checkout.ts` reads, plus
    // the VAT booked out of — or added to — the goods, which is the figure that
    // tells the two commercial models apart when the total alone does not.
    goodsMinor: minor(cart.item_total),
    shippingMinor: minor(cart.shipping_total),
    itemTaxMinor: minor(cart.item_tax_total),
    totalMinor: minor(cart.total),
  };
}

/**
 * The address cases the checkbox names, with the exact figures each is presented
 * with before payment.
 *
 * **The rate is no longer swept, and that is the change.** The previous version
 * of this table asserted one total per country *at every VAT rate*, because the
 * commercial model then was one tax-inclusive figure worldwide and rate
 * invariance was the property worth proving. The operator has since settled the
 * opposite model: EUR 25.00 is the **net** price and Estonian VAT is added on an
 * EU destination, exactly as the legacy shop adds it at checkout. A total that
 * did not move with the rate would now mean the VAT was not being charged, so
 * sweeping the rate here would assert the defect rather than the behaviour.
 *
 * What replaces it is stricter in the direction that matters: the rate is read
 * out of the declared configuration by {@link declaredVatPercent} rather than
 * written into the case, so a missing or mis-rated tax region moves these
 * numbers and turns the table red.
 */
describe("the exact total presented before payment", () => {
  const VAT_PERCENTS = [0, 17, 20, 22, 24, 27] as const;

  const cases: readonly {
    readonly label: string;
    readonly countryCode: string;
    /** The flat delivery charge the shipping model declares, net. Minor units. */
    readonly shippingMinor: number;
    /** What the configuration must charge this destination. */
    readonly vatPercent: number;
    /** `cart.item_total` — the goods with their VAT. */
    readonly goodsMinor: number;
    /** `cart.shipping_total` — the delivery charge with its VAT. */
    readonly shippingTotalMinor: number;
    readonly totalMinor: number;
  }[] = [
    // An included country: an EU member state. 25.00 + 6.00 goods, 7.00 + 1.68
    // shipping. Shipping is net too, and grosses with the goods.
    {
      label: "Estonia",
      countryCode: "EE",
      shippingMinor: 700,
      vatPercent: 24,
      goodsMinor: 3100,
      shippingTotalMinor: 868,
      totalMinor: 3968,
    },
    // A second member state, so the zone is not one country wide — and charged
    // Estonia's rate rather than Germany's, because the shop is below the
    // EUR 10,000 OSS threshold and charges its domestic rate.
    {
      label: "Germany",
      countryCode: "DE",
      shippingMinor: 700,
      vatPercent: 24,
      goodsMinor: 3100,
      shippingTotalMinor: 868,
      totalMinor: 3968,
    },
    /*
     * The checkbox asks for "an excluded one". NO COUNTRY IS EXCLUDED — the
     * operator's decision is worldwide delivery — so the case is the nearest
     * thing the model has: a delivery address inside the European Union that is
     * not in an EU *member state*. It is served, at the rest-of-world rate,
     * rather than refused — and, being outside the EU VAT territory for this
     * purpose, carries no EU VAT.
     */
    {
      label: "French Guiana",
      countryCode: "GF",
      shippingMinor: 1200,
      vatPercent: 0,
      goodsMinor: 2500,
      shippingTotalMinor: 1200,
      totalMinor: 3700,
    },
    {
      label: "Åland Islands",
      countryCode: "AX",
      shippingMinor: 1200,
      vatPercent: 0,
      goodsMinor: 2500,
      shippingTotalMinor: 1200,
      totalMinor: 3700,
    },
    // A non-EU country. No VAT outside the EU.
    {
      label: "United States",
      countryCode: "US",
      shippingMinor: 1200,
      vatPercent: 0,
      goodsMinor: 2500,
      shippingTotalMinor: 1200,
      totalMinor: 3700,
    },
    {
      label: "Japan",
      countryCode: "JP",
      shippingMinor: 1200,
      vatPercent: 0,
      goodsMinor: 2500,
      shippingTotalMinor: 1200,
      totalMinor: 3700,
    },
  ];

  it.each(cases)(
    "presents $label a $totalMinor total on $vatPercent% VAT and EUR $shippingMinor of net shipping",
    ({ countryCode, shippingMinor, vatPercent, goodsMinor, shippingTotalMinor, totalMinor }) => {
      expect(shippingAmountMinorForCountry(countryCode)).toBe(shippingMinor);
      expect(declaredVatPercent(countryCode), `${countryCode} VAT rate`).toBe(vatPercent);

      expect(
        presentedTotals({
          shippingMinor,
          vatPercent: declaredVatPercent(countryCode),
          taxInclusive: declaredTaxInclusivity("EUR"),
        }),
        countryCode,
      ).toEqual({
        goodsMinor,
        shippingMinor: shippingTotalMinor,
        itemTaxMinor: goodsMinor - GOODS_AMOUNT_MINOR,
        totalMinor,
      });
    },
  );

  /**
   * **The negative control, inverted.** It used to prove that leaving the
   * currency preference at Medusa's `false` default charged VAT on top of a
   * price advertised as containing it. The commercial model is now the other
   * one, so the control is the other one: setting inclusivity back to `true`
   * charges the advertised EUR 25.00 and books EUR 4.84 of VAT *out of* it —
   * 25.00 × 24/124 — which is a 19% cut to the net take, silently, with every
   * figure on every page still reading EUR 25.00.
   *
   * `item_tax_total` is asserted explicitly and not merely implied by the total,
   * because the total is what makes the defect invisible: a reader comparing
   * EUR 32.00 to EUR 25.00 sees a shop that undercharged, not a shop that gave
   * a fifth of its revenue to the tax authority.
   */
  it("would charge the advertised price and book VAT out of it if inclusivity returned", () => {
    const configured = presentedTotals({ shippingMinor: 700, vatPercent: 24, taxInclusive: false });
    const inclusive = presentedTotals({ shippingMinor: 700, vatPercent: 24, taxInclusive: true });

    expect(configured).toEqual({
      goodsMinor: 3100,
      shippingMinor: 868,
      itemTaxMinor: 600,
      totalMinor: 3968,
    });
    expect(inclusive).toEqual({
      goodsMinor: 2500,
      shippingMinor: 700,
      itemTaxMinor: 484,
      totalMinor: 3200,
    });
    expect(declaredTaxInclusivity("EUR")).toBe(false);
  });

  /**
   * `storefront/src/lib/store-checkout.ts` refuses to render a disclosure whose
   * three figures do not sum, and `content/legal/terms.ts` lists all three among
   * what a buyer sees above the order button. That the sum holds is a property
   * of Medusa's arithmetic, so it is checked against Medusa's arithmetic.
   *
   * This one still sweeps the rate, because the sum holds at every rate whether
   * or not the total does — which is the whole of what it claims.
   */
  it("produces three figures that add up, which is what the checkout requires", () => {
    for (const zone of SHIPPING_ZONES) {
      for (const method of zone.methods) {
        for (const vatPercent of VAT_PERCENTS) {
          const totals = presentedTotals({
            shippingMinor: method.amountMinor,
            vatPercent,
            taxInclusive: declaredTaxInclusivity("EUR"),
          });
          expect(totals.goodsMinor + totals.shippingMinor, `${zone.name}/${method.name}`).toBe(
            totals.totalMinor,
          );
        }
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
