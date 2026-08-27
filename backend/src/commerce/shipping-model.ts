/**
 * The shipping model Task 1 froze, declared here and nowhere else.
 *
 * **Worldwide delivery, three zones, two flat rates, one free method, no
 * excluded country.** EUR 7.00 to a delivery address in an EU **member
 * state**, EUR 12.00 to one anywhere else — that was the whole commercial
 * model until 2026-08-26, when the operator added a second, free method for
 * Estonia, Latvia and Lithuania: an Omniva parcel machine, offered alongside
 * Standard delivery rather than instead of it. Those three countries therefore
 * move into a service zone of their own, still charged the same EUR 7.00
 * standard rate as the rest of the Union. None of this is derived from a
 * WooCommerce export: the old shop's zones are the old shop's, and an export
 * that happened to carry different figures or a different country set would
 * otherwise silently reprice every order the new site takes.
 *
 * ## What is deliberately absent
 *
 * There is **no free method anywhere but Estonia, Latvia and Lithuania**. The
 * plan's checkbox once read "flat and free shipping" and the operator's first
 * decision replaced that with two flat rates and nothing else; the free method
 * introduced here is a second, later and narrower decision, not a reversion to
 * the checkbox, and it is asserted in `tests/commerce-shipping-model.test.ts`
 * as exactly that: free in one zone, and nowhere else.
 *
 * There is **no carrier interface, quote cache or fallback contract** — ADR
 * `020` records why. Both rates are stored `flat` prices on the shipping option,
 * so nothing is fetched, nothing can time out, and there is no second figure a
 * fallback could produce.
 *
 * There is **no weight band and no rate table**. The single product is 300 g in
 * a 12 x 12 x 4 cm box — {@link ./product-model.js} is where that is declared,
 * and this sentence said 200 g until 2026-08-18 without anything going red,
 * precisely because no rate here depends on it: the figure a buyer is charged is
 * a function of the destination zone alone.
 *
 * ## "EU member state" is narrower than "in the EU", and the difference is paid for
 *
 * {@link EU_MEMBER_STATE_CODES} is exactly the 27 member states. Åland, French
 * Guiana, Guadeloupe, Martinique, Réunion and Mayotte are territories *of* a
 * member state rather than member states, and they are charged the rest-of-world
 * rate. `storefront/mock/countries.json` draws the same line with its `euMember`
 * flag, and `tests/commerce-shipping-model.test.ts` holds the two lists to it in
 * both directions — a zone this file assigns differently from the country the
 * checkout offers is an order priced by one surface and charged by another.
 *
 * **A service zone is not the VAT boundary, and EE/LV/LT moving zones does not
 * move it.** Estonia, Latvia and Lithuania leave the `European Union` delivery
 * zone for their own on 2026-08-26, but they do not leave
 * {@link EU_MEMBER_STATE_CODES} — that list, and `VAT_COUNTRY_CODES` in
 * {@link ./tax-model.js}, both stay at 27. `storefront/src/lib/cart.ts`'s
 * `ShippingZone` union is the mock layer's VAT classifier and is untouched by
 * this file for the same reason: which zone sells a buyer their delivery
 * method and which VAT rate they pay are two different questions, and this
 * model answers only the first one.
 *
 * ## Where the country list comes from
 *
 * From Medusa's own `defaultCountries`, not from a list written here. The
 * rest-of-world zone has to be *enumerated* — a Medusa service zone is a set of
 * geo zones and there is no "everywhere else" geo zone — and the only list that
 * cannot disagree with the country codes Medusa will accept on a shipping
 * address is the one Medusa ships. It is a superset of the 249 entries the
 * storefront offers (it adds `XK`, which is user-assigned rather than officially
 * assigned ISO 3166-1), which is the right direction for the containment to run:
 * every address the checkout can produce falls in a zone.
 */

import { defaultCountries } from "@medusajs/framework/utils";

/** One advertised price worldwide, and one currency to charge shipping in. */
export const SHIPPING_CURRENCY = "EUR";

/** The one delivery method offered in every zone. */
export const SHIPPING_OPTION_NAME = "Standard delivery";

/** The second method, offered to three countries and priced at nothing. */
export const PARCEL_MACHINE_OPTION_NAME = "Omniva parcel machine";

export const PARCEL_MACHINE_ZONE_NAME = "Estonia, Latvia and Lithuania";
export const EUROPEAN_UNION_ZONE_NAME = "European Union";
export const REST_OF_WORLD_ZONE_NAME = "Rest of world";

/** Operator-frozen, 2026-08-10. Minor units. */
export const EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR = 700;
/** Operator-frozen, 2026-08-10. Minor units. */
export const REST_OF_WORLD_SHIPPING_AMOUNT_MINOR = 1200;
/** Operator-frozen, 2026-08-26. Minor units. Free is free before tax and after. */
export const PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR = 0;

/**
 * The 27 EU member states, ISO 3166-1 alpha-2, sorted.
 *
 * Membership and nothing wider — not the VAT territory and not the customs
 * territory. Do not add a 28th without an accession.
 */
export const EU_MEMBER_STATE_CODES: readonly string[] = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI",
  "SK",
];

const EU_MEMBER_STATE_SET: ReadonlySet<string> = new Set(EU_MEMBER_STATE_CODES);

/**
 * The three countries Omniva serves with parcel machines, ISO 3166-1 alpha-2,
 * sorted.
 *
 * Deliberately **not** named after a region. It is three countries, it is the
 * set OMX makes `deliveryChannel` mandatory for, and it is the set
 * `locations.json` carries parcel machines in. A regional name would invite a
 * fourth member on grounds this list does not have.
 *
 * Every one of them is also an EU member state. That is asserted in
 * `tests/commerce-shipping-model.test.ts`, because the day it stops being true
 * is the day the VAT treatment and the delivery zone stop agreeing.
 */
export const PARCEL_MACHINE_COUNTRY_CODES: readonly string[] = ["EE", "LT", "LV"];

const PARCEL_MACHINE_COUNTRY_SET: ReadonlySet<string> = new Set(PARCEL_MACHINE_COUNTRY_CODES);

/**
 * The fulfillment provider the three manual-rate methods are served by — the
 * three `Standard delivery` options, not the Omniva parcel machine.
 *
 * `manual_manual` is `@medusajs/medusa/fulfillment-manual`, registered
 * alongside Omniva in `medusa-config.ts`. It is the correct provider for a
 * flat rate: it quotes nothing and calls nothing, which is precisely what ADR
 * `020` chose over a carrier interface — and it is not true of the parcel
 * machine method, which {@link OMNIVA_FULFILLMENT_PROVIDER_ID} serves
 * instead.
 *
 * Declared here rather than in `configuration.ts`, alongside
 * {@link OMNIVA_FULFILLMENT_PROVIDER_ID}: this is the file that names each
 * method's provider, so it is the one place a reader's editor actually shows
 * this reasoning on hover — a JSDoc block on `configuration.ts`'s
 * `export { MANUAL_FULFILLMENT_PROVIDER_ID } from "./shipping-model.js"` is
 * not what TypeScript surfaces there, so that used to be a second,
 * shorter, wrong-by-omission copy of this comment that nobody would read.
 */
export const MANUAL_FULFILLMENT_PROVIDER_ID = "manual_manual";

/**
 * The Omniva provider's Medusa id: the service's `identifier` and the id it is
 * registered under in `medusa-config.ts`, joined. Declared here because the
 * shipping model names it and `medusa-config.ts` must register it to match.
 */
export const OMNIVA_FULFILLMENT_PROVIDER_ID = "omniva_omniva";

/**
 * Every country a parcel may be addressed to, sorted — Medusa's own list.
 *
 * `content/legal/shipping.ts` says "We ship to every country", so this is every
 * country Medusa knows rather than a subset somebody chose. Narrowing it is a
 * commercial decision the operator has not made, and a country missing from here
 * is a delivery address the checkout offers and Medusa answers with no shipping
 * option at all.
 */
export const DELIVERABLE_COUNTRY_CODES: readonly string[] = defaultCountries
  .map((country) => country.alpha2.toUpperCase())
  .sort((left, right) => left.localeCompare(right));

const REST_OF_WORLD_COUNTRY_CODES: readonly string[] = DELIVERABLE_COUNTRY_CODES.filter(
  (code) => !EU_MEMBER_STATE_SET.has(code),
);

/** One delivery method a zone sells. */
export interface ShippingMethodModel {
  /** What the Admin shows, and the natural key the upsert addresses it by. */
  readonly name: string;
  readonly currency: string;
  /** Minor units. A flat price; never a band, a table or a quote. */
  readonly amountMinor: number;
  readonly providerId: string;
  /**
   * The OMX `deliveryChannel` this method registers as, for methods the Omniva
   * provider serves. Absent on a method no carrier integration touches, which
   * is what makes "is this an Omniva method" a property of the model rather
   * than a string comparison on the name.
   */
  readonly omnivaChannel?: "PARCEL_MACHINE" | "COURIER";
}

export interface ShippingZoneModel {
  /** The service zone's name, and the natural key every upsert addresses it by. */
  readonly name: string;
  readonly countryCodes: readonly string[];
  /**
   * The methods this zone sells, in the order they are declared and applied.
   *
   * A list rather than a single method since 2026-08-26, when EE, LV and LT
   * gained a second one. A zone with two methods is two rows in
   * `shipping_option`, keyed by name within the zone.
   */
  readonly methods: readonly ShippingMethodModel[];
}

const STANDARD_EUROPEAN_UNION_METHOD: ShippingMethodModel = {
  name: SHIPPING_OPTION_NAME,
  currency: SHIPPING_CURRENCY,
  amountMinor: EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR,
  providerId: MANUAL_FULFILLMENT_PROVIDER_ID,
};

/**
 * The three zones, in the order they are declared and applied.
 *
 * A country appears in exactly one of them, and every country appears in one —
 * asserted, because "no excluded country" is a commitment on the legal page
 * rather than a property anyone can see by reading three arrays.
 */
export const SHIPPING_ZONES: readonly ShippingZoneModel[] = [
  {
    name: PARCEL_MACHINE_ZONE_NAME,
    countryCodes: PARCEL_MACHINE_COUNTRY_CODES,
    methods: [
      STANDARD_EUROPEAN_UNION_METHOD,
      {
        name: PARCEL_MACHINE_OPTION_NAME,
        currency: SHIPPING_CURRENCY,
        amountMinor: PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR,
        providerId: OMNIVA_FULFILLMENT_PROVIDER_ID,
        omnivaChannel: "PARCEL_MACHINE",
      },
    ],
  },
  {
    name: EUROPEAN_UNION_ZONE_NAME,
    countryCodes: EU_MEMBER_STATE_CODES.filter((code) => !PARCEL_MACHINE_COUNTRY_SET.has(code)),
    methods: [STANDARD_EUROPEAN_UNION_METHOD],
  },
  {
    name: REST_OF_WORLD_ZONE_NAME,
    countryCodes: REST_OF_WORLD_COUNTRY_CODES,
    methods: [
      {
        name: SHIPPING_OPTION_NAME,
        currency: SHIPPING_CURRENCY,
        amountMinor: REST_OF_WORLD_SHIPPING_AMOUNT_MINOR,
        providerId: MANUAL_FULFILLMENT_PROVIDER_ID,
      },
    ],
  },
];

/**
 * The zone a delivery address falls in, or `null` when the code is not one this
 * model knows.
 *
 * **It never guesses and never falls back to the dearer rate.** The country code
 * reaching it comes from a selection over a fixed list; anything else is a value
 * no form could have produced, and the honest answer is "no zone" — which leaves
 * the order unpriced rather than charging somebody five euro more on a string
 * nobody recognises. `storefront/src/lib/cart.ts`'s `zoneForCountryName` takes
 * the same position on the same decision.
 */
export function shippingZoneForCountry(countryCode: string): ShippingZoneModel | null {
  const code = countryCode.trim().toUpperCase();
  if (code.length === 0) return null;
  return SHIPPING_ZONES.find((zone) => zone.countryCodes.includes(code)) ?? null;
}

/**
 * The flat charge for **standard delivery** to a destination, in minor units,
 * or `null` for no zone.
 *
 * Deliberately not "the cheapest method". EE, LV and LT can be delivered to for
 * nothing via a parcel machine, but that is a method the buyer chooses, not the
 * price of delivering to Estonia — and every caller of this function wants the
 * figure the basket quotes before any method is picked.
 *
 * This is the only figure this file knows. There is deliberately **no**
 * `orderTotalMinorForCountry` here: the total a buyer is presented with before
 * payment is computed by Medusa from the prices, the tax lines and the
 * currency's tax-inclusivity preference, and a `goods + shipping` helper next
 * to the constants it adds would restate two numbers rather than check any.
 * `tests/commerce-medusa-semantics.test.ts` asserts that total by running
 * Medusa's own totals code over the configuration this repository declares,
 * which is the only way the assertion can be wrong when the configuration is.
 */
export function shippingAmountMinorForCountry(countryCode: string): number | null {
  const zone = shippingZoneForCountry(countryCode);
  if (zone === null) return null;
  const standard = zone.methods.find((method) => method.name === SHIPPING_OPTION_NAME);
  return standard?.amountMinor ?? null;
}
