/**
 * Turns a site-relative {@link RoutePath} into an absolute URL on the
 * canonical host. The one place that string concatenation happens, so every
 * other module works in `RoutePath`s and never builds a URL string by hand.
 */

import type { RoutePath } from "../../../content/routes.js";

/** `baseUrl` must be an origin with no trailing slash, as {@link loadSiteHostConfig} returns. */
export function absoluteUrl(baseUrl: string, path: RoutePath | string): string {
  return new URL(path, `${baseUrl}/`).toString();
}
