import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createClient } from "redis";

import {
  readNewsletterRateLimitRuntimeConfig,
  readNewsletterRuntimeConfig,
} from "../../../config/runtime.js";
import {
  RedisFixedWindowNewsletterRateLimiter,
  boundedRedisEvalClient,
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
    boundedRedisEvalClient(redis, 2_000),
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
