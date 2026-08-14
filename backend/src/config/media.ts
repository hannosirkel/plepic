import type { MediaRuntimeConfig } from "./runtime.js";

/**
 * Medusa's local file provider, pinned to the assets PVC.
 *
 * `upload_dir` is the same directory the catalogue import writes into, and
 * `backend_url` is the relative `/static` path the provider stamps into every
 * image URL it hands out. Both halves matter: pinning only the directory would
 * let the provider publish absolute URLs the storefront would then have to
 * rewrite, and pinning only the URL would let it serve from somewhere the
 * import never wrote to.
 *
 * The URL is relative on purpose. An absolute one would be a per-environment
 * value, and nothing that differs between environments may be baked into an
 * image — the storefront turns `/static/<file>` into
 * `/store-api/static/<file>` on the current origin, so no hostname is needed
 * anywhere in the chain.
 */
export function localFileModule(config: MediaRuntimeConfig) {
  return {
    resolve: "@medusajs/medusa/file",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/file-local",
          id: "local",
          options: {
            upload_dir: config.root,
            backend_url: "/static",
          },
        },
      ],
    },
  } as const;
}
