/**
 * Resolves a content {@link LinkTarget} to something a page can render.
 *
 * Route and anchor targets resolve to a site-relative path straight from
 * `content/routes.ts` — no host, no scheme, matching that file's own rule.
 * External targets have no URL in content **by construction**: an
 * `ExternalTargetId` is a name, and the address behind it is deployment
 * configuration (`src/config/runtime-config.ts`'s `externalTargets`).
 *
 * A caller that has that configuration passes it and gets a real `href`. A
 * caller that does not — every static, unrouted mockup in this directory —
 * passes nothing, gets `undefined`, and renders the case as inert text rather
 * than a fabricated `href="#"`. Both behaviours are deliberate and both are
 * unchanged by this function gaining its second parameter.
 *
 * ## No external destination is a disclosure, and the distinction is the point
 *
 * A page that cannot resolve something has two honest options, and which one is
 * right turns on **what the missing thing is** rather than on how important the
 * link looks:
 *
 * 1. **The missing value _is_ the disclosure.** Nothing else on the page
 *    conveys it, so an unconfigured one leaves a legal notice that reads as
 *    complete and is not. The trader's name, registered address, register
 *    number, VAT number, contact address, telephone number and return address
 *    are all in this class. They are marked `legallyRequired` in
 *    `content/schema.ts`, resolved by `src/lib/configuration-placeholders.ts`,
 *    and rendered **loudly**: a named gap where the value belongs and a
 *    page-level notice enumerating what is absent. That is unchanged.
 * 2. **The prose beside the link already carries the disclosure**, and the
 *    address only makes it easier to act on. An unconfigured one costs a
 *    reader convenience, not information, so it degrades **quietly** — the link
 *    is simply not rendered — and the page says nothing about it.
 *
 * **Every destination in `content/routes.ts`'s `EXTERNAL_TARGETS` is in class 2
 * today, including `consumer-disputes-committee`**, and that last one is a
 * decision rather than an oversight. Article 6(1)(t) CRD requires the
 * out-of-court body; `content/legal/terms.ts` names the Consumer Disputes
 * Committee in prose, and the operator, with the qualified reviewer's manual
 * verification on 2026-08-10, confirmed that naming it without an access method
 * satisfies the article. The URL is a real improvement on that and it stays —
 * but an optional enhancement must not be able to make a legally complete page
 * announce itself as incomplete, which is exactly what the previous revision
 * did by putting this id in a required-gap set.
 *
 * This module therefore has no gap mechanism at all, and that is deliberate:
 * class 1 is about **values**, and it lives in one place, one namespace and one
 * test — `configuration-placeholders.ts` and the `legallyRequired` flag behind
 * it. A destination that ever genuinely belonged in class 1 would be a
 * disclosure `content/` could not state in prose, which is a different problem
 * from a dead link and should be built as one when it exists, not kept warm
 * here on the strength of a case that turned out not to be one.
 */
import { ROUTE_PATHS } from "../../../../content/routes.js";
import type { LinkTarget } from "../../../../content/schema.js";
import type { ExternalTargetUrls } from "../../config/runtime-config.js";

export function resolveLinkHref(
  target: LinkTarget,
  externalUrls: ExternalTargetUrls = {},
): string | undefined {
  switch (target.kind) {
    case "route":
      return target.anchor ? `${ROUTE_PATHS[target.to]}#${target.anchor}` : ROUTE_PATHS[target.to];
    case "anchor":
      return `#${target.to}`;
    case "external":
      return externalUrls[target.to] ?? undefined;
    default:
      return undefined;
  }
}
