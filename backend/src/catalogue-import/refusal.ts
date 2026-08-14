import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Why an import stopped. Every refusal carries one of these, so a Job failure
 * is diagnosable from its exit message without the message ever quoting the
 * data that caused it.
 */
export type CatalogueImportRefusalReason =
  /**
   * The expected checksum or environment identity was absent or malformed.
   * An unconfigured import refuses; it never proceeds. This is the reason the
   * expected values are read from the backend's runtime configuration rather
   * than from a file staged beside the archive: a self-consistent pair proves
   * nothing.
   */
  | "expected-value-unset"
  | "archive-missing"
  | "archive-checksum-mismatch"
  | "environment-identity-mismatch"
  | "personal-data-present"
  | "unrecognised-manifest-section"
  | "unsafe-archive-member"
  | "unsupported-archive-member"
  | "malformed-archive";

export class CatalogueImportRefusal extends Error {
  constructor(
    readonly reason: CatalogueImportRefusalReason,
    detail: string,
  ) {
    super(`Catalogue import refused (${reason}): ${detail}`);
    this.name = "CatalogueImportRefusal";
  }
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Refuses unless the staged archive hashes to the value the deployment
 * configured. Neither digest appears in the message: the actual one is a fact
 * about an unverified file and the expected one is configuration, and a Job log
 * that prints the expected digest turns a log reader into someone who can forge
 * a matching archive.
 */
export function assertArchiveChecksum(archive: Uint8Array, expected: string | undefined): void {
  const configured = expected?.trim();
  if (configured === undefined || !SHA256_HEX.test(configured)) {
    throw new CatalogueImportRefusal(
      "expected-value-unset",
      "no expected archive SHA-256 is configured; set CATALOGUE_IMPORT_ARCHIVE_SHA256 to 64 lowercase hex digits",
    );
  }

  const actual = Buffer.from(sha256Hex(archive), "hex");
  if (!timingSafeEqual(actual, Buffer.from(configured, "hex"))) {
    throw new CatalogueImportRefusal(
      "archive-checksum-mismatch",
      "the staged archive is not the archive this environment expects",
    );
  }
}

/**
 * Refuses unless the archive was prepared for this environment. This is what
 * stops the live export being imported into test, or the reverse — the two
 * environments share source and base manifests but no data at all.
 */
export function assertEnvironmentIdentity(recorded: unknown, expected: string | undefined): void {
  const configured = expected?.trim();
  if (configured === undefined || configured.length === 0) {
    throw new CatalogueImportRefusal(
      "expected-value-unset",
      "no expected environment identity is configured; set CATALOGUE_IMPORT_ENVIRONMENT",
    );
  }

  if (typeof recorded !== "string" || recorded.trim() !== configured) {
    throw new CatalogueImportRefusal(
      "environment-identity-mismatch",
      `the staged archive was not prepared for the ${configured} environment`,
    );
  }
}
