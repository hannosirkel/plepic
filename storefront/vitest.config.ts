import { defineConfig } from "vitest/config";

/**
 * The storefront's suite. Runs standalone (`npm run test:unit` inside
 * `storefront/`) and as a project of the repository root's
 * `vitest.config.ts`, which is what `bash scripts/validate` and CI execute.
 */
export default defineConfig({
  test: {
    name: "storefront",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    server: {
      // Its published source maps point at source files absent from the npm
      // package. Native Node needs no Vite transform and emits no false warning.
      deps: { external: ["@medusajs/js-sdk"] },
    },
    // The build + serve contract test runs `next build` and `next start`.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
