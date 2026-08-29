import { describe, expect, it } from "vitest";

import { parcelMachinesForCountry, parseParcelMachines } from "../../src/modules/omniva/locations.js";

const LOCATIONS_URL = "https://www.omniva.ee/locations.json";

/**
 * The **real** `locations.json`, parsed -- not a fixture, and this is the
 * point of the file. See below for why, and see
 * `tests/omniva-locations.test.ts`'s own header for why this test does not
 * live there (I2 of the 2026-08-27 review): `bash scripts/validate` must not
 * depend on a third-party host being up, and `scripts/smoke`'s suite already
 * exists for exactly the class of check that does.
 *
 * ## Why a fixture is not the answer
 *
 * A fixture built from one day's download would only ever prove
 * `parseParcelMachines` agrees with itself about that one day's shape. It
 * would go green forever even if Omniva renamed `A0_NAME` tomorrow -- and
 * that rename is precisely the day this module would start silently
 * mis-sorting every machine into the wrong country, because `A0_NAME` is
 * read.toUpperCase() and compared against `PARCEL_MACHINE_COUNTRY_CODES`
 * with no fallback and no validation that the key exists at all: a renamed
 * or restructured field does not throw, it just quietly stops matching, and
 * every machine in every country silently disappears from every buyer's
 * checkout. `locations.ts`'s own header makes the identical argument for why
 * `parseParcelMachines` is exercised here against the live feed rather than
 * a captured payload. A fixture is a test that Omniva's contract has not
 * changed *since the fixture was captured*; only the real feed can be a test
 * that Omniva's contract has not changed *since now*.
 *
 * ## Why this may still fail hard, unlike a check inside `bash scripts/validate`
 *
 * This suite (`vitest.smoke.config.mts`) is never run by `bash
 * scripts/validate` and is not asked to survive a bare checkout with no
 * network -- `scripts/store-smoke`, which runs it, already stands up a real
 * PostgreSQL, a real Redis and a real Medusa, and the CI `store-smoke` job
 * that runs it already assumes outbound internet access to reach Omniva,
 * Stripe and every other third party this shop's smoke path could touch. An
 * Omniva outage failing *this* job is a true report of what it is testing --
 * "can this shop currently reach Omniva's published location list" -- in a
 * way it would not be inside the merge gate that runs with no network at
 * all.
 */
describe("the Omniva location list, against the live feed", () => {
  it("parses the real published list, and finds machines in all three countries", async () => {
    const response = await fetch(LOCATIONS_URL);
    expect(response.ok, `GET ${LOCATIONS_URL} answered ${String(response.status)}`).toBe(true);
    const machines = parseParcelMachines(await response.json());

    // Measured 2026-08-26: 437 EE, 412 LV, 561 LT parcel machines. Asserted as
    // floors rather than equalities -- Omniva adds and removes machines, and an
    // equality here would go red for a reason that is not a defect.
    expect(parcelMachinesForCountry(machines, "EE").length).toBeGreaterThan(300);
    expect(parcelMachinesForCountry(machines, "LV").length).toBeGreaterThan(300);
    expect(parcelMachinesForCountry(machines, "LT").length).toBeGreaterThan(400);

    for (const machine of machines) {
      expect(machine.zip, machine.name).toMatch(/^[0-9A-Za-z-]+$/);
      expect(machine.name.length, machine.zip).toBeGreaterThan(0);
      expect(["EE", "LV", "LT"]).toContain(machine.countryCode);
    }

    // ZIPs are the offloadPostcode a shipment registers against, so two
    // machines sharing one would make the buyer's choice unrepresentable.
    const zips = machines.map((machine) => machine.zip);
    expect(new Set(zips).size).toBe(zips.length);
  }, 30_000);
});
