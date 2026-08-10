/**
 * The root layout — the one place every per-request value is actually read:
 * the CSP nonce and the `Host` header (both from `proxy.ts`, via
 * `next/headers`), and every environment variable `getRuntimeConfig()`
 * touches. `export const dynamic = "force-dynamic"` opts the whole tree out
 * of static generation, which is what makes all of that "per request" rather
 * than "once, at build time, and then wrong for every environment but one" —
 * see `src/config/runtime-config.ts` for why that distinction is the whole
 * point of this unit.
 *
 * Everything downstream — `RuntimeConfigScript`, `ConsentManager` — receives
 * these values as props. Nothing below this file calls `process.env` or
 * `headers()` directly.
 */

import type { ReactNode } from "react";

import "../../../design/tokens.css";
import "../styles/global.css";

import { ConsentManager } from "../components/analytics/ConsentManager.js";
import { RuntimeConfigScript } from "../components/RuntimeConfigScript.js";
import { isTestHost, loadSiteHostConfig } from "../config/hosts.js";
import { getRuntimeConfig } from "../config/runtime-config.js";
import { toClientRuntimeConfig } from "../lib/client-runtime-config.js";
import { getRequestNonce } from "../lib/nonce.js";
import { getRequestHost } from "../lib/request-host.js";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const [nonce, host] = await Promise.all([getRequestNonce(), getRequestHost()]);
  const hostConfig = loadSiteHostConfig();
  const runtimeConfig = getRuntimeConfig();
  const testHost = host !== undefined && isTestHost(host, hostConfig);

  /*
   * A named projection, not a spread. This blob is serialized into the HTML of
   * every route, so a spread published every field `RuntimeConfig` has and
   * every field it will gain — including the merchant's contact address, on
   * `/cart` and `/checkout`, which never quote it and whose client-side code
   * never reads it. See `src/lib/client-runtime-config.ts`.
   */
  const clientConfig = toClientRuntimeConfig(runtimeConfig, testHost);

  return (
    <html lang="en" data-layer="publisher">
      <body>
        <RuntimeConfigScript config={clientConfig} nonce={nonce} />
        {children}
        <ConsentManager
          isTestHost={testHost}
          measurementId={runtimeConfig.analytics.measurementId}
          nonce={nonce}
        />
      </body>
    </html>
  );
}
