import { describe, expect, it, vi } from "vitest";

import {
  CACHE_KEY,
  OmnivaLocations,
  STALE_CACHE_KEY,
  parseParcelMachines,
} from "../src/modules/omniva/locations.js";

/**
 * I2: this file used to also carry "parses the real published list, and
 * finds machines in all three countries" -- a real `fetch` against
 * `https://www.omniva.ee/locations.json`, no fixture. It moved to
 * `tests/smoke/omniva-locations.test.ts`, and it did not move because the
 * assertion was wrong; it moved because of *where it ran*.
 *
 * This file is collected by `vitest.config.mts`, which is what `npm run
 * test:unit` and therefore `bash scripts/validate` run -- on a bare checkout,
 * with nothing running, and (per `AGENTS.md`'s Testing section) with **no
 * network**. A real fetch inside it made an Omniva outage, or an
 * egress-restricted runner, turn this repository's one validation command
 * red for a reason that is not a defect -- and worse than merely "red": a
 * runner that silently drops the connection rather than refusing it can hang
 * a bare `fetch()` (no `AbortSignal` was attached) well past any reasonable
 * CI timeout, rather than failing fast. `vitest.config.mts`'s own docstring
 * makes exactly this argument for excluding `tests/smoke/`: "a suite that
 * refused without a server would make the repository's one validation
 * command fail for every developer". `scripts/validate`'s comment on why it
 * will not fetch another repository's manifests at validation time makes the
 * same argument from the other direction: a green run must not depend on a
 * third party's availability at the moment it happens to run.
 *
 * See `tests/smoke/omniva-locations.test.ts` for why the assertion itself is
 * kept, and kept real rather than fixture-backed.
 */
describe("the Omniva location list", () => {
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

/** One `set` call this fake cache recorded, in the shape `ICacheService.set` takes it. */
interface RecordedSetCall {
  readonly key: string;
  readonly ttl: number | undefined;
}

/**
 * A minimal, in-memory stand-in for `Modules.CACHE`'s real `ICacheService`
 * (`get<T>(key): Promise<T | null>`, `set(key, data, ttl?): Promise<void>`).
 * Good enough to exercise `OmnivaLocations`'s own logic without a Redis or an
 * in-memory Medusa module behind it -- the class does not care which
 * `ICacheService` it is handed, only that it behaves like one.
 *
 * **`setCalls` records the `ttl` argument, which this fake used to drop
 * entirely.** `locations.ts`'s whole "two cache entries, not one" design
 * (see `OmnivaLocations`'s own docstring) rests on {@link CACHE_KEY} being
 * written *with* a TTL and {@link STALE_CACHE_KEY} being written *without*
 * one -- and nothing at this seam constrained that before `setCalls` existed:
 * a `set(STALE_CACHE_KEY, machines, this.source.cacheTtlSeconds)` regression
 * (the "last known good" key quietly gaining an expiry, and therefore quietly
 * stopping being "last known good") would have passed every test in this
 * file unchanged.
 */
function fakeCache() {
  const store = new Map<string, unknown>();
  const setCalls: RecordedSetCall[] = [];
  return {
    store,
    setCalls,
    get: async <T>(key: string): Promise<T | null> => (store.has(key) ? (store.get(key) as T) : null),
    set: async (key: string, data: unknown, ttl?: number): Promise<void> => {
      store.set(key, data);
      setCalls.push({ key, ttl });
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
    const locations = new OmnivaLocations({ cache, fetcher });

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

    // The TTL split `OmnivaLocations`'s own docstring describes: the fresh
    // key is written *with* a TTL (so it can age out), the "last known good"
    // key *without* one (so it never does). Asserted here, at the seam,
    // rather than trusted -- see `fakeCache`'s own docstring for what this
    // catches.
    const freshCall = cache.setCalls.find((call) => call.key === CACHE_KEY);
    const staleCall = cache.setCalls.find((call) => call.key === STALE_CACHE_KEY);
    expect(freshCall?.ttl, "the fresh key must be written with a TTL").toBeTypeOf("number");
    expect(staleCall?.ttl, "the last-known-good key must never be given a TTL").toBeUndefined();
  });

  it("never serves an empty list as if it were a valid answer", async () => {
    const cache = fakeCache();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json([]));
    const locations = new OmnivaLocations({ cache, fetcher });

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
    const locations = new OmnivaLocations({ cache, fetcher });

    await expect(locations.list("EE")).rejects.toThrow(/503/);
  });

  it("throws when the fetched payload cannot be parsed as a location list", async () => {
    const cache = fakeCache();
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ not: "a list" }));
    const locations = new OmnivaLocations({ cache, fetcher });

    await expect(locations.list("EE")).rejects.toThrow(/list/i);
  });

  it("serves the last known good list, and logs the fallback, when a refetch fails", async () => {
    const cache = fakeCache();
    const warmFetcher = vi.fn<typeof fetch>(async () => Response.json([RAW_ESTONIAN_MACHINE]));
    const warm = new OmnivaLocations({ cache, fetcher: warmFetcher });
    await expect(warm.list("EE")).resolves.toHaveLength(1);

    // Simulate the freshness window elapsing without a real TTL clock: the
    // TTL-bound key is gone -- exactly what `ICacheService.get` also answers
    // for a key that was never written -- while the non-expiring "last known
    // good" key this same successful fetch also wrote is untouched.
    cache.store.delete(CACHE_KEY);
    expect(cache.store.has(STALE_CACHE_KEY)).toBe(true);

    const failingFetcher = vi.fn<typeof fetch>(async () => new Response("", { status: 503 }));
    const warn = vi.fn<(message: string) => void>();
    const cold = new OmnivaLocations({ cache, fetcher: failingFetcher, logger: { warn } });

    await expect(cold.list("EE")).resolves.toEqual([
      { zip: "10145", name: "Kristiine Keskus", group: "Harjumaa — Tallinn", countryCode: "EE" },
    ]);
    // The stale copy is served only after a refetch was genuinely attempted
    // and failed -- never in place of one.
    expect(failingFetcher).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/last known|refetch failed/i);
  });

  it("still refuses when a refetch fails and there is no last-known-good copy to fall back to", async () => {
    const cache = fakeCache();
    const fetcher = vi.fn<typeof fetch>(async () => new Response("", { status: 503 }));
    const locations = new OmnivaLocations({ cache, fetcher });

    await expect(locations.list("EE")).rejects.toThrow(/503/);
  });
});
