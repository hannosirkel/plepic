/**
 * The shipping model Task 1 froze, declared here and nowhere else.
 *
 * **Worldwide delivery, two flat rates, no free method, no excluded country.**
 * EUR 7.00 to a delivery address in an EU **member state**, EUR 12.00 to one
 * anywhere else. That is the whole commercial model, and it is a *declaration*
 * rather than something derived from a WooCommerce export: the old shop's zones
 * are the old shop's, and an export that happened to carry different figures
 * would otherwise silently reprice every order the new site takes.
 *
 * ## What is deliberately absent
 *
 * There is **no free-shipping method**. The plan's checkbox says "flat and free
 * shipping"; the operator's later decision replaced that with two flat rates and
 * nothing else, and inventing a zero-priced method to satisfy the older wording
 * would put a delivery option on the checkout that nobody has agreed to sell.
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

/** The one delivery method offered in either zone. */
export const SHIPPING_OPTION_NAME = "Standard delivery";

export const EUROPEAN_UNION_ZONE_NAME = "European Union";
export const REST_OF_WORLD_ZONE_NAME = "Rest of world";

/** Operator-frozen, 2026-08-10. Minor units. */
export const EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR = 700;
/** Operator-frozen, 2026-08-10. Minor units. */
export const REST_OF_WORLD_SHIPPING_AMOUNT_MINOR = 1200;

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

export interface ShippingZoneModel {
  /** The service zone's name, and the natural key every upsert addresses it by. */
  readonly name: string;
  readonly countryCodes: readonly string[];
  readonly optionName: string;
  readonly currency: string;
  /** Minor units. A flat price; never a band, a table or a quote. */
  readonly amountMinor: number;
}

/**
 * The two zones, in the order they are declared and applied.
 *
 * A country appears in exactly one of them, and every country appears in one —
 * asserted, because "no excluded country" is a commitment on the legal page
 * rather than a property anyone can see by reading two arrays.
 */
export const SHIPPING_ZONES: readonly ShippingZoneModel[] = [
  {
    name: EUROPEAN_UNION_ZONE_NAME,
    countryCodes: EU_MEMBER_STATE_CODES,
    optionName: SHIPPING_OPTION_NAME,
    currency: SHIPPING_CURRENCY,
    amountMinor: EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR,
  },
  {
    name: REST_OF_WORLD_ZONE_NAME,
    countryCodes: REST_OF_WORLD_COUNTRY_CODES,
    optionName: SHIPPING_OPTION_NAME,
    currency: SHIPPING_CURRENCY,
    amountMinor: REST_OF_WORLD_SHIPPING_AMOUNT_MINOR,
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
 * The flat charge for a destination, in minor units, or `null` for no zone.
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
  return shippingZoneForCountry(countryCode)?.amountMinor ?? null;
}
