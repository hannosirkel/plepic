/**
 * Two jobs, both configuration-driven, both request-time:
 *
 * 1. **Host-based redirects.** `www.<canonical>`, the alternate-brand host,
 *    and its `www` variant (see `config/redirect-map.ts`) each resolve to
 *    exactly one destination on the canonical host and answer a single 301.
 *    A request to the canonical host itself never matches an entry in the
 *    map, so there is no second hop and no loop — and that is now an
 *    **enforced** guard, not just a fact about the maps this file has been
 *    tested against so far: `isCanonicalHost` gates the whole redirect branch
 *    below with an early return, so a typo that adds the apex to the
 *    operator map at Task 5 cannot turn into an infinite redirect on the live
 *    site. The redirect also forwards the inbound query string
 *    (`request.nextUrl.search`) onto the single resolved target path —
 *    dropping it would discard `utm_*` campaign attribution on exactly the
 *    migration traffic the plan keeps analytics running to measure, and
 *    appending it before the one `absoluteUrl` call keeps the redirect a
 *    single hop rather than a second one that re-attaches it.
 1b. **Retired routes.** A route in `content/routes.ts`'s `RETIRED_ROUTES`
 *    keeps its path and publishes no page, so it answers a 301 to the route
 *    that replaced it. Retirement is applied **after** the host map has
 *    resolved its route id to a path, and to the direct request otherwise, so
 *    `www.<canonical>/about` is one hop to the canonical `/` rather than two.
 *    The map cannot reintroduce a chain by targeting a retired route, because
 *    the same resolution runs on its output.
 * 2. **CSP nonce and the test-host `X-Robots-Tag`.** A fresh nonce is minted
 *    per request and the resulting policy is set in **three** places, all
 *    with the identical nonce:
 *
 *    - the **`Content-Security-Policy` response header**, which is what the
 *      browser enforces;
 *    - the **`content-security-policy` request header**, which is the *only*
 *      input Next.js itself reads a nonce from. `app-render` does
 *      `headers['content-security-policy']` and then parses the first
 *      `'nonce-…'` source out of the `script-src` directive
 *      (`next/dist/server/app-render/get-script-nonce-from-header.js`). That
 *      nonce is what it stamps on the framework bundle, the route chunks, the
 *      inline `self.__next_f.push(…)` flight scripts and the precedence
 *      stylesheet links. Next's own `with-strict-dynamic` example sets the
 *      policy on both request and response for exactly this reason, and this
 *      matters here because `lib/csp.ts` emits `'strict-dynamic'`: under CSP
 *      Level 3 that makes a browser ignore `'self'` and every host-source in
 *      `script-src`, leaving the nonce as the only thing that can authorise a
 *      script at all;
 *    - the `x-nonce` request header, which Next.js does **not** read. It
 *      exists purely so application code can get at the bare value without
 *      re-parsing the policy (`src/lib/nonce.ts`).
 *
 *    A request whose `Host` is in `SiteHostConfig.testHostnames` — checked
 *    against validated configuration, never against the request string by
 *    pattern — additionally gets `X-Robots-Tag: noindex, nofollow`.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; the export is named
 * `proxy` accordingly. The `nodejs` runtime (the only one `proxy` supports)
 * is required here anyway: `loadRedirectMap` may read a file from disk.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ROUTE_PATHS } from "../../content/routes.js";
import type { RouteId } from "../../content/routes.js";
import { finalRouteFor, isRetiredRoute } from "../../content/schema.js";
import { isCanonicalHost, isTestHost, loadSiteHostConfig } from "./config/hosts.js";
import { loadRedirectMap, resolveRedirect } from "./config/redirect-map.js";
import { buildContentSecurityPolicy } from "./lib/csp.js";
import { absoluteUrl } from "./lib/urls.js";

/** Path-to-route lookup, built once, for resolving retirement by path. */
const ROUTE_ID_BY_PATH: ReadonlyMap<string, RouteId> = new Map(
  Object.entries(ROUTE_PATHS).map(([routeId, path]) => [path, routeId as RouteId]),
);

/**
 * `path`, or the path that replaced it when it names a retired route.
 *
 * Exact matches only. A retired route's *descendants* are not retired by
 * association — `/about/team` was never a route and 404s, which is the honest
 * answer for a URL that never existed.
 */
function retirePath(path: string): string {
  const routeId = ROUTE_ID_BY_PATH.get(path);
  if (routeId === undefined || !isRetiredRoute(routeId)) return path;
  return ROUTE_PATHS[finalRouteFor(routeId)];
}

export function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get("host") ?? "";
  const hostConfig = loadSiteHostConfig();

  // Enforced, not assumed: the canonical host must never be redirected by
  // this mechanism, on pain of a self-redirect loop. See this module's doc
  // comment.
  if (!isCanonicalHost(host, hostConfig)) {
    const redirectMap = loadRedirectMap();
    const redirect = resolveRedirect(host, request.nextUrl.pathname, redirectMap);
    if (redirect !== null) {
      // Resolved through retirement, so a map that still targets `about`
      // produces one hop to `/` rather than a hop to `/about` and a second
      // one out of it. The operator's Task 1 map does target it.
      const target = `${retirePath(redirect.targetPath)}${request.nextUrl.search}`;
      return NextResponse.redirect(absoluteUrl(hostConfig.baseUrl, target), 301);
    }
  }

  const retired = retirePath(request.nextUrl.pathname);
  if (retired !== request.nextUrl.pathname) {
    const target = `${retired}${request.nextUrl.search}`;
    return NextResponse.redirect(absoluteUrl(hostConfig.baseUrl, target), 301);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  // What Next.js parses its own nonce out of. Without this, every script and
  // stylesheet Next emits depends on an internal implementation detail to be
  // nonced at all — see this module's doc comment.
  requestHeaders.set("content-security-policy", csp);
  // What application code reads the bare value from.
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // What the browser enforces.
  response.headers.set("Content-Security-Policy", csp);

  if (isTestHost(host, hostConfig)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon\\.ico).*)",
    },
  ],
};
