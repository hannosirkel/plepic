import { defineConfig } from "vitest/config";

/**
 * The repository's one test entry point. `npm run test:unit` — and therefore
 * `bash scripts/validate`, and therefore `.github/workflows/validate.yml` —
 * runs everything listed here.
 *
 * It is a **projects** list rather than one `include` array because the
 * storefront's suite genuinely needs different settings (it runs a real
 * `next build` and `next start`, so it raises the test and hook timeouts to
 * two minutes) and because a second workspace with its own `vitest.config.ts`
 * was previously invisible to this file: the root `include` covered
 * `content/`, `design/` and `scripts/` only, so `storefront/tests` — the
 * entire enforcement apparatus for "nothing that differs between environments
 * may be baked into an image" — ran in no gate at all. Listing projects makes
 * this file's coverage the single fact about what runs, so a developer's
 * `npm run test:unit` and CI's `bash scripts/validate` cannot diverge again.
 *
 * The cost is real and intended: `storefront/tests/build-and-serve.test.ts`
 * builds the application and serves it, which adds roughly a minute to every
 * validation run. There is no cheaper way to prove a value is absent from a
 * built artifact than to build the artifact.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "repo",
          include: ["content/**/*.test.ts", "design/**/*.test.ts", "scripts/**/*.test.ts"],
          environment: "node",
        },
      },
      "./storefront/vitest.config.ts",
      "./backend/vitest.config.mts",
    ],
  },
});
