import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createClient } from "redis";

import {
  readNewsletterRateLimitRuntimeConfig,
  readNewsletterRuntimeConfig,
} from "../../../config/runtime.js";
import {
  BoundedRedisEvalClient,
  RedisFixedWindowNewsletterRateLimiter,
  type NewsletterRateLimiter,
} from "../../../newsletter/rate-limit.js";
import { subscribeToNewsletter } from "../../../newsletter/subscribe.js";

let rateLimiter: NewsletterRateLimiter | undefined;

function getRateLimiter(): NewsletterRateLimiter {
  if (rateLimiter !== undefined) return rateLimiter;

  const config = readNewsletterRateLimitRuntimeConfig(process.env);
  const redis = createClient({
    disableOfflineQueue: true,
    password: config.redisPassword,
    socket: {
      connectTimeout: 2_000,
      host: config.redisHost,
      port: config.redisPort,
      reconnectStrategy: false,
    },
  });
  redis.on("error", () => undefined);

  rateLimiter = new RedisFixedWindowNewsletterRateLimiter(
    new BoundedRedisEvalClient(
      {
        get isReady() { return redis.isReady; },
        connect: () => redis.connect(),
        destroy: () => redis.destroy(),
        eval: (script, options) => redis.eval(script, {
          keys: [...options.keys],
          arguments: [...options.arguments],
        }),
      },
      2_000,
    ),
    config.maximum,
    config.windowSeconds,
  );
  return rateLimiter;
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const status = await subscribeToNewsletter(
    req.body,
    readNewsletterRuntimeConfig(process.env),
    getRateLimiter(),
  );
  res.sendStatus(status);
}
