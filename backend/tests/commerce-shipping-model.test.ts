import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DELIVERABLE_COUNTRY_CODES,
  EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR,
  EU_MEMBER_STATE_CODES,
  PARCEL_MACHINE_COUNTRY_CODES,
  PARCEL_MACHINE_OPTION_NAME,
  PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR,
  REST_OF_WORLD_SHIPPING_AMOUNT_MINOR,
  SHIPPING_CURRENCY,
  SHIPPING_ZONES,
  shippingAmountMinorForCountry,
  shippingZoneForCountry,
} from "../src/commerce/shipping-model.js";
import { ESTONIAN_STANDARD_VAT_PERCENT } from "../src/commerce/tax-model.js";

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
 *
 * **Both of those figures are history rather than the current model.** The
 * operator has since settled EUR 25.00 as a *net* price with Estonian VAT added
 * on an EU destination, so an EU cart now totals EUR 39.68 and a rest-of-world
 * cart EUR 37.00. The two flat shipping rates asserted below are unchanged by
 * that — they are net figures too, and the destination zone is still the only
 * thing that selects between them.
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
    readonly ratesWithTax: { readonly europeanUnion: number; readonly restOfWorld: number };
  };
  readonly parcelMachine: {
    readonly name: string;
    readonly rate: number;
    readonly countries: readonly string[];
  };
}

describe("the frozen shipping model", () => {
  it("declares three zones, and the flat rates the operator froze", () => {
    expect(SHIPPING_CURRENCY).toBe("EUR");
    expect(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR).toBe(700);
    expect(REST_OF_WORLD_SHIPPING_AMOUNT_MINOR).toBe(1200);
    expect(PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR).toBe(0);
    expect(SHIPPING_ZONES.map((zone) => zone.name)).toEqual([
      "Estonia, Latvia and Lithuania",
      "European Union",
      "Rest of world",
    ]);
    for (const zone of SHIPPING_ZONES) {
      for (const method of zone.methods) {
        expect(method.currency, `${zone.name}/${method.name}`).toBe("EUR");
      }
    }
  });

  /**
   * The free method exists in exactly one zone, and the operator's decision to
   * introduce it does not leak into the other two. The old assertion here said
   * no zone had a free method at all; that decision was reversed on 2026-08-26
   * for EE, LV and LT only, and this is that reversal stated narrowly.
   */
  it("offers the free method only to Estonia, Latvia and Lithuania", () => {
    const free = SHIPPING_ZONES.filter((zone) =>
      zone.methods.some((method) => method.amountMinor === 0),
    );
    expect(free.map((zone) => zone.name)).toEqual(["Estonia, Latvia and Lithuania"]);

    for (const zone of SHIPPING_ZONES) {
      const standard = zone.methods.find((method) => method.name === "Standard delivery");
      expect(standard?.amountMinor, zone.name).toBeGreaterThan(0);
    }
  });

  it("sells one standard method everywhere, and a second method in one zone", () => {
    const keys = SHIPPING_ZONES.flatMap((zone) =>
      zone.methods.map((method) => `${zone.name}/${method.name}`),
    );
    expect(keys).toEqual([
      "Estonia, Latvia and Lithuania/Standard delivery",
      "Estonia, Latvia and Lithuania/Omniva parcel machine",
      "European Union/Standard delivery",
      "Rest of world/Standard delivery",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("serves the parcel machine method through the Omniva provider and nothing else", () => {
    for (const zone of SHIPPING_ZONES) {
      for (const method of zone.methods) {
        const omniva = method.name === PARCEL_MACHINE_OPTION_NAME;
        expect(method.providerId, `${zone.name}/${method.name}`).toBe(
          omniva ? "omniva_omniva" : "manual_manual",
        );
        expect(method.omnivaChannel, `${zone.name}/${method.name}`).toBe(
          omniva ? "PARCEL_MACHINE" : undefined,
        );
      }
    }
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
      const expected = PARCEL_MACHINE_COUNTRY_CODES.includes(country.code)
        ? "Estonia, Latvia and Lithuania"
        : country.euMember
          ? "European Union"
          : "Rest of world";
      expect(zone?.name, `${country.name} (${country.code}) is in the wrong zone`).toBe(expected);
    }

    // The VAT boundary has NOT moved. EE, LV and LT buy delivery from their own
    // service zone and are still EU member states for tax.
    const euMembers = offered.filter((country) => country.euMember).map((country) => country.code);
    expect([...euMembers].sort()).toEqual([...EU_MEMBER_STATE_CODES].sort());
    for (const code of PARCEL_MACHINE_COUNTRY_CODES) {
      expect(EU_MEMBER_STATE_CODES, code).toContain(code);
    }
  });

  it("still charges the standard rate the checkout's own rate file declares", () => {
    const { method } = storefrontJson<StorefrontShipping>("mock/shipping.json");
    expect(method.currency).toBe(SHIPPING_CURRENCY);
    expect(method.rates.europeanUnion).toBe(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR);
    expect(method.rates.restOfWorld).toBe(REST_OF_WORLD_SHIPPING_AMOUNT_MINOR);
    // EE, LV and LT pay the same standard rate as the rest of the EU. The
    // basket's estimate quotes standard delivery, so `method` stays the one
    // the basket prices against.
    expect(shippingAmountMinorForCountry("EE")).toBe(EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR);
  });

  /**
   * **The one string that crosses the boundary, held to one writer.**
   *
   * The storefront cannot import this model — it reads Medusa's option list,
   * which carries the option's *display name* and not its provider id, so
   * `isParcelMachineOption` compares names. That is a second copy of a value
   * this file declares, and a second copy nothing compares is how a renamed
   * option silently stops being recognised as the parcel machine method: the
   * `<select>` would render it, the machine picker would never appear, and the
   * order would be placed against an option with no machine chosen.
   *
   * So the name is written once into `mock/shipping.json` — the file this suite
   * already reads for the rates — and both sides read it from there.
   */
  it("names the parcel machine method the same as the checkout does", () => {
    const { parcelMachine } = storefrontJson<StorefrontShipping>("mock/shipping.json");
    expect(parcelMachine.name).toBe(PARCEL_MACHINE_OPTION_NAME);
    expect(parcelMachine.rate).toBe(PARCEL_MACHINE_SHIPPING_AMOUNT_MINOR);
    expect(parcelMachine.rate).toBe(0);
    expect(parcelMachine.countries).toEqual([...PARCEL_MACHINE_COUNTRY_CODES]);
  });

  /**
   * **The grossed figures the checkout actually charges, derived rather than
   * trusted.**
   *
   * `mock/shipping.json` declares each zone's rate twice — before tax and with
   * it — because the storefront may not apply a rate and therefore cannot
   * compute the second from the first. That makes the grossed pair *data*, and
   * data with nothing behind it is exactly what this file exists to prevent.
   * So the multiplication happens **here**, on the side of the boundary where
   * the rate is declared.
   *
   * The rest-of-world figures are equal on purpose: no EU VAT arises on an
   * export, so the charged figure and the quoted rate are the same number. It
   * is asserted rather than skipped, because "the same" and "forgotten" look
   * identical in a JSON file.
   */
  it("grosses the EU rate at the declared VAT percentage and leaves the export rate alone", () => {
    const { method } = storefrontJson<StorefrontShipping>("mock/shipping.json");

    expect(method.ratesWithTax.europeanUnion).toBe(
      Math.round(
        EUROPEAN_UNION_SHIPPING_AMOUNT_MINOR * (1 + ESTONIAN_STANDARD_VAT_PERCENT / 100),
      ),
    );
    expect(method.ratesWithTax.restOfWorld).toBe(REST_OF_WORLD_SHIPPING_AMOUNT_MINOR);
    expect(method.ratesWithTax.europeanUnion).toBeGreaterThan(method.rates.europeanUnion);
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
