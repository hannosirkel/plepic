/**
 * The destination a visitor is quoted for: how it is chosen, and what it is
 * called in each published edition.
 *
 * ## The country names are pinned because a wrong one is silent
 *
 * `src/lib/destination.ts` asks ICU for the edition's name for a country, and
 * an earlier revision of its doc comment described a failure mode ICU does not
 * have — it claimed a runtime without data answers with the country **code**,
 * and guarded against that. It does not: `Intl.DisplayNames` falls back to the
 * default locale and answers in **English**, so an Estonian legal page would
 * read *"…sihtkohta Estonia"* with nothing failing anywhere. The guard could
 * not fire, and the comment asserting it could cited this file, which did not
 * exist.
 *
 * It exists now, and it checks the thing that actually goes wrong: the names
 * the qualification is built from, in the edition it is built for.
 */
import { describe, expect, it } from "vitest";

import { LOCALES } from "../../content/routes.js";
import {
  DEFAULT_DESTINATION_CODE,
  VAT_PRICING_COUNTRY_CODE,
  defaultDestination,
  deliveryCountries,
  destinationForCode,
  destinationForCountryName,
  destinationNameIn,
  knownDestinationForCode,
} from "../src/lib/destination.js";

/**
 * The names that carry the qualification on a legal page, in the edition that
 * page is served in.
 *
 * The default destination, because that is what an untouched visit renders,
 * and Estonia, because it is the VAT country and the one an EU reader is most
 * likely to pick. Written out rather than derived: deriving them from ICU is
 * asserting ICU against itself.
 */
const ESTONIAN_NAMES: Readonly<Record<string, string>> = {
  US: "Ameerika Ühendriigid",
  EE: "Eesti",
  DE: "Saksamaa",
  FR: "Prantsusmaa",
};

describe("the destination a price is quoted for", () => {
  it("defaults to the operator's declared destination, which the country list offers", () => {
    expect(defaultDestination.code).toBe(DEFAULT_DESTINATION_CODE);
    expect(defaultDestination.euMember, "the default attracts VAT").toBe(false);
    expect(deliveryCountries).toContainEqual(defaultDestination);
  });

  /**
   * The cookie is total and the order is strict, and the difference is about
   * where the code came from. A cookie may have been mangled by a browser or an
   * extension, and the declared default is stated beside the figure; a country
   * code off a confirmed order is what somebody is being charged against, and
   * defaulting an unrecognised one would put "No VAT added" over a taxed order.
   */
  it("falls back for a cookie it does not know and refuses for an order it does not know", () => {
    for (const value of ["ZZ", "", "  ", null, undefined]) {
      expect(destinationForCode(value), String(value)).toEqual(defaultDestination);
      expect(knownDestinationForCode(value), String(value)).toBeNull();
    }
    expect(destinationForCode("ee")).toEqual(knownDestinationForCode("EE"));
  });

  it("matches a country name exactly, because a lookup that repairs can repair wrongly", () => {
    expect(destinationForCountryName("Estonia")?.code).toBe("EE");
    for (const near of ["estonia", " Estonia", "Estonai", "EE"]) {
      expect(destinationForCountryName(near), near).toBeNull();
    }
  });

  /**
   * The catalogue is priced in a country that is actually in the EU, or the
   * "gross" figure every page states would silently be the net one. The module
   * refuses at import; this states the same fact where a reader will find it.
   */
  it("prices the catalogue in an EU member state", () => {
    expect(knownDestinationForCode(VAT_PRICING_COUNTRY_CODE)?.euMember).toBe(true);
  });
});

describe("what a destination is called in each edition", () => {
  it("leaves the default edition's names exactly as the country list holds them", () => {
    for (const country of deliveryCountries.slice(0, 40)) {
      expect(destinationNameIn(country, "en")).toBe(country.name);
    }
  });

  /**
   * **The pin the qualification depends on.** These are the names that end up
   * inside the emphasised first line of an approved Estonian legal page, so a
   * runtime whose ICU cannot produce them is a runtime that serves an English
   * sentence there.
   */
  it("translates the names the Estonian legal page is built from", () => {
    for (const [code, expected] of Object.entries(ESTONIAN_NAMES)) {
      const destination = knownDestinationForCode(code);
      expect(destination, code).not.toBeNull();
      expect(destinationNameIn(destination!, "et"), code).toBe(expected);
    }
  });

  /**
   * And it translates the **whole list**, not the handful anybody would have
   * hand-written — which is the argument for using ICU rather than a table of
   * the 27 member states with an English fallback for everywhere else.
   *
   * The threshold is half rather than all, because a large minority of country
   * names are genuinely identical in the two languages (Andorra, Angola,
   * Bahrein… ) and requiring a difference there would be requiring a
   * translation to be wrong. Measured: 163 of 249 differ. Half is the level
   * that distinguishes "ICU is translating" from "ICU answered in English for
   * everything", which is the failure this exists to catch.
   */
  it("translates the whole list rather than a curated subset", () => {
    const translated = deliveryCountries.filter(
      (country) => destinationNameIn(country, "et") !== country.name,
    );
    expect(translated.length).toBeGreaterThan(deliveryCountries.length / 2);
  });

  /**
   * The fallback is the **English name**, never a bare code.
   *
   * This is the claim the old guard got backwards. An edition ICU has no data
   * for resolves to the default locale and answers in English, so there is
   * nothing to repair — and if `of()` ever answers with nothing at all, the
   * English name is what a reader gets. A two-letter code in the middle of a
   * sentence would be the worst of the three outcomes and is the one this
   * refuses.
   */
  it("never yields a bare country code in any edition", () => {
    for (const locale of LOCALES) {
      for (const country of deliveryCountries) {
        const name = destinationNameIn(country, locale);
        expect(name.length, `${locale}/${country.code}`).toBeGreaterThan(2);
        expect(name.toUpperCase(), `${locale}/${country.code}`).not.toBe(
          country.code.toUpperCase(),
        );
      }
    }
  });
});
