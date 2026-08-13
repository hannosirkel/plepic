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

interface ConnectableRedisEvalClient extends RedisEvalClient {
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
