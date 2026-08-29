/**
 * A Redis-backed `ICacheService`, because `Modules.CACHE` is not one here.
 *
 * `OmnivaLocations`'s one-reader guarantee (see `locations.ts`) only holds if
 * every replica of this backend reads and writes the *same* cached list. That
 * needs a cache all replicas share -- and `Modules.CACHE`, resolved from the
 * Medusa container, is not that cache in this deployment. Three facts, each
 * checked rather than assumed:
 *
 * 1. `medusa-config.ts` wires Redis four times over -- sessions, the event
 *    bus, the workflow engine, locking -- and the cache module is not among
 *    them; `redis-preflight.ts`'s own docstring is the record of exactly how
 *    deliberate that four-not-five split is.
 * 2. Medusa's own module resolution installs the in-memory cache module by
 *    default outside Medusa Cloud, regardless of what `projectConfig` names,
 *    unless a `cache-redis` module is explicitly registered.
 * 3. `@medusajs/cache-redis` is not a dependency this workspace declares --
 *    only `@medusajs/caching`'s bundled in-memory provider is on disk.
 *
 * With replicas at 1 today, an in-memory `Modules.CACHE` merely means every
 * process re-fetches independently, which is wasteful but not wrong: there is
 * only one process to disagree with itself. It stops being merely wasteful the
 * day replicas go above 1 -- two processes could then cache two different
 * "current" lists, and a buyer's chosen ZIP could be validated by a process
 * that never served that ZIP as an option. Fixing it now, while it costs
 * nothing observable, is cheaper than waiting for a replica bump to
 * reintroduce the exact class of cross-process disagreement `medusa-config.ts`
 * already documents this project having been bitten by once.
 *
 * **No new dependency.** `@medusajs/cache-redis` is deliberately not added;
 * this file is built entirely from what the workspace already has: the
 * `redis` package (already a declared dependency, already used by
 * `redis-preflight.ts` and the newsletter rate limiter), `runtime.ts`'s
 * `readRedisRuntimeConfig`/`redisConnectionUrl`/`redisConnectionOptions` (the
 * one place this backend decides what a Redis address looks like), and
 * `newsletter/rate-limit.ts`'s `BoundedRedisEvalClient` (the one place this
 * backend has already solved "a long-lived Redis client must not wedge on a
 * hung connect, and must not crash the process on an `error` event").
 *
 * `get`/`set`/`invalidate` are expressed as small Lua scripts run through
 * `BoundedRedisEvalClient.eval`, rather than as direct `GET`/`SET`/`DEL`
 * calls, specifically so this class needs no `connect`/`error` handling of
 * its own: `boundedRedisEvalClient` already provides the lazy, memoized
 * reconnect and the destroy-on-timeout that keeps a stalled connect attempt
 * from wedging every later request, and `tests/newsletter-rate-limit.test.ts`
 * already exercises that behaviour end to end. A second, hand-rolled version
 * of that same connect/timeout logic for plain `GET`/`SET` would be new,
 * untested code answering a question this codebase has already answered.
 */

import type { ICacheService } from "@medusajs/framework/types";
import { createClient } from "redis";

// Extensionless: this file lives in `src/modules/omniva/`, loaded by
// MikroORM's type-generation pass through a bare path rather than an npm
// package -- see the comment on `index.ts`'s import of `./service` for the
// full explanation, and `locations.ts`'s import of `../../commerce/shipping-model`
// for another file in this same directory that already works around it.
import {
  readRedisRuntimeConfig,
  redisConnectionOptions,
  redisConnectionUrl,
} from "../../config/runtime";
import { boundedRedisEvalClient } from "../../newsletter/rate-limit";

/**
 * The narrow shape `RedisCache` actually calls -- deliberately not the
 * concrete `BoundedRedisEvalClient` class, which carries private fields and
 * so cannot be satisfied by a plain object. Any `BoundedRedisEvalClient`
 * instance implements this structurally (its `eval` is public), so
 * `omnivaRedisCache` below passes one unchanged; a test can hand `RedisCache`
 * a bare `{ eval: vi.fn(...) }` instead, with no Redis and no
 * `BoundedRedisEvalClient` involved at all.
 */
interface EvalClient {
  eval(
    script: string,
    options: { readonly keys: readonly string[]; readonly arguments: readonly string[] },
  ): Promise<unknown>;
}

/** Bounds both the initial connect and every eval -- see `BoundedRedisEvalClient`. */
const OPERATION_TIMEOUT_MS = 2_000;

/** Lua: read one key, verbatim, so a JSON round-trip is this class's job, not Redis's. */
const GET_SCRIPT = "return redis.call('GET', KEYS[1])";

/**
 * Lua: write one key, and `EXPIRE` it only when `ARGV[2]` names a TTL.
 *
 * One script rather than two (a `SET` and a `SET ... EX`) so that whether a
 * key expires is a value passed in, not a choice of which script to run --
 * `RedisCache.set` passes `""` for "no TTL", which is exactly what a
 * non-expiring "last known good" key needs, and every caller in this backend
 * only ever supplies a real TTL as a positive integer, so `ARGV[2] ~= ''` can
 * never mistake one for the other.
 */
const SET_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1])
if ARGV[2] ~= '' then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 1
`;

const DEL_SCRIPT = "redis.call('DEL', KEYS[1]); return 1";

/**
 * `ICacheService`, over `BoundedRedisEvalClient`.
 *
 * Every method **swallows a Redis failure into the value `ICacheService`
 * already uses for "nothing here"** -- `get` returns `null`, `set` and
 * `invalidate` resolve without writing anything -- rather than rejecting.
 * That is the "degrades ... rather than crashing" this class exists to
 * provide: a Redis blip turns into a cache miss, which `OmnivaLocations`
 * already treats as "fetch fresh from Omniva", not into a `500` from a route
 * that was only ever trying to save a round trip. The one place a Redis
 * failure is allowed to surface is inside `OmnivaLocations` itself, when
 * there is no fresh data *and* no stale copy either -- this class has no
 * opinion on that; it only ever reports "I have nothing" or "here it is".
 */
export class RedisCache implements ICacheService {
  constructor(private readonly redis: EvalClient) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.eval(GET_SCRIPT, { keys: [key], arguments: [] });
      return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, data: unknown, ttl?: number): Promise<void> {
    try {
      await this.redis.eval(SET_SCRIPT, {
        keys: [key],
        arguments: [JSON.stringify(data), ttl === undefined ? "" : String(ttl)],
      });
    } catch {
      // Best-effort. A write Redis never durably took just degrades the next
      // read to a cache miss, which is recoverable on its own; throwing here
      // would turn a Redis blip into a failed request for no benefit -- the
      // caller already has the freshly-fetched value in hand regardless of
      // whether caching it succeeded.
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.eval(DEL_SCRIPT, { keys: [key], arguments: [] });
    } catch {
      // Best-effort, same reasoning as `set`.
    }
  }
}

let sharedCache: RedisCache | undefined;

/**
 * The one Redis-backed cache this process shares across every request.
 *
 * A singleton, not a `new RedisCache(...)` per request, because the client
 * underneath is long-lived on purpose: `redis-preflight.ts`'s client is
 * built, used once and destroyed within a single script's lifetime, but a
 * cache dialled fresh on every Store API request would pay a TCP and Redis
 * handshake per checkout page-load, and would never benefit from
 * `BoundedRedisEvalClient`'s reconnect memoisation, since there would be
 * nothing shared across calls left to reconnect.
 *
 * `readRedisRuntimeConfig(process.env)` is read once, on first use, not at
 * module load: importing this file must not by itself require every
 * `REDIS_*` variable to be set (a unit test importing `locations.ts` should
 * not need a Redis to exist), and reading it lazily is what keeps that true.
 */
export function omnivaRedisCache(): RedisCache {
  if (sharedCache !== undefined) return sharedCache;

  const redis = readRedisRuntimeConfig(process.env);
  const client = createClient({
    url: redisConnectionUrl(redis),
    password: redisConnectionOptions(redis).password,
    socket: { connectTimeout: OPERATION_TIMEOUT_MS, reconnectStrategy: false },
  });
  // Same reasoning as `redis-preflight.ts` and the newsletter rate limiter's
  // client: node-redis emits every failure as an `error` event as well as
  // rejecting the call that caused it, and an `error` event with no listener
  // crashes the process.
  client.on("error", () => undefined);

  sharedCache = new RedisCache(boundedRedisEvalClient(client, OPERATION_TIMEOUT_MS));
  return sharedCache;
}
