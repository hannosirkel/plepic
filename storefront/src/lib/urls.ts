/**
 * The canonical-URL module: what URL a route has, in a locale, on the
 * canonical host — and the inverse, what locale and route a served path is.
 *
 * The one place URL string concatenation happens, so every other module works
 * in `RoutePath`s and `Locale`s and never builds a path by hand. Both
 * directions live here on purpose: {@link localizedPath} and
 * {@link parseLocalizedPath} are inverses, and an inverse pair that lives in
 * two files is a pair that drifts. A round-trip test asserts they are one.
 *
 * **It knows locales but not pages.** Nothing here imports a page registry.
 * `src/proxy.ts` imports this module and runs on every request, so what this
 * file depends on is what the request path costs; `content/routes.ts` is a
 * table of paths and locale definitions and nothing else. Which locales
 * actually *publish* a given route is a question about content, and it is
 * answered in `./seo.ts`.
 */

import {
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  LOCALES,
  ROUTE_PATHS,
  type Locale,
  type RouteId,
  type RoutePath,
} from "../../../content/routes.js";

/** `baseUrl` must be an origin with no trailing slash, as {@link loadSiteHostConfig} returns. */
export function absoluteUrl(baseUrl: string, path: RoutePath | string): string {
  return new URL(path, `${baseUrl}/`).toString();
}

/**
 * The path `path` is served at in `locale`.
 *
 * The default locale's prefix is the empty string, so its paths are the bare
 * `ROUTE_PATHS` — unchanged, un-redirected, and identical to what this site
 * served before a locale dimension existed. That is a deliberate property:
 * every link, backlink and redirect target that already points at this site
 * keeps pointing at the same URL, and a locale is added by giving it URLs
 * nobody has yet rather than by moving everyone else's.
 */
export function localizedPath(locale: Locale, path: RoutePath | string): string {
  const { pathPrefix } = LOCALE_DEFINITIONS[locale];
  if (pathPrefix === "") return path;
  return path === "/" ? pathPrefix : `${pathPrefix}${path}`;
}

export interface ParsedPath {
  readonly locale: Locale;
  /** The path with the locale prefix removed: always a bare `ROUTE_PATHS`-shaped path. */
  readonly path: string;
}

/**
 * Splits a served pathname into the locale it was served in and the bare path
 * underneath it. The inverse of {@link localizedPath}.
 *
 * A pathname carrying no known prefix is the default locale's, because the
 * default locale is defined as the one served at the bare paths. That makes
 * this total rather than nullable, which matters: a nullable answer invites a
 * caller to invent a fallback, and two callers inventing two fallbacks is how
 * one URL ends up with two canonicals.
 */
export function parseLocalizedPath(pathname: string): ParsedPath {
  for (const locale of LOCALES) {
    const { pathPrefix } = LOCALE_DEFINITIONS[locale];
    if (pathPrefix === "") continue;
    if (pathname === pathPrefix) return { locale, path: "/" };
    if (pathname.startsWith(`${pathPrefix}/`)) {
      return { locale, path: pathname.slice(pathPrefix.length) };
    }
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/**
 * The locale served under the first path segment `segment`, or `undefined`.
 *
 * Used by the localized router, which receives that segment as a dynamic
 * route parameter rather than as a pathname. The default locale is **never**
 * returned: its prefix is empty, so `/en/legal/imprint` is not one of its
 * URLs and must 404 rather than answer with a second copy of a page that
 * already has a canonical.
 */
export function localeForPathSegment(segment: string): Locale | undefined {
  return LOCALES.find((locale) => {
    const { pathPrefix } = LOCALE_DEFINITIONS[locale];
    return pathPrefix !== "" && pathPrefix === `/${segment}`;
  });
}

/** The route whose bare path is exactly `path`, or `undefined`. */
export function routeIdForPath(path: string): RouteId | undefined {
  return (Object.keys(ROUTE_PATHS) as RouteId[]).find((routeId) => ROUTE_PATHS[routeId] === path);
}

/**
 * The one canonical URL of `routeId` in `locale`.
 *
 * Exactly one canonical per page per locale falls out of this being the only
 * way anything builds one: the metadata, the sitemap and the `hreflang`
 * alternates all call it, so there is no second construction to disagree with.
 */
export function canonicalUrl(baseUrl: string, locale: Locale, routeId: RouteId): string {
  return absoluteUrl(baseUrl, localizedPath(locale, ROUTE_PATHS[routeId]));
}
