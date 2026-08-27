/**
 * The commerce configuration this deployment declares, as ordered, key-addressed
 * records — and the port that applies them.
 *
 * ## Why this exists at all
 *
 * A migrated Medusa database has a store and a default sales channel and nothing
 * else. It has **no region**, so `POST /store/carts` has nothing to create a
 * cart against and `storefront/src/lib/cart-store.tsx` refuses with "Medusa
 * Store catalogue is not ready"; **no stock location** and **no shipping
 * profile**, which the catalogue import refuses without; **no fulfillment set**,
 * so there is nowhere to hang a service zone; and **no shipping option**, so a
 * completed delivery address returns an empty option list and the checkout can
 * never reach payment. None of that is catalogue data and none of it comes from
 * a WooCommerce export. It is configuration, it is frozen in this repository,
 * and it is applied by `npm run configure:commerce` from the predeploy Job —
 * before any pod serves traffic and before the import Job is ever staged.
 *
 * ## Shipping and tax are configured here and nowhere else
 *
 * The catalogue import used to seed the shipping zones and methods from the
 * archive's `shippingZones` section, and the tax regions from its `taxRegions`
 * section. It no longer seeds either: two writers of one price is a way for the
 * rates a buyer is charged to stop being the rates the operator froze, and the
 * export is the *old* shop's configuration rather than the model this repository
 * declares. The zones, the methods and their frozen amounts are
 * {@link ./shipping-model.js}'s; the VAT rate and the countries it applies in
 * are {@link ./tax-model.js}'s.
 *
 * The catalogue-import Job still carries its own copies of those upserts. It is
 * a Job that is not on this critical path and retiring it is a deliberately
 * separate change — but while both exist, this file is the writer that runs on
 * every promoted digest and the import is the one that runs when an operator
 * stages an archive, so this file wins by simply running last and asserting the
 * declared figures.
 *
 * ## Every record is an assertion addressed by a natural key
 *
 * The same shape the catalogue import uses, for the same reason: a create-shaped
 * configuration is idempotent only if something remembers what it created, and
 * the predeploy Job is an Argo CD sync hook that runs again on **every promoted
 * digest**. A key-addressed upsert is idempotent because the second application
 * of a record is the same assertion as the first, and a run interrupted halfway
 * converges when it is run again.
 *
 * **Idempotent is not the same as silent.** Seven of the ten record kinds write
 * nothing at all on a second run, because they compare before they write. The
 * region, the tax regions and the shipping options do not: they re-issue their
 * update whenever the row exists, so every promoted digest rewrites the region's
 * country list, all twenty-seven VAT rates and every shipping option's price —
 * three flat and one free — and emits `region.updated` and
 * `shipping_option.updated`. The end state is the same
 * either way, which is what idempotence means here — but a reader watching the
 * event bus will see them, and
 * `tests/commerce-medusa-semantics.test.ts` asserts the exact set so that this
 * paragraph cannot quietly stop being true.
 *
 * ## The natural keys are display names, and renaming one in the Admin hurts
 *
 * {@link REGION_NAME}, {@link STOCK_LOCATION_NAME}, {@link FULFILLMENT_SET_NAME}
 * and the three zone names in {@link ./shipping-model.js} are both what the
 * Admin shows an operator *and* the key every upsert here addresses. An
 * operator who renames the region in the Admin does not rename this record: the
 * next predeploy finds no row called `Worldwide`, creates a **second** region,
 * and `storefront/src/lib/cart-store.tsx` — which lists regions with `limit: 2`
 * and refuses unless it finds exactly one — then answers every add-to-cart with
 * "Medusa Store catalogue is not ready". Renaming any of these six in the
 * Admin is therefore a change to this file, not a cosmetic edit.
 */

import { STRIPE_PAYMENT_PROVIDER_ID } from "../config/payment.js";
import {
  OMNIVA_COURIER_OPTION_ID,
  OMNIVA_PARCEL_MACHINE_OPTION_ID,
} from "../modules/omniva/service.js";
import {
  DELIVERABLE_COUNTRY_CODES,
  MANUAL_FULFILLMENT_PROVIDER_ID,
  OMNIVA_FULFILLMENT_PROVIDER_ID,
  SHIPPING_CURRENCY,
  SHIPPING_ZONES,
  type ShippingMethodModel,
} from "./shipping-model.js";
import {
  ESTONIAN_STANDARD_VAT_PERCENT,
  TAX_PROVIDER_ID,
  VAT_COUNTRY_CODES,
  VAT_RATE_CODE,
  VAT_RATE_NAME,
} from "./tax-model.js";

/**
 * The one region.
 *
 * `storefront/src/lib/cart-store.tsx` lists regions with `limit: 2` and refuses
 * unless it finds **exactly one** — deliberately, because a second region is a
 * second answer to "what does this cost?" and the storefront has no region
 * selector to resolve it with. One advertised price worldwide is the commercial
 * model, so one region is its faithful expression.
 */
export const REGION_NAME = "Worldwide";

/** The single physical origin every parcel is sent from. */
export const STOCK_LOCATION_NAME = "Plepic Games";

/** The fulfillment set the three service zones hang off. */
export const FULFILLMENT_SET_NAME = "Plepic Games delivery";
export const FULFILLMENT_SET_TYPE = "shipping";

/** The shipping profile the single product and every shipping option share. */
export const SHIPPING_PROFILE_NAME = "Default";
export const SHIPPING_PROFILE_TYPE = "default";

/**
 * Re-exported from {@link ./shipping-model.js} — see
 * {@link MANUAL_FULFILLMENT_PROVIDER_ID} there for the full reasoning, which
 * belongs on the declaration rather than here: a JSDoc block on a re-export
 * is not what an editor surfaces on hover, so a copy here would be the wrong,
 * shorter comment winning over the right one. Re-exported anyway, because
 * every other caller in this file already imports from `./configuration.js`.
 */
export { MANUAL_FULFILLMENT_PROVIDER_ID } from "./shipping-model.js";

export type CommerceRecord =
  | {
      /**
       * The store's supported currency, and — the only reason this record
       * exists — whether prices denominated in it contain their tax.
       */
      readonly kind: "store-currency";
      /** The currency code. */
      readonly key: string;
      readonly currencyCode: string;
      /**
       * Whether an advertised price contains the tax rather than having it
       * added. **It is `false` here, and it is the operator's decision**: EUR
       * 25.00 is the *net* price and VAT is added on top for an EU destination,
       * which is what the legacy shop does at checkout. See
       * {@link ./tax-model.js}.
       *
       * `updateStoresWorkflow` forwards this to the pricing module's
       * `price_preference` keyed on `currency_code`, and
       * `@medusajs/pricing`'s `isTaxInclusive` reads that preference for a price
       * carrying no `region_id` price rule — which is every price this
       * deployment writes: the product price as `[{ amount, currency_code }]`
       * and the shipping price as `[{ currency_code, amount }]`.
       *
       * **It is not enough on its own, and the region record's flag is not
       * decoration.** Read that one next; the two have to move together.
       */
      readonly taxInclusivePrices: boolean;
    }
  | {
      readonly kind: "region";
      readonly key: string;
      readonly name: string;
      readonly currencyCode: string;
      readonly countryCodes: readonly string[];
      readonly paymentProviderIds: readonly string[];
      /**
       * The region's own tax-inclusivity preference — **a live hazard, not a
       * statement of intent.** This docstring used to call it the latter and
       * that was wrong in a way that costs money.
       *
       * `createRegionsWorkflow` strips this off the region row and writes it to
       * the pricing module as `{ attribute: "region_id", value: <region id>,
       * is_tax_inclusive }`
       * (`@medusajs/core-flows/dist/region/workflows/create-regions.js:67-88`);
       * `updateRegionsWorkflow` rewrites the same row whenever the field is
       * present (`update-regions.js:56-75`). `@medusajs/pricing`'s
       * `isTaxInclusive` then consults it **ahead of** the currency preference
       * for any price carrying a `region_id` price rule
       * (`services/pricing-module.js:1191`).
       *
       * No price this deployment writes carries such a rule *today*. That is the
       * whole of the protection, and it is one region-scoped price away from
       * being gone: a price list, a region-specific override, an operator's edit
       * in the Admin. If this said `true` while the currency said `false`, the
       * first such price would make the shop charge the advertised EUR 25.00 and
       * book EUR 4.84 of VAT out of it — a 19% cut to the net take, with every
       * figure on every page still reading EUR 25.00 and nothing to notice.
       *
       * So the two flags are declared as one decision and must be changed as
       * one. `tests/commerce-medusa-semantics.test.ts` asserts that the
       * configuration leaves **no** tax-inclusive price preference behind, for
       * either attribute, over the graph Medusa's own region workflows write.
       */
      readonly taxInclusivePrices: boolean;
      /**
       * Whether Medusa resolves the destination's tax region automatically.
       *
       * With tax-**exclusive** prices this decides the total and not merely its
       * composition: an EU address resolves to one of the tax regions declared
       * below and pays EUR 39.68, and an address anywhere else resolves to no
       * tax region, carries no tax line, and pays EUR 37.00.
       */
      readonly automaticTaxes: boolean;
    }
  | {
      /**
       * One country's tax region and the single rate within it.
       *
       * These moved here from the catalogue import. That import reads them from
       * a WooCommerce archive, which is the *old* shop's tax configuration
       * rather than the model the operator froze — the same reason the shipping
       * zones are declared here and the archive's `shippingZones` section is
       * refused outright. A rate a buyer is charged may have one writer, and
       * this is it.
       *
       * There are twenty-seven of them and they all carry Estonia's rate; see
       * {@link ./tax-model.js} for why, and for the citation behind the figure.
       */
      readonly kind: "tax-region";
      /** The ISO 3166-1 alpha-2 country code. */
      readonly key: string;
      readonly countryCode: string;
      /** What the Admin shows against the rate. */
      readonly name: string;
      /** A percentage: `24` is 24 %. */
      readonly ratePercent: number;
      /** The natural key the rate is addressed by within its region. */
      readonly code: string;
      /**
       * The tax provider the region resolves its lines through: `tp_system`.
       *
       * Declared per record rather than read from the model inside the target,
       * because it is part of what the region *is* — a region without one is a
       * row `TaxModuleService.getTaxLines` answers with `Could not resolve
       * 'null'`, which is an HTTP 500 on every catalogue request carrying a
       * `country_code`. {@link ./tax-model.js} has the whole reasoning and the
       * citations.
       */
      readonly providerId: string;
    }
  | { readonly kind: "stock-location"; readonly key: string; readonly name: string }
  | {
      /**
       * The `location_fulfillment_provider` link between the stock location and
       * a provider a shipping option is served by. One such record per
       * provider — `manual_manual` and, since 2026-08-26, `omniva_omniva`.
       *
       * Nothing else creates it. `createStockLocationsWorkflow` creates the
       * location, `createLocationFulfillmentSetWorkflow` creates the set and its
       * association to the location, and neither touches this link — but
       * `createShippingOptionsWorkflow` and `updateShippingOptionsWorkflow` both
       * run `validateFulfillmentProvidersStep` first, which walks
       * `service_zone.fulfillment_set.locations.fulfillment_providers.id` and
       * throws `Providers (manual_manual) are not enabled for the service
       * location` when the provider is not among them. Without this record the
       * predeploy Job dies on the first shipping option on every environment,
       * and because it is an Argo CD sync hook the Application never syncs.
       */
      readonly kind: "stock-location-fulfillment-provider";
      /** `<stock location name>/<provider id>`. */
      readonly key: string;
      readonly stockLocationName: string;
      readonly providerId: string;
    }
  | {
      readonly kind: "fulfillment-set";
      readonly key: string;
      readonly name: string;
      readonly type: string;
      readonly stockLocationName: string;
    }
  | {
      readonly kind: "shipping-profile";
      readonly key: string;
      readonly name: string;
      readonly type: string;
    }
  | {
      /** The default sales channel has to reach the stock location, or no
       * shipping option is listed for a cart placed through it. */
      readonly kind: "sales-channel-stock-location";
      readonly key: string;
      readonly stockLocationName: string;
    }
  | {
      readonly kind: "service-zone";
      /** The zone name. */
      readonly key: string;
      readonly name: string;
      readonly countryCodes: readonly string[];
    }
  | {
      readonly kind: "shipping-option";
      /** `<zone name>/<option name>`. */
      readonly key: string;
      readonly zoneName: string;
      readonly optionName: string;
      readonly currency: string;
      readonly amountMinor: number;
      readonly providerId: string;
      /**
       * What Medusa stores as `shipping_option.data` and hands back to the
       * provider as `optionData` on every call — `getFulfillmentOptions`,
       * `validateFulfillmentData`, `createFulfillment`. Absent for a method no
       * carrier integration touches.
       *
       * This is not decoration. A later task's `validateFulfillmentData` guard
       * reads `optionData.id` to decide whether a cart needs a parcel machine
       * chosen before it can complete, and an option created with no `data`
       * makes that guard unable to fire — every cart would sail through
       * unvalidated, silently, because nothing here would be wrong in a way a
       * unit test that hands `optionData` in directly could see.
       */
      readonly data?: Record<string, unknown>;
    };

/** Applies one record by its natural key. Applying it twice is applying it once. */
export interface CommerceConfigurationTarget {
  apply(record: CommerceRecord): Promise<void>;
}

/**
 * The `shipping_option.data` a method's `omnivaChannel` becomes, or
 * `undefined` for a method no carrier integration touches.
 *
 * The ids come from `service.ts` — `OMNIVA_PARCEL_MACHINE_OPTION_ID` and
 * `OMNIVA_COURIER_OPTION_ID` — rather than being written again here, because
 * `getFulfillmentOptions` is what Medusa actually calls to validate a
 * `data.id` it is handed, and a second copy of that id is exactly the kind of
 * value that silently stops matching the first.
 */
function omnivaOptionData(
  omnivaChannel: ShippingMethodModel["omnivaChannel"],
): Record<string, unknown> | undefined {
  switch (omnivaChannel) {
    case "PARCEL_MACHINE":
      return { id: OMNIVA_PARCEL_MACHINE_OPTION_ID, deliveryChannel: "PARCEL_MACHINE" };
    case "COURIER":
      return { id: OMNIVA_COURIER_OPTION_ID, deliveryChannel: "COURIER" };
    case undefined:
      return undefined;
  }
}

/**
 * The configuration as records, in dependency order.
 *
 * A pure function of the frozen model: the same source produces the same
 * records, in the same order, on every run, which is what
 * `tests/commerce-configuration.test.ts` compares across two runs.
 *
 * The order is not cosmetic. A service zone needs its fulfillment set, which
 * needs its stock location; a shipping option needs its zone, the shipping
 * profile **and** the fulfillment-provider link, without which Medusa refuses
 * to create it at all; and the sales-channel link is placed before the zones so
 * that a run which fails partway has already made the location reachable. The
 * currency's tax treatment goes first because it governs how every price this
 * deployment holds is read — including the product price, which
 * `npm run seed:product` writes. The tax regions follow the region and precede
 * everything physical, so that a run interrupted after the region has already
 * put the rates behind `automatic_taxes` in place.
 */
export function commerceRecords(): readonly CommerceRecord[] {
  return [
    {
      kind: "store-currency",
      key: SHIPPING_CURRENCY,
      currencyCode: SHIPPING_CURRENCY,
      // Net prices, VAT added. Moves only together with the region's flag below.
      taxInclusivePrices: false,
    },
    {
      kind: "region",
      key: REGION_NAME,
      name: REGION_NAME,
      currencyCode: SHIPPING_CURRENCY,
      countryCodes: DELIVERABLE_COUNTRY_CODES,
      paymentProviderIds: [STRIPE_PAYMENT_PROVIDER_ID],
      // Net prices, VAT added. Moves only together with the currency's flag above.
      taxInclusivePrices: false,
      automaticTaxes: true,
    },
    ...VAT_COUNTRY_CODES.map<CommerceRecord>((countryCode) => ({
      kind: "tax-region",
      key: countryCode,
      countryCode,
      name: VAT_RATE_NAME,
      ratePercent: ESTONIAN_STANDARD_VAT_PERCENT,
      code: VAT_RATE_CODE,
      providerId: TAX_PROVIDER_ID,
    })),
    { kind: "stock-location", key: STOCK_LOCATION_NAME, name: STOCK_LOCATION_NAME },
    {
      kind: "stock-location-fulfillment-provider",
      key: `${STOCK_LOCATION_NAME}/${MANUAL_FULFILLMENT_PROVIDER_ID}`,
      stockLocationName: STOCK_LOCATION_NAME,
      providerId: MANUAL_FULFILLMENT_PROVIDER_ID,
    },
    {
      // Without this, createShippingOptionsWorkflow refuses the parcel
      // machine option with "Providers (omniva_omniva) are not enabled for
      // the service location" and the predeploy Job dies on every
      // environment — the same failure the manual link above exists to
      // avoid, for the second provider.
      kind: "stock-location-fulfillment-provider",
      key: `${STOCK_LOCATION_NAME}/${OMNIVA_FULFILLMENT_PROVIDER_ID}`,
      stockLocationName: STOCK_LOCATION_NAME,
      providerId: OMNIVA_FULFILLMENT_PROVIDER_ID,
    },
    {
      kind: "fulfillment-set",
      key: FULFILLMENT_SET_NAME,
      name: FULFILLMENT_SET_NAME,
      type: FULFILLMENT_SET_TYPE,
      stockLocationName: STOCK_LOCATION_NAME,
    },
    {
      kind: "shipping-profile",
      key: SHIPPING_PROFILE_NAME,
      name: SHIPPING_PROFILE_NAME,
      type: SHIPPING_PROFILE_TYPE,
    },
    {
      kind: "sales-channel-stock-location",
      key: STOCK_LOCATION_NAME,
      stockLocationName: STOCK_LOCATION_NAME,
    },
    ...SHIPPING_ZONES.map<CommerceRecord>((zone) => ({
      kind: "service-zone",
      key: zone.name,
      name: zone.name,
      countryCodes: zone.countryCodes,
    })),
    ...SHIPPING_ZONES.flatMap<CommerceRecord>((zone) =>
      zone.methods.map<CommerceRecord>((method) => ({
        kind: "shipping-option",
        key: `${zone.name}/${method.name}`,
        zoneName: zone.name,
        optionName: method.name,
        currency: method.currency,
        amountMinor: method.amountMinor,
        providerId: method.providerId,
        data: omnivaOptionData(method.omnivaChannel),
      })),
    ),
  ];
}

export interface CommerceConfigurationSummary {
  readonly records: number;
}

/** Applies every record once, in order, and stops at the first refusal. */
export async function configureCommerce(
  target: CommerceConfigurationTarget,
): Promise<CommerceConfigurationSummary> {
  const records = commerceRecords();
  for (const record of records) {
    await target.apply(record);
  }
  return { records: records.length };
}
