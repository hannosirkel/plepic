import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The store smoke suite, which needs a Medusa answering on a socket.
 *
 * Kept out of `vitest.config.mts` — and therefore out of `npm run test:unit`,
 * `bash scripts/validate` and the `validate` CI job — because those must pass on
 * a bare checkout. `scripts/store-smoke` is the only thing that runs this, and it
 * builds the server, runs the predeploy chain and starts it first.
 *
 * Timeouts are raised well above Vitest's five-second default. Nothing here is
 * slow in the ordinary case — the catalogue request answers in milliseconds —
 * but every assertion crosses a socket to a server that has a database behind
 * it, and a five-second ceiling would turn a slow CI runner into a red build
 * that says nothing about the code.
 *
 * `fileParallelism: false` because the suite mints an Admin session and a Store
 * key against one shared, stateful Medusa. There is one file today; the setting
 * is what keeps a second one from racing it.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    name: "backend-store-smoke",
    include: ["tests/smoke/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
