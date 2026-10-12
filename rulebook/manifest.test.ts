import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { englishPdf } from "./editions.js";
import { manifestPath, readManifest, recordEdition, verifyManifest, type Manifest } from "./manifest.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const germanPdf = "storefront/public/documents/lunar-base-rulebook-de.pdf";

/** A repository in miniature: the files a German edition is built from, and its PDF. */
async function fixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "rulebook-manifest-"));
  const files = {
    [englishPdf]: "the English PDF",
    [germanPdf]: "the German PDF",
    "rulebook/layout/frames.ts": "frames",
    "rulebook/layout/overrides.ts": "overrides",
    "rulebook/text/de.ts": "Regelbuch",
    [manifestPath]: JSON.stringify({ english: { path: englishPdf, sha256: "" }, editions: {} }),
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), content);
  }
  return directory;
}

async function recorded(directory: string): Promise<Manifest> {
  await recordEdition(directory, "de", germanPdf);
  return readManifest(directory);
}

describe("the committed rulebook manifest", () => {
  it("agrees with the current files, and has an entry for every translated PDF", async () => {
    expect(await verifyManifest(root, await readManifest(root))).toEqual([]);
  });

  it("fails when any recorded hash is edited", async () => {
    const manifest = await readManifest(root);
    const hashes = [manifest.english, ...Object.values(manifest.editions).map((edition) => edition.pdf)];
    expect(hashes.length).toBeGreaterThan(0);
    for (const recorded of hashes) {
      const original = recorded.sha256;
      recorded.sha256 = original.replace(/^./, (first) => (first === "0" ? "1" : "0"));
      expect(await verifyManifest(root, manifest)).toContainEqual(expect.stringContaining(`${recorded.path} differs`));
      recorded.sha256 = original;
    }
  });
});

describe("the rulebook manifest of a built edition", () => {
  it("records the PDF and every file it was built from", async () => {
    const directory = await fixture();
    const manifest = await recorded(directory);
    expect(Object.keys(manifest.editions.de?.sources ?? {})).toEqual(["rulebook/layout/frames.ts", "rulebook/layout/overrides.ts", "rulebook/text/de.ts", englishPdf]);
    expect(manifest.editions.de?.pdf.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyManifest(directory, manifest)).toEqual([]);
  });

  it.each([
    ["its text", "rulebook/text/de.ts"],
    ["the frame map", "rulebook/layout/frames.ts"],
    ["the review", "rulebook/layout/overrides.ts"],
    ["the English PDF", englishPdf],
    ["the PDF itself", germanPdf],
  ])("fails when %s changes after the build", async (_what, path) => {
    const directory = await fixture();
    const manifest = await recorded(directory);
    await writeFile(join(directory, path), "changed");
    expect(await verifyManifest(directory, manifest)).toContainEqual(`de: ${path} differs from its recorded hash`);
  });

  it("fails when a text file is added after the build", async () => {
    const directory = await fixture();
    const manifest = await recorded(directory);
    await mkdir(join(directory, "rulebook/text/de"));
    await writeFile(join(directory, "rulebook/text/de/sheet-02.ts"), "Noch ein Blatt");
    expect(await verifyManifest(directory, manifest)).toEqual(["de: rulebook/text/de/sheet-02.ts is a source but was not recorded"]);
  });

  it("fails when a translated PDF has no entry", async () => {
    const directory = await fixture();
    const { english } = await recorded(directory);
    expect(await verifyManifest(directory, { english, editions: {} })).toEqual([
      `de: ${germanPdf} has no entry; run npm run rulebook:build -- de`,
    ]);
  });

  it("fails when a recorded PDF is gone", async () => {
    const directory = await fixture();
    const manifest = await recorded(directory);
    manifest.editions.et = { pdf: { path: "storefront/public/documents/lunar-base-rulebook-et.pdf", sha256: "0" }, sources: {} };
    expect(await verifyManifest(directory, manifest)).toContain("et: storefront/public/documents/lunar-base-rulebook-et.pdf is recorded but missing");
  });
});

