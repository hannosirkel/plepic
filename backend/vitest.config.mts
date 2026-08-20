import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * The backend's pure suite: everything under `tests/` **except** `tests/smoke/`.
 *
 * `tests/smoke/` needs a running Medusa, a migrated PostgreSQL and a Redis, and
 * it is excluded here rather than merged in because this config is what
 * `npm run test:unit` and therefore `bash scripts/validate` execute — on any
 * checkout, with nothing running. A suite that refused without a server would
 * make the repository's one validation command fail for every developer.
 * `backend/vitest.smoke.config.mts` runs it, and `scripts/store-smoke` stands up
 * what it needs first.
 *
 * The default exclusions are kept rather than replaced: naming `exclude` at all
 * drops Vitest's own list, and a `node_modules` full of `*.test.ts` would then be
 * collected.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    name: "backend",
    include: ["tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "tests/smoke/**"],
    environment: "node",
  },
});
