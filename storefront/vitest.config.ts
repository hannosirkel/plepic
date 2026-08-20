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
    /*
     * `tests/smoke/` needs a Medusa answering on a socket, so it is not part of
     * the unit suite and must not be: `bash scripts/validate` and the
     * `validate` CI job have to pass on a bare checkout. `scripts/store-smoke`
     * runs it through `vitest.smoke.config.mts`, which includes exactly this
     * directory. Excluded rather than named around, because the include above
     * is a glob and a new smoke file would otherwise join the unit run the day
     * it was written.
     */
    exclude: ["tests/smoke/**"],
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
