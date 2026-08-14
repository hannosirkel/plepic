import { describe, expect, it, vi } from "vitest";

import {
  BoundedRedisEvalClient,
  NEWSLETTER_GLOBAL_RATE_LIMIT_KEY,
  RedisFixedWindowNewsletterRateLimiter,
} from "../src/newsletter/rate-limit.js";

describe("newsletter global Redis rate limit", () => {
  it("uses one atomic, static Redis key and expires the first increment in its fixed window", async () => {
    const redis = {
      eval: vi.fn(async (script: string, options: { readonly keys: readonly string[]; readonly arguments: readonly string[] }) => {
        expect(script).toContain("redis.call('INCR', KEYS[1])");
        expect(script).toContain("redis.call('EXPIRE', KEYS[1], ARGV[1])");
        expect(options.keys).toEqual([NEWSLETTER_GLOBAL_RATE_LIMIT_KEY]);
        expect(options.arguments).toEqual(["600"]);
        return redis.eval.mock.calls.length;
      }),
    };
    const limiter = new RedisFixedWindowNewsletterRateLimiter(redis, 2, 600);

    await expect(limiter.consume()).resolves.toBe("allowed");
    await expect(limiter.consume()).resolves.toBe("allowed");
    await expect(limiter.consume()).resolves.toBe("denied");

    expect(redis.eval).toHaveBeenCalledTimes(3);
    expect(NEWSLETTER_GLOBAL_RATE_LIMIT_KEY).toBe("plepic:newsletter:global");
  });

  it("fails closed when Redis cannot evaluate the atomic limiter", async () => {
    const limiter = new RedisFixedWindowNewsletterRateLimiter(
      { eval: vi.fn(async () => { throw new Error("synthetic Redis failure"); }) },
      20,
      600,
    );

    await expect(limiter.consume()).resolves.toBe("unavailable");
  });

  it("destroys a connection that cannot become ready before its deadline", async () => {
    vi.useFakeTimers();
    const redis = {
      isReady: false,
      connect: vi.fn(() => new Promise<never>(() => undefined)),
      destroy: vi.fn(),
      eval: vi.fn(async () => 1),
    };
    const limiter = new RedisFixedWindowNewsletterRateLimiter(
      new BoundedRedisEvalClient(redis, 2_000),
      20,
      600,
    );

    const result = limiter.consume();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe("unavailable");
    expect(redis.destroy).toHaveBeenCalledTimes(1);
    expect(redis.eval).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("destroys an already-ready client when the atomic evaluation stalls", async () => {
    vi.useFakeTimers();
    const redis = {
      isReady: true,
      connect: vi.fn(async () => undefined),
      destroy: vi.fn(),
      eval: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const limiter = new RedisFixedWindowNewsletterRateLimiter(
      new BoundedRedisEvalClient(redis, 2_000),
      20,
      600,
    );

    const result = limiter.consume();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe("unavailable");
    expect(redis.connect).not.toHaveBeenCalled();
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.destroy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("fails two concurrent stalled operations closed when the second destroy throws", async () => {
    vi.useFakeTimers();
    let destroys = 0;
    const redis = {
      isReady: true,
      connect: vi.fn(async () => undefined),
      destroy: vi.fn(() => {
        destroys += 1;
        if (destroys > 1) throw new Error("synthetic already-closed client");
      }),
      eval: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const limiter = new RedisFixedWindowNewsletterRateLimiter(
      new BoundedRedisEvalClient(redis, 2_000),
      20,
      600,
    );

    const first = limiter.consume();
    const second = limiter.consume();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(Promise.all([first, second])).resolves.toEqual([
      "unavailable",
      "unavailable",
    ]);
    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(redis.destroy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
