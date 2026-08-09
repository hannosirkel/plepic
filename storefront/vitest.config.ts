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
    // The build + serve contract test runs `next build` and `next start`.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
