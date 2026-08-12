import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import { readBackendRuntimeConfig } from "./src/config/runtime";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: readBackendRuntimeConfig(process.env),
});
