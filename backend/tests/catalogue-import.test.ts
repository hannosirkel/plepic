import { chmod, copyFile, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { StagedArchiveDisposalFailure } from "../src/catalogue-import/disposal.js";
import { CatalogueImportRefusal } from "../src/catalogue-import/refusal.js";
import { runCatalogueImport, type ExpectedImportIdentity } from "../src/catalogue-import/run.js";
import type { CatalogueSeedTarget, SeedRecord } from "../src/catalogue-import/seed.js";
import {
  boxImage,
  manifest,
  sha256,
  tableImage,
  validArchive,
} from "./helpers/catalogue-archive.js";

const now = new Date("2026-08-14T00:00:00.000Z");

/**
 * A store with the only semantics the import is allowed to rely on: every
 * record is addressed by its natural key, so applying the same record twice
 * leaves one row. Nothing here dedupes on the caller's behalf — a create-shaped
 * import would leave two rows and the twice-run assertions below would fail.
 */
class RecordingTarget implements CatalogueSeedTarget {
  readonly rows = new Map<string, SeedRecord>();
  readonly applied: SeedRecord[] = [];

  constructor(private readonly failAfter: number = Number.POSITIVE_INFINITY) {}

  upsert(record: SeedRecord): Promise<void> {
    if (this.applied.length >= this.failAfter) {
      return Promise.reject(new Error("synthetic interruption"));
    }
    this.applied.push(record);
    this.rows.set(`${record.kind}:${record.key}`, record);
    return Promise.resolve();
  }
}

const roots: string[] = [];

async function workspace(archive: Buffer = validArchive()): Promise<{
  readonly archivePath: string;
  readonly mediaRoot: string;
  readonly expected: ExpectedImportIdentity;
}> {
  const root = await mkdtemp(join(tmpdir(), "plepic-import-"));
  roots.push(root);
  const archivePath = join(root, "catalogue.tar.gz");
  const mediaRoot = join(root, "static");
  await writeFile(archivePath, archive);
  return {
    archivePath,
    mediaRoot,
    expected: { archiveSha256: sha256(archive), environment: "test" },
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

afterEach(() => {
  roots.length = 0;
  vi.restoreAllMocks();
});

describe("runCatalogueImport", () => {
  it("seeds the commerce data the plan permits and nothing else", async () => {
    const target = new RecordingTarget();
    const place = await workspace();

    const summary = await runCatalogueImport({ ...place, target, now });

    expect(summary).toMatchObject({ environment: "test", mediaWritten: 2, mediaUnchanged: 0 });
    // No shipping record: the zones, the methods and their two flat rates are
    // declared in src/commerce/shipping-model.ts and applied by
    // `npm run configure:commerce`, never by the import.
    expect([...target.rows.keys()].sort()).toEqual([
      "product:lunar-base",
      "tax-region:EE",
      "variant-price:LUNAR-BASE-01/EUR",
      "variant-stock:LUNAR-BASE-01",
      "promotion:LUNAR10",
    ].sort());
  });

  it("keeps only coupons that are still valid at the moment of the run", async () => {
    const target = new RecordingTarget();
    await runCatalogueImport({ ...(await workspace()), target, now });

    const codes = [...target.rows.values()]
      .filter((record) => record.kind === "promotion")
      .map((record) => record.key);
    expect(codes).toEqual(["LUNAR10"]);
    expect(manifest.coupons.map((coupon) => coupon.code)).toContain("EXPIRED5");
  });

  it("carries the packaged dimensions and the advertised price through unchanged", async () => {
    const target = new RecordingTarget();
    await runCatalogueImport({ ...(await workspace()), target, now });

    expect(target.rows.get("product:lunar-base")).toMatchObject({
      kind: "product",
      packaging: {
        weightGrams: 310,
        lengthMillimetres: 220,
        widthMillimetres: 160,
        heightMillimetres: 60,
      },
    });
    expect(target.rows.get("variant-price:LUNAR-BASE-01/EUR")).toMatchObject({
      amountMinor: 2500,
      currency: "EUR",
      taxIncluded: true,
    });
  });

  it("leaves one product, one price, one stock figure and one copy of each media file when run twice", async () => {
    const place = await workspace();
    const first = new RecordingTarget();
    await runCatalogueImport({ ...place, target: first, now });

    const firstBox = await stat(join(place.mediaRoot, "lunar-base-box.webp"));

    // The Job stages the archive again for the second run; the import removed it.
    await writeFile(place.archivePath, validArchive());
    const second = new RecordingTarget();
    const summary = await runCatalogueImport({ ...place, target: second, now });

    expect(second.applied).toEqual(first.applied);
    expect([...second.rows.keys()].sort()).toEqual([...first.rows.keys()].sort());
    expect([...second.rows.values()].filter((record) => record.kind === "product")).toHaveLength(1);
    expect(
      [...second.rows.values()].filter((record) => record.kind === "variant-price"),
    ).toHaveLength(1);
    expect(
      [...second.rows.values()].filter((record) => record.kind === "variant-stock"),
    ).toHaveLength(1);

    expect((await readdir(place.mediaRoot)).sort()).toEqual([
      "lunar-base-box.webp",
      "lunar-base-table.webp",
    ]);
    expect(await readFile(join(place.mediaRoot, "lunar-base-box.webp"))).toEqual(boxImage);
    expect(await readFile(join(place.mediaRoot, "lunar-base-table.webp"))).toEqual(tableImage);
    expect(summary).toMatchObject({ mediaWritten: 0, mediaUnchanged: 2 });
    expect((await stat(join(place.mediaRoot, "lunar-base-box.webp"))).mtimeMs).toBe(
      firstBox.mtimeMs,
    );
  });

  it("converges after a run interrupted halfway through seeding", async () => {
    const place = await workspace();
    const interrupted = new RecordingTarget(3);

    await expect(runCatalogueImport({ ...place, target: interrupted, now })).rejects.toThrow(
      /synthetic interruption/,
    );
    expect(interrupted.rows.size).toBe(3);

    await writeFile(place.archivePath, validArchive());
    const resumed = new RecordingTarget();
    await runCatalogueImport({ ...place, target: resumed, now });

    const complete = new RecordingTarget();
    await writeFile(place.archivePath, validArchive());
    await runCatalogueImport({ ...place, target: complete, now });
    expect([...resumed.rows.keys()].sort()).toEqual([...complete.rows.keys()].sort());
    expect((await readdir(place.mediaRoot)).sort()).toEqual([
      "lunar-base-box.webp",
      "lunar-base-table.webp",
    ]);
  });

  it("discards a partial media file left behind by an interrupted run", async () => {
    const place = await workspace();
    const target = new RecordingTarget();
    await runCatalogueImport({ ...place, target, now });

    const partial = join(place.mediaRoot, "lunar-base-box.webp.plepic-import-partial");
    await writeFile(partial, "truncated");
    await writeFile(place.archivePath, validArchive());
    await runCatalogueImport({ ...place, target: new RecordingTarget(), now });

    expect((await readdir(place.mediaRoot)).sort()).toEqual([
      "lunar-base-box.webp",
      "lunar-base-table.webp",
    ]);
    expect(await readFile(join(place.mediaRoot, "lunar-base-box.webp"))).toEqual(boxImage);
  });

  it("replaces a media file whose bytes changed and leaves the identical ones alone", async () => {
    const place = await workspace();
    await runCatalogueImport({ ...place, target: new RecordingTarget(), now });

    await writeFile(join(place.mediaRoot, "lunar-base-box.webp"), "stale bytes");
    await writeFile(place.archivePath, validArchive());
    const summary = await runCatalogueImport({ ...place, target: new RecordingTarget(), now });

    expect(summary).toMatchObject({ mediaWritten: 1, mediaUnchanged: 1 });
    expect(await readFile(join(place.mediaRoot, "lunar-base-box.webp"))).toEqual(boxImage);
  });

  it("deletes the staged archive after a successful run and after a refused one alike", async () => {
    const success = await workspace();
    await runCatalogueImport({ ...success, target: new RecordingTarget(), now });
    expect(await exists(success.archivePath)).toBe(false);

    const mismatch = await workspace();
    await expect(
      runCatalogueImport({
        ...mismatch,
        expected: { ...mismatch.expected, archiveSha256: sha256(Buffer.from("other", "utf8")) },
        target: new RecordingTarget(),
        now,
      }),
    ).rejects.toBeInstanceOf(CatalogueImportRefusal);
    expect(await exists(mismatch.archivePath)).toBe(false);

    const failed = await workspace();
    await expect(
      runCatalogueImport({ ...failed, target: new RecordingTarget(0), now }),
    ).rejects.toThrow(/synthetic interruption/);
    expect(await exists(failed.archivePath)).toBe(false);
  });

  it("fails the run when a successful import cannot dispose of the staged archive", async () => {
    const place = await workspace();
    const staging = await mkdtemp(join(tmpdir(), "plepic-import-staging-"));
    const archivePath = join(staging, "catalogue.tar.gz");
    await copyFile(place.archivePath, archivePath);
    await chmod(staging, 0o500);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      // Nothing else refused, so the leak is the only thing to report and it is
      // reported by failing: a Job that seeded the catalogue and left the
      // WooCommerce export on the assets PVC did not succeed.
      await expect(
        runCatalogueImport({ ...place, archivePath, target: new RecordingTarget(), now }),
      ).rejects.toBeInstanceOf(StagedArchiveDisposalFailure);
    } finally {
      await chmod(staging, 0o700);
    }
  });

  it("refuses before touching the media root when the checksum does not match", async () => {
    const place = await workspace();

    await expect(
      runCatalogueImport({
        ...place,
        expected: { ...place.expected, archiveSha256: sha256(Buffer.from("other", "utf8")) },
        target: new RecordingTarget(),
        now,
      }),
    ).rejects.toBeInstanceOf(CatalogueImportRefusal);

    expect(await exists(place.mediaRoot)).toBe(false);
  });

  it("refuses when the archive records the other environment", async () => {
    const place = await workspace();

    await expect(
      runCatalogueImport({
        ...place,
        expected: { ...place.expected, environment: "live" },
        target: new RecordingTarget(),
        now,
      }),
    ).rejects.toMatchObject({ reason: "environment-identity-mismatch" });
    expect(await exists(place.mediaRoot)).toBe(false);
  });

  /**
   * The unset-expected-value half of this test used to live here, as
   * `expected: {archiveSha256: undefined}`. It has moved to
   * `tests/catalogue-import-command.test.ts`, which drives it through the
   * command the Job runs. The type no longer admits the state at all: an
   * unconfigured import is refused by the configuration gate, above this
   * function, and proving it here proved nothing about the path production
   * takes.
   */
  it("refuses when no archive is staged", async () => {
    const place = await workspace();

    await expect(
      runCatalogueImport({
        ...place,
        archivePath: join(place.mediaRoot, "absent.tar.gz"),
        target: new RecordingTarget(),
        now,
      }),
    ).rejects.toMatchObject({ reason: "archive-missing" });
  });

  it("never writes a media file outside the assets root", async () => {
    const place = await workspace(
      validArchive([{ name: "media/../../escape.webp", content: boxImage }]),
    );

    await expect(
      runCatalogueImport({
        ...place,
        expected: { ...place.expected, archiveSha256: sha256(await readFile(place.archivePath)) },
        target: new RecordingTarget(),
        now,
      }),
    ).rejects.toMatchObject({ reason: "unsafe-archive-member" });

    expect(await exists(join(place.mediaRoot, "..", "..", "escape.webp"))).toBe(false);
    expect(await exists(place.mediaRoot)).toBe(false);
  });
});
