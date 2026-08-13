import { describe, expect, it } from "vitest";
import { readBackendRuntimeConfig } from "../src/config/runtime.js";

describe("readBackendRuntimeConfig", () => {
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

  it("does not silently supply credentials or CORS origins", () => {
    expect(() => readBackendRuntimeConfig({ NODE_ENV: "development" })).toThrow(
      /DATABASE_URL/,
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
    });
  });
});
