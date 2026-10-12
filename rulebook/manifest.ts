import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { englishPdf } from "./editions.js";

/**
 * What each committed rulebook PDF was built from. The build writes it and
 * `manifest.test.ts` compares it with the current files, so text or layout
 * changed without a rebuild fails `scripts/validate`.
 *
 * `english` pins the published English PDF, which every edition is laid
 * over. An edition records its own PDF and every file its build read: its
 * text, the frame map, the review and the English PDF.
 */
export type Manifest = {
  english: Recorded;
  editions: Record<string, { pdf: Recorded; sources: Record<string, string> }>;
};
type Recorded = { path: string; sha256: string };

export const manifestPath = "rulebook/manifest.json";
const documents = "storefront/public/documents";
const translatedPdf = /^lunar-base-rulebook-([A-Za-z0-9-]+)\.pdf$/;
const layoutSources = ["rulebook/layout/frames.ts", "rulebook/layout/overrides.ts", englishPdf];

async function sha256(file: string): Promise<string | undefined> {
  try { return createHash("sha256").update(await readFile(file)).digest("hex"); }
  catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
}

async function names(directory: string): Promise<string[]> {
  try { return (await readdir(directory, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)); }
  catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return [];
    throw error;
  }
}

/** An edition's text is `text/<locale>.ts`, a `text/<locale>/` directory, or both. */
async function sourceHashes(root: string, locale: string): Promise<Record<string, string>> {
  const text = resolve(root, "rulebook/text");
  const inDirectory = (await names(join(text, locale))).map((file) => relative(root, file).replaceAll("\\", "/"));
  const hashes: Record<string, string> = {};
  for (const path of [`rulebook/text/${locale}.ts`, ...inDirectory, ...layoutSources].sort()) {
    const hash = await sha256(resolve(root, path));
    if (hash) hashes[path] = hash;
  }
  return hashes;
}

export async function readManifest(root: string): Promise<Manifest> {
  return JSON.parse(await readFile(resolve(root, manifestPath), "utf8")) as Manifest;
}

/** Called by the build once an edition's PDF is written and every frame fits. */
export async function recordEdition(root: string, locale: string, pdf: string): Promise<void> {
  const manifest = await readManifest(root);
  const sources = await sourceHashes(root, locale);
  if (!Object.keys(sources).some((path) => path.startsWith(`rulebook/text/${locale}`))) throw new Error(`No text files for ${locale} under rulebook/text`);
  const english = await sha256(resolve(root, englishPdf));
  const built = await sha256(resolve(root, pdf));
  if (!english || !built) throw new Error(`Cannot record ${locale}: ${english ? pdf : englishPdf} is missing`);
  manifest.english = { path: englishPdf, sha256: english };
  manifest.editions[locale] = { pdf: { path: pdf, sha256: built }, sources };
  manifest.editions = Object.fromEntries(Object.entries(manifest.editions).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(resolve(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Every way the manifest disagrees with the files under `root`; empty when it agrees. */
export async function verifyManifest(root: string, manifest: Manifest): Promise<string[]> {
  const problems: string[] = [];
  const differs = async (owner: string, path: string, recorded: string) => {
    const current = await sha256(resolve(root, path));
    if (!current) problems.push(`${owner}: ${path} is recorded but missing`);
    else if (current !== recorded) problems.push(`${owner}: ${path} differs from its recorded hash`);
  };
  await differs("english", manifest.english.path, manifest.english.sha256);
  for (const file of (await readdir(resolve(root, documents))).sort()) {
    const locale = translatedPdf.exec(file)?.[1];
    if (locale && !manifest.editions[locale]) problems.push(`${locale}: ${documents}/${file} has no entry; run npm run rulebook:build -- ${locale}`);
  }
  for (const [locale, edition] of Object.entries(manifest.editions)) {
    await differs(locale, edition.pdf.path, edition.pdf.sha256);
    for (const [path, recorded] of Object.entries(edition.sources)) await differs(locale, path, recorded);
    for (const path of Object.keys(await sourceHashes(root, locale))) {
      if (!(path in edition.sources)) problems.push(`${locale}: ${path} is a source but was not recorded`);
    }
  }
  return problems;
}
