import { describe, expect, it } from "vitest";
import {
  mediaRootForBaseDir,
  readCatalogueImportRuntimeConfig,
  readCheckoutTurnstileRuntimeConfig,
  readBackendRuntimeConfig,
  readNewsletterRateLimitRuntimeConfig,
  readNewsletterRuntimeConfig,
  redisConnectionOptions,
  redisConnectionUrl,
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
      REDIS_HOST: "plepic-redis",
      REDIS_PORT: "6379",
      REDIS_PASSWORD: "redis-password",
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
        REDIS_HOST: "plepic-redis",
        REDIS_PORT: "6379",
        REDIS_PASSWORD: "redis-password",
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
      redis: { host: "plepic-redis", port: 6379, password: "redis-password" },
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

  /**
   * The environment `deploys/plepic/base/backend.yaml` actually projects. It
   * supplies the five `DATABASE_*` parts and no `DATABASE_URL`, and the
   * Deployment crash-looped on a configuration read that demanded the URL.
   *
   * This is the manifest's own list, transcribed, minus the values that are
   * irrelevant to the database read.
   */
  it("accepts the five DATABASE_* parts the deploys manifests project", () => {
    const config = readBackendRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_HOST: "plepic-postgresql",
      DATABASE_PORT: "5432",
      DATABASE_NAME: "plepic",
      DATABASE_USER: "medusa",
      DATABASE_PASSWORD: "projected-from-the-secret",
      JWT_SECRET: "jwt-secret",
      COOKIE_SECRET: "cookie-secret",
      STORE_CORS: "https://store.example.test",
      ADMIN_CORS: "https://admin.example.test",
      AUTH_CORS: "https://store.example.test",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_example",
      REDIS_HOST: "plepic-redis",
      REDIS_PORT: "6379",
      REDIS_PASSWORD: "redis-password",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_USERNAME: "smtp-user",
      SMTP_PASSWORD: "smtp-password",
      SMTP_ENVELOPE_FROM: "orders@example.test",
      CONTACT_MAIL_RECIPIENT: "contact@example.test",
      TURNSTILE_SECRET_KEY: "turnstile-secret",
      MERCHANT_LEGAL_NAME: "Lunar Base OÜ",
      MERCHANT_REGISTERED_ADDRESS: "Moon Street 1, Tallinn",
      MERCHANT_CONTACT_ADDRESS: "legal@example.test",
      MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
    });

    expect(config.databaseUrl).toBe(
      "postgres://medusa:projected-from-the-secret@plepic-postgresql:5432/plepic",
    );
  });

  /**
   * The environment `deploys/plepic/base/backend.yaml` projects, with the three
   * CORS origins declared **empty** — which is what the plan mandates rather
   * than an omission. Cart and checkout require no CORS origin at all: the
   * storefront proxies `/store-api` on its own origin and the Admin is
   * same-origin on the backend, so a hostname here would be a second, unneeded
   * way in and would breach the exposure boundary.
   */
  const manifestEnvironment = {
    NODE_ENV: "production",
    DATABASE_HOST: "plepic-postgresql",
    DATABASE_PORT: "5432",
    DATABASE_NAME: "plepic",
    DATABASE_USER: "medusa",
    DATABASE_PASSWORD: "projected-from-the-secret",
    JWT_SECRET: "jwt-secret",
    COOKIE_SECRET: "cookie-secret",
    STORE_CORS: "",
    ADMIN_CORS: "",
    AUTH_CORS: "",
    STRIPE_SECRET_KEY: "sk_test_example",
    STRIPE_WEBHOOK_SECRET: "whsec_example",
    STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_example",
    REDIS_HOST: "plepic-redis",
    REDIS_PORT: "6379",
    REDIS_PASSWORD: "redis-password",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USERNAME: "smtp-user",
    SMTP_PASSWORD: "smtp-password",
    SMTP_ENVELOPE_FROM: "orders@example.test",
    CONTACT_MAIL_RECIPIENT: "contact@example.test",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    MERCHANT_LEGAL_NAME: "Lunar Base OÜ",
    MERCHANT_REGISTERED_ADDRESS: "Moon Street 1, Tallinn",
    MERCHANT_CONTACT_ADDRESS: "legal@example.test",
    MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
  } as const;

  const corsVariables = ["STORE_CORS", "ADMIN_CORS", "AUTH_CORS"] as const;

  it("accepts the CORS origins declared empty, and passes the empty list through", () => {
    const config = readBackendRuntimeConfig(manifestEnvironment);

    expect(config.http.storeCors).toBe("");
    expect(config.http.adminCors).toBe("");
    expect(config.http.authCors).toBe("");
  });

  /**
   * Declared-empty is permitted; **absent** is not. A workload whose manifest
   * forgets the variable entirely is not making the same statement as one that
   * declares it empty on purpose, and it should not start.
   */
  it.each(corsVariables)("still refuses %s when it is absent altogether", (name) => {
    const withoutIt: Record<string, string | undefined> = { ...manifestEnvironment };
    delete withoutIt[name];

    expect(() => readBackendRuntimeConfig(withoutIt)).toThrow(
      `Missing required backend environment variable: ${name}`,
    );
  });

  /**
   * Whitespace is refused, and that is a deliberate choice between two ways of
   * being wrong. `value: ""` is how a manifest *says* empty; whitespace is
   * never a deliberate way to say it, so refusing costs nothing intentional.
   * Accepting it would absorb a templating slip into a backend that starts,
   * looks healthy, and denies an origin somebody meant to allow — discovered at
   * checkout, if ever. Refusing surfaces it at start, which is the one moment
   * an operator is already watching.
   */
  it.each(corsVariables)("refuses a whitespace-only %s", (name) => {
    expect(() => readBackendRuntimeConfig({ ...manifestEnvironment, [name]: "   " })).toThrow(
      new RegExp(`${name}.*whitespace`),
    );
  });

  /**
   * The permission is those three and nothing else. An empty secret is an
   * absent secret however it got that way.
   */
  it.each(["JWT_SECRET", "COOKIE_SECRET", "STRIPE_SECRET_KEY", "SMTP_HOST", "TURNSTILE_SECRET_KEY"])(
    "still refuses an empty %s",
    (name) => {
      expect(() => readBackendRuntimeConfig({ ...manifestEnvironment, [name]: "" })).toThrow(
        new RegExp(name),
      );
    },
  );

  /**
   * Redis is required of every workload that runs this image, and refusing it
   * is the point. An unset `REDIS_PASSWORD` used to be *fine*: the backend
   * started, `defineConfig` installed an in-process event bus and workflow
   * engine, and the worker consumed a queue nothing published to while both
   * pods reported healthy. There is no later gate that notices.
   */
  it.each(["REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD"])(
    "refuses a backend whose %s is absent",
    (name) => {
      const withoutIt: Record<string, string | undefined> = { ...manifestEnvironment };
      delete withoutIt[name];

      expect(() => readBackendRuntimeConfig(withoutIt)).toThrow(new RegExp(name));
    },
  );

  it("refuses a REDIS_HOST that is anything but a host", () => {
    for (const host of [
      "redis://plepic-redis",
      "plepic-redis:6380",
      "user:password@plepic-redis",
      "plepic-redis/0",
      "[::1]",
      "plepic-redis?db=1",
    ]) {
      expect(
        () => readBackendRuntimeConfig({ ...manifestEnvironment, REDIS_HOST: host }),
        host,
      ).toThrow(/REDIS_HOST/);
    }
  });

  /**
   * `"6379 "` is deliberately absent: every reader in this file trims, so
   * padding is not a different port. `mail-submission-target.test.ts` makes the
   * same point about `SMTP_PORT` and spells out which way it cuts.
   */
  it.each(["0", "65536", "6379.5", "-1", "0x1", "", "six"])(
    "refuses the REDIS_PORT %j",
    (port) => {
      expect(() =>
        readBackendRuntimeConfig({ ...manifestEnvironment, REDIS_PORT: port }),
      ).toThrow(/REDIS_PORT/);
    },
  );

  /**
   * The password is carried beside the URL, never inside it. A URL that never
   * held the secret cannot leak it through a log line, an ioredis error, or a
   * connection string printed by something downstream — and there is no
   * percent-encoding to get right, which is the other way this goes wrong.
   */
  it("composes a credential-free URL and carries the password beside it", () => {
    const { redis } = readBackendRuntimeConfig({
      ...manifestEnvironment,
      REDIS_PASSWORD: "p@ss/w:rd?#",
    });

    expect(redisConnectionUrl(redis)).toBe("redis://plepic-redis:6379");
    expect(redisConnectionUrl(redis)).not.toContain("p@ss");
    expect(redisConnectionOptions(redis)).toEqual({ password: "p@ss/w:rd?#" });

    // And it is a URL, parsed by a parser rather than eyeballed.
    const parsed = new URL(redisConnectionUrl(redis));
    expect(parsed.protocol).toBe("redis:");
    expect(parsed.hostname).toBe("plepic-redis");
    expect(parsed.port).toBe("6379");
    expect(parsed.username).toBe("");
    expect(parsed.password).toBe("");
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
