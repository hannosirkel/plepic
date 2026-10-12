import { execFile } from "node:child_process";
import { access, mkdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { editionPaths, editions, englishPdf, type Edition } from "./editions.js";
import { embeddedFontNames, fontSpecs } from "./fonts.js";
import { sourceLeading } from "./leading.js";
import type { ReviewedFrame, ReviewedSheet } from "./layout/overrides.js";
import { reviewedSheets } from "./layout/overrides.js";
import { plainText } from "./text/schema.js";
import { thresholds } from "./thresholds.js";

/**
 * The layout check of plan section "How the layout is checked". It reads
 * the built PDF and nothing the build wrote beside it, so a committed PDF
 * can be checked on its own.
 *
 * Chromium tags the PDF with one structure element per frame, in the order
 * of the HTML. That is how a frame's text is found in the PDF without
 * relying on where it landed: sheet N's k-th structure element is that
 * sheet's k-th frame. The Structure check fails when the two do not line
 * up, and then the sheet's frames cannot be measured either.
 *
 * The one thing read from the published English PDF besides its pixels is
 * where its text stands: the leading of each frame, and the ink two frames
 * already share there.
 */

const execute = promisify(execFile);

async function run(binary: string, args: readonly string[]): Promise<string> {
  try { return (await execute(binary, args, { maxBuffer: 64 * 1024 * 1024 })).stdout; }
  catch (error) { throw new Error(`${binary} failed or is missing: ${String(error)}`, { cause: error }); }
}

async function pool<Item>(items: readonly Item[], work: (item: Item) => Promise<void>, width = 6): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: width }, async () => {
    for (let index = next++; index < items.length; index = next++) await work(items[index] as Item);
  }));
}

export type CheckResult = { name: string; summary: string; failures: string[] };

/** One run of text as the PDF sets it, in points from the sheet's top left. */
export type BuiltRun = { text: string; x: number; width: number; baseline: number; size: number };
export type BuiltFrame = { role: string; runs: BuiltRun[] };
export type BuiltSheet = { width: number; height: number; elements: BuiltFrame[] };
export type Built = { language: string | undefined; sheets: BuiltSheet[] };

type Box = { left: number; right: number; top: number; bottom: number };
type Node = { role?: string; type?: string; id?: string; children?: Node[] };

const toRun = (item: { str: string; transform: number[]; width: number }, height: number): BuiltRun => ({
  text: item.str, x: item.transform[4] ?? 0, width: item.width,
  baseline: height - (item.transform[5] ?? 0), size: Math.hypot(item.transform[0] ?? 0, item.transform[1] ?? 0),
});

const contentIds = (node: Node): string[] => node.type === "content" && node.id ? [node.id] : (node.children ?? []).flatMap(contentIds);

export async function readBuilt(pdf: string): Promise<Built> {
  const document = await getDocument({ data: new Uint8Array(await readFile(pdf)) }).promise;
  try {
    const { info } = await document.getMetadata();
    const sheets: BuiltSheet[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const width = (page.view[2] ?? 0) - (page.view[0] ?? 0);
      const height = (page.view[3] ?? 0) - (page.view[1] ?? 0);
      // Document > the sheet's <section> > one element per frame, beside the section's own content.
      const tree = await page.getStructTree() as Node | null;
      const section = tree?.children?.[0]?.children?.[0];
      const nodes = (section?.children ?? []).filter((node) => node.type !== "content");
      const elements = nodes.map((node) => ({ role: node.role ?? "", runs: [] as BuiltRun[] }));
      const owner = new Map<string, number>();
      nodes.forEach((node, index) => { for (const id of contentIds(node)) owner.set(id, index); });
      const open: (string | undefined)[] = [];
      const content = await page.getTextContent({ includeMarkedContent: true });
      for (const item of content.items) {
        if ("type" in item) {
          if (item.type === "endMarkedContent") open.pop(); else open.push(item.id);
          continue;
        }
        if (!item.str.trim()) continue;
        // List numbers and bullets are aria-hidden, so they are artifacts and belong to no element.
        const element = open.map((id) => (id === undefined ? undefined : owner.get(id))).findLast((index) => index !== undefined);
        if (element === undefined) continue;
        elements[element]?.runs.push(toRun(item, height));
      }
      sheets.push({ width, height, elements });
      page.cleanup();
    }
    return { language: typeof (info as { Language?: unknown }).Language === "string" ? (info as { Language: string }).Language : undefined, sheets };
  } finally { await document.cleanup(); }
}

/** Every run of text on each sheet of the published PDF, which is not tagged by frame. */
export async function readPublished(pdf: string): Promise<BuiltRun[][]> {
  const document = await getDocument({ data: new Uint8Array(await readFile(pdf)) }).promise;
  try {
    const sheets: BuiltRun[][] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const height = (page.view[3] ?? 0) - (page.view[1] ?? 0);
      const content = await page.getTextContent();
      sheets.push(content.items.flatMap((item) => ("str" in item && item.str.trim() ? [toRun(item, height)] : [])));
      page.cleanup();
    }
    return sheets;
  } finally { await document.cleanup(); }
}

/** The em box of a run on its baseline, which is how `layout/frames.ts` measures English. */
const runBox = (run: BuiltRun): Box => ({ left: run.x, right: run.x + run.width, top: run.baseline - thresholds.ascent * run.size, bottom: run.baseline + (1 - thresholds.ascent) * run.size });

/** One box per printed line, as wide as the line from its first run to its last. */
export function lineBoxes(runs: readonly BuiltRun[]): Box[] {
  const lines: { baseline: number; box: Box }[] = [];
  for (const run of [...runs].sort((a, b) => a.baseline - b.baseline)) {
    const box = runBox(run);
    const line = lines.at(-1);
    if (line && run.baseline - line.baseline < 0.3) {
      line.box = { left: Math.min(line.box.left, box.left), right: Math.max(line.box.right, box.right), top: Math.min(line.box.top, box.top), bottom: Math.max(line.box.bottom, box.bottom) };
    } else lines.push({ baseline: run.baseline, box });
  }
  return lines.map((line) => line.box);
}

const union = (boxes: readonly Box[]): Box => ({
  left: Math.min(...boxes.map((box) => box.left)), right: Math.max(...boxes.map((box) => box.right)),
  top: Math.min(...boxes.map((box) => box.top)), bottom: Math.max(...boxes.map((box) => box.bottom)),
});
const english = (frame: ReviewedFrame): Box => ({ left: frame.box.x, right: frame.box.x + frame.box.width, top: frame.box.y, bottom: frame.box.y + frame.box.height });
/** How far two boxes overlap: the smaller of the shared width and the shared height, negative when apart. */
const overlap = (a: Box, b: Box) => Math.min(Math.min(a.right, b.right) - Math.max(a.left, b.left), Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const fixed = (value: number, digits = 2) => value.toFixed(digits);

/** Every frame with the element the PDF holds for it; undefined where the sheet's structure does not line up. */
function pairs(sheets: readonly ReviewedSheet[], built: Built): { sheet: ReviewedSheet; frame: ReviewedFrame; element: BuiltFrame | undefined }[] {
  return sheets.flatMap((sheet) => {
    const page = built.sheets[sheet.sheet - 1];
    const aligned = page?.elements.length === sheet.frames.length;
    return sheet.frames.map((frame, index) => ({ sheet, frame, element: aligned ? page.elements[index] : undefined }));
  });
}

const absent = (element: BuiltFrame | undefined) => (element ? "it has no text in the PDF" : "its sheet's structure elements do not line up with the frames");

export function checkSheets(sheets: readonly ReviewedSheet[], built: Built): CheckResult {
  const failures: string[] = [];
  if (built.sheets.length !== sheets.length) failures.push(`${built.sheets.length} sheets, not ${sheets.length}`);
  let worst = 0;
  for (const sheet of sheets) {
    const page = built.sheets[sheet.sheet - 1];
    if (!page) continue;
    const difference = Math.max(Math.abs(page.width - sheet.width), Math.abs(page.height - sheet.height));
    worst = Math.max(worst, difference);
    if (difference > thresholds.sheetSizePt) failures.push(`sheet ${sheet.sheet} is ${fixed(page.width)} x ${fixed(page.height)} pt, English is ${sheet.width} x ${sheet.height} pt`);
  }
  return { name: "Sheets", summary: `${built.sheets.length} sheets, each within ${fixed(worst)} pt of the English size (limit ${thresholds.sheetSizePt} pt)`, failures };
}

/** The smallest size the ladder allows a frame: 90% of English and 6 pt, except that type already under 6 pt keeps its size. */
export function sizeFloor(englishSize: number): number {
  return englishSize < thresholds.minSizePt ? englishSize : Math.max(englishSize * thresholds.minSizeScale, thresholds.minSizePt);
}

/**
 * The most a frame's leading can be, from its printed baselines. Chromium
 * prints each baseline on a whole CSS pixel, so the distance over any run of
 * lines is the leading times their number, give or take a pixel; a
 * paragraph gap only adds to it. The tightest such run bounds the leading
 * from above, and closely where a paragraph has several lines.
 */
export function leadingBound(runs: readonly BuiltRun[]): number | undefined {
  const baselines = [...new Set(runs.map((run) => Math.round(run.baseline * 100) / 100))].sort((a, b) => a - b);
  let bound: number | undefined;
  baselines.forEach((first, index) => {
    baselines.slice(index + 1).forEach((last, lines) => {
      bound = Math.min(bound ?? Infinity, (last - first + thresholds.baselineGridPt) / (lines + 1));
    });
  });
  return bound;
}

export function checkFit(sheets: readonly ReviewedSheet[], built: Built, englishLeading: Readonly<Record<string, number>>): CheckResult {
  const failures: string[] = [];
  let smallest = 1;
  let tightest = 1;
  let furthest = { by: 0, id: "" };
  for (const { sheet, frame, element } of pairs(sheets, built)) {
    if (!element || element.runs.length === 0) { failures.push(`${frame.id} (sheet ${sheet.sheet}) cannot be measured: ${absent(element)}`); continue; }
    const size = Math.min(...element.runs.map((run) => run.size));
    const scale = size / frame.fontSize;
    smallest = Math.min(smallest, scale);
    if (size < sizeFloor(frame.fontSize) - thresholds.sizeSlackPt) failures.push(`${frame.id} (sheet ${sheet.sheet}) is set at ${fixed(size)} pt, under the floor of ${fixed(sizeFloor(frame.fontSize))} pt for ${frame.fontSize} pt type`);
    if (Math.max(...element.runs.map((run) => run.size)) > frame.fontSize + thresholds.sizeSlackPt) failures.push(`${frame.id} (sheet ${sheet.sheet}) is set larger than its English ${frame.fontSize} pt`);
    const leading = englishLeading[frame.id];
    const bound = leadingBound(element.runs);
    if (bound !== undefined && leading !== undefined) {
      const leadingScale = bound / (leading * scale);
      tightest = Math.min(tightest, leadingScale);
      if (leadingScale < thresholds.minLeadingScale - thresholds.leadingSlack) failures.push(`${frame.id} (sheet ${sheet.sheet}) has at most ${fixed(bound)} pt leading, ${fixed(leadingScale * 100, 1)}% of English at this size; the floor is ${thresholds.minLeadingScale * 100}%`);
    }
    const ink = union(lineBoxes(element.runs));
    const box = english(frame);
    const sides = [["left of", box.left - ink.left], ["right of", ink.right - box.right], ["above", box.top - ink.top], ["below", ink.bottom - box.bottom]] as const;
    const [side, by] = sides.reduce((most, candidate) => (candidate[1] > most[1] ? candidate : most));
    if (by > furthest.by) furthest = { by, id: frame.id };
    if (by > thresholds.fitSlackPt) failures.push(`${frame.id} (sheet ${sheet.sheet}) does not fit: its text runs ${fixed(by, 1)} pt ${side} its box at ${fixed(scale * 100, 0)}% size; shorten the text`);
  }
  return { name: "Fit", summary: `smallest type ${fixed(smallest * 100, 1)}% of English (floor ${thresholds.minSizeScale * 100}%), tightest leading ${fixed(tightest * 100, 1)}% (floor ${thresholds.minLeadingScale * 100}%), furthest outside a box ${fixed(furthest.by)} pt at ${furthest.id || "no frame"} (limit ${thresholds.fitSlackPt} pt)`, failures };
}

/**
 * The ink each frame has on the published sheet: a run belongs to the
 * smallest frame whose box holds it. A label set inside a paragraph's line
 * lies in both boxes and is the label's ink alone; the paragraph's own runs
 * stop either side of it, and that gap is not the paragraph's ink.
 */
export function englishInk(sheet: ReviewedSheet, runs: readonly BuiltRun[]): Map<string, Box[]> {
  const ink = new Map<string, Box[]>();
  const area = (frame: ReviewedFrame) => frame.box.width * frame.box.height;
  const slack = thresholds.inkSlackPt;
  for (const box of runs.map(runBox)) {
    const holds = (frame: ReviewedFrame) => {
      const outer = english(frame);
      return box.left >= outer.left - slack && box.right <= outer.right + slack && box.top >= outer.top - slack && box.bottom <= outer.bottom + slack;
    };
    const owner = sheet.frames.filter(holds).sort((a, b) => area(a) - area(b))[0];
    if (owner) ink.set(owner.id, [...(ink.get(owner.id) ?? []), box]);
  }
  return ink;
}

/**
 * Ink is compared run by run, not line by line or box by box: a paragraph
 * that leaves a gap in its line for a label does not touch the label, and a
 * paragraph that runs through the label does, although the label lies inside
 * the paragraph's box either way.
 */
export function checkCollisions(sheets: readonly ReviewedSheet[], built: Built, published: readonly (readonly BuiltRun[])[]): CheckResult {
  const failures: string[] = [];
  let deepest = { by: 0, pair: "none" };
  const shared = (first: readonly Box[], second: readonly Box[]) => Math.max(0, ...first.flatMap((a) => second.map((b) => overlap(a, b))));
  for (const sheet of sheets) {
    const before = englishInk(sheet, published[sheet.sheet - 1] ?? []);
    const frames = pairs([sheet], built).map(({ frame, element }) => ({ frame, ink: (element?.runs ?? []).map(runBox) }));
    frames.forEach((a, index) => {
      for (const b of frames.slice(index + 1)) {
        const now = shared(a.ink, b.ink);
        if (now === 0) continue;
        // Frames whose ink overlaps in English may overlap as far here.
        const then = shared(before.get(a.frame.id) ?? [], before.get(b.frame.id) ?? []);
        const by = now - then;
        if (by > deepest.by) deepest = { by, pair: `${a.frame.id} and ${b.frame.id}` };
        if (by > thresholds.collisionPt) failures.push(`${a.frame.id} and ${b.frame.id} (sheet ${sheet.sheet}) overlap by ${fixed(now, 1)} pt and ${then > 0 ? `by ${fixed(then, 1)} pt` : "do not overlap"} in English`);
      }
    });
  }
  return { name: "Collisions", summary: `deepest new overlap ${fixed(deepest.by)} pt at ${deepest.pair} (limit ${thresholds.collisionPt} pt)`, failures };
}

export type Word = { text: string; x: number; y: number };

/** The words of `pdftotext -bbox`, per sheet, each with the centre of its box. */
export function parseWords(xhtml: string): Word[][] {
  const unescape = (text: string) => text.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" })[name] ?? "");
  return xhtml.split(/<page [^>]*>/).slice(1).map((page) =>
    [...page.matchAll(/<word xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">([^<]*)<\/word>/g)].map((word) => ({
      text: unescape(word[5] ?? ""), x: (Number(word[1]) + Number(word[3])) / 2, y: (Number(word[2]) + Number(word[4])) / 2,
    })));
}

const squeeze = (text: string) => text.normalize("NFKC").replace(/\s+/gu, "");

/**
 * Reads `expected` out of `words` in order, skipping a word that is not
 * next: a frame set inside another's lines puts foreign words among them.
 * Returns what is left unread, empty when the whole text was found.
 */
export function unread(expected: string, words: readonly string[]): string {
  let rest = squeeze(expected);
  for (const word of words.map(squeeze)) if (word && rest.startsWith(word)) rest = rest.slice(word.length);
  return rest;
}

export type PdfFont = { name: string; embedded: boolean };

/** The rows of `pdffonts`, with the subset prefix removed from each name. */
export function parseFonts(table: string): PdfFont[] {
  return table.split("\n").slice(2).filter((line) => line.trim()).map((line) => {
    const cells = line.trim().split(/\s+/);
    return { name: (cells[0] ?? "").replace(/^[A-Z]{6}\+/, ""), embedded: cells.at(-5) === "yes" };
  });
}

export function fontFailures(fonts: readonly PdfFont[], allowed: readonly string[]): string[] {
  const failures = new Set<string>();
  for (const font of fonts) {
    if (!allowed.includes(font.name)) failures.add(`font ${font.name} is not one rulebook/fonts.ts allows${font.embedded ? ", although it is embedded" : ""}`);
    if (!font.embedded) failures.add(`font ${font.name} is not embedded`);
  }
  return [...failures];
}

export function checkGlyphs(sheets: readonly ReviewedSheet[], built: Built, edition: Edition, words: readonly Word[][], fonts: readonly PdfFont[], allowed: readonly string[]): CheckResult {
  const failures = fontFailures(fonts, allowed);
  words.forEach((page, index) => {
    if (page.some((word) => word.text.includes("�"))) failures.push(`sheet ${index + 1} holds a replacement character`);
  });
  const frames = pairs(sheets, built);
  let found = 0;
  for (const { sheet, frame, element } of frames) {
    const text = plainText(edition.text[frame.id as keyof typeof edition.text]);
    if (!element || element.runs.length === 0) { failures.push(`${frame.id} (sheet ${sheet.sheet}): ${absent(element)}`); continue; }
    // Wherever the text landed, and left to the frame's edge, where a list's numbers and bullets stand.
    const lines = lineBoxes(element.runs);
    const ink = union(lines);
    const area = { left: Math.min(ink.left, frame.box.x) - 1, right: ink.right + 1, top: ink.top - 1, bottom: ink.bottom + 1 };
    const line = (word: Word) => lines.findIndex((box) => word.y >= box.top - 1 && word.y <= box.bottom + 1);
    const inside = (words[sheet.sheet - 1] ?? []).filter((word) => word.x >= area.left && word.x <= area.right && line(word) >= 0)
      .sort((a, b) => line(a) - line(b) || a.x - b.x);
    const rest = unread(text, inside.map((word) => word.text));
    if (rest) failures.push(`${frame.id} (sheet ${sheet.sheet}): pdftotext does not return its text from ${JSON.stringify(rest.slice(0, 24))} on`);
    else found += 1;
  }
  return { name: "Glyphs", summary: `pdftotext returns the text of ${found} of ${frames.length} frames; fonts ${[...new Set(fonts.map((font) => font.name))].sort().join(", ")}`, failures };
}

const structureRoles: Partial<Record<ReviewedFrame["role"], string>> = { h1: "H1", h2: "H2", ol: "L", ul: "L" };

export function checkStructure(sheets: readonly ReviewedSheet[], built: Built, edition: Edition, tagged: boolean): CheckResult {
  const failures: string[] = [];
  if (!tagged) failures.push("the PDF is not tagged");
  if (built.language !== edition.tag) failures.push(`the PDF's language is ${built.language ?? "not set"}, not ${edition.tag}`);
  let marked = 0;
  for (const sheet of sheets) {
    const elements = built.sheets[sheet.sheet - 1]?.elements ?? [];
    if (elements.length !== sheet.frames.length) { failures.push(`sheet ${sheet.sheet} has ${elements.length} structure elements for ${sheet.frames.length} frames`); continue; }
    sheet.frames.forEach((frame, index) => {
      const role = structureRoles[frame.role];
      if (!role) return;
      if (elements[index]?.role === role) marked += 1;
      else failures.push(`${frame.id} (sheet ${sheet.sheet}) is tagged ${elements[index]?.role || "nothing"}, not ${role}`);
    });
  }
  return { name: "Structure", summary: `${tagged ? "tagged" : "not tagged"}, language ${built.language ?? "not set"}, ${marked} headings and lists marked up`, failures };
}

export function checkSize(bytes: number): CheckResult {
  const megabytes = (value: number) => `${fixed(value / 1_000_000, 1)} MB`;
  return { name: "Size", summary: `${megabytes(bytes)} (limit ${megabytes(thresholds.maxBytes)})`, failures: bytes > thresholds.maxBytes ? [`the file is ${megabytes(bytes)}`] : [] };
}

/** Each sheet's share of differing pixels, largest first. */
export function checkPixels(name: string, limit: number, ratios: readonly { sheet: number; ratio: number }[]): CheckResult {
  const sorted = [...ratios].sort((a, b) => b.ratio - a.ratio);
  const worst = sorted[0] ?? { sheet: 0, ratio: 0 };
  return {
    name, summary: `worst sheet ${worst.sheet} differs in ${fixed(worst.ratio * 100, 3)}% of its pixels (limit ${fixed(limit * 100, 3)}%)`,
    failures: sorted.filter((entry) => entry.ratio > limit).map((entry) => `sheet ${entry.sheet} differs in ${fixed(entry.ratio * 100, 3)}% of its pixels`),
  };
}

async function stripText(pdf: string, output: string): Promise<void> {
  await run("gs", ["-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite", "-dFILTERTEXT", `-sOutputFile=${output}`, pdf]);
}

type Canvas = { sheet: number; width: number; height: number };

/**
 * Renders every sheet of `pdf` from its top left corner onto the canvas the
 * built and the English sheet share. Chromium rounds a sheet by up to half a
 * point; cutting both to one size compares them pixel for pixel, where
 * stretching one onto the other would shift every edge.
 */
async function render(pdf: string, directory: string, name: string, canvases: readonly Canvas[]): Promise<void> {
  await pool(canvases, async (canvas) => {
    const page = String(canvas.sheet);
    await run("pdftoppm", ["-f", page, "-l", page, "-r", String(72 * thresholds.renderScale), "-x", "0", "-y", "0", "-W", String(canvas.width), "-H", String(canvas.height), "-png", "-singlefile", pdf, join(directory, `${name}-${page.padStart(2, "0")}`)]);
  });
}

/** The same measure the build uses to judge an underlay: blur away antialiasing, then count pixels beyond a colour tolerance. */
async function differing(directory: string, first: string, second: string, canvases: readonly Canvas[]): Promise<{ sheet: number; ratio: number }[]> {
  const ratios: { sheet: number; ratio: number }[] = [];
  await pool(canvases, async (canvas) => {
    const file = (name: string) => join(directory, `${name}-${String(canvas.sheet).padStart(2, "0")}.png`);
    const blur = ["-blur", `0x${thresholds.compareBlur}`];
    const count = Number.parseFloat(await run("magick", ["(", file(first), ...blur, ")", "(", file(second), ...blur, ")", "-metric", "AE", "-fuzz", `${thresholds.compareFuzzPercent}%`, "-compare", "-format", "%[distortion]", "info:"]));
    if (!Number.isFinite(count)) throw new Error(`magick returned no pixel count for sheet ${canvas.sheet}`);
    ratios.push({ sheet: canvas.sheet, ratio: count / (canvas.width * canvas.height) });
  });
  return ratios;
}

export type CheckInput = { root: string; locale: string; edition: Edition; sheets: readonly ReviewedSheet[]; pdf: string; work: string };

export async function checkEdition(input: CheckInput): Promise<CheckResult[]> {
  const { sheets, edition, pdf } = input;
  const source = resolve(input.root, englishPdf);
  const directory = join(input.work, "check");
  await mkdir(join(input.work, "compare"), { recursive: true });
  await mkdir(directory, { recursive: true });
  const built = await readBuilt(pdf);
  const canvases = sheets.flatMap((sheet): Canvas[] => {
    const page = built.sheets[sheet.sheet - 1];
    return page ? [{ sheet: sheet.sheet, width: Math.floor(Math.min(sheet.width, page.width) * thresholds.renderScale), height: Math.floor(Math.min(sheet.height, page.height) * thresholds.renderScale) }] : [];
  });

  await Promise.all([stripText(source, join(directory, "english-artwork.pdf")), stripText(pdf, join(directory, "built-artwork.pdf"))]);
  await render(join(directory, "english-artwork.pdf"), directory, "english-artwork", canvases);
  await render(join(directory, "built-artwork.pdf"), directory, "built-artwork", canvases);
  await render(source, directory, "english", canvases);
  await render(pdf, directory, "built", canvases);

  const results = [
    checkSheets(sheets, built),
    checkPixels("Artwork", thresholds.artworkPixelRatio, await differing(directory, "built-artwork", "english-artwork", canvases)),
    checkFit(sheets, built, await sourceLeading(source, sheets)),
    checkCollisions(sheets, built, await readPublished(source)),
    checkGlyphs(sheets, built, edition, parseWords(await run("pdftotext", ["-bbox", pdf, "-"])), parseFonts(await run("pdffonts", [pdf])), embeddedFontNames(fontSpecs("", input.root))),
    checkStructure(sheets, built, edition, /^Tagged:\s+yes$/m.test(await run("pdfinfo", [pdf]))),
    checkSize((await stat(pdf)).size),
  ];
  // Only the English text can be held against the published sheets: it is the same text.
  if (input.locale === "en") results.push(checkPixels("English proof", thresholds.proofPixelRatio, await differing(directory, "built", "english", canvases)));

  await pool(canvases, async (canvas) => {
    const page = String(canvas.sheet).padStart(2, "0");
    await run("magick", [join(directory, `built-${page}.png`), join(directory, `english-${page}.png`), "+append", join(input.work, "compare", `sheet-${page}.png`)]);
  });
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const locale = process.argv[2];
  if (!locale) throw new Error("Usage: npm run rulebook:check -- <locale>");
  const edition = editions[locale];
  if (!edition) throw new Error(`No rulebook text edition for ${locale}`);
  const { work, pdf } = editionPaths(root, locale);
  try { await access(pdf); }
  catch { throw new Error(`${pdf} is missing; run npm run rulebook:build -- ${locale} first`); }
  const results = await checkEdition({ root, locale, edition, sheets: reviewedSheets, pdf, work });
  for (const result of results) {
    console.log(`${result.failures.length === 0 ? "ok  " : "FAIL"} ${result.name}: ${result.summary}`);
    for (const failure of result.failures) console.log(`       ${failure}`);
  }
  console.log(`The built sheets, each beside its English sheet, are in ${join(work, "compare")} for the reviewer.`);
  if (results.some((result) => result.failures.length > 0)) process.exitCode = 1;
}
