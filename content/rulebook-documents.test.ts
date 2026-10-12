import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rulebookDocuments } from "./rulebook-documents.js";
import { LOCALES } from "./routes.js";

const documentsDir = join(dirname(fileURLToPath(import.meta.url)), "../storefront/public/documents");

describe("published rulebook PDFs", () => {
  it("registers every edition and matches each committed file's size and sheet count", () => {
    expect(Object.keys(rulebookDocuments).sort()).toEqual([...LOCALES].sort());
    for (const document of Object.values(rulebookDocuments)) {
      if (document === null) continue;
      const file = join(documentsDir, document.fileName);
      const bytes = statSync(file).size;
      expect(document.megabytes).toBe(Math.round(bytes / 1_000_000 * 10) / 10);
      expect(document.sheetCount).toBe(25);
    }
  });
});
