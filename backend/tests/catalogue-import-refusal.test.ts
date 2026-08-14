import { describe, expect, it } from "vitest";

import {
  CatalogueImportRefusal,
  assertArchiveChecksum,
  assertEnvironmentIdentity,
} from "../src/catalogue-import/refusal.js";
import { readCatalogueImportRuntimeConfig } from "../src/config/runtime.js";
import { sha256 } from "./helpers/catalogue-archive.js";

const archive = Buffer.from("synthetic-archive-bytes", "utf8");
const digest = sha256(archive);

function refusalReason(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogueImportRefusal) return error.reason;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("catalogue import refusal gate", () => {
  it("admits an archive whose checksum and recorded environment both match", () => {
    expect(() => {
      assertArchiveChecksum(archive, digest);
    }).not.toThrow();
    expect(() => {
      assertEnvironmentIdentity("test", "test");
    }).not.toThrow();
  });

  it("refuses a checksum mismatch without disclosing the expected digest", () => {
    const expected = sha256(Buffer.from("a different archive", "utf8"));
    let message = "";
    try {
      assertArchiveChecksum(archive, expected);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(refusalReason(() => {
      assertArchiveChecksum(archive, expected);
    })).toBe("archive-checksum-mismatch");
    expect(message).not.toContain(expected);
    expect(message).not.toContain(digest);
  });

  it("refuses when the recorded environment identity is not the configured one", () => {
    expect(refusalReason(() => {
      assertEnvironmentIdentity("live", "test");
    })).toBe("environment-identity-mismatch");
  });

  it("fails closed when either expected value is unset, empty or malformed", () => {
    for (const expected of [undefined, "", "   ", "not-a-digest", digest.toUpperCase(), `${digest}0`]) {
      expect(refusalReason(() => {
        assertArchiveChecksum(archive, expected);
      })).toBe("expected-value-unset");
    }

    for (const expected of [undefined, "", "   "]) {
      expect(refusalReason(() => {
        assertEnvironmentIdentity("test", expected);
      })).toBe("expected-value-unset");
    }
  });

  it("refuses an archive that records no environment identity at all", () => {
    for (const recorded of [undefined, null, "", "  ", 5, {}]) {
      expect(refusalReason(() => {
        assertEnvironmentIdentity(recorded, "test");
      })).toBe("environment-identity-mismatch");
    }
  });
});

describe("readCatalogueImportRuntimeConfig", () => {
  const environment = {
    CATALOGUE_IMPORT_ARCHIVE_SHA256: digest,
    CATALOGUE_IMPORT_ENVIRONMENT: "test",
  };

  it("defaults the staged archive and media paths to the Job's mount points", () => {
    expect(readCatalogueImportRuntimeConfig(environment)).toEqual({
      archivePath: "/var/lib/plepic/import/catalogue.tar.gz",
      mediaRoot: "/app/static",
      expectedArchiveSha256: digest,
      environmentIdentity: "test",
    });
  });

  it("names the missing variable rather than proceeding unconfigured", () => {
    expect(() => readCatalogueImportRuntimeConfig({})).toThrow(
      /CATALOGUE_IMPORT_ARCHIVE_SHA256/,
    );
    expect(() =>
      readCatalogueImportRuntimeConfig({ CATALOGUE_IMPORT_ARCHIVE_SHA256: digest }),
    ).toThrow(/CATALOGUE_IMPORT_ENVIRONMENT/);
  });

  it("rejects a malformed digest and an unrecognised environment identity", () => {
    expect(() =>
      readCatalogueImportRuntimeConfig({ ...environment, CATALOGUE_IMPORT_ARCHIVE_SHA256: "abc" }),
    ).toThrow(/CATALOGUE_IMPORT_ARCHIVE_SHA256/);
    expect(() =>
      readCatalogueImportRuntimeConfig({ ...environment, CATALOGUE_IMPORT_ENVIRONMENT: "staging" }),
    ).toThrow(/CATALOGUE_IMPORT_ENVIRONMENT/);
  });

  it("takes the staged archive path and media root from configuration when supplied", () => {
    expect(
      readCatalogueImportRuntimeConfig({
        ...environment,
        CATALOGUE_IMPORT_ARCHIVE_PATH: "/var/lib/plepic/import/other.tar.gz",
        MEDIA_ROOT: "/app/assets",
      }),
    ).toMatchObject({
      archivePath: "/var/lib/plepic/import/other.tar.gz",
      mediaRoot: "/app/assets",
    });
  });
});
