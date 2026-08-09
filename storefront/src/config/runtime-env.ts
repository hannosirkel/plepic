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

export const RUNTIME_ENV_VARS = [
  /** GA4 measurement ID. Absent means the analytics loader never mounts. */
  "ANALYTICS_MEASUREMENT_ID",
  /** schema.org availability token for the mock catalogue's offer. */
  "CATALOGUE_MOCK_AVAILABILITY",
  /** Mock catalogue price, in minor currency units. */
  "CATALOGUE_MOCK_PRICE_AMOUNT",
  /** ISO 4217 code for the mock catalogue's price. */
  "CATALOGUE_MOCK_PRICE_CURRENCY",
  /** Display name of the one product. */
  "CATALOGUE_MOCK_PRODUCT_NAME",
  /** Path to the operator's redirect map; absent means the committed fixture. */
  "REDIRECT_MAP_PATH",
  /** Canonical origin, no trailing slash. */
  "SITE_BASE_URL",
  /** Bare canonical hostname. */
  "SITE_CANONICAL_HOST",
  /** Comma-separated hostnames that must never be indexed and never load analytics. */
  "SITE_TEST_HOSTNAMES",
  /** Cloudflare Turnstile site key. Absent means no widget renders. */
  "TURNSTILE_SITE_KEY",
] as const;

export type RuntimeEnvVar = (typeof RUNTIME_ENV_VARS)[number];
