export const NEWSLETTER_GLOBAL_RATE_LIMIT_KEY = "plepic:newsletter:global";

const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

interface RedisEvalClient {
  eval(
    script: string,
    options: {
      readonly keys: readonly string[];
      readonly arguments: readonly string[];
    },
  ): Promise<unknown>;
}

/**
 * Exported so a second long-lived Redis client can be adapted the same way
 * this module's own {@link boundedRedisEvalClient} adapts one — see that
 * function's docstring for why a second caller wants this at all.
 */
export interface ConnectableRedisEvalClient extends RedisEvalClient {
  readonly isReady: boolean;
  connect(): Promise<unknown>;
  destroy(): void;
}

export interface NewsletterRateLimiter {
  consume(): Promise<"allowed" | "denied" | "unavailable">;
}

/** Adds one hard deadline to Redis readiness and the atomic evaluation. */
export class BoundedRedisEvalClient implements RedisEvalClient {
  private connection: Promise<void> | undefined;

  constructor(
    private readonly client: ConnectableRedisEvalClient,
    private readonly operationTimeoutMilliseconds: number,
  ) {}

  private connect(): Promise<void> {
    return this.client.connect().then(() => {
      if (!this.client.isReady) {
        throw new Error("Redis connection did not become ready");
      }
    });
  }

  private withinDeadline<T>(operation: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      let finished = false;
      const timeout = setTimeout(() => {
        finished = true;
        this.connection = undefined;
        try {
          this.client.destroy();
        } catch {
          // A concurrent deadline may already have closed the shared client.
        } finally {
          reject(new Error("Redis operation deadline exceeded"));
        }
      }, this.operationTimeoutMilliseconds);

      void operation.then(
        (value) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          resolve(value);
        },
        (error: unknown) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  }

  async eval(
    script: string,
    options: {
      readonly keys: readonly string[];
      readonly arguments: readonly string[];
    },
  ): Promise<unknown> {
    const operation = (async () => {
      if (!this.client.isReady) {
        this.connection ??= this.connect().finally(() => {
          this.connection = undefined;
        });
        await this.connection;
      }
      return this.client.eval(script, options);
    })();
    return this.withinDeadline(operation);
  }
}

/**
 * The narrow shape of a real node-redis client this adaptor needs. `eval`'s
 * `keys`/`arguments` are declared as mutable arrays because that is what
 * node-redis's own `EvalOptions` (`@redis/client/dist/lib/commands/EVAL.d.ts`)
 * declares — not because {@link boundedRedisEvalClient} mutates them; it
 * always passes freshly-copied arrays.
 */
export interface NodeRedisEvalClient {
  readonly isReady: boolean;
  connect(): Promise<unknown>;
  destroy(): void;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

/**
 * Adapts a real node-redis client into the narrow, `readonly`-array shape
 * {@link BoundedRedisEvalClient} needs, and returns the bounded wrapper.
 *
 * This is the exact wiring `getRateLimiter` in
 * `api/store/newsletter/route.ts` used to write out inline: `isReady` reread
 * as a getter rather than captured once (the client's readiness changes
 * across its lifetime), and `eval`'s `keys`/`arguments` copied into new
 * arrays because node-redis's own `eval` wants mutable ones where this
 * module's own {@link RedisEvalClient} deliberately asks for readonly ones.
 *
 * Extracted here, rather than left inline at each call site, because a second
 * long-lived Redis client — the Omniva parcel-machine cache
 * (`modules/omniva/redis-cache.ts`) — needs the identical
 * reconnect-and-deadline behaviour `BoundedRedisEvalClient` provides, and
 * that behaviour is exactly what `tests/newsletter-rate-limit.test.ts`
 * already proves correct (destroys a client that cannot become ready before
 * its deadline; destroys one that stalls mid-command; fails closed rather
 * than hangs). A second, independently-written version of that same
 * connect/deadline machinery for a second client would be untested in its
 * own right and would read, to the next person, as two different answers to
 * one question — "what happens when this Redis client hangs" — that this
 * codebase has already answered once.
 */
export function boundedRedisEvalClient(
  client: NodeRedisEvalClient,
  operationTimeoutMilliseconds: number,
): BoundedRedisEvalClient {
  return new BoundedRedisEvalClient(
    {
      get isReady() {
        return client.isReady;
      },
      connect: () => client.connect(),
      destroy: () => client.destroy(),
      eval: (script, options) =>
        client.eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
    },
    operationTimeoutMilliseconds,
  );
}

/** A cross-pod fixed window containing only one aggregate counter and expiry. */
export class RedisFixedWindowNewsletterRateLimiter implements NewsletterRateLimiter {
  constructor(
    private readonly redis: RedisEvalClient,
    private readonly maximum: number,
    private readonly windowSeconds: number,
  ) {}

  async consume(): Promise<"allowed" | "denied" | "unavailable"> {
    try {
      const count = await this.redis.eval(FIXED_WINDOW_SCRIPT, {
        keys: [NEWSLETTER_GLOBAL_RATE_LIMIT_KEY],
        arguments: [String(this.windowSeconds)],
      });
      return typeof count === "number" && count <= this.maximum ? "allowed" : "denied";
    } catch {
      return "unavailable";
    }
  }
}
