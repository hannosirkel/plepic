import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configManager } from "@medusajs/framework/config";
import type { MedusaContainer } from "@medusajs/framework/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CatalogueImportRefusal } from "../src/catalogue-import/refusal.js";
import catalogueImport from "../src/scripts/catalogue-import.js";
import { sha256, validArchive } from "./helpers/catalogue-archive.js";

/**
 * The refusal contract, driven through **the command the Job actually runs**.
 *
 * `npm run catalogue:import` is `medusa exec` on
 * `src/scripts/catalogue-import.ts`, and the function this file calls is the
 * default export that `medusa exec` invokes. Nothing here hands the import a
 * state it could not reach in the cluster: every input is an environment
 * variable and a file on disk, exactly as the Job supplies them.
 *
 * That distinction is the point. The suite previously proved archive deletion
 * by calling `runCatalogueImport` with `expected: {archiveSha256: undefined}` —
 * a state production cannot produce, because the configuration reader refuses
 * it first — and so proved nothing about the four refusal paths that leave the
 * import body unentered. A staged WooCommerce export survived every one of
 * them.
 */

const archive = validArchive();
const digest = sha256(archive);
const otherDigest = sha256(Buffer.from("a different archive", "utf8"));

const container = {} as MedusaContainer;

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

let previousEnvironment: NodeJS.ProcessEnv;
let root: string;
let archivePath: string;

beforeEach(async () => {
  previousEnvironment = { ...process.env };
  root = await mkdtemp(join(tmpdir(), "plepic-import-command-"));
  archivePath = join(root, "catalogue.tar.gz");
  await writeFile(archivePath, archive);

  // The framework's own base directory, set the way `medusa exec` sets it —
  // `loaders({directory: process.cwd()})` — so the media root the command
  // derives is the directory this process would really serve.
  configManager.loadConfig({ projectConfig: {}, baseDir: root, throwOnValidationError: false });

  process.env.CATALOGUE_IMPORT_ARCHIVE_PATH = archivePath;
  process.env.CATALOGUE_IMPORT_ARCHIVE_SHA256 = digest;
  process.env.CATALOGUE_IMPORT_ENVIRONMENT = "test";
});

afterEach(() => {
  process.env = previousEnvironment;
});

async function refusalFrom(): Promise<CatalogueImportRefusal> {
  const error: unknown = await catalogueImport({ container, args: [] }).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  if (!(error instanceof CatalogueImportRefusal)) {
    throw new Error(
      `expected a catalogue import refusal, got ${error === null ? "no error" : String(error)}`,
    );
  }
  return error;
}

describe("the catalogue:import command", () => {
  const refusals = [
    {
      name: "no expected archive digest is configured",
      reason: "expected-value-unset",
      configure: () => {
        delete process.env.CATALOGUE_IMPORT_ARCHIVE_SHA256;
      },
    },
    {
      name: "the expected archive digest is empty",
      reason: "expected-value-unset",
      configure: () => {
        process.env.CATALOGUE_IMPORT_ARCHIVE_SHA256 = "   ";
      },
    },
    {
      name: "the expected archive digest is malformed",
      reason: "expected-value-unset",
      configure: () => {
        process.env.CATALOGUE_IMPORT_ARCHIVE_SHA256 = digest.toUpperCase();
      },
    },
    {
      name: "no expected environment identity is configured",
      reason: "expected-value-unset",
      configure: () => {
        delete process.env.CATALOGUE_IMPORT_ENVIRONMENT;
      },
    },
    {
      name: "the expected environment identity is neither live nor test",
      reason: "expected-value-unset",
      configure: () => {
        process.env.CATALOGUE_IMPORT_ENVIRONMENT = "staging";
      },
    },
    {
      name: "the staged archive is not the one this environment expects",
      reason: "archive-checksum-mismatch",
      configure: () => {
        process.env.CATALOGUE_IMPORT_ARCHIVE_SHA256 = otherDigest;
      },
    },
    {
      name: "the archive was prepared for the other environment",
      reason: "environment-identity-mismatch",
      configure: () => {
        process.env.CATALOGUE_IMPORT_ENVIRONMENT = "live";
      },
    },
  ] as const;

  for (const refusal of refusals) {
    it(`refuses and deletes the staged archive when ${refusal.name}`, async () => {
      refusal.configure();

      const error = await refusalFrom();

      expect(error.reason).toBe(refusal.reason);
      expect(
        await exists(archivePath),
        "the staged WooCommerce export survived a refusal and stays on the assets PVC",
      ).toBe(false);
    });
  }

  it("names the unset expected value without disclosing the digest it expected", async () => {
    delete process.env.CATALOGUE_IMPORT_ARCHIVE_SHA256;

    const error = await refusalFrom();

    expect(error.message).toContain("CATALOGUE_IMPORT_ARCHIVE_SHA256");
    expect(error.message).not.toContain(digest);
  });

  it("deletes the staged archive even when no archive is staged to begin with", async () => {
    process.env.CATALOGUE_IMPORT_ARCHIVE_PATH = join(root, "absent.tar.gz");

    const error = await refusalFrom();

    expect(error.reason).toBe("archive-missing");
    expect(await exists(join(root, "absent.tar.gz"))).toBe(false);
  });
});
