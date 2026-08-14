import { readFile, rm } from "node:fs/promises";

import { readArchiveMembers } from "./archive.js";
import { syncMedia } from "./media.js";
import { assertNoPersonalData } from "./personal-data.js";
import { readCatalogueImportPlan, readManifestEnvironment } from "./plan.js";
import {
  CatalogueImportRefusal,
  assertArchiveChecksum,
  assertEnvironmentIdentity,
} from "./refusal.js";
import { seedRecords, type CatalogueSeedTarget } from "./seed.js";

export interface ExpectedImportIdentity {
  /** 64 lowercase hex digits, from `CATALOGUE_IMPORT_ARCHIVE_SHA256`. */
  readonly archiveSha256: string | undefined;
  /** `live` or `test`, from `CATALOGUE_IMPORT_ENVIRONMENT`. */
  readonly environment: string | undefined;
}

export interface CatalogueImportInput {
  readonly archivePath: string;
  readonly mediaRoot: string;
  readonly expected: ExpectedImportIdentity;
  readonly target: CatalogueSeedTarget;
  readonly now?: Date;
}

export interface CatalogueImportSummary {
  readonly environment: string;
  readonly records: number;
  readonly mediaWritten: number;
  readonly mediaUnchanged: number;
}

async function readStagedArchive(path: string): Promise<Uint8Array> {
  try {
    return await readFile(path);
  } catch {
    throw new CatalogueImportRefusal(
      "archive-missing",
      `no archive is staged at ${path}; stage it onto the assets PVC before running the Job`,
    );
  }
}

/**
 * Runs one catalogue import.
 *
 * The order is the contract. The checksum is verified before the archive is
 * parsed, the archive is parsed and refused before the assets root is touched,
 * and the seed records are applied last — so a refusal leaves the environment
 * exactly as it found it. The staged archive is deleted in a `finally`, so it
 * is gone after a successful import and after a failed or refused one alike: a
 * WooCommerce export sitting on a PVC is a liability whether or not the import
 * that was supposed to consume it worked.
 */
export async function runCatalogueImport(
  input: CatalogueImportInput,
): Promise<CatalogueImportSummary> {
  const now = input.now ?? new Date();

  try {
    const archive = await readStagedArchive(input.archivePath);
    assertArchiveChecksum(archive, input.expected.archiveSha256);

    const members = readArchiveMembers(archive);
    assertNoPersonalData(members);
    assertEnvironmentIdentity(readManifestEnvironment(members), input.expected.environment);

    const plan = readCatalogueImportPlan(members, now);
    const media = await syncMedia(members, input.mediaRoot);

    const records = seedRecords(plan);
    for (const record of records) {
      await input.target.upsert(record);
    }

    return {
      environment: plan.environment,
      records: records.length,
      mediaWritten: media.written,
      mediaUnchanged: media.unchanged,
    };
  } finally {
    await rm(input.archivePath, { force: true });
  }
}
