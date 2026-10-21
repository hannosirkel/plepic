import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RULEBOOK_LANGUAGES, rulebookDocuments } from "./rulebook-documents.js";
import { LOCALES } from "./routes.js";

const documentsDir = join(dirname(fileURLToPath(import.meta.url)), "../storefront/public/documents");

describe("published rulebook PDFs", () => {
  it("registers exactly the rulebook languages, each under its own tag", () => {
    expect(Object.keys(rulebookDocuments).sort()).toEqual([...RULEBOOK_LANGUAGES].sort());
    expect([...RULEBOOK_LANGUAGES].slice(0, LOCALES.length)).toEqual([...LOCALES]);
    for (const [language, document] of Object.entries(rulebookDocuments)) expect(document.languageTag).toBe(language);
  });

  it("registers every rulebook language and matches each committed file's size and sheet count", () => {
    expect(Object.keys(rulebookDocuments).sort()).toEqual([...RULEBOOK_LANGUAGES].sort());
    for (const document of Object.values(rulebookDocuments)) {
      if (document === null) continue;
      const file = join(documentsDir, document.fileName);
      const bytes = statSync(file).size;
      expect(document.megabytes).toBe(Math.round(bytes / 1_000_000 * 10) / 10);
      expect(document.sheetCount).toBe(25);
    }
  });
});
