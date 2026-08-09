/**
 * The client-side half of the one serialized runtime-config object.
 *
 * The server writes it once, into `<script id="RUNTIME_CONFIG_ELEMENT_ID"
 * type="application/json">` (see `RuntimeConfigScript.tsx`). A
 * `type="application/json"` script block is inert — the browser never
 * executes it — so it is data waiting to be read, not code: a consumer reads
 * it back with `JSON.parse` over the element's `textContent`, from an effect
 * or an event handler and never from the top of a render function, because
 * reading it during the first render pass would desync server- and
 * client-rendered output on the very first paint.
 *
 * No reader is committed here yet. This unit's only consumers of runtime
 * configuration — the consent-gated analytics loader and the Turnstile widget
 * — receive their values as props from `src/app/layout.tsx`, which already
 * read them server-side. The blob exists because Task 5's client-side Stripe
 * and Medusa code will need them without a prop chain, and the shape it is
 * delivered in is what this unit is establishing.
 */

import type { RuntimeConfig } from "../config/runtime-config.js";

export const RUNTIME_CONFIG_ELEMENT_ID = "plepic-runtime-config";

/** What the client actually receives: the environment config, plus this request's host classification. */
export interface ClientRuntimeConfig extends RuntimeConfig {
  readonly isTestHost: boolean;
}
