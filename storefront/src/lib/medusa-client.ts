import Medusa from "@medusajs/js-sdk";

import type { ClientRuntimeConfig } from "./client-runtime-config.js";
import { ConfigError } from "../config/env.js";

function browserOrigin(): string {
  if (typeof window === "undefined") {
    throw new ConfigError("a browser origin is required to create the Medusa Store client on the server");
  }
  return window.location.origin;
}

/**
 * Creates the browser's Medusa client from request-time configuration.
 *
 * The origin is read when this function is called, never at module load or
 * build time. The fixed `/store-api` base path keeps every Store request on
 * the page's own origin, where the storefront's allowlisted proxy owns it.
 */
export function createMedusaStoreClient(
  config: ClientRuntimeConfig["medusa"],
  origin: string = browserOrigin(),
): Medusa {
  if (config.publishableKey === null) {
    throw new ConfigError("MEDUSA_PUBLISHABLE_API_KEY is required for Store API requests");
  }

  const baseUrl = new URL(config.basePath, origin).toString().replace(/\/$/, "");
  return new Medusa({
    baseUrl,
    publishableKey: config.publishableKey,
    auth: { fetchCredentials: "same-origin" },
  });
}
