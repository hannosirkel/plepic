/**
 * A thin, App Router-side convenience re-export of `content/routes.ts`'s
 * `ROUTE_PATHS`. Exists so a component that needs one specific path (a
 * privacy-page link in a consent banner, say) does not have to import the
 * whole map and index into it inline. It re-exports values, never invents a
 * path of its own — `ROUTE_PATHS` in `content/routes.ts` stays the single
 * source of truth.
 */

import { ROUTE_PATHS } from "../../../content/routes.js";

export const legalPrivacyPath = ROUTE_PATHS.legalPrivacy;
