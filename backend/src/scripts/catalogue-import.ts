import type { ExecArgs } from "@medusajs/framework/types";

import { MedusaCatalogueSeedTarget } from "../catalogue-import/medusa-target.js";
import { runCatalogueImport } from "../catalogue-import/run.js";
import { readCatalogueImportRuntimeConfig } from "../config/runtime.js";

/**
 * The command the catalogue-import Job runs — `npm run catalogue:import`,
 * `medusa exec` on this file.
 *
 * It runs **in the cluster, in the target namespace, from the backend image**.
 * That is not a free choice: the NetworkPolicy admits PostgreSQL connections
 * only from in-namespace workloads, so an operator machine cannot run it at
 * all. The archive is staged onto the assets PVC by a short-lived helper pod
 * and this command is the only thing that reads it.
 *
 * The summary printed here carries counts and the environment identity and no
 * catalogue content: a Job log is not a place to put commerce data, let alone
 * anything that came out of a WooCommerce export.
 */
export default async function catalogueImport({ container }: ExecArgs): Promise<void> {
  const config = readCatalogueImportRuntimeConfig(process.env);

  const summary = await runCatalogueImport({
    archivePath: config.archivePath,
    mediaRoot: config.mediaRoot,
    expected: {
      archiveSha256: config.expectedArchiveSha256,
      environment: config.environmentIdentity,
    },
    target: new MedusaCatalogueSeedTarget(container),
  });

  console.log(
    `catalogue import complete: environment=${summary.environment} records=${String(summary.records)} media_written=${String(summary.mediaWritten)} media_unchanged=${String(summary.mediaUnchanged)}`,
  );
}
