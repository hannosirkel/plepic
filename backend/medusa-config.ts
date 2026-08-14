import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import { readBackendRuntimeConfig, readMediaRuntimeConfig } from "./src/config/runtime";
import { stripePaymentModule } from "./src/config/payment";
import { notificationModule } from "./src/config/notification";
import { localFileModule } from "./src/config/media";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const runtime = readBackendRuntimeConfig(process.env);

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: runtime.databaseUrl,
    http: runtime.http,
  },
  modules: [
    stripePaymentModule(runtime.stripe),
    notificationModule(runtime.smtp),
    localFileModule(readMediaRuntimeConfig(process.env)),
  ],
});
