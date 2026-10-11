import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import type { ReviewedSheet } from "./layout/overrides.js";
const run = promisify(execFile);

async function command(binary: string, args: string[]): Promise<void> {
  try { await run(binary, args, { maxBuffer: 16 * 1024 * 1024 }); }
  catch (error) { throw new Error(`${binary} failed or is missing: ${String(error)}`, { cause: error }); }
}

export type Underlay = { sheet: number; path: string; kind: "svg" | "raster"; pixelRatio: number };

export async function makeUnderlays(source: string, work: string, sheets: readonly ReviewedSheet[], maxPixelRatio = 0.005): Promise<Underlay[]> {
  await mkdir(work, { recursive: true });
  const stripped = join(work, "artwork.pdf");
  await command("gs", ["-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite", "-dFILTERTEXT", `-sOutputFile=${stripped}`, source]);
  const result: Underlay[] = [];
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (error) { throw new Error(`Playwright Chromium is missing; run npx playwright install chromium. ${String(error)}`, { cause: error }); }
  try {
  for (const sheet of sheets) {
    const index = String(sheet.sheet).padStart(2, "0");
    const svg = join(work, `sheet-${index}.svg`);
    await command("pdftocairo", ["-f", String(sheet.sheet), "-l", String(sheet.sheet), "-svg", stripped, svg]);
    const xml = await readFile(svg, "utf8");
    if (!xml.includes("<svg")) throw new Error(`Poppler produced no SVG for sheet ${sheet.sheet}`);
    const sourcePng = join(work, `sheet-${index}-source.png`);
    const vectorPng = join(work, `sheet-${index}-vector.png`);
    await command("pdftoppm", ["-f", String(sheet.sheet), "-l", String(sheet.sheet), "-r", "72", "-png", "-singlefile", stripped, sourcePng.slice(0, -4)]);
    const page = await browser.newPage({ viewport: { width: Math.round(sheet.width), height: Math.round(sheet.height) }, deviceScaleFactor: 1 });
    await page.goto(`file://${svg}`, { waitUntil: "load" });
    await page.screenshot({ path: vectorPng });
    await page.close();
    let ratio = 1;
    try {
      const { stdout, stderr } = await run("magick", ["compare", "-metric", "AE", sourcePng, vectorPng, "null:"], { maxBuffer: 1024 * 1024 });
      ratio = Number((stderr || stdout).trim());
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      ratio = Number(stderr.trim().split(/\s+/).at(-1));
    }
    ratio = Number.isFinite(ratio) ? ratio / (Math.round(sheet.width) * Math.round(sheet.height)) : 1;
    if (ratio > maxPixelRatio) {
      const raster = join(work, `sheet-${index}-300.jpg`);
      await command("pdftoppm", ["-f", String(sheet.sheet), "-l", String(sheet.sheet), "-r", "300", "-jpeg", "-jpegopt", "quality=90", "-singlefile", stripped, raster.slice(0, -4)]);
      result.push({ sheet: sheet.sheet, path: raster, kind: "raster", pixelRatio: ratio });
    } else result.push({ sheet: sheet.sheet, path: svg, kind: "svg", pixelRatio: ratio });
  }
  await writeFile(join(work, "underlays.json"), JSON.stringify(result, null, 2));
  return result;
  } finally { await browser.close(); }
}
