/**
 * The served document, once.
 *
 * This is the body of what used to be `src/app/layout.tsx` — the one place
 * every per-request value is actually read: the CSP nonce and the `Host`
 * header (both from `proxy.ts`, via `next/headers`), and every environment
 * variable `getRuntimeConfig()` touches. `export const dynamic =
 * "force-dynamic"` in each root layout opts the whole tree out of static
 * generation, which is what makes all of that "per request" rather than
 * "once, at build time, and then wrong for every environment but one" — see
 * `src/config/runtime-config.ts` for why that distinction is the whole point
 * of that unit.
 *
 * Everything downstream — `RuntimeConfigScript`, `ConsentManager` — receives
 * these values as props. Nothing below this file calls `process.env` or
 * `headers()` directly.
 *
 * ## Why it is a component and not a layout any more
 *
 * `<html lang>` is the served document's declaration of what language it is
 * written in, and only a **root** layout may render `<html>`. A single root
 * layout can therefore only ever declare one language, because a root layout
 * has no way to learn which locale the request resolved to: it has no
 * pathname, and its `params` are its own segment's, which for `app/layout.tsx`
 * is nothing.
 *
 * So there are two root layouts, which Next.js supports precisely for this —
 * "root layouts can also be placed under dynamic segments, which is useful
 * for implementing internationalization". `app/(site)/layout.tsx` is the root
 * of the unprefixed default edition; `app/[locale]/layout.tsx` is the root of
 * every prefixed one and reads the locale from its own dynamic segment. Both
 * are four lines around this component, so the document itself exists once
 * and cannot drift between editions — which is the failure a second copy of a
 * root layout would have produced on its first edit.
 *
 * The alternative was a request header carrying the pathname, set in
 * `src/proxy.ts`. That file is outside this unit's authority, and depending on
 * a Next.js-internal path header would have been worse anyway.
 */

import type { ReactNode } from "react";

import "../../../design/tokens.css";
import "../styles/global.css";

import { ConsentManager } from "../components/analytics/ConsentManager.js";
import { RuntimeConfigScript } from "../components/RuntimeConfigScript.js";
import { isTestHost, loadSiteHostConfig } from "../config/hosts.js";
import { getRuntimeConfig } from "../config/runtime-config.js";
import { LOCALE_DEFINITIONS, type Locale } from "../../../content/routes.js";
import { toClientRuntimeConfig } from "../lib/client-runtime-config.js";
import { getRequestNonce } from "../lib/nonce.js";
import { getRequestHost } from "../lib/request-host.js";

export interface SiteDocumentProps {
  /** The edition being served. Its BCP 47 tag becomes the document's `lang`. */
  readonly locale: Locale;
  readonly children: ReactNode;
}

export async function SiteDocument({ locale, children }: SiteDocumentProps) {
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
    <html lang={LOCALE_DEFINITIONS[locale].languageTag} data-layer="publisher">
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
