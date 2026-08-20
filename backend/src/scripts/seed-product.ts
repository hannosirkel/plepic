import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";

import { MedusaProductSeedTarget, seedProduct } from "../commerce/seed-product.js";

/**
 * The fourth and last step of `npm run predeploy` — `medusa db:migrate` first,
 * the initial administrator second, the declared commerce configuration third,
 * and the one product this shop sells last.
 *
 * **Last is a dependency, not a preference.** The product binds to a shipping
 * profile and to the default sales channel; `configure:commerce` is what creates
 * the profile, and a run before it refuses with "run npm run configure:commerce
 * before seeding the product". Because predeploy is an Argo CD sync hook at wave
 * `-10`, that refusal would stop the Application syncing rather than merely
 * logging.
 *
 * It belongs in the predeploy Job rather than a Job of its own for the reason
 * the other two do: `deploys` names the workloads it runs, one sync hook gates
 * everything else, and a fifth `args: [npm, run, …]` would be a script no
 * manifest invokes.
 *
 * It is **not** the catalogue import. That command reads a WooCommerce archive
 * somebody stages by hand, and nothing a promoted digest depends on may wait for
 * a human — a fresh environment with no product answers `GET /store/products`
 * with an empty list, and every page reading the catalogue refuses.
 *
 * It reads **no environment variable at all**. Everything it applies is frozen
 * in `src/commerce/product-model.ts` and identical in both environments, so
 * nothing here can differ between test and live.
 *
 * The summary carries a record count and nothing else; a Job log is not a place
 * to put catalogue data, and it is not a place to put a price.
 */
export default async function seedProductCommand({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const summary = await seedProduct(new MedusaProductSeedTarget(container));

  logger.info(`product seed applied: records=${String(summary.records)}`);
}
