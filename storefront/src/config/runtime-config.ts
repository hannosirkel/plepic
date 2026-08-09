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
 * `catalogueMock` is exactly what its name says: Task 2 has no catalogue —
 * Medusa lands in Task 5 — so the product's price, currency and availability
 * are mock values read from configuration the same way every other
 * per-environment value is, precisely so the JSON-LD and the runtime-config
 * plumbing this unit builds do not need to change shape when Task 5 replaces
 * the mock with a real catalogue lookup.
 *
 * ## Why the offer has no default
 *
 * The mock *values* are sanctioned; a silent fallback for them is not. Price,
 * currency and availability are published as machine-readable `Product` /
 * `Offer` structured data on the canonical product page, so a default here is
 * not a placeholder a developer sees and replaces — it is a **price claim
 * made to search engines**, and the completion criterion this feeds says that
 * data must be truthful. `config/hosts.ts` may fall back safely because
 * RFC 2606 reserves `example.com` for the purpose. There is no reserved
 * price.
 *
 * So {@link loadCatalogueOffer} takes all three or none:
 *
 * - **none set** — `offer` is `null` and `buildProductJsonLd` omits `offers`
 *   entirely. The page publishes no price rather than a wrong one.
 * - **all three set** — each is validated, and an unparsable amount, a
 *   non-ISO currency or an unknown availability token throws rather than
 *   being coerced. Coercing an unrecognised availability to `InStock` is the
 *   same fabrication in a smaller costume.
 * - **some set** — throws, naming the missing ones. Partial configuration is
 *   a deployment mistake, and failing loudly at the first request is the only
 *   way an operator finds out.
 */

import { ConfigError, optionalEnv, readEnv, type EnvRecord } from "./env.js";
import { loadSiteHostConfig, type SiteHostConfig } from "./hosts.js";

export type ProductAvailability = "InStock" | "OutOfStock" | "PreOrder" | "SoldOut";

const AVAILABILITY_VALUES: readonly ProductAvailability[] = [
  "InStock",
  "OutOfStock",
  "PreOrder",
  "SoldOut",
];

/** Non-negative integer, no sign, no decimal point: minor units or nothing. */
const MINOR_UNITS_PATTERN = /^\d+$/;
const ISO_4217_PATTERN = /^[A-Za-z]{3}$/;

export interface CatalogueOffer {
  /** Minor currency units (cents), never a float. */
  readonly priceAmount: number;
  /** ISO 4217, e.g. "EUR". */
  readonly priceCurrency: string;
  readonly availability: ProductAvailability;
}

export interface CatalogueMock {
  readonly productName: string;
  /**
   * `null` when the deployment configures no price at all. Never a default —
   * see this module's "Why the offer has no default".
   */
  readonly offer: CatalogueOffer | null;
}

export interface RuntimeConfig {
  readonly baseUrl: string;
  readonly canonicalHost: string;
  readonly analytics: { readonly measurementId: string | null };
  readonly turnstile: { readonly siteKey: string | null };
  readonly catalogueMock: CatalogueMock;
}

function isAvailability(value: string): value is ProductAvailability {
  return (AVAILABILITY_VALUES as readonly string[]).includes(value);
}

function loadCatalogueOffer(env: EnvRecord): CatalogueOffer | null {
  const amountRaw = readEnv("CATALOGUE_MOCK_PRICE_AMOUNT", env);
  const currencyRaw = readEnv("CATALOGUE_MOCK_PRICE_CURRENCY", env);
  const availabilityRaw = readEnv("CATALOGUE_MOCK_AVAILABILITY", env);

  const missing: string[] = [];
  if (amountRaw === undefined) missing.push("CATALOGUE_MOCK_PRICE_AMOUNT");
  if (currencyRaw === undefined) missing.push("CATALOGUE_MOCK_PRICE_CURRENCY");
  if (availabilityRaw === undefined) missing.push("CATALOGUE_MOCK_AVAILABILITY");

  // None configured: publish no price claim at all.
  if (missing.length === 3) return null;

  if (missing.length > 0) {
    throw new ConfigError(
      `incomplete catalogue offer configuration: ${missing.join(", ")} ` +
        `${missing.length === 1 ? "is" : "are"} unset while the others are set. ` +
        `Set all three, or none of them — a partially configured offer would publish ` +
        `a price this deployment cannot stand behind.`,
    );
  }

  if (amountRaw === undefined || currencyRaw === undefined || availabilityRaw === undefined) {
    // Unreachable: missing.length is 0 here. Present so the narrowing is the
    // compiler's, not a comment's.
    throw new ConfigError("catalogue offer configuration disappeared between reads");
  }

  if (!MINOR_UNITS_PATTERN.test(amountRaw)) {
    throw new ConfigError(
      `CATALOGUE_MOCK_PRICE_AMOUNT must be a non-negative integer number of minor ` +
        `currency units (3900 means 39.00) — got ${JSON.stringify(amountRaw)}.`,
    );
  }
  if (!ISO_4217_PATTERN.test(currencyRaw)) {
    throw new ConfigError(
      `CATALOGUE_MOCK_PRICE_CURRENCY must be a three-letter ISO 4217 code — got ` +
        `${JSON.stringify(currencyRaw)}.`,
    );
  }
  if (!isAvailability(availabilityRaw)) {
    throw new ConfigError(
      `CATALOGUE_MOCK_AVAILABILITY must be one of ${AVAILABILITY_VALUES.join(", ")} — got ` +
        `${JSON.stringify(availabilityRaw)}. It is published as schema.org availability, ` +
        `so an unrecognised value is not defaulted.`,
    );
  }

  return {
    priceAmount: Number.parseInt(amountRaw, 10),
    priceCurrency: currencyRaw.toUpperCase(),
    availability: availabilityRaw,
  };
}

function loadCatalogueMock(env: EnvRecord): CatalogueMock {
  return {
    // The product's name is not a price claim and is identical in every
    // environment, so it keeps a default. The offer does not.
    productName: optionalEnv("CATALOGUE_MOCK_PRODUCT_NAME", "Lunar Base", env),
    offer: loadCatalogueOffer(env),
  };
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
    catalogueMock: loadCatalogueMock(env),
  };
}
