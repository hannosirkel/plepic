import { describe, expect, it, vi } from "vitest";

import { RedisCache } from "../src/modules/omniva/redis-cache.js";

/**
 * `RedisCache` is exercised here against a bare `{ eval }` stand-in, never a
 * real Redis and never a real `BoundedRedisEvalClient` -- the point of typing
 * its constructor parameter narrowly (see `redis-cache.ts`) is exactly that
 * this class's own GET/SET/DEL-via-Lua logic can be proven correct without
 * either. The connect/reconnect/deadline behaviour underneath `eval` is
 * `BoundedRedisEvalClient`'s job and is already proven by
 * `tests/newsletter-rate-limit.test.ts`; re-asserting it here would test the
 * same thing twice through two different fakes.
 */
describe("RedisCache, an ICacheService over BoundedRedisEvalClient", () => {
  it("reads back exactly what it wrote, as JSON, through GET/SET Lua scripts", async () => {
    const store = new Map<string, string>();
    const redis = {
      eval: vi.fn(async (script: string, options: { readonly keys: readonly string[]; readonly arguments: readonly string[] }) => {
        const [key] = options.keys;
        if (script.includes("redis.call('GET'")) {
          return store.get(key!) ?? null;
        }
        if (script.includes("redis.call('SET'")) {
          store.set(key!, options.arguments[0]!);
          return 1;
        }
        throw new Error(`unexpected script: ${script}`);
      }),
    };
    const cache = new RedisCache(redis);

    await expect(cache.get("omniva:parcel-machines:v1")).resolves.toBeNull();

    await cache.set("omniva:parcel-machines:v1", [{ zip: "10145" }], 3600);
    await expect(cache.get<{ zip: string }[]>("omniva:parcel-machines:v1")).resolves.toEqual([
      { zip: "10145" },
    ]);

    // The TTL travels as the script's second argument, not as a client-level
    // option -- confirmed by inspecting the actual call rather than trusting
    // the round trip alone.
    const setCall = redis.eval.mock.calls.find(([script]) => script.includes("SET"));
    expect(setCall?.[1].arguments[1]).toBe("3600");
  });

  it("passes an empty string, not a TTL, for a key meant to persist", async () => {
    const redis = {
      eval: vi.fn(async (_script: string, _options: { readonly keys: readonly string[]; readonly arguments: readonly string[] }) => 1),
    };
    const cache = new RedisCache(redis);

    await cache.set("omniva:parcel-machines:v1:last-known-good", [{ zip: "10145" }]);

    const [, options] = redis.eval.mock.calls[0]!;
    expect(options.arguments[1]).toBe("");
  });

  it("deletes through a DEL script", async () => {
    const redis = { eval: vi.fn(async () => 1) };
    const cache = new RedisCache(redis);

    await cache.invalidate("omniva:parcel-machines:v1");

    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('DEL'"),
      { keys: ["omniva:parcel-machines:v1"], arguments: [] },
    );
  });

  it("degrades a Redis failure to a cache miss, on get, set and invalidate alike", async () => {
    const redis = { eval: vi.fn(async () => { throw new Error("synthetic Redis failure"); }) };
    const cache = new RedisCache(redis);

    // None of the three ever reject -- a Redis blip must not turn into a
    // failed checkout request for a cache that was only ever a courtesy.
    await expect(cache.get("omniva:parcel-machines:v1")).resolves.toBeNull();
    await expect(cache.set("omniva:parcel-machines:v1", ["anything"], 3600)).resolves.toBeUndefined();
    await expect(cache.invalidate("omniva:parcel-machines:v1")).resolves.toBeUndefined();
  });

  it("treats a non-string reply (Redis's nil for a missing key) as no value, not as a parse target", async () => {
    const redis = { eval: vi.fn(async () => null) };
    const cache = new RedisCache(redis);

    await expect(cache.get("omniva:parcel-machines:v1")).resolves.toBeNull();
  });
});
