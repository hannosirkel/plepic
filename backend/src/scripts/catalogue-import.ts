import { rm } from "node:fs/promises";

import { configManager } from "@medusajs/framework/config";
import type { ExecArgs } from "@medusajs/framework/types";

import { MedusaCatalogueSeedTarget } from "../catalogue-import/medusa-target.js";
import { runCatalogueImport } from "../catalogue-import/run.js";
import {
  catalogueImportArchivePath,
  readCatalogueImportRuntimeConfig,
} from "../config/runtime.js";

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
 * **The staged archive is disposed of on every exit path**, and that is why the
 * path is resolved before anything that can refuse. The archive is a
 * WooCommerce export carrying customer accounts, sessions and order history,
 * and the volume it is staged on is the same volume Medusa serves as its static
 * root — so an archive left behind by a configuration refusal is not a stray
 * file, it is a published one. Reading the configuration inside the `try` is
 * the whole of that guarantee: it used to sit above `runCatalogueImport`, whose
 * own `finally` never ran when the configuration read threw, and four of the
 * five refusal paths left the export staged.
 *
 * The media root is not configured either. It is derived from the framework's
 * own base directory, the same value the express loader mounts
 * `<baseDir>/static` from, so the directory the import writes to and the
 * directory Medusa serves cannot drift apart.
 *
 * The summary printed here carries counts and the environment identity and no
 * catalogue content: a Job log is not a place to put commerce data, let alone
 * anything that came out of a WooCommerce export.
 */
export default async function catalogueImport({ container }: ExecArgs): Promise<void> {
  const archivePath = catalogueImportArchivePath(process.env);

  try {
    const config = readCatalogueImportRuntimeConfig(process.env, configManager.baseDir);

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
  } finally {
    await rm(archivePath, { force: true });
  }
}
