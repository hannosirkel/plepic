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
 * The **merchant's identity** does. Global Constraints put account addresses
 * in configuration rather than in content files, and `content/` carries all
 * seven fields as literal template strings — `{merchantLegalName}`,
 * `{merchantRegisteredAddress}`, `{merchantRegistrationNumber}`,
 * `{merchantVatNumber}`, `{merchantContactAddress}`, `{merchantPhoneNumber}`
 * and `{returnAddress}` — which `src/lib/configuration-placeholders.ts`
 * resolves at render. The operator supplied the set on 2026-08-09; it lives in
 * the private inventory and reaches a pod as environment, never as a committed
 * value.
 *
 * Until a deployment sets them, `null` is the honest value, and what a page
 * does with a `null` depends on what that page owes the reader. The Support
 * page **suppresses** the sentence: every visitor to `/support/lunar-base`
 * once read "You can also reach us at {merchantContactAddress}." in plain body
 * type, and losing an alternative contact route costs a visitor nothing they
 * could have used. A legal page, and the product page's GPSR block, **name the
 * gap where it is and say so at the top**, because an imprint that quietly
 * loses its registration number renders as a complete legal notice that is not
 * one.
 *
 * **So does the address behind a named external target**, and it is the other
 * failure mode rather than the same one. `content/routes.ts` declares
 * `EXTERNAL_TARGETS` as ids precisely so no content file has to hold a URL, and
 * `EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE` carries the one address a legal
 * page links to. An unset one is **not** treated like an unset registration
 * number: the link is simply not rendered, and the page shows no gap marker and
 * no incompleteness notice.
 *
 * That is the operator's ruling of 2026-08-10, verified manually by the
 * qualified reviewer — naming the out-of-court body without an access method
 * satisfies Article 6(1)(t) CRD, and `content/legal/terms.ts` names the
 * Consumer Disputes Committee in its own prose. The distinction is *what the
 * missing thing is*: a registration number **is** the disclosure and nothing
 * else on the page carries it, while the address only makes a remedy the prose
 * already stated easier to reach. An optional enhancement must not be able to
 * make a legally complete page announce itself incomplete, which is what the
 * first revision did. `src/components/mockups/link-target.ts` holds the rule;
 * `tests/legal-pages.test.tsx` asserts both states.
 */

import type { ExternalTargetId } from "../../../content/routes.js";
import { readEnv, type EnvRecord } from "./env.js";
import { loadSiteHostConfig, type SiteHostConfig } from "./hosts.js";

/**
 * The trader's identity, as a deployment supplies it.
 *
 * Every field is `string | null`, and `null` means "this deployment has not
 * configured it" — never a placeholder, never an empty string, never a
 * fabricated value. What a page does with a `null` depends on what the page
 * owes the reader: optional Support-page prose is dropped, a legal disclosure
 * is rendered as a named, visible gap alongside a notice that the page is
 * incomplete. `src/lib/configuration-placeholders.ts` owns that distinction.
 *
 * The set grew from one field to seven when the second qualified legal read
 * landed: an imprint owes a register number, a VAT number, a registered
 * address and — after Directive (EU) 2019/2161 removed the "where available"
 * qualifier from Article 6(1)(c) CRD — a telephone number.
 */
export interface MerchantConfig {
  readonly legalName: string | null;
  readonly registeredAddress: string | null;
  readonly registrationNumber: string | null;
  readonly vatNumber: string | null;
  readonly contactAddress: string | null;
  readonly phoneNumber: string | null;
  readonly returnAddress: string | null;
}

/**
 * URLs for the named external destinations `content/routes.ts` declares.
 *
 * A content file links by **id** — `{ kind: "external", to: … }` — because it
 * may carry no absolute URL and no host. This is the other half: the id, and
 * the address a deployment puts behind it. `null` means "this deployment has
 * not configured it", and what a page does with a `null` is again a question
 * of what that page owes the reader, not of taste.
 *
 * Only the ids a deployment can actually configure appear here. The other
 * seven external targets (the campaign, the two video links, the retailer, the
 * two social profiles, the listing sites) have no variable behind them yet and
 * are still rendered as inert text by `src/components/mockups/link-target.ts`;
 * this type is `Partial` so that stays a visible fact rather than seven
 * permanently-null fields pretending to be configurable.
 */
export type ExternalTargetUrls = Readonly<Partial<Record<ExternalTargetId, string | null>>>;

export interface RuntimeConfig {
  readonly baseUrl: string;
  readonly canonicalHost: string;
  readonly analytics: { readonly measurementId: string | null };
  readonly turnstile: { readonly siteKey: string | null };
  readonly medusa: {
    /** Namespace-local backend origin, consumed only by the server-side proxy. */
    readonly backendUrl: string | null;
    /** Public credential deliberately projected to the browser at request time. */
    readonly publishableKey: string | null;
  };
  readonly stripe: { readonly publishableKey: string | null };
  readonly merchant: MerchantConfig;
  readonly externalTargets: ExternalTargetUrls;
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
    medusa: {
      backendUrl: readEnv("MEDUSA_BACKEND_URL", env) ?? null,
      publishableKey: readEnv("MEDUSA_PUBLISHABLE_API_KEY", env) ?? null,
    },
    stripe: { publishableKey: readEnv("STRIPE_PUBLISHABLE_KEY", env) ?? null },
    merchant: {
      legalName: readEnv("MERCHANT_LEGAL_NAME", env) ?? null,
      registeredAddress: readEnv("MERCHANT_REGISTERED_ADDRESS", env) ?? null,
      registrationNumber: readEnv("MERCHANT_REGISTRATION_NUMBER", env) ?? null,
      vatNumber: readEnv("MERCHANT_VAT_NUMBER", env) ?? null,
      contactAddress: readEnv("MERCHANT_CONTACT_ADDRESS", env) ?? null,
      phoneNumber: readEnv("MERCHANT_PHONE_NUMBER", env) ?? null,
      returnAddress: readEnv("MERCHANT_RETURN_ADDRESS", env) ?? null,
    },
    externalTargets: {
      "consumer-disputes-committee":
        readEnv("EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE", env) ?? null,
    },
  };
}
