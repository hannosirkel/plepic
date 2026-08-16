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
 * ## Shipping is configured here and nowhere else
 *
 * The catalogue import used to seed the shipping zones and methods from the
 * archive's `shippingZones` section. It no longer does, and the section is
 * refused: two writers of one price is a way for the rates a buyer is charged to
 * stop being the rates the operator froze, and the export is the *old* shop's
 * shipping configuration rather than Task 1's model. `src/catalogue-import/`
 * keeps the product, its price and stock, the still-valid coupons, the tax
 * regions and the media; the zones, the methods and their two flat rates are
 * {@link ./shipping-model.js}'s.
 *
 * ## Every record is an assertion addressed by a natural key
 *
 * The same shape the catalogue import uses, for the same reason: a create-shaped
 * configuration is idempotent only if something remembers what it created, and
 * the predeploy Job is an Argo CD sync hook that runs again on **every promoted
 * digest**. A key-addressed upsert is idempotent because the second application
 * of a record is the same assertion as the first, and a run interrupted halfway
 * converges when it is run again.
 */

import { STRIPE_PAYMENT_PROVIDER_ID } from "../config/payment.js";
import {
  DELIVERABLE_COUNTRY_CODES,
  SHIPPING_CURRENCY,
  SHIPPING_ZONES,
} from "./shipping-model.js";

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

/** The fulfillment set the two service zones hang off. */
export const FULFILLMENT_SET_NAME = "Plepic Games delivery";
export const FULFILLMENT_SET_TYPE = "shipping";

/** The shipping profile the single product and both shipping options share. */
export const SHIPPING_PROFILE_NAME = "Default";
export const SHIPPING_PROFILE_TYPE = "default";

/**
 * The fulfillment provider both options are served by.
 *
 * `manual_manual` is `@medusajs/medusa/fulfillment-manual`, which `defineConfig`
 * registers by default. It is the correct provider for a flat rate: it quotes
 * nothing and calls nothing, which is precisely what ADR `020` chose over a
 * carrier interface.
 */
export const FULFILLMENT_PROVIDER_ID = "manual_manual";

export type CommerceRecord =
  | {
      readonly kind: "region";
      readonly key: string;
      readonly name: string;
      readonly currencyCode: string;
      readonly countryCodes: readonly string[];
      readonly paymentProviderIds: readonly string[];
      /**
       * Whether the advertised price contains the tax rather than having it
       * added. `content/legal/shipping.ts` says "Included means contained within
       * that figure rather than added to it", and this is the switch that makes
       * that sentence true of what Medusa actually computes.
       */
      readonly taxInclusivePrices: boolean;
      /**
       * Whether Medusa applies the destination's tax region automatically. With
       * tax-inclusive prices this changes the *tax portion* of a total and never
       * the total, which is the other half of the same promise.
       */
      readonly automaticTaxes: boolean;
    }
  | { readonly kind: "stock-location"; readonly key: string; readonly name: string }
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
    };

/** Applies one record by its natural key. Applying it twice is applying it once. */
export interface CommerceConfigurationTarget {
  apply(record: CommerceRecord): Promise<void>;
}

/**
 * The configuration as records, in dependency order.
 *
 * A pure function of the frozen model: the same source produces the same
 * records, in the same order, on every run, which is what
 * `tests/commerce-configuration.test.ts` compares across two runs.
 *
 * The order is not cosmetic. A service zone needs its fulfillment set, which
 * needs its stock location; a shipping option needs its zone and the shipping
 * profile; and the sales-channel link is placed before the zones so that a run
 * which fails partway has already made the location reachable.
 */
export function commerceRecords(): readonly CommerceRecord[] {
  return [
    {
      kind: "region",
      key: REGION_NAME,
      name: REGION_NAME,
      currencyCode: SHIPPING_CURRENCY,
      countryCodes: DELIVERABLE_COUNTRY_CODES,
      paymentProviderIds: [STRIPE_PAYMENT_PROVIDER_ID],
      taxInclusivePrices: true,
      automaticTaxes: true,
    },
    { kind: "stock-location", key: STOCK_LOCATION_NAME, name: STOCK_LOCATION_NAME },
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
    ...SHIPPING_ZONES.map<CommerceRecord>((zone) => ({
      kind: "shipping-option",
      key: `${zone.name}/${zone.optionName}`,
      zoneName: zone.name,
      optionName: zone.optionName,
      currency: zone.currency,
      amountMinor: zone.amountMinor,
      providerId: FULFILLMENT_PROVIDER_ID,
    })),
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
