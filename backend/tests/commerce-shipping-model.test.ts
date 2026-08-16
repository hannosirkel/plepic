import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DELIVERABLE_COUNTRY_CODES,
  EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR,
  EU_MEMBER_STATE_CODES,
  REST_OF_WORLD_SHIPPING_AMOUNT_MINOR,
  SHIPPING_CURRENCY,
  SHIPPING_ZONES,
  shippingAmountMinorForCountry,
  shippingZoneForCountry,
} from "../src/commerce/shipping-model.js";

/**
 * The commercial model Task 1 froze, held to the figures the operator froze it
 * with and to the two surfaces that state them to a buyer.
 *
 * The **total** a buyer is presented with before payment is not asserted here.
 * It used to be, against a `goods + shipping` helper in the module under test,
 * which restated two constants declared a hundred lines above and went green
 * while the shop as configured would have presented EUR 39.04 for the EUR 32.00
 * it claimed. It now lives in `commerce-medusa-semantics.test.ts`, computed by
 * Medusa's own totals code from the configuration this repository declares.
 */

function storefrontJson<T>(relative: string): T {
  return JSON.parse(
    readFileSync(join(__dirname, "..", "..", "storefront", relative), "utf8"),
  ) as T;
}

interface StorefrontCountries {
  readonly countries: readonly { readonly code: string; readonly name: string; readonly euMember: boolean }[];
}

interface StorefrontShipping {
  readonly method: {
    readonly currency: string;
    readonly rates: { readonly europeanUnion: number; readonly restOfWorld: number };
  };
}

describe("the frozen shipping model", () => {
  it("declares two flat rates in EUR and nothing else", () => {
    expect(SHIPPING_CURRENCY).toBe("EUR");
    expect(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR).toBe(700);
    expect(REST_OF_WORLD_SHIPPING_AMOUNT_MINOR).toBe(1200);
    expect(SHIPPING_ZONES).toHaveLength(2);
    expect(SHIPPING_ZONES.map((zone) => zone.name)).toEqual([
      "European Union",
      "Rest of world",
    ]);
    for (const zone of SHIPPING_ZONES) {
      expect(zone.currency, zone.name).toBe("EUR");
      expect(zone.optionName, zone.name).toBe("Standard delivery");
    }
  });

  /**
   * The plan's checkbox says "flat and free shipping"; the operator's later
   * decision replaced that with two flat rates and **no free method**. A
   * zero-priced option would be a delivery offer nobody agreed to sell, so its
   * absence is asserted rather than merely left out.
   */
  it("offers no free shipping method, in either zone", () => {
    for (const zone of SHIPPING_ZONES) {
      expect(zone.amountMinor, zone.name).toBeGreaterThan(0);
    }
    expect(SHIPPING_ZONES.filter((zone) => zone.amountMinor === 0)).toEqual([]);
  });

  it("offers exactly one method per zone — no rate table, no weight band", () => {
    const options = SHIPPING_ZONES.map((zone) => `${zone.name}/${zone.optionName}`);
    expect(options).toHaveLength(2);
    expect(new Set(options).size).toBe(2);
  });

  it("pins the 27 EU member states, and only those", () => {
    expect(EU_MEMBER_STATE_CODES).toHaveLength(27);
    expect([...EU_MEMBER_STATE_CODES].sort()).toEqual([...EU_MEMBER_STATE_CODES]);
    expect(EU_MEMBER_STATE_CODES).toEqual([
      "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR",
      "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
      "SE", "SI", "SK",
    ]);
    // Territories of a member state are not member states, and are charged the
    // rest-of-world rate. This is the judgment `storefront/mock/countries.json`
    // records, restated where the price is decided.
    for (const territory of ["AX", "GF", "GP", "MQ", "RE", "YT"]) {
      expect(EU_MEMBER_STATE_CODES, territory).not.toContain(territory);
    }
  });

  /**
   * "We ship to every country" is a statement on `/legal/shipping`. A country in
   * no zone is a delivery address the checkout offers and Medusa answers with no
   * shipping option at all; a country in two is one address with two prices.
   */
  it("puts every deliverable country in exactly one zone", () => {
    expect(DELIVERABLE_COUNTRY_CODES.length).toBeGreaterThan(240);

    for (const code of DELIVERABLE_COUNTRY_CODES) {
      const zones = SHIPPING_ZONES.filter((zone) => zone.countryCodes.includes(code));
      expect(zones.map((zone) => zone.name), code).toHaveLength(1);
    }

    const covered = SHIPPING_ZONES.flatMap((zone) => [...zone.countryCodes]);
    expect(covered.length).toBe(DELIVERABLE_COUNTRY_CODES.length);
    expect([...covered].sort()).toEqual([...DELIVERABLE_COUNTRY_CODES].sort());
  });

  /**
   * There is **no excluded country**. The checkbox this model implements says to
   * test "an excluded one"; the operator's later decision is worldwide delivery
   * with no exclusions, so the case is asserted as an absence rather than
   * deleted — if an exclusion is ever introduced, this goes red.
   */
  it("excludes no country from delivery", () => {
    const unzoned = DELIVERABLE_COUNTRY_CODES.filter(
      (code) => shippingZoneForCountry(code) === null,
    );
    expect(unzoned).toEqual([]);
  });

  it("agrees with the country list the checkout offers, in both directions", () => {
    const offered = storefrontJson<StorefrontCountries>("mock/countries.json").countries;
    expect(offered.length).toBeGreaterThan(240);

    for (const country of offered) {
      const zone = shippingZoneForCountry(country.code);
      expect(zone?.name, `${country.name} (${country.code}) has no zone`).toBeTypeOf("string");
      expect(zone?.name, `${country.name} (${country.code}) is in the wrong zone`).toBe(
        country.euMember ? "European Union" : "Rest of world",
      );
    }

    const euMembers = offered.filter((country) => country.euMember).map((country) => country.code);
    expect([...euMembers].sort()).toEqual([...EU_MEMBER_STATE_CODES].sort());
  });

  it("charges the same two figures the checkout's own rate file declares", () => {
    const { method } = storefrontJson<StorefrontShipping>("mock/shipping.json");
    expect(method.currency).toBe(SHIPPING_CURRENCY);
    expect(method.rates.europeanUnion).toBe(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR);
    expect(method.rates.restOfWorld).toBe(REST_OF_WORLD_SHIPPING_AMOUNT_MINOR);
  });

  it("never guesses a zone, and never falls back to the dearer rate", () => {
    expect(shippingZoneForCountry("ZZ")).toBeNull();
    expect(shippingZoneForCountry("")).toBeNull();
    expect(shippingZoneForCountry("Estonia")).toBeNull();
    expect(shippingAmountMinorForCountry("ZZ")).toBeNull();
  });

  it("reads a country code in either case, because ISO codes arrive both ways", () => {
    expect(shippingAmountMinorForCountry("ee")).toBe(700);
    expect(shippingAmountMinorForCountry("EE")).toBe(700);
    expect(shippingAmountMinorForCountry(" us ")).toBe(1200);
  });
});
