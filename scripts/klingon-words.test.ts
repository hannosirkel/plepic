import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { IDENTIFIER_KEYS } from "../content/glossary/schema.js";
import type { GlossaryEntry } from "../content/glossary/schema.js";
import { klingonLexicon } from "../content/glossary/tlh-lexicon.js";
import type { KlingonLexiconEntry } from "../content/glossary/tlh-lexicon.js";
import { klingonGlossary } from "../content/glossary/tlh.js";
import { TERM_IDS, TERMS } from "../content/glossary/terms.js";
import { checkKlingonWords, isKnownKlingonWord } from "./klingon-words.js";

describe("Klingon word check", () => {
  it("accepts attested roots and ordinary inflections", () => {
    for (const word of ["tlhIngan", "Hol", "maleghlaH", "qo'mey", "Qapla'", "nobmeH", "ngaSwI'", "woDlu'bogh"]) {
      expect(isKnownKlingonWord(word), word).toBe(true);
    }
  });

  it("rejects bad spelling, a lost glottal stop and an unknown root", () => {
    expect(checkKlingonWords("klingon")).toEqual([{ word: "klingon", reason: "spelling" }]);
    expect(checkKlingonWords("Qapla")).toEqual([{ word: "Qapla", reason: "unknown-root" }]);
    expect(checkKlingonWords("qoch")).toEqual([{ word: "qoch", reason: "unknown-root" }]);
  });

  it("accepts sourced roots of every declared word class", () => {
    const lexicon = klingonLexicon as unknown as Record<string, KlingonLexiconEntry>;
    lexicon.jIH = { wordClass: "pronoun", english: "I", source: "TKD" };
    lexicon["'ej"] = { wordClass: "other", english: "and", source: "TKD" };
    try {
      expect(checkKlingonWords("jIH 'ej")).toEqual([]);
    } finally {
      delete lexicon.jIH;
      delete lexicon["'ej"];
    }
  });

  it("does not treat the noun suffix -na' as a verb suffix", () => {
    expect(checkKlingonWords("Dujna'")).toEqual([]);
    expect(checkKlingonWords("leghna'")).toEqual([{ word: "leghna'", reason: "unknown-root" }]);
  });

  it("exempts only exact named proper nouns and loans", () => {
    expect(checkKlingonWords("Lunar Base Qapla'", ["Lunar Base"])).toEqual([]);
    expect(checkKlingonWords("VAT", [], ["VAT"])).toEqual([]);
    expect(checkKlingonWords("vat", [], ["VAT"])).not.toEqual([]);
  });

  it("accepts a printed card label only when bracketed", () => {
    expect(checkKlingonWords("vumwI' (Agent)")).toEqual([]);
    expect(checkKlingonWords("Agent")).not.toEqual([]);
  });

  it("sources every glossary root and explains every coined glossary construction", () => {
    expect(Object.keys(klingonGlossary).sort()).toEqual([...TERM_IDS].sort());
    for (const id of TERM_IDS) {
      const entry: GlossaryEntry = klingonGlossary[id];
      if (TERMS[id].class === "as-printed") expect(entry.term).toBe(TERMS[id].english);
      else {
        expect(checkKlingonWords(entry.term), `${id}: ${entry.term}`).toEqual([]);
        if (entry.note?.startsWith("Coined")) {
          const roots = [...entry.note.matchAll(/(?:^|[ :+])([A-Za-z']+) \(/g)].map((match) => match[1]);
          expect(roots.length, `${id}: construction has no roots`).toBeGreaterThan(0);
          for (const root of roots) expect(root && Object.hasOwn(klingonLexicon, root), `${id}: ${root}`).toBe(true);
        }
      }
    }
    for (const [root, entry] of Object.entries(klingonLexicon) as [string, KlingonLexiconEntry][]) {
      expect(entry.source, root).toMatch(/^(TKD|KGT|KLI|coined)$/);
      expect(isKnownKlingonWord(root), root).toBe(true);
      if (entry.source === "coined") {
        expect((entry.construction?.length ?? 0) > 0, root).toBe(true);
        for (const component of entry.construction ?? []) {
          expect(Object.hasOwn(klingonLexicon, component), `${root}: ${component}`).toBe(true);
        }
      }
    }
  });
});

const sourceDirectories = ["content/legal/tlh", "content/tlh", "rulebook/text/tlh"];
const excludedKeys = new Set([...IDENTIFIER_KEYS, "english", "forms", "forbidden", "note"]);

function translationFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? translationFiles(path) : entry.name.endsWith(".ts") && entry.name !== "index.ts" ? [path] : [];
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

function proseStrings(value: unknown, key = ""): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => proseStrings(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([name, item]) =>
      excludedKeys.has(name) || name.endsWith("Id") ? [] : proseStrings(item, name));
  }
  return [];
}

it("checks every staged Klingon translation string and reports the scan count", async () => {
  const files = sourceDirectories.flatMap(translationFiles);
  const failures: string[] = [];
  let scannedStrings = 0;
  for (const file of files) {
    const module = await import(pathToFileURL(join(process.cwd(), file)).href) as Record<string, unknown>;
    for (const value of Object.values(module)) {
      for (const line of proseStrings(value)) {
        scannedStrings++;
        for (const issue of checkKlingonWords(line)) failures.push(`${file}: ${issue.word} (${issue.reason})`);
      }
    }
  }
  process.stdout.write(`Klingon word check: ${scannedStrings} translated strings in ${files.length} files\n`);
  if (files.length === 0) expect(scannedStrings, "no tlh translation files yet").toBe(0);
  expect(failures).toEqual([]);
});
