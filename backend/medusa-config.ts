import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import { readBackendRuntimeConfig } from "./src/config/runtime";
import { stripePaymentModule } from "./src/config/payment";
import { notificationModule } from "./src/config/notification";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const runtime = readBackendRuntimeConfig(process.env);

/**
 * The File module is deliberately **not** overridden.
 *
 * `defineConfig` already registers `@medusajs/medusa/file-local`, whose
 * `upload_dir` defaults to `<cwd>/static` — the same directory the framework's
 * express loader serves at `/static/*` and the same directory the catalogue
 * import writes into. Overriding it bought nothing and cost a great deal: the
 * override set `backend_url` to the relative `/static`, and the provider does
 * `new URL(backend_url)` on every upload and presigned download, so every Admin
 * upload raised `TypeError: Invalid URL`. The import never used the provider —
 * it writes with `fs` and computes its own relative URLs — so the override was
 * dead configuration that was also broken.
 *
 * The default `backend_url` is `http://localhost:9000/static`, which is only
 * ever seen by an Admin user's own browser. It is not a per-environment value
 * this image bakes in, and the storefront drops any absolute media URL rather
 * than forwarding it, so it cannot reach a shopper. `tests/media-provider.test.ts`
 * exercises the provider this config registers.
 */
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: runtime.databaseUrl,
    http: runtime.http,
  },
  modules: [stripePaymentModule(runtime.stripe), notificationModule(runtime.smtp)],
});
