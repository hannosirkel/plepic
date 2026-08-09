/**
 * `robots.txt`'s contract, as a pure function so it is testable without a
 * server: a test hostname gets a disallow-all body (and `app/layout.tsx`
 * separately sends the `X-Robots-Tag: noindex, nofollow` header for the same
 * hostnames — see `proxy.ts`); the live host gets an explicit allow, keeps
 * `/cart`, `/checkout`, and `/store-api` out, and points at the sitemap.
 *
 * Which hostnames count as "test" is never sniffed from the request string —
 * it is `config.isTestHost`, computed once from validated
 * {@link SiteHostConfig} configuration and passed in.
 */

import type { MetadataRoute } from "next";

export interface RobotsContractInput {
  readonly isTestHost: boolean;
  readonly baseUrl: string;
}

export function buildRobotsRules(input: RobotsContractInput): MetadataRoute.Robots {
  if (input.isTestHost) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/store-api"],
    },
    sitemap: `${input.baseUrl}/sitemap.xml`,
  };
}
