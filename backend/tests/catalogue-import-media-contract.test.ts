import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MEDIA_PUBLIC_PREFIX, mediaPublicUrl, resolveMediaRequest } from "../src/catalogue-import/media.js";
import { CatalogueImportRefusal } from "../src/catalogue-import/refusal.js";
import { runCatalogueImport } from "../src/catalogue-import/run.js";
import type { CatalogueSeedTarget, SeedRecord } from "../src/catalogue-import/seed.js";
import { boxImage, sha256, validArchive } from "./helpers/catalogue-archive.js";

const now = new Date("2026-08-14T00:00:00.000Z");

class CollectingTarget implements CatalogueSeedTarget {
  readonly records: SeedRecord[] = [];
  upsert(record: SeedRecord): Promise<void> {
    this.records.push(record);
    return Promise.resolve();
  }
}

function refusalReason(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogueImportRefusal) return error.reason;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("media delivery contract", () => {
  it("imports, serves and restores the same bytes under /static/*", async () => {
    const root = await mkdtemp(join(tmpdir(), "plepic-media-"));
    const archivePath = join(root, "catalogue.tar.gz");
    const mediaRoot = join(root, "static");
    const archive = validArchive();
    const expected = { archiveSha256: sha256(archive), environment: "test" };

    // Import.
    await writeFile(archivePath, archive);
    const target = new CollectingTarget();
    await runCatalogueImport({ archivePath, mediaRoot, expected, target, now });

    const product = target.records.find((record) => record.kind === "product");
    expect(product).toMatchObject({
      media: [
        { url: "/static/lunar-base-box.webp", role: "thumbnail" },
        { url: "/static/lunar-base-table.webp", role: "gallery" },
      ],
    });

    // Render: the URL Medusa hands out resolves to the file on the assets PVC.
    const served = resolveMediaRequest(mediaRoot, "/static/lunar-base-box.webp");
    expect(served).toBe(join(mediaRoot, "lunar-base-box.webp"));
    expect(await readFile(served)).toEqual(boxImage);

    // Restore: an emptied assets volume is refilled by re-running the import.
    await rm(mediaRoot, { recursive: true });
    await writeFile(archivePath, archive);
    await runCatalogueImport({ archivePath, mediaRoot, expected, target: new CollectingTarget(), now });
    expect(await readFile(resolveMediaRequest(mediaRoot, "/static/lunar-base-box.webp"))).toEqual(
      boxImage,
    );

    await rm(root, { recursive: true, force: true });
  });

  it("builds the public URL from the media prefix and nothing else", () => {
    expect(MEDIA_PUBLIC_PREFIX).toBe("/static/");
    expect(mediaPublicUrl("lunar-base-box.webp")).toBe("/static/lunar-base-box.webp");
    expect(refusalReason(() => mediaPublicUrl("../escape.webp"))).toBe("unsafe-archive-member");
  });

  it("refuses a crafted request path rather than serving outside the assets root", () => {
    for (const requestPath of [
      "/static/../../etc/passwd",
      "/static/..%2f..%2fetc%2fpasswd",
      "/static/%2e%2e/escape.webp",
      "/static//etc/passwd",
      "/static/sub/../../escape.webp",
      "/static/back\\slash.webp",
      "/static/nul\0.webp",
      "/static/",
      "/static",
      "/etc/passwd",
      "/store-api/static/lunar-base-box.webp",
      "/staticky/x.webp",
    ]) {
      expect(refusalReason(() => resolveMediaRequest("/app/static", requestPath))).toBe(
        "unsafe-archive-member",
      );
    }
  });
});
