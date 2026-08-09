import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ConfigError } from "../src/config/env.js";
import { getRuntimeConfig } from "../src/config/runtime-config.js";
import { RUNTIME_ENV_VARS } from "../src/config/runtime-env.js";

const OFFER_ENV = {
  CATALOGUE_MOCK_PRICE_AMOUNT: "1234",
  CATALOGUE_MOCK_PRICE_CURRENCY: "usd",
  CATALOGUE_MOCK_AVAILABILITY: "OutOfStock",
};

describe("getRuntimeConfig", () => {
  it("has a null analytics measurement ID and turnstile site key when unconfigured, never a literal", () => {
    const config = getRuntimeConfig({});
    expect(config.analytics.measurementId).toBeNull();
    expect(config.turnstile.siteKey).toBeNull();
  });

  it("reads every field from the environment given to it, not from process.env of the test runner", () => {
    const config = getRuntimeConfig({
      SITE_BASE_URL: "https://canonical.example.net",
      SITE_CANONICAL_HOST: "canonical.example.net",
      ANALYTICS_MEASUREMENT_ID: "G-EXAMPLE1",
      TURNSTILE_SITE_KEY: "0x0000000000000000000AA",
      CATALOGUE_MOCK_PRODUCT_NAME: "Test Product",
      ...OFFER_ENV,
    });

    expect(config).toEqual({
      baseUrl: "https://canonical.example.net",
      canonicalHost: "canonical.example.net",
      analytics: { measurementId: "G-EXAMPLE1" },
      turnstile: { siteKey: "0x0000000000000000000AA" },
      catalogueMock: {
        productName: "Test Product",
        offer: {
          priceAmount: 1234,
          priceCurrency: "USD",
          availability: "OutOfStock",
        },
      },
    });
  });

  it("two calls with different environments never share a value — nothing is memoised at module scope", () => {
    const first = getRuntimeConfig({ ANALYTICS_MEASUREMENT_ID: "G-FIRST" });
    const second = getRuntimeConfig({ ANALYTICS_MEASUREMENT_ID: "G-SECOND" });
    expect(first.analytics.measurementId).toBe("G-FIRST");
    expect(second.analytics.measurementId).toBe("G-SECOND");
  });
});

/**
 * The offer is published as machine-readable `Product`/`Offer` structured
 * data to search engines. A default price there is not a placeholder, it is a
 * claim — and unlike the reserved example hostnames `config/hosts.ts` falls
 * back to, no price is reserved for the purpose. So: all three, or none.
 */
describe("the catalogue offer is never defaulted", () => {
  it("is null when nothing at all is configured, so the page can publish no price", () => {
    expect(getRuntimeConfig({}).catalogueMock.offer).toBeNull();
  });

  it("publishes no fabricated amount, currency or availability in that case", () => {
    const serialized = JSON.stringify(getRuntimeConfig({}));
    expect(serialized).not.toContain("3900");
    expect(serialized).not.toContain("EUR");
    expect(serialized).not.toContain("InStock");
  });

  for (const omitted of Object.keys(OFFER_ENV)) {
    it(`throws when ${omitted} is the only one missing, rather than silently defaulting it`, () => {
      const env: Record<string, string> = { ...OFFER_ENV };
      delete env[omitted];

      expect(() => getRuntimeConfig(env)).toThrow(ConfigError);
      expect(() => getRuntimeConfig(env)).toThrow(new RegExp(omitted));
    });
  }

  it("throws on an unrecognised availability token instead of coercing it to InStock", () => {
    expect(() =>
      getRuntimeConfig({ ...OFFER_ENV, CATALOGUE_MOCK_AVAILABILITY: "SoldOutForever" }),
    ).toThrow(ConfigError);
  });

  it("throws on a price amount that is not a whole number of minor units", () => {
    for (const amount of ["39.00", "-3900", "free", "3 900", ""]) {
      expect(() => getRuntimeConfig({ ...OFFER_ENV, CATALOGUE_MOCK_PRICE_AMOUNT: amount })).toThrow(
        ConfigError,
      );
    }
  });

  it("throws on a currency that is not a three-letter ISO 4217 code", () => {
    for (const currency of ["EURO", "E", "€", "12"]) {
      expect(() =>
        getRuntimeConfig({ ...OFFER_ENV, CATALOGUE_MOCK_PRICE_CURRENCY: currency }),
      ).toThrow(ConfigError);
    }
  });
});

/**
 * The anti-drift half of the build-time canary set.
 *
 * `tests/build-and-serve.test.ts` asserts every name in `RUNTIME_ENV_VARS`
 * has a canary in its build. That is only worth anything if `RUNTIME_ENV_VARS`
 * is itself complete, which this asserts by scanning for every literal handed
 * to a reader in `src/config/env.ts`. Between them, a variable added anywhere
 * under `src/` — Task 5's Stripe and Medusa publishable keys being the case
 * the plan explicitly warns about — cannot reach an image without a test
 * proving it is not baked into one.
 */
describe("RUNTIME_ENV_VARS is the complete set of variables src/ reads", () => {
  const srcDir = join(dirname(dirname(fileURLToPath(import.meta.url))), "src");

  function listSourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...listSourceFiles(path));
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
    }
    return files;
  }

  const READER_CALL = /\b(?:readEnv|optionalEnv|readEnvList)\(\s*"([A-Z0-9_]+)"/g;

  const files = listSourceFiles(srcDir);
  const found = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(READER_CALL)) {
      if (match[1] !== undefined) found.add(match[1]);
    }
  }

  it("scanned the source tree and found reads to check", () => {
    expect(files.length).toBeGreaterThan(15);
    expect(found.size).toBeGreaterThan(5);
  });

  it("declares every variable src/ actually reads", () => {
    const declared: readonly string[] = RUNTIME_ENV_VARS;
    const undeclared = [...found].filter((name) => !declared.includes(name)).toSorted();
    expect(
      undeclared,
      "add these to src/config/runtime-env.ts, then give each one a canary in build-and-serve.test.ts",
    ).toEqual([]);
  });

  it("declares nothing src/ does not read", () => {
    const unread = RUNTIME_ENV_VARS.filter((name) => !found.has(name)).toSorted();
    expect(unread, "these are listed in runtime-env.ts but nothing reads them").toEqual([]);
  });

  it("reads no environment variable outside config/, so the scan above is exhaustive", () => {
    // Comments stripped: several modules explain in prose that they never
    // touch `process.env`, which is the opposite of an offence.
    const stripComments = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    const configDir = join("src", "config");
    const offenders = files.filter(
      (file) => !file.includes(configDir) && /process\.env/.test(stripComments(readFileSync(file, "utf8"))),
    );

    expect(
      offenders.map((file) => file.replace(`${srcDir}/`, "")),
      "read configuration through src/config so RUNTIME_ENV_VARS stays the complete list",
    ).toEqual([]);
  });
});
