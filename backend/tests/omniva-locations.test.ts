import { describe, expect, it, vi } from "vitest";

import {
  OmnivaLocations,
  parcelMachinesForCountry,
  parseParcelMachines,
} from "../src/modules/omniva/locations.js";

const LOCATIONS_URL = "https://www.omniva.ee/locations.json";

describe("the Omniva location list", () => {
  it("parses the real published list, and finds machines in all three countries", async () => {
    const response = await fetch(LOCATIONS_URL);
    expect(response.ok).toBe(true);
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

  it("keeps parcel machines and discards post offices", () => {
    const machines = parseParcelMachines([
      { ZIP: "10145", NAME: "Kristiine Keskus", TYPE: "0", A0_NAME: "EE", A1_NAME: "Harjumaa", A2_NAME: "Tallinn" },
      { ZIP: "10101", NAME: "Tallinn post office", TYPE: "1", A0_NAME: "EE", A1_NAME: "Harjumaa", A2_NAME: "Tallinn" },
      { ZIP: "99999", NAME: "Helsinki", TYPE: "0", A0_NAME: "FI", A1_NAME: "", A2_NAME: "Helsinki" },
    ]);
    expect(machines.map((machine) => machine.zip)).toEqual(["10145"]);
    expect(machines[0]?.group).toBe("Harjumaa — Tallinn");
  });

  it("refuses an entry missing the fields a shipment registration needs", () => {
    expect(parseParcelMachines([{ NAME: "No zip", TYPE: "0", A0_NAME: "EE" }])).toEqual([]);
    expect(() => parseParcelMachines("not a list")).toThrow(/list/i);
  });
});

/**
 * A minimal, in-memory stand-in for `Modules.CACHE`'s real `ICacheService`
 * (`get<T>(key): Promise<T | null>`, `set(key, data, ttl?): Promise<void>`).
 * Good enough to exercise `OmnivaLocations`'s own logic without a Redis or an
 * in-memory Medusa module behind it -- the class does not care which
 * `ICacheService` it is handed, only that it behaves like one.
 */
function fakeCache() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: async <T>(key: string): Promise<T | null> => (store.has(key) ? (store.get(key) as T) : null),
    set: async (key: string, data: unknown): Promise<void> => {
      store.set(key, data);
    },
    invalidate: async (key: string): Promise<void> => {
      store.delete(key);
    },
  };
}

const RAW_ESTONIAN_MACHINE = {
  ZIP: "10145",
  NAME: "Kristiine Keskus",
  TYPE: "0",
  A0_NAME: "EE",
  A1_NAME: "Harjumaa",
  A2_NAME: "Tallinn",
};

describe("OmnivaLocations, the cached reader", () => {
  it("fetches once, caches the result, and serves every later call from the cache", async () => {
    const cache = fakeCache();
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json([RAW_ESTONIAN_MACHINE]),
    );
    const locations = new OmnivaLocations(cache, undefined, fetcher);

    await expect(locations.list("EE")).resolves.toEqual([
      { zip: "10145", name: "Kristiine Keskus", group: "Harjumaa — Tallinn", countryCode: "EE" },
    ]);
    await expect(locations.find("10145")).resolves.toEqual({
      zip: "10145",
      name: "Kristiine Keskus",
      group: "Harjumaa — Tallinn",
      countryCode: "EE",
    });
    await expect(locations.find("no-such-zip")).resolves.toBeNull();

    // Three calls above, one fetch: the second and third are answered from
    // the cache this class populated on the first.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never serves an empty list as if it were a valid answer", async () => {
    const cache = fakeCache();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json([]));
    const locations = new OmnivaLocations(cache, undefined, fetcher);

    // A parse that yields zero machines is not cached and not returned: an
    // empty <select> at checkout is a broken-looking page with no visible
    // cause, and this class refuses instead of standing in for Omniva
    // answering "there are no parcel machines anywhere".
    await expect(locations.list("EE")).rejects.toThrow(/no parcel machines/i);
    expect(cache.store.size).toBe(0);
  });

  it("throws, rather than guesses, when Omniva answers with an HTTP error and there is no cached copy", async () => {
    const cache = fakeCache();
    const fetcher = vi.fn<typeof fetch>(async () => new Response("", { status: 503 }));
    const locations = new OmnivaLocations(cache, undefined, fetcher);

    await expect(locations.list("EE")).rejects.toThrow(/503/);
  });

  it("throws when the fetched payload cannot be parsed as a location list", async () => {
    const cache = fakeCache();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ not: "a list" }));
    const locations = new OmnivaLocations(cache, undefined, fetcher);

    await expect(locations.list("EE")).rejects.toThrow(/list/i);
  });
});
