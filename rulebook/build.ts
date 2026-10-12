import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { reviewedSheets } from "./layout/overrides.js";
import { en } from "./text/en.js";
import { fontSpecs, requireFonts } from "./fonts.js";
import { fitFrame } from "./fit.js";
import { sourceLeading } from "./leading.js";
import { makeUnderlays } from "./underlay.js";
import { renderRulebookHtml } from "./template.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const locale = process.argv[2];
if (!locale) throw new Error("Usage: npm run rulebook:build -- <locale>");
const fontDir = process.env.RULEBOOK_FONT_DIR;
if (!fontDir) throw new Error("RULEBOOK_FONT_DIR must name the directory containing MADE Evolve Sans OTF files");
const editions = { en: { tag: "en", title: "Lunar Base Rule Book", text: en } } as const;
const edition = editions[locale as keyof typeof editions];
if (!edition) throw new Error(`No rulebook text edition for ${locale}`);
const specs = fontSpecs(fontDir, root);
await requireFonts(specs);
const work = resolve(root, "rulebook/.work", locale);
await mkdir(work, { recursive: true });
const source = resolve(root, "storefront/public/documents/lunar-base-rulebook.pdf");
await access(source);
const englishLeading = await sourceLeading(source, reviewedSheets);
const underlays = await makeUnderlays(source, work, reviewedSheets);
const html = await renderRulebookHtml({ locale, languageTag: edition.tag, title: edition.title, sheets: reviewedSheets, text: edition.text, underlays, fonts: specs });
await writeFile(join(work, "rulebook.html"), html);
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch (error) { throw new Error(`Playwright Chromium is missing; run npx playwright install chromium. ${String(error)}`, { cause: error }); }
try {
  const page = await browser.newPage();
  await page.goto(`file://${join(work, "rulebook.html")}`, { waitUntil: "load" });
  await page.evaluate("document.fonts.ready");
  const fits: Record<string, { size: number; scale: number; leading: number; leadingScale: number }> = {};
  for (const sheet of reviewedSheets) for (const frame of sheet.frames) {
    try {
      fits[frame.id] = await fitFrame(frame.fontSize, englishLeading[frame.id] ?? frame.fontSize * 1.25, async (size, leading) => page.locator(`[id="${frame.id}"]`).evaluate((element, value) => {
        const node = element as typeof element & { style: { fontSize: string; lineHeight: string }; scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number };
        node.style.fontSize = `${value.size}pt`;
        node.style.lineHeight = `${value.leading}pt`;
        return node.scrollHeight <= node.clientHeight + 4 && node.scrollWidth <= node.clientWidth + 4;
      }, { size, leading }));
    } catch (error) { throw new Error(`Sheet ${sheet.sheet}, frame ${frame.id}: ${String(error)}`, { cause: error }); }
  }
  const output = locale === "en" ? join(work, "lunar-base-rulebook-en.pdf") : resolve(root, `storefront/public/documents/lunar-base-rulebook-${locale}.pdf`);
  await page.pdf({ path: output, printBackground: true, preferCSSPageSize: true, tagged: true });
  await writeFile(join(work, "fit.json"), JSON.stringify(fits, null, 2));
  console.log(`Wrote ${output}; ${underlays.filter((entry) => entry.kind === "raster").length} raster underlays`);
} finally { await browser.close(); }
