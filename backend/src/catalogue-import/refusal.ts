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

export type ImportEnvironmentIdentity = "live" | "test";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The one gate that decides whether the expected archive digest is configured
 * at all, and the only producer of a validated one.
 *
 * It lives here rather than in the configuration reader because "an
 * unconfigured import refuses" is a refusal, not a startup error: it carries a
 * reason a Job log can be read for, and it is raised on the same path as every
 * other refusal, so the staged archive is disposed of the same way. The message
 * names the variable and never the digest — a log that prints the expected
 * digest turns a log reader into someone who can forge a matching archive.
 */
export function assertExpectedArchiveDigest(value: string | undefined): string {
  const configured = value?.trim();
  if (configured === undefined || !SHA256_HEX.test(configured)) {
    throw new CatalogueImportRefusal(
      "expected-value-unset",
      "no expected archive SHA-256 is configured; set CATALOGUE_IMPORT_ARCHIVE_SHA256 to 64 lowercase hex digits",
    );
  }
  return configured;
}

/** The same gate for the environment identity. `live` and `test` are the only two. */
export function assertExpectedEnvironmentIdentity(
  value: string | undefined,
): ImportEnvironmentIdentity {
  const configured = value?.trim();
  if (configured !== "live" && configured !== "test") {
    throw new CatalogueImportRefusal(
      "expected-value-unset",
      "no expected environment identity is configured; set CATALOGUE_IMPORT_ENVIRONMENT to exactly live or test",
    );
  }
  return configured;
}

/**
 * Refuses unless the staged archive hashes to the value the deployment
 * configured. Neither digest appears in the message: the actual one is a fact
 * about an unverified file and the expected one is configuration.
 *
 * `expected` is already validated — {@link assertExpectedArchiveDigest} is the
 * only way to obtain one — so there is no unset branch here to be reassured by.
 */
export function assertArchiveChecksum(archive: Uint8Array, expected: string): void {
  const actual = Buffer.from(sha256Hex(archive), "hex");
  if (!timingSafeEqual(actual, Buffer.from(expected, "hex"))) {
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
export function assertEnvironmentIdentity(
  recorded: unknown,
  expected: ImportEnvironmentIdentity,
): void {
  if (typeof recorded !== "string" || recorded.trim() !== expected) {
    throw new CatalogueImportRefusal(
      "environment-identity-mismatch",
      `the staged archive was not prepared for the ${expected} environment`,
    );
  }
}
