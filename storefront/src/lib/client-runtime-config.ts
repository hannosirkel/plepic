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
 *
 * ## Publication is opt-in, and used not to be
 *
 * This blob is serialized into the HTML of **every** route, because it is
 * written from the root layout. It was built by spreading `RuntimeConfig`
 * wholesale — `{ ...runtimeConfig, isTestHost }` — so every field the
 * configuration object had, and every field it would ever gain, was published
 * to the browser on `/cart`, `/checkout` and every legal page by default.
 * `merchant.contactAddress` was already in it: once an operator sets
 * `MERCHANT_CONTACT_ADDRESS`, `curl https://<canonical-host>/checkout | grep @`
 * returned the merchant's address from a page that never quotes it, and no
 * client-side code read it.
 *
 * That address is a public business address that must appear on the Imprint by
 * law, so this was not a leak. The defect is the **default**: a spread means
 * the next value added to `RuntimeConfig` is published to every page unless
 * someone remembers it should not be, and `RuntimeConfig` is where Task 5's
 * Stripe and Medusa configuration lands. So the projection below names its
 * fields, one by one, and {@link CLIENT_RUNTIME_CONFIG_KEYS} pins the set —
 * `tests/runtime-config.test.ts` fails when a new field appears on either
 * side, which makes publishing one a decision somebody has to make on purpose.
 */

import type { RuntimeConfig } from "../config/runtime-config.js";

export const RUNTIME_CONFIG_ELEMENT_ID = "plepic-runtime-config";

/**
 * What the client actually receives. Named field by field rather than
 * extending `RuntimeConfig`, so a field added there is *not* published here
 * until someone adds it here too.
 */
export interface ClientRuntimeConfig {
  readonly baseUrl: string;
  readonly canonicalHost: string;
  readonly analytics: RuntimeConfig["analytics"];
  readonly turnstile: RuntimeConfig["turnstile"];
  /** This request's host classification. The one field that is not environment configuration. */
  readonly isTestHost: boolean;
}

/** Every key the browser is given, sorted. The test asserts the served blob carries exactly these. */
export const CLIENT_RUNTIME_CONFIG_KEYS: readonly (keyof ClientRuntimeConfig)[] = [
  "analytics",
  "baseUrl",
  "canonicalHost",
  "isTestHost",
  "turnstile",
];

/**
 * Projects the server's `RuntimeConfig` onto the subset the browser is given.
 *
 * Deliberately not a spread and deliberately not `Omit<>`: both publish a new
 * field the moment one is added. Anything a browser genuinely needs is added
 * here explicitly, with the same question asked of it that
 * `merchant.contactAddress` failed — does client-side code read it?
 */
export function toClientRuntimeConfig(config: RuntimeConfig, isTestHost: boolean): ClientRuntimeConfig {
  return {
    baseUrl: config.baseUrl,
    canonicalHost: config.canonicalHost,
    analytics: config.analytics,
    turnstile: config.turnstile,
    isTestHost,
  };
}
