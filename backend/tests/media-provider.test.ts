import { access, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { LocalFileService } from "@medusajs/file-local";
import { describe, expect, it } from "vitest";

import { mediaRootForBaseDir } from "../src/config/runtime.js";

/**
 * The file provider, exercised rather than inspected.
 *
 * The backend used to register `@medusajs/medusa/file-local` with
 * `backend_url: "/static"`, and the provider does `new URL(this.backendUrl_)`
 * on every upload and every presigned download — so a relative value is not a
 * neat way to avoid baking a hostname into the image, it is a `TypeError` on
 * every Admin upload. A configuration object that type checks proves nothing
 * about that; only running the provider does.
 *
 * The import does not use the provider at all — it writes with `fs` and
 * computes `/static/<file>` URLs itself — so the override was dead
 * configuration that was also broken, and the fix is to stop overriding. What
 * remains to be proved is that the default the framework registers works, and
 * that it writes where the import writes and where the framework serves.
 */

const requiredEnvironment: Record<string, string> = {
  DATABASE_URL: "postgres://app:password@database:5432/medusa",
  JWT_SECRET: "validation-jwt-secret",
  COOKIE_SECRET: "validation-cookie-secret",
  STORE_CORS: "https://store.example.test",
  ADMIN_CORS: "https://admin.example.test",
  AUTH_CORS: "https://store.example.test",
  REDIS_HOST: "redis.example.test",
  REDIS_PORT: "6379",
  REDIS_PASSWORD: "validation-redis-password",
  STRIPE_SECRET_KEY: "synthetic_validation",
  STRIPE_WEBHOOK_SECRET: "whsec_validation",
  STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_validation",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "587",
  SMTP_USERNAME: "validation-smtp-user",
  SMTP_PASSWORD: "validation-smtp-password",
  SMTP_ENVELOPE_FROM: "orders@example.test",
  CONTACT_MAIL_RECIPIENT: "contact@example.test",
  TURNSTILE_SECRET_KEY: "validation-turnstile-secret",
  MERCHANT_LEGAL_NAME: "Example Games OU",
  MERCHANT_REGISTERED_ADDRESS: "Example Street 1, Tallinn",
  MERCHANT_CONTACT_ADDRESS: "legal@example.test",
  MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
};

/**
 * The framework's compiled express loader, found by walking up from the
 * directory the suite started in — the backend workspace when the suite is run
 * on its own, the repository root when `scripts/validate` runs it.
 */
const suiteRoot = process.cwd();

async function frameworkExpressLoader(): Promise<string> {
  const suffix = join(
    "node_modules",
    "@medusajs",
    "framework",
    "dist",
    "http",
    "express-loader.js",
  );

  for (let directory = suiteRoot; ; directory = dirname(directory)) {
    const candidate = join(directory, suffix);
    try {
      await access(candidate);
      return candidate;
    } catch {
      if (dirname(directory) === directory) {
        throw new Error(`@medusajs/framework is not installed above ${suiteRoot}`);
      }
    }
  }
}

interface ProviderDeclaration {
  readonly resolve?: unknown;
  readonly id?: unknown;
  readonly options?: Record<string, unknown>;
}

/** The File module exactly as `medusa-config.ts` hands it to the framework. */
async function registeredFileProvider(): Promise<ProviderDeclaration> {
  Object.assign(process.env, requiredEnvironment);
  const loaded = (await import("../medusa-config.js")) as unknown as Record<string, unknown>;
  const config = (loaded.default ?? loaded) as {
    modules?: Record<string, { options?: { providers?: ProviderDeclaration[] } }>;
  };
  const providers = config.modules?.file?.options?.providers ?? [];
  const provider = providers[0];
  if (provider === undefined) throw new Error("the backend registers no file provider");
  return provider;
}

describe("the file provider the backend registers", () => {
  it("uploads and hands back a URL a browser could resolve", async () => {
    const provider = await registeredFileProvider();
    expect(provider.resolve).toBe("@medusajs/medusa/file-local");

    // The provider reads `process.cwd()` at construction for its defaults, so
    // the upload lands in a temporary tree rather than in the checkout.
    const root = await mkdtemp(join(tmpdir(), "plepic-file-provider-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const service = new LocalFileService(undefined, provider.options as never);
      const result = await service.upload({
        filename: "lunar-base-box.webp",
        mimeType: "image/webp",
        content: Buffer.from("synthetic-box-image-bytes", "utf8").toString("base64"),
        access: "public",
      });

      expect(() => new URL(result.url)).not.toThrow();
      expect(new URL(result.url).pathname).toContain("lunar-base-box.webp");

      const written = await readdir(mediaRootForBaseDir(root));
      expect(written).toHaveLength(1);
      expect(written[0]).toContain("lunar-base-box.webp");
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("writes into the same directory the import writes into and the framework serves", async () => {
    const provider = await registeredFileProvider();
    const root = await mkdtemp(join(tmpdir(), "plepic-file-provider-"));
    const previousCwd = process.cwd();
    process.chdir(root);
    try {
      const service = new LocalFileService(undefined, provider.options as never);
      const uploadDir = (service as unknown as { uploadDir_: string }).uploadDir_;
      expect(uploadDir).toBe(mediaRootForBaseDir(root));
    } finally {
      process.chdir(previousCwd);
    }
  });

  /**
   * The framework fact the derivation rests on. `express-loader` mounts
   * `express.static(path.join(baseDir, "static"))` at `/static`
   * unconditionally, and there is no configuration for it — so if a Medusa
   * upgrade moves that directory, this fails and `mediaRootForBaseDir` is
   * re-derived rather than silently serving somewhere the import never wrote.
   */
  it("serves the derived media root under /static, per the framework's own loader", async () => {
    const source = await readFile(await frameworkExpressLoader(), "utf8");

    expect(source).toContain('app.use("/static"');
    expect(source).toContain('path_1.default.join(baseDir, "static")');
    expect(mediaRootForBaseDir("/app")).toBe("/app/static");
  });
});
