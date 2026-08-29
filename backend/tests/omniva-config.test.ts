import { describe, expect, it } from "vitest";

import { readOmnivaConfig } from "../src/modules/omniva/config.js";

/**
 * `readOmnivaConfig` in isolation, against a plain `env` object rather than
 * `process.env` -- the whole point of it taking an explicit parameter (see
 * `config.ts`'s header) is that this suite never has to stub or restore a
 * global to prove the optionality rule.
 */
const FULL_ENV = {
  OMNIVA_API_USER: "user",
  OMNIVA_API_PASSWORD: "pass",
  OMNIVA_CUSTOMER_CODE: "CUSTOMER",
  OMNIVA_BASE_URL: "https://omx.omniva.eu",
  MERCHANT_SENDER_STREET: "Pihlaka tn 2",
  MERCHANT_SENDER_CITY: "Jüri alevik",
  MERCHANT_SENDER_POSTCODE: "75301",
  MERCHANT_SENDER_COUNTRY: "EE",
  MERCHANT_PHONE_NUMBER: "+37255550100",
  MERCHANT_LEGAL_NAME: "Plepic Games OÜ",
  MERCHANT_CONTACT_ADDRESS: "info@example.com",
} as const;

function withoutKey<T extends Record<string, string | undefined>>(
  env: T,
  key: keyof T,
): Record<string, string | undefined> {
  const copy: Record<string, string | undefined> = { ...env };
  delete copy[key as string];
  return copy;
}

describe("readOmnivaConfig: optional on total absence, refused on partial", () => {
  it("returns null when nothing Omniva-related is set", () => {
    expect(readOmnivaConfig({})).toBeNull();
    expect(readOmnivaConfig({ UNRELATED: "value" })).toBeNull();
  });

  it("returns the full config, sender included, when every variable is set", () => {
    expect(readOmnivaConfig(FULL_ENV)).toEqual({
      baseUrl: "https://omx.omniva.eu",
      apiUser: "user",
      apiPassword: "pass",
      customerCode: "CUSTOMER",
      sender: {
        personName: "Plepic Games OÜ",
        street: "Pihlaka tn 2",
        deliverypoint: "Jüri alevik",
        postcode: "75301",
        country: "EE",
        phone: "+37255550100",
        email: "info@example.com",
      },
    });
  });

  it("omits the sender's street when it alone is unset, without treating that as partial", () => {
    const config = readOmnivaConfig(withoutKey(FULL_ENV, "MERCHANT_SENDER_STREET"));
    expect(config).not.toBeNull();
    expect(config?.sender).not.toHaveProperty("street");
  });

  it("throws, naming what is missing, when only some of the mandatory variables are set", () => {
    expect(() => readOmnivaConfig(withoutKey(FULL_ENV, "OMNIVA_BASE_URL"))).toThrow(
      /OMNIVA_BASE_URL/,
    );
  });

  it("throws when only a single stray Omniva variable is set", () => {
    expect(() => readOmnivaConfig({ OMNIVA_API_USER: "user" })).toThrow(/missing/i);
  });

  it("treats a whitespace-only value the same as unset", () => {
    expect(readOmnivaConfig({ OMNIVA_API_USER: "   " })).toBeNull();
  });

  /**
   * Ruling R17: presence is keyed on the three secret `OMNIVA_*` names only,
   * not on the merchant sender facts -- `MERCHANT_PHONE_NUMBER` is already a
   * storefront-required variable (`storefront/src/config/runtime-env.ts`,
   * CRD Art. 6(1)(c)) for a reason that has nothing to do with Omniva. This
   * is the scenario R17 exists for: a shared merchant `ConfigMap` handing the
   * backend every `MERCHANT_*` fact while never mentioning Omniva at all
   * must not be read as "Omniva is on and misconfigured".
   */
  it("returns null when merchant sender variables are set but no OMNIVA_* one is (R17)", () => {
    const omnivaOnlyNames = ["OMNIVA_API_USER", "OMNIVA_API_PASSWORD", "OMNIVA_CUSTOMER_CODE", "OMNIVA_BASE_URL"] as const;
    const merchantOnly = omnivaOnlyNames.reduce<Record<string, string | undefined>>(
      (env, name) => withoutKey(env, name),
      FULL_ENV,
    );
    expect(readOmnivaConfig(merchantOnly)).toBeNull();
  });

  it("returns null when only the sender's street is set and nothing else, per R17", () => {
    expect(readOmnivaConfig({ MERCHANT_SENDER_STREET: "Pihlaka tn 2" })).toBeNull();
  });

  /**
   * This is the deployed test environment exactly: `hannosirkel/deploys`'
   * `plepic/base/backend.yaml` and `worker.yaml` both set `OMNIVA_BASE_URL`
   * unconditionally, in every environment, whether or not Omniva credentials
   * have been provisioned. `OMNIVA_BASE_URL` carries the `OMNIVA_` prefix but
   * is deployment furniture, not evidence of intent -- presence must be keyed
   * on the three secrets alone, or an environment with no Omniva credentials
   * wrongly reports "partly configured" instead of "not configured".
   */
  it("returns null when OMNIVA_BASE_URL is set but none of the three secrets are", () => {
    expect(readOmnivaConfig({ OMNIVA_BASE_URL: "https://omx.omniva.eu" })).toBeNull();
  });
});
