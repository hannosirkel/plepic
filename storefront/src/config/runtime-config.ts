/**
 * The one per-environment configuration object.
 *
 * Next.js inlines every `NEXT_PUBLIC_*` value into the client bundle at build
 * time, so **none** of these values are ever read that way: not the base
 * URL, not the analytics measurement ID, not the Turnstile site key, and
 * (once Task 5 lands them) not the Stripe or Medusa publishable keys either.
 * `getRuntimeConfig` reads `process.env` itself, inside a function called
 * from dynamically-rendered request handling — see `src/app/layout.tsx`,
 * which sets `export const dynamic = "force-dynamic"` so every page under it
 * renders per request rather than being collected at build time. The
 * resulting object is computed fresh per request and handed to the browser
 * once, as a single serialized blob (`RuntimeConfigScript`), never spread
 * across several `NEXT_PUBLIC_*` variables.
 *
 * ## The catalogue is not configuration, and no longer pretends to be
 *
 * This module used to carry a `catalogueMock` built from
 * `CATALOGUE_MOCK_PRICE_AMOUNT`, `_PRICE_CURRENCY`, `_AVAILABILITY` and
 * `_PRODUCT_NAME`, feeding the product page's `Product`/`Offer` JSON-LD,
 * while the *visible* page read `storefront/mock/catalogue.json`. Those are
 * two sources for one fact, and they disagreed in practice: one request to
 * one page served a different amount, a different currency,
 * `"availability":"OutOfStock"` and a different product name to a search
 * engine while showing a human the catalogue's own amount and name, in
 * stock. Nothing failed and nothing warned. In the **default** state —
 * nothing configured — `offers` was omitted entirely, so the page advertised
 * a price to people and no price at all to search engines.
 *
 * The price, currency, availability and product name are the same in every
 * environment: it is one product at one advertised price worldwide. They
 * never met this file's own admission criterion ("nothing that *differs*
 * between environments"), and the indirection bought nothing but the
 * opportunity to disagree. They are gone from here.
 * `storefront/mock/catalogue.json`, read through `src/lib/catalogue.ts`, is
 * now the single source for both the rendered page and the structured data —
 * see `src/lib/product-jsonld.ts` and `tests/product-jsonld.test.ts`, which
 * imports both and fails if the two ever differ. Task 5 replaces that one
 * module with a Medusa lookup and both consumers follow it.
 *
 * ## What stays configuration
 *
 * `merchantContactAddress` does differ, and does not exist yet: it is the
 * address customers write to, `content/schema.ts` marks it `unresolved`, and
 * `content/` (read-only here) carries it as the literal template string
 * `{merchantContactAddress}`. Until an operator sets
 * `MERCHANT_CONTACT_ADDRESS`, `null` is the honest value, and the copy that
 * needs it is **suppressed rather than rendered with a brace in it** — see
 * `src/lib/configuration-placeholders.ts`. Every visitor to
 * `/support/lunar-base` previously read, in plain body type, "You can also
 * reach us at {merchantContactAddress}."
 */

import { readEnv, type EnvRecord } from "./env.js";
import { loadSiteHostConfig, type SiteHostConfig } from "./hosts.js";

export interface MerchantConfig {
  /**
   * The customer contact address, or `null` when this deployment has not
   * configured one. Never a placeholder and never a fabricated address: copy
   * that needs it is dropped when it is `null`.
   */
  readonly contactAddress: string | null;
}

export interface RuntimeConfig {
  readonly baseUrl: string;
  readonly canonicalHost: string;
  readonly analytics: { readonly measurementId: string | null };
  readonly turnstile: { readonly siteKey: string | null };
  readonly merchant: MerchantConfig;
}

/**
 * Assembles the runtime config object. Call this from inside a dynamically
 * rendered request — never at module scope — so the values it reads are
 * this request's environment, not whatever happened to be set when the image
 * was built.
 */
export function getRuntimeConfig(env: EnvRecord = process.env): RuntimeConfig {
  const hostConfig: SiteHostConfig = loadSiteHostConfig(env);

  return {
    baseUrl: hostConfig.baseUrl,
    canonicalHost: hostConfig.canonicalHost,
    analytics: { measurementId: readEnv("ANALYTICS_MEASUREMENT_ID", env) ?? null },
    turnstile: { siteKey: readEnv("TURNSTILE_SITE_KEY", env) ?? null },
    merchant: { contactAddress: readEnv("MERCHANT_CONTACT_ADDRESS", env) ?? null },
  };
}
