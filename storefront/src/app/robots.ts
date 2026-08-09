/**
 * `robots.txt`, generated per request from validated host configuration —
 * see `src/lib/robots-contract.ts` for the actual rule set, and `proxy.ts`
 * for the `X-Robots-Tag` header this pairs with. `force-dynamic` for the same
 * reason `sitemap.ts` needs it: this must read *this* request's `Host`
 * header and *this* environment's base URL, never whatever was true when the
 * image was built.
 */

import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { isTestHost, loadSiteHostConfig } from "../config/hosts.js";
import { buildRobotsRules } from "../lib/robots-contract.js";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hostConfig = loadSiteHostConfig();
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  return buildRobotsRules({
    isTestHost: isTestHost(host, hostConfig),
    baseUrl: hostConfig.baseUrl,
  });
}
