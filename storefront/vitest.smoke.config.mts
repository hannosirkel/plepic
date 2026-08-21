import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The storefront's half of the store smoke check: its own Store readers, run
 * against a Medusa answering on a socket.
 *
 * Kept out of `vitest.config.mts` — and therefore out of `npm run test:unit`,
 * `bash scripts/validate` and the `validate` CI job — for the same reason the
 * backend's smoke config is, because those must pass on a bare checkout.
 * `scripts/store-smoke` is the only thing that runs this, after it has built
 * the server, run the predeploy chain and started it.
 *
 * **It lives here rather than beside the backend's smoke suite**, which is
 * where it was first written. The backend workspace is CommonJS and this one is
 * ESM, so a backend test cannot import `src/lib/store-cart.ts` at all — and the
 * point of these assertions is to drive the storefront's *own* functions rather
 * than URLs a test assembles for itself. A test that builds its own request
 * with the right `fields` on it passes whether or not the shipped code sends
 * them, which is precisely the defect this suite exists for.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    name: "storefront-store-smoke",
    include: ["tests/smoke/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
