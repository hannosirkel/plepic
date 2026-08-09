/**
 * Resolves a content {@link LinkTarget} to something a mockup can render.
 *
 * Route and anchor targets resolve to a site-relative path straight from
 * `content/routes.ts` — no host, no scheme, matching that file's own rule.
 * External targets deliberately do **not** resolve here: the destination
 * URL for an `ExternalTargetId` comes from runtime configuration
 * (`src/config/runtime-config.ts`), which a static, unrouted mockup has no
 * business reading. `resolveLinkHref` returns `undefined` for one, and every
 * caller in this directory renders that case as inert text rather than a
 * fabricated `href="#"` — the real anchor arrives when whichever unit wires
 * this markup into a route also wires the runtime config that resolves it.
 */
import { ROUTE_PATHS } from "../../../../content/routes.js";
import type { LinkTarget } from "../../../../content/schema.js";

export function resolveLinkHref(target: LinkTarget): string | undefined {
  switch (target.kind) {
    case "route":
      return target.anchor ? `${ROUTE_PATHS[target.to]}#${target.anchor}` : ROUTE_PATHS[target.to];
    case "anchor":
      return `#${target.to}`;
    case "external":
      return undefined;
    default:
      return undefined;
  }
}
