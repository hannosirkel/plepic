import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const contentDir = dirname(fileURLToPath(import.meta.url));
const siteModules = [
  "publisher", "lunar-base", "proof", "support", "shop", "pages", "interface",
] as const;
const legalModules = ["imprint", "privacy", "returns", "shipping", "terms"] as const;
const fixedKeys = new Set([
  "anchor", "autoComplete", "control", "covers", "emphasis", "href", "id",
  "indexable", "kind", "name", "path", "reviewStatus", "route", "sections",
  "source", "src", "to", "type", "url", "youTubeId",
]);

// Both token syntaxes copy is written with: `{token}` for what `schema.ts` declares,
// `%token%` for what a component fills in. Repeats are kept, so a count is compared too.
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{[A-Za-z][A-Za-z0-9]*\}|%[A-Za-z][A-Za-z0-9]*%/g)].map(([token]) => token).sort();
}

function compareStructure(english: unknown, translated: unknown, path: string): string[] {
  if (Array.isArray(english)) {
    if (!Array.isArray(translated)) return [`${path}: expected a list`];
    const errors = english.length === translated.length
      ? []
      : [`${path}: list length ${translated.length} differs from English ${english.length}`];
    for (let index = 0; index < Math.min(english.length, translated.length); index++) {
      errors.push(...compareStructure(english[index], translated[index], `${path}[${index}]`));
    }
    return errors;
  }
  if (english !== null && typeof english === "object") {
    if (translated === null || typeof translated !== "object" || Array.isArray(translated)) {
      return [`${path}: expected an object`];
    }
    const original = english as Record<string, unknown>;
    const other = translated as Record<string, unknown>;
    const errors = [
      ...Object.keys(original).filter((key) => !Object.hasOwn(other, key)).map((key) => `${path}.${key}: missing key`),
      ...Object.keys(other).filter((key) => !Object.hasOwn(original, key)).map((key) => `${path}.${key}: extra key`),
    ];
    for (const key of Object.keys(original)) {
      if (Object.hasOwn(other, key)) errors.push(...compareStructure(original[key], other[key], `${path}.${key}`));
    }
    return errors;
  }
  if (typeof english !== typeof translated) return [`${path}: value type changed`];
  if (typeof english === "string" && typeof translated === "string") {
    const key = path.replaceAll("[", ".").replaceAll("]", "").split(".").at(-1) ?? "";
    if ((fixedKeys.has(key) || key.endsWith("Id") || /\.(covers|sections|supporting)\[/.test(path)) && english !== translated) {
      return [`${path}: identifier or link target changed from ${JSON.stringify(english)} to ${JSON.stringify(translated)}`];
    }
    if (JSON.stringify(placeholders(english)) !== JSON.stringify(placeholders(translated))) {
      return [`${path}: placeholders changed from ${placeholders(english).join(", ")} to ${placeholders(translated).join(", ")}`];
    }
    return [];
  }
  return english === translated ? [] : [`${path}: structural value changed`];
}

async function compareEdition(directory: string, modules: readonly string[], extension = ".ts") {
  const errors: string[] = [];
  const expected = new Set(modules.map((name) => name + extension));
  const staged = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:[cm]?[jt]sx?)$/.test(entry.name));
  for (const entry of staged) {
    if (!expected.has(entry.name)) errors.push(`${join(directory, entry.name)}: no English module to mirror`);
  }
  for (const moduleName of modules.filter((name) => staged.some((entry) => entry.name === name + extension))) {
    const source = join(dirname(directory), `${moduleName}${extension}`);
    const target = join(directory, `${moduleName}${extension}`);
    const english = await import(pathToFileURL(source).href);
    let translated: unknown;
    try {
      translated = await import(pathToFileURL(target).href);
    } catch {
      errors.push(`${target}: unreadable module`);
      continue;
    }
    errors.push(...compareStructure(english, translated, target));
  }
  return errors;
}

describe("edition structure mirror", () => {
  it("checks every staged site and legal directory, including unregistered editions", async () => {
    const errors: string[] = [];
    for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "legal" && entry.name !== "glossary") {
        errors.push(...await compareEdition(join(contentDir, entry.name), siteModules));
      }
    }
    const legalDir = join(contentDir, "legal");
    for (const entry of readdirSync(legalDir, { withFileTypes: true })) {
      if (entry.isDirectory()) errors.push(...await compareEdition(join(legalDir, entry.name), legalModules));
    }
    expect(errors).toEqual([]);
  });

  it("names removed exports, list items, changed anchors and placeholders in fixture failures", async () => {
    const root = mkdtempSync(join(tmpdir(), "plepic-mirror-"));
    const edition = join(root, "fixture");
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(edition);
      writeFileSync(join(root, "sample.mjs"),
        'export const first = [{ anchor: "start", text: "Pay {price}" }, { anchor: "end", text: "Done" }];\nexport const removed = "text";\n');
      writeFileSync(join(edition, "sample.mjs"),
        'export const first = [{ anchor: "changed", text: "Pay {priceNet}" }];\n');
      const failures = await compareEdition(edition, ["sample"], ".mjs");
      expect(failures.join("\n")).toContain("removed: missing key");
      expect(failures.join("\n")).toContain("list length");
      expect(failures.join("\n")).toContain("anchor");
      expect(failures.join("\n")).toContain("placeholders");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a percent token dropped from, repeated in or renamed in a translated sentence", async () => {
    const { downloadNote } = (await import("./interface")).interfaceCopy.rulebook;
    expect(downloadNote).toContain("%megabytes%");
    const root = mkdtempSync(join(tmpdir(), "plepic-mirror-percent-"));
    try {
      const { mkdirSync } = await import("node:fs");
      const moduleOf = (note: string) => `export const rulebook = { downloadNote: ${JSON.stringify(note)} };\n`;
      writeFileSync(join(root, "sample.mjs"), moduleOf(downloadNote));
      // One edition directory per translation: a module is cached by its URL.
      const failuresFor = async (edition: string, translated: string) => {
        mkdirSync(join(root, edition));
        writeFileSync(join(root, edition, "sample.mjs"), moduleOf(translated));
        return (await compareEdition(join(root, edition), ["sample"], ".mjs")).join("\n");
      };
      expect(await failuresFor("kept", downloadNote.replace("It is a", "See on"))).toBe("");
      for (const [edition, translated] of [
        ["dropped", downloadNote.replace("%megabytes% ", "")],
        ["repeated", downloadNote.replace("%megabytes%", "%megabytes% or %megabytes%")],
        ["renamed", downloadNote.replace("%megabytes%", "%megabaiti%")],
      ] as const) {
        expect(translated).not.toBe(downloadNote);
        expect(await failuresFor(edition, translated), edition).toContain("rulebook.downloadNote: placeholders changed");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("checks a staged module before the rest of an edition exists", async () => {
    const root = mkdtempSync(join(tmpdir(), "plepic-mirror-partial-"));
    const edition = join(root, "fixture");
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(edition);
      writeFileSync(join(root, "sample.mjs"), 'export const line = "English";\n');
      writeFileSync(join(edition, "sample.mjs"), 'export const line = "Translated";\n');
      expect(await compareEdition(edition, ["sample", "later"], ".mjs")).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects changed supporting source ids in a fixture", async () => {
    const root = mkdtempSync(join(tmpdir(), "plepic-mirror-sources-"));
    const edition = join(root, "fixture");
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(edition);
      writeFileSync(join(root, "sample.mjs"), 'export const proof = { supporting: ["E14", "E15"] };\n');
      writeFileSync(join(edition, "sample.mjs"), 'export const proof = { supporting: ["E1", "E2"] };\n');
      expect((await compareEdition(edition, ["sample"], ".mjs")).join("\n")).toContain("supporting[0]");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects changed form tokens and review metadata in a fixture", async () => {
    const root = mkdtempSync(join(tmpdir(), "plepic-mirror-fields-"));
    const edition = join(root, "fixture");
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(edition);
      writeFileSync(join(root, "sample.mjs"), 'export const field = { name: "email", type: "email", control: "input", autoComplete: "email", emphasis: "primary", reviewStatus: "operator-approved" };\n');
      writeFileSync(join(edition, "sample.mjs"), 'export const field = { name: "e-post", type: "text", control: "country", autoComplete: "e-post", emphasis: "secondary", reviewStatus: "draft" };\n');
      const failures = (await compareEdition(edition, ["sample"], ".mjs")).join("\n");
      for (const key of ["name", "type", "control", "autoComplete", "emphasis", "reviewStatus"]) {
        expect(failures).toContain(`field.${key}`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
