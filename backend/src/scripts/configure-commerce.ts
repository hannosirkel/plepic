import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";

import { configureCommerce } from "../commerce/configuration.js";
import { MedusaCommerceConfigurationTarget } from "../commerce/medusa-target.js";

/**
 * The third step of `npm run predeploy` — `medusa db:migrate` first, the initial
 * administrator second, and the declared commerce configuration last.
 *
 * It belongs in the predeploy Job rather than in a Job of its own for the same
 * reason the administrator does: one Argo CD sync hook gates everything else, so
 * migrate, seed and configure all complete before an API or worker pod starts.
 * It is also what has to be true *before* the catalogue-import Job is ever
 * staged — that Job refuses without a shipping profile and a stock location, and
 * it has no fulfillment set to hang a zone off.
 *
 * It reads **no environment variable at all**. Everything it applies is frozen
 * in this repository and identical in both environments: one region, one stock
 * location, one fulfillment set, one shipping profile, the sales-channel link,
 * and the two zones with their two flat rates. Nothing per-environment is
 * configured here, so nothing here can differ between test and live.
 *
 * The summary carries a record count and nothing else; a Job log is not a place
 * to put commerce data.
 */
export default async function configureCommerceCommand({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const summary = await configureCommerce(new MedusaCommerceConfigurationTarget(container));

  logger.info(`commerce configuration applied: records=${String(summary.records)}`);
}
