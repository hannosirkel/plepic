import { mkdir, writeFile, access } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { FrameId, ReviewedSheet } from "./layout/overrides.js";
import { editionSheets } from "./layout/overrides.js";
import { editions, editionPaths, englishPdf, type Edition } from "./editions.js";
import { fontSpecs, requireFonts, type FontSpec } from "./fonts.js";
import { DoesNotFit, fitFloor, fitFrame, type Fit } from "./fit.js";
import { sourceLeading } from "./leading.js";
import { recordEdition } from "./manifest.js";
import { parseMarkup } from "./text/schema.js";
import { makeUnderlays } from "./underlay.js";
import { renderRulebookHtml } from "./template.js";

export type BuildInput = {
  root: string;
  locale: string;
  edition: Edition;
  sheets: readonly ReviewedSheet<FrameId>[];
  fonts: readonly FontSpec[];
  /** The ignored directory that receives the underlays, the HTML and `fit.json`. */
  work: string;
};

/** Strips the text, makes the underlays and composes the HTML that `printEdition` prints. */
export async function composeEdition(input: BuildInput): Promise<string> {
  await mkdir(input.work, { recursive: true });
  const underlays = await makeUnderlays(resolve(input.root, englishPdf), input.work, input.sheets);
  console.log(`${underlays.filter((entry) => entry.kind === "raster").length} raster underlays`);
  return renderRulebookHtml({ locale: input.locale, languageTag: input.edition.tag, title: input.edition.title, sheets: input.sheets, text: input.edition.text, underlays, fonts: input.fonts });
}

/** An anchor's room may lie this many CSS pixels off its frame: the frame's letter then still stands clear of the text. */
const anchorSlack = 2;

/**
 * Fits every frame and prints the PDF. A frame that does not fit at the
 * floor of the ladder is printed there and returned: the PDF is still
 * written, so that the layout check can name the frame and the reviewer can
 * see it.
 */
export async function printEdition(html: string, input: BuildInput, output: string): Promise<string[]> {
  const englishLeading = await sourceLeading(resolve(input.root, englishPdf), input.sheets);
  await writeFile(join(input.work, "rulebook.html"), html);
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { throw new Error(`Playwright Chromium is missing; run npx playwright install chromium. ${String(error)}`, { cause: error }); }
  try {
    const page = await browser.newPage();
    await page.goto(`file://${join(input.work, "rulebook.html")}`, { waitUntil: "load" });
    await page.evaluate("document.fonts.ready");
    const fits: Record<string, Fit & { fits: boolean }> = {};
    for (const sheet of input.sheets) for (const frame of sheet.frames) {
      const leading = englishLeading[frame.id] ?? frame.fontSize * 1.25;
      const set = async (size: number, lineHeight: number) => page.locator(`[id="${frame.id}"]`).evaluate((element, value) => {
        type Placed = { style: Record<string, string>; dataset: Record<string, string>; getBoundingClientRect(): { left: number; right: number; top: number; bottom: number } };
        const node = element as unknown as Placed & {
          scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number;
          querySelectorAll(selector: string): Iterable<Placed>; ownerDocument: { getElementById(id: string): Placed | null };
        };
        node.style.fontSize = `${value.size}pt`;
        node.style.lineHeight = `${value.lineHeight}pt`;
        // Each anchor's room is pushed right until it lies around its frame. Where it cannot get there, in the frame's own line, the text does not fit.
        let landed = true;
        for (const anchor of node.querySelectorAll(".anchor")) {
          const label = node.ownerDocument.getElementById(anchor.dataset.frame ?? "")?.getBoundingClientRect();
          if (!label) throw new Error(`No frame ${anchor.dataset.frame} to anchor`);
          const left = (label.left + label.right) / 2 - Number(anchor.dataset.room) * (96 / 72) / 2;
          anchor.style.marginLeft = "0";
          let room = anchor.getBoundingClientRect();
          // A room that lies past the frame's box has no width, and stays at the end of its line.
          const inside = room.right > room.left;
          if (inside) anchor.style.marginLeft = `${Math.max(0, left - room.left)}px`;
          room = anchor.getBoundingClientRect();
          landed &&= (inside ? Math.abs(left - room.left) : Math.max(0, room.left - left)) <= value.anchorSlack && Math.abs(label.bottom - room.bottom) <= (label.bottom - label.top) / 2;
        }
        return landed && node.scrollHeight <= node.clientHeight + 4 && node.scrollWidth <= node.clientWidth + 4;
      }, { size, lineHeight, anchorSlack });
      try {
        fits[frame.id] = { ...await fitFrame(frame.fontSize, leading, set), fits: true };
      } catch (error) {
        if (!(error instanceof DoesNotFit)) throw new Error(`Sheet ${sheet.sheet}, frame ${frame.id}: ${String(error)}`, { cause: error });
        const floor = fitFloor(frame.fontSize, leading);
        await set(floor.size, floor.leading);
        fits[frame.id] = { ...floor, fits: false };
      }
    }
    await page.pdf({ path: output, printBackground: true, preferCSSPageSize: true, tagged: true });
    await writeFile(join(input.work, "fit.json"), JSON.stringify(fits, null, 2));
    console.log(`Wrote ${output}`);
    return Object.entries(fits).filter(([, fit]) => !fit.fits).map(([id]) => id);
  } finally { await browser.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const locale = process.argv[2];
  if (!locale) throw new Error("Usage: npm run rulebook:build -- <locale>");
  const fontDir = process.env.RULEBOOK_FONT_DIR;
  if (!fontDir) throw new Error("RULEBOOK_FONT_DIR must name the directory containing MADE Evolve Sans OTF files");
  const edition = editions[locale];
  if (!edition) throw new Error(`No rulebook text edition for ${locale}`);
  const fonts = fontSpecs(fontDir, root);
  await requireFonts(fonts);
  await access(resolve(root, englishPdf));
  const { work, pdf } = editionPaths(root, locale);
  const input: BuildInput = { root, locale, edition, sheets: editionSheets(locale), fonts, work };
  const unfit = await printEdition(await composeEdition(input), input, pdf);
  if (unfit.length > 0) {
    const anchors = (id: string) => parseMarkup(edition.text[id as FrameId]).some((block) => block.lines.flat().some((run) => "anchor" in run));
    for (const id of unfit) console.error(`${id} does not fit its box at the floor of the ladder${anchors(id) ? ", or does not bring a frame named in its text into that frame's own line" : ""}`);
    console.error(`rulebook/manifest.json was not updated. npm run rulebook:check -- ${locale} measures each frame; shorten its text and build again.`);
    process.exitCode = 1;
  } else if (locale !== "en") {
    // The English proof is never committed, so it has no entry.
    await recordEdition(root, locale, relative(root, pdf).replaceAll("\\", "/"));
  }
}
