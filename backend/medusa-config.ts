import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import { readBackendRuntimeConfig } from "./src/config/runtime";
import { stripePaymentModule } from "./src/config/payment";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const runtime = readBackendRuntimeConfig(process.env);

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: runtime.databaseUrl,
    http: runtime.http,
  },
  modules: [stripePaymentModule(runtime.stripe)],
});
