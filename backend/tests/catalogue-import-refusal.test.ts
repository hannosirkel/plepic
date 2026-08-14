import { describe, expect, it } from "vitest";

import {
  CatalogueImportRefusal,
  assertArchiveChecksum,
  assertEnvironmentIdentity,
} from "../src/catalogue-import/refusal.js";
import {
  catalogueImportArchivePath,
  readCatalogueImportRuntimeConfig,
} from "../src/config/runtime.js";
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

  /**
   * Fail-closed is asserted through the configuration reader, because that is
   * where the command meets it. It used to be asserted by handing
   * `assertArchiveChecksum` an `undefined` expected value — a state the command
   * cannot produce — and the branch that answered was unreachable from the real
   * entry point. `tests/catalogue-import-command.test.ts` drives the same
   * refusals through `npm run catalogue:import` itself.
   */
  it("fails closed when either expected value is unset, empty or malformed", () => {
    for (const value of [undefined, "", "   ", "not-a-digest", digest.toUpperCase(), `${digest}0`]) {
      expect(refusalReason(() => {
        readCatalogueImportRuntimeConfig(
          { CATALOGUE_IMPORT_ARCHIVE_SHA256: value, CATALOGUE_IMPORT_ENVIRONMENT: "test" },
          "/app",
        );
      })).toBe("expected-value-unset");
    }

    for (const value of [undefined, "", "   ", "staging", "Live", "live test"]) {
      expect(refusalReason(() => {
        readCatalogueImportRuntimeConfig(
          { CATALOGUE_IMPORT_ARCHIVE_SHA256: digest, CATALOGUE_IMPORT_ENVIRONMENT: value },
          "/app",
        );
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

  it("defaults the staged archive path to the Job's mount point and derives the media root", () => {
    expect(readCatalogueImportRuntimeConfig(environment, "/app")).toEqual({
      archivePath: "/var/lib/plepic/import/catalogue.tar.gz",
      mediaRoot: "/app/static",
      expectedArchiveSha256: digest,
      environmentIdentity: "test",
    });
  });

  it("names the missing variable rather than proceeding unconfigured", () => {
    expect(() => readCatalogueImportRuntimeConfig({}, "/app")).toThrow(
      /CATALOGUE_IMPORT_ARCHIVE_SHA256/,
    );
    expect(() =>
      readCatalogueImportRuntimeConfig({ CATALOGUE_IMPORT_ARCHIVE_SHA256: digest }, "/app"),
    ).toThrow(/CATALOGUE_IMPORT_ENVIRONMENT/);
  });

  it("rejects a malformed digest and an unrecognised environment identity", () => {
    expect(() =>
      readCatalogueImportRuntimeConfig(
        { ...environment, CATALOGUE_IMPORT_ARCHIVE_SHA256: "abc" },
        "/app",
      ),
    ).toThrow(/CATALOGUE_IMPORT_ARCHIVE_SHA256/);
    expect(() =>
      readCatalogueImportRuntimeConfig(
        { ...environment, CATALOGUE_IMPORT_ENVIRONMENT: "staging" },
        "/app",
      ),
    ).toThrow(/CATALOGUE_IMPORT_ENVIRONMENT/);
  });

  it("takes the staged archive path from configuration when supplied", () => {
    expect(
      readCatalogueImportRuntimeConfig(
        { ...environment, CATALOGUE_IMPORT_ARCHIVE_PATH: "/var/lib/plepic/import/other.tar.gz" },
        "/srv/medusa",
      ),
    ).toMatchObject({
      archivePath: "/var/lib/plepic/import/other.tar.gz",
      mediaRoot: "/srv/medusa/static",
    });
  });

  /**
   * The command has to know which file to dispose of before it knows whether it
   * is configured well enough to run at all, or a configuration refusal leaves
   * the staged WooCommerce export on the assets PVC.
   */
  it("resolves the staged archive path without judging anything else", () => {
    expect(catalogueImportArchivePath({})).toBe("/var/lib/plepic/import/catalogue.tar.gz");
    expect(catalogueImportArchivePath({ CATALOGUE_IMPORT_ARCHIVE_PATH: "  " })).toBe(
      "/var/lib/plepic/import/catalogue.tar.gz",
    );
    expect(
      catalogueImportArchivePath({ CATALOGUE_IMPORT_ARCHIVE_PATH: "/tmp/staged.tar.gz" }),
    ).toBe("/tmp/staged.tar.gz");
  });
});
