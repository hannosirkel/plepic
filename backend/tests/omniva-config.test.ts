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

  it("throws when only the sender's street is set and nothing else", () => {
    expect(() => readOmnivaConfig({ MERCHANT_SENDER_STREET: "Pihlaka tn 2" })).toThrow(/missing/i);
  });

  it("treats a whitespace-only value the same as unset", () => {
    expect(readOmnivaConfig({ OMNIVA_API_USER: "   " })).toBeNull();
  });
});
