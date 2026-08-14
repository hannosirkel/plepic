import { configManager } from "@medusajs/framework/config";
import type { ExecArgs } from "@medusajs/framework/types";

import { withStagedArchiveDisposal } from "../catalogue-import/disposal.js";
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
 * and an archive left behind by a configuration refusal is not a stray file —
 * it is a customer-data export at rest on a production volume, for good. The
 * Job runs with `backoffLimit: 0`, so there is no second attempt that would
 * clear it, and nothing else on the cluster ever looks in the staging
 * directory. The staging subtree is a sibling of the media root rather than
 * part of it, so this is not a publication; it is an indefinite retention of
 * exactly the data this import exists to refuse. Reading the configuration
 * *inside* the wrapper
 * is the whole of that guarantee: it used to sit above `runCatalogueImport`,
 * whose own disposal never ran when the configuration read threw, and four of
 * the five refusal paths left the export staged.
 *
 * {@link withStagedArchiveDisposal} owns the two things that guarantee needs in
 * order to survive contact with a real staging directory. A mis-staged
 * **directory** — `kubectl cp` of a directory onto the archive path is an easy
 * operator slip — is removed as readily as a file, rather than answered with
 * `EISDIR` and left in place. And where the archive genuinely cannot be
 * removed, the disposal failure is reported *alongside* the refusal that caused
 * it rather than thrown in its place: an operator needs to know the import
 * refused on a checksum mismatch at least as much as they need to know a file
 * survived.
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

  await withStagedArchiveDisposal(archivePath, async () => {
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
  });
}
