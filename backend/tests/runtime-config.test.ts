import { describe, expect, it } from "vitest";
import {
  mediaRootForBaseDir,
  readCatalogueImportRuntimeConfig,
  readCheckoutTurnstileRuntimeConfig,
  readBackendRuntimeConfig,
  readNewsletterRateLimitRuntimeConfig,
  readNewsletterRuntimeConfig,
} from "../src/config/runtime.js";

describe("readBackendRuntimeConfig", () => {
  it("parses the Turnstile secret only for the checkout completion route", () => {
    expect(readCheckoutTurnstileRuntimeConfig({ TURNSTILE_SECRET_KEY: "turnstile-secret" })).toEqual({
      secretKey: "turnstile-secret",
    });
    expect(() => readCheckoutTurnstileRuntimeConfig({})).toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it("rejects production configuration without every required value", () => {
    expect(() =>
      readBackendRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://app:password@database:5432/medusa",
        JWT_SECRET: "jwt-secret",
        COOKIE_SECRET: "cookie-secret",
        STORE_CORS: "https://store.example.test",
        ADMIN_CORS: "https://admin.example.test",
        AUTH_CORS: "https://store.example.test",
      }),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("rejects SMTP settings that omit the required encrypted submission configuration", () => {
    expect(() =>
      readBackendRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://app:password@database:5432/medusa",
        JWT_SECRET: "jwt-secret",
        COOKIE_SECRET: "cookie-secret",
        STORE_CORS: "https://store.example.test",
        ADMIN_CORS: "https://admin.example.test",
        AUTH_CORS: "https://store.example.test",
        STRIPE_SECRET_KEY: "sk_test_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_example",
      }),
    ).toThrow(/SMTP_HOST/);
  });

  it("does not silently supply credentials or CORS origins", () => {
    expect(() => readBackendRuntimeConfig({ NODE_ENV: "development" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects unsafe mail addresses and any SMTP port other than submission 587", () => {
    const environment = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://app:password@database:5432/medusa",
      JWT_SECRET: "jwt-secret",
      COOKIE_SECRET: "cookie-secret",
      STORE_CORS: "https://store.example.test",
      ADMIN_CORS: "https://admin.example.test",
      AUTH_CORS: "https://store.example.test",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_example",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_USERNAME: "smtp-user",
      SMTP_PASSWORD: "smtp-password",
      SMTP_ENVELOPE_FROM: "orders@example.test",
      CONTACT_MAIL_RECIPIENT: "contact@example.test",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      NEWSLETTER_API_KEY: "newsletter-api-key",
      NEWSLETTER_LIST_ID: "42",
      MERCHANT_LEGAL_NAME: "Lunar Base OÜ",
      MERCHANT_REGISTERED_ADDRESS: "Moon Street 1, Tallinn",
      MERCHANT_CONTACT_ADDRESS: "legal@example.test",
      MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
    };

    expect(() => readBackendRuntimeConfig({ ...environment, SMTP_PORT: "25" })).toThrow(/587/);
    expect(() =>
      readBackendRuntimeConfig({
        ...environment,
        SMTP_ENVELOPE_FROM: "orders@example.test\r\nBcc: attacker@example.test",
      }),
    ).toThrow(/SMTP_ENVELOPE_FROM/);
    expect(() =>
      readBackendRuntimeConfig({ ...environment, CONTACT_MAIL_RECIPIENT: "not-an-address" }),
    ).toThrow(/CONTACT_MAIL_RECIPIENT/);
    expect(() =>
      readBackendRuntimeConfig({ ...environment, MERCHANT_LEGAL_NAME: "Unsafe\nName" }),
    ).toThrow(/MERCHANT_LEGAL_NAME/);
    expect(() =>
      readBackendRuntimeConfig({ ...environment, MERCHANT_CONTACT_ADDRESS: "not-an-address" }),
    ).toThrow(/MERCHANT_CONTACT_ADDRESS/);
    expect(() => readNewsletterRuntimeConfig({ ...environment, NEWSLETTER_LIST_ID: "0" })).toThrow(
      /NEWSLETTER_LIST_ID/,
    );
    expect(() => readNewsletterRuntimeConfig({ ...environment, NEWSLETTER_LIST_ID: "12.5" })).toThrow(
      /NEWSLETTER_LIST_ID/,
    );
  });

  it("returns the supplied production values unchanged", () => {
    expect(
      readBackendRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://app:password@database:5432/medusa",
        JWT_SECRET: "jwt-secret",
        COOKIE_SECRET: "cookie-secret",
        STORE_CORS: "https://store.example.test",
        ADMIN_CORS: "https://admin.example.test",
        AUTH_CORS: "https://store.example.test",
        STRIPE_SECRET_KEY: "sk_test_example",
        STRIPE_WEBHOOK_SECRET: "whsec_example",
        STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_example",
        SMTP_HOST: "smtp.example.test",
        SMTP_PORT: "587",
        SMTP_USERNAME: "smtp-user",
        SMTP_PASSWORD: "smtp-password",
        SMTP_ENVELOPE_FROM: "orders@example.test",
        CONTACT_MAIL_RECIPIENT: "contact@example.test",
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        NEWSLETTER_API_KEY: "newsletter-api-key",
        NEWSLETTER_LIST_ID: "42",
        MERCHANT_LEGAL_NAME: "Lunar Base OÜ",
        MERCHANT_REGISTERED_ADDRESS: "Moon Street 1, Tallinn",
        MERCHANT_CONTACT_ADDRESS: "legal@example.test",
        MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
      }),
    ).toEqual({
      databaseUrl: "postgres://app:password@database:5432/medusa",
      http: {
        storeCors: "https://store.example.test",
        adminCors: "https://admin.example.test",
        authCors: "https://store.example.test",
        jwtSecret: "jwt-secret",
        cookieSecret: "cookie-secret",
      },
      stripe: {
        apiKey: "sk_test_example",
        webhookSecret: "whsec_example",
        paymentMethodConfiguration: "pmc_example",
      },
      smtp: {
        host: "smtp.example.test",
        port: 587,
        username: "smtp-user",
        password: "smtp-password",
        envelopeFrom: "orders@example.test",
      },
      contactMailRecipient: "contact@example.test",
      turnstileSecretKey: "turnstile-secret",
      orderConfirmationLegal: {
        merchantLegalName: "Lunar Base OÜ",
        merchantRegisteredAddress: "Moon Street 1, Tallinn",
        merchantContactAddress: "legal@example.test",
        returnAddress: "Return Street 2, Tallinn",
      },
    });
  });

  it("parses newsletter credentials only for the subscribing Store route", () => {
    expect(readNewsletterRuntimeConfig({
      NEWSLETTER_API_KEY: "newsletter-api-key",
      NEWSLETTER_LIST_ID: "42",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
    })).toEqual({
      apiKey: "newsletter-api-key",
      listId: 42,
      turnstileSecretKey: "turnstile-secret",
    });
  });

  it("parses the newsletter limiter only for the subscribing Store route", () => {
    expect(readNewsletterRateLimitRuntimeConfig({
      REDIS_HOST: "redis.internal",
      REDIS_PORT: "6379",
      REDIS_PASSWORD: "redis-password",
      NEWSLETTER_RATE_LIMIT_MAX: "20",
      NEWSLETTER_RATE_LIMIT_WINDOW_SECONDS: "600",
    })).toEqual({
      redisHost: "redis.internal",
      redisPort: 6379,
      redisPassword: "redis-password",
      maximum: 20,
      windowSeconds: 600,
    });

    for (const invalid of ["0", "12.5", "9007199254740992"]) {
      expect(() => readNewsletterRateLimitRuntimeConfig({
        REDIS_HOST: "redis.internal",
        REDIS_PORT: "6379",
        REDIS_PASSWORD: "redis-password",
        NEWSLETTER_RATE_LIMIT_MAX: invalid,
        NEWSLETTER_RATE_LIMIT_WINDOW_SECONDS: "600",
      })).toThrow(/NEWSLETTER_RATE_LIMIT_MAX/);
    }
  });
});

describe("mediaRootForBaseDir", () => {
  it("derives the media root from the framework's own base directory", () => {
    expect(mediaRootForBaseDir("/app")).toBe("/app/static");
  });

  /**
   * `configManager.baseDir` is typed `string` but is `undefined` until a config
   * is loaded, so an unloaded config manager reaches this function with nothing
   * at all. Saying so beats a `TypeError` about reading `trim` of undefined:
   * the archive is disposed of either way, but only one of the two tells the
   * operator what went wrong.
   */
  it("names the missing base directory rather than dereferencing undefined", () => {
    for (const absent of [undefined, "", "   "]) {
      expect(() => mediaRootForBaseDir(absent)).toThrow(/base directory is not known/);
      expect(() =>
        readCatalogueImportRuntimeConfig(
          {
            CATALOGUE_IMPORT_ARCHIVE_SHA256: "a".repeat(64),
            CATALOGUE_IMPORT_ENVIRONMENT: "test",
          },
          absent,
        ),
      ).toThrow(/base directory is not known/);
    }
  });
});
