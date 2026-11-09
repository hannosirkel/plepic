/**
 * Links resolved for one edition ahead of time, for client components.
 *
 * Which URL a route target gets on a page depends on the page registry
 * (`localizedLinkFor` in `src/lib/seo.ts`): the edition's own URL where the
 * edition publishes the route, the default edition's, marked with its
 * language, where it does not. The registry is every edition's content, so a
 * client component cannot consult it without shipping all of it to the
 * browser. The server resolves every route once instead (`routeLinksFor`) and
 * hands the client the answers; {@link resolveLinkIn} then reads a target
 * from them exactly as `resolveLocalizedLink` in `./link-target.ts` would.
 *
 * Only types are imported here, so this module adds nothing to a bundle but
 * the function below.
 */
import type { RouteId } from "../../../../content/routes.js";
import type { LinkTarget } from "../../../../content/schema.js";

export interface ResolvedLink {
  /** `undefined` exactly where `resolveLinkHref` answers `undefined`. */
  readonly href: string | undefined;
  /** Set when a route target had to cross into the default edition -- see `localizedLinkFor`. */
  readonly hrefLang?: string;
}

/** Every route's link from one edition's pages. */
export type RouteLinks = Readonly<Record<RouteId, { readonly href: string; readonly hrefLang?: string }>>;

/**
 * `resolveLocalizedLink`'s answer, read from links already resolved for the
 * page's edition. An external target resolves to no URL: no client component
 * that uses this is handed external destinations.
 */
export function resolveLinkIn(links: RouteLinks, target: LinkTarget): ResolvedLink {
  switch (target.kind) {
    case "route": {
      const link = links[target.to];
      return target.anchor ? { ...link, href: `${link.href}#${target.anchor}` } : link;
    }
    case "anchor":
      return { href: `#${target.to}` };
    default:
      return { href: undefined };
  }
}
