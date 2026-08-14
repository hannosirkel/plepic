/**
 * The one list of every environment variable this application reads.
 *
 * It exists so the two guards under `tests/` cannot be silently outgrown:
 *
 * - `tests/runtime-config.test.ts` scans `src/` for every name handed to a
 *   reader in `config/env.ts` and asserts the set is exactly this list, so a
 *   new variable cannot be introduced without appearing here; and
 * - `tests/build-and-serve.test.ts` asserts every name here has a build-time
 *   canary value in its scan of the built artifact, so a new variable cannot
 *   appear here without also being proved absent from the image.
 *
 * Together those two make "nothing that differs between environments is baked
 * into an image" self-enforcing rather than hand-maintained. That matters at
 * the exact moment the plan warns about: Task 5 lands the Stripe and Medusa
 * publishable keys, and adding either without a canary is a one-line change
 * that would otherwise pass every test in this repository.
 *
 * Adding a variable is deliberately three edits — the call site, this list,
 * and the canary — and the tests name whichever one is missing.
 */

/**
 * ## The `MERCHANT_*` set
 *
 * Seven variables, and every one of them is a **legally required disclosure**:
 * Article 5(1) of the e-Commerce Directive and Article 6(1) CRD between them
 * oblige the trader to state its name, its registered address, its register
 * entry, its VAT number, an electronic address, a telephone number (Article
 * 6(1)(c) as amended by Directive (EU) 2019/2161 — the "where available"
 * qualifier is gone) and the address returns go to.
 *
 * They are configuration rather than content because Global Constraints put
 * account addresses in configuration, and because `content/` is a public
 * repository of copy while a deployment's identity is a deployment's own fact.
 * The operator supplied the whole set on 2026-08-09; it belongs in the private
 * inventory and reaches a pod as environment.
 *
 * **Absent is not the same as optional for these.** `MERCHANT_CONTACT_ADDRESS`
 * also appears in optional Support-page prose, where dropping the sentence is
 * the honest answer; on a legal page every one of them is rendered as a named,
 * visible gap with a page-level notice instead. See
 * `src/lib/configuration-placeholders.ts` for why silently dropping a
 * registration number is a compliance defect rather than a graceful
 * degradation.
 */
export const RUNTIME_ENV_VARS = [
  /** GA4 measurement ID. Absent means the analytics loader never mounts. */
  "ANALYTICS_MEASUREMENT_ID",
  /**
   * The web address of the Consumer Disputes Committee at the Estonian
   * Consumer Protection and Technical Regulatory Authority.
   *
   * It is configuration for the same reason the `MERCHANT_*` set is: `content/`
   * may carry no hostname and no absolute URL, so the copy on `/legal/terms`
   * carries only the `consumer-disputes-committee` external-target id and a
   * deployment supplies the URL.
   *
   * **Absent is optional here, unlike the set above.** The operator, with the
   * qualified reviewer's manual verification on 2026-08-10, ruled that naming
   * the out-of-court body without an access method satisfies Article 6(1)(t)
   * CRD, and `content/legal/terms.ts` names it in its own prose. The address is
   * therefore an enhancement: an unset variable renders one link fewer and
   * changes nothing else — no gap marker, and no incompleteness notice. The
   * mechanism that would have produced one was removed rather than emptied, so
   * there is no set to add this id back into; see
   * `src/components/mockups/link-target.ts` for the rule and
   * `tests/legal-pages.test.tsx` for both states asserted.
   *
   * It is still worth supplying — the page is better with it — but it does not
   * gate the page's completeness and must not be held for.
   */
  "EXTERNAL_URL_CONSUMER_DISPUTES_COMMITTEE",
  /**
   * Customer contact address — the trader's electronic address. On the Support
   * page, absent means the copy that quotes it is suppressed; on a legal page
   * and in the product page's manufacturer block, absent means a named gap and
   * a notice. Never an unresolved `{merchantContactAddress}`, and never a
   * fabricated address.
   *
   * The four `CATALOGUE_MOCK_*` variables that used to sit here are gone: the
   * price, currency, availability and product name are identical in every
   * environment, so configuring them per environment only made it possible
   * for the structured data and the rendered page to disagree — which they
   * did. See `src/config/runtime-config.ts`.
   */
  "MERCHANT_CONTACT_ADDRESS",
  /** Registered legal name of the trader, as filed. */
  "MERCHANT_LEGAL_NAME",
  /** Trader's telephone number. Mandatory under Article 6(1)(c) CRD as amended. */
  "MERCHANT_PHONE_NUMBER",
  /** Registered address of the trader, as filed. */
  "MERCHANT_REGISTERED_ADDRESS",
  /** Commercial-register entry number. */
  "MERCHANT_REGISTRATION_NUMBER",
  /** Postal address returns are sent to. */
  "MERCHANT_RETURN_ADDRESS",
  /** VAT identification number. */
  "MERCHANT_VAT_NUMBER",
  /** Namespace-local Medusa origin used by the request-time Store API proxy. */
  "MEDUSA_BACKEND_URL",
  /** Public Store API credential serialized into the request-time browser config. */
  "MEDUSA_PUBLISHABLE_API_KEY",
  /** Path to the operator's redirect map; absent means the committed fixture. */
  "REDIRECT_MAP_PATH",
  /** Canonical origin, no trailing slash. */
  "SITE_BASE_URL",
  /** Bare canonical hostname. */
  "SITE_CANONICAL_HOST",
  /** Comma-separated hostnames that must never be indexed and never load analytics. */
  "SITE_TEST_HOSTNAMES",
  /** Public Stripe.js credential serialized into the request-time browser config. */
  "STRIPE_PUBLISHABLE_KEY",
  /** Cloudflare Turnstile site key. Absent means no widget renders. */
  "TURNSTILE_SITE_KEY",
] as const;

export type RuntimeEnvVar = (typeof RUNTIME_ENV_VARS)[number];
