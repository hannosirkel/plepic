import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = new URL("../", import.meta.url);
const source = new URL("storefront/public/documents/lunar-base-rulebook.pdf", root);
const destination = new URL("rulebook/layout/frames.ts", root);

type TextRun = {
  str: string;
  fontName: string;
  transform: number[];
  width: number;
  height: number;
};

type PositionedRun = TextRun & {
  x: number;
  y: number;
  size: number;
  family: string;
  weight: number;
  style: "normal" | "italic";
  color: string;
};

type Line = {
  runs: PositionedRun[];
  baseline: number;
  x: number;
  right: number;
  top: number;
  bottom: number;
  text: string;
};

type Frame = {
  id: string;
  box: { x: number; y: number; width: number; height: number };
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  color: string;
  alignment: "left" | "center" | "right";
  text: string;
};

type Sheet = { sheet: number; width: number; height: number; frames: Frame[] };

const round = (value: number) => Math.round(value * 100) / 100;

function fontDetails(name: string): Pick<PositionedRun, "family" | "weight" | "style"> {
  const face = name.replace(/^[A-Z]{6}\+/, "");
  if (face.startsWith("MADEEvolveSans")) {
    return {
      family: "MADE Evolve Sans",
      weight: face.endsWith("-Light") ? 300 : face.endsWith("-Medium") ? 500 : face.endsWith("-Bold") ? 700 : 400,
      style: "normal",
    };
  }
  if (face.startsWith("Lato-")) {
    return {
      family: "Lato",
      weight: face.includes("Heavy") ? 800 : face.includes("Bold") ? 700 : face.includes("Medium") ? 500 : 400,
      style: face.includes("Italic") ? "italic" : "normal",
    };
  }
  if (face.startsWith("JosefinSans-")) {
    return { family: "Josefin Sans", weight: face.includes("Bold") ? 700 : 400, style: "normal" };
  }
  throw new Error(`Unrecognised live-text font: ${name}`);
}

function operatorColours(operatorList: { fnArray: number[]; argsArray: unknown[][] }): { char: string; color: string }[] {
  let color = "#000000";
  const stack: string[] = [];
  const chars: { char: string; color: string }[] = [];
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];
    if (fn === OPS.save) stack.push(color);
    if (fn === OPS.restore) color = stack.pop() ?? "#000000";
    if (fn === OPS.setFillRGBColor && typeof args?.[0] === "string") color = args[0];
    if (fn !== OPS.showText && fn !== OPS.showSpacedText) continue;
    const glyphs = args?.[0];
    if (!Array.isArray(glyphs)) continue;
    for (const glyph of glyphs) {
      if (typeof glyph !== "object" || glyph === null || !("unicode" in glyph)) continue;
      const unicode = glyph.unicode;
      if (typeof unicode !== "string") continue;
      for (const char of unicode) if (!/\s/u.test(char)) chars.push({ char, color });
    }
  }
  return chars;
}

function joinRuns(runs: PositionedRun[]): string {
  let result = "";
  let previous: PositionedRun | undefined;
  for (const run of runs) {
    if (previous && result && !/\s$/u.test(result) && !/^\s/u.test(run.str)) {
      const gap = run.x - previous.x - previous.width;
      if (gap > Math.max(1.2, run.size * 0.18)) result += " ";
    }
    result += run.str;
    previous = run;
  }
  return result.trim().replace(/\s+/gu, " ");
}

function makeLines(runs: PositionedRun[]): Line[] {
  const lines: Line[] = [];
  for (const run of runs) {
    const baseline = run.transform[5];
    if (baseline === undefined) throw new Error("Text run has no baseline");
    const previous = lines.at(-1);
    if (previous && Math.abs(previous.baseline - baseline) < 0.6 && run.x >= previous.right - 0.5) {
      previous.runs.push(run);
      previous.right = Math.max(previous.right, run.x + run.width);
      previous.top = Math.min(previous.top, run.y);
      previous.bottom = Math.max(previous.bottom, run.y + run.height);
      previous.text = joinRuns(previous.runs);
    } else {
      lines.push({ runs: [run], baseline, x: run.x, right: run.x + run.width, top: run.y, bottom: run.y + run.height, text: run.str.trim() });
    }
  }
  return lines;
}

function sameFormat(a: PositionedRun, b: PositionedRun): boolean {
  return a.family === b.family && a.style === b.style && a.color === b.color && Math.abs(a.size - b.size) < 0.1;
}

function makeFrames(lines: Line[], sheet: number, pageWidth: number): Frame[] {
  const groups: Line[][] = [];
  for (const line of lines) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    const first = line.runs[0];
    const priorFirst = previous?.runs[0];
    const leading = previous ? previous.baseline - line.baseline : 0;
    const sameIndent = previous && Math.abs(line.x - previous.x) <= 2.5;
    const listContinuation = previous && group?.length === 1 && first &&
      line.x > previous.x && line.x - previous.x <= first.size * 2.2;
    if (group && previous && first && priorFirst && sameFormat(first, priorFirst) &&
        leading > 0 && leading <= first.size * 1.65 && (sameIndent || listContinuation)) {
      group.push(line);
    } else {
      groups.push([line]);
    }
  }

  return groups.map((group, index) => {
    const first = group[0];
    if (!first) throw new Error("Empty frame group");
    const run = first.runs[0];
    if (!run) throw new Error("Empty text line");
    const x = Math.min(...group.map((line) => line.x));
    const right = Math.max(...group.map((line) => line.right));
    const y = Math.min(...group.map((line) => line.top));
    const bottom = Math.max(...group.map((line) => line.bottom));
    const centered = group.length === 1 && Math.abs((x + right) / 2 - pageWidth / 2) < 3;
    return {
      id: `s${String(sheet).padStart(2, "0")}.f${String(index + 1).padStart(2, "0")}`,
      box: { x: round(x), y: round(y), width: round(right - x), height: round(bottom - y) },
      fontFamily: run.family,
      fontWeight: run.weight,
      fontStyle: run.style,
      fontSize: round(run.size),
      color: run.color,
      alignment: centered ? "center" : "left",
      text: group.map((line) => line.text).join(" ").replace(/\s+/gu, " ").trim(),
    };
  });
}

export async function extract(): Promise<Sheet[]> {
  const document = await getDocument({ data: new Uint8Array(await readFile(source)), fontExtraProperties: true }).promise;
  const sheets: Sheet[] = [];
  for (let sheet = 1; sheet <= document.numPages; sheet += 1) {
    const page = await document.getPage(sheet);
    const [operators, content] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
    const colors = operatorColours(operators);
    let characterIndex = 0;
    const height = (page.view[3] ?? 0) - (page.view[1] ?? 0);
    const width = (page.view[2] ?? 0) - (page.view[0] ?? 0);
    const runs: PositionedRun[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const text = item as TextRun;
      let color = "#000000";
      for (const char of text.str) {
        if (/\s/u.test(char)) continue;
        const expected = colors[characterIndex++];
        if (expected?.char !== char) throw new Error(`Sheet ${sheet}: text/operator mismatch at character ${characterIndex}`);
        color = expected.color;
      }
      if (!text.str.trim()) continue;
      const font = page.commonObjs.get(text.fontName) as { name?: string };
      if (!font.name) throw new Error(`Sheet ${sheet}: missing embedded font name for ${text.fontName}`);
      const details = fontDetails(font.name);
      const size = Math.hypot(text.transform[0] ?? 0, text.transform[1] ?? 0);
      const ascent = content.styles[text.fontName]?.ascent ?? 1;
      const x = text.transform[4] ?? 0;
      const baseline = text.transform[5] ?? 0;
      runs.push({ ...text, ...details, x, y: height - baseline - ascent * size, size, color });
    }
    if (characterIndex !== colors.length) throw new Error(`Sheet ${sheet}: unconsumed text operators`);
    sheets.push({ sheet, width: round(width), height: round(height), frames: makeFrames(makeLines(runs), sheet, width) });
    page.cleanup();
  }
  await document.cleanup();
  return sheets;
}

export async function writeFrames(): Promise<void> {
  const sheets = await extract();
  const header = "// GENERATED by npm run rulebook:extract from the published English PDF. Do not edit.\n";
  const types = `export type RulebookFrame = { id: string; box: { x: number; y: number; width: number; height: number }; fontFamily: string; fontWeight: number; fontStyle: "normal" | "italic"; fontSize: number; color: string; alignment: "left" | "center" | "right"; text: string };\nexport type RulebookSheet = { sheet: number; width: number; height: number; frames: readonly RulebookFrame[] };\n`;
  const body = `export const rulebookSheets = ${JSON.stringify(sheets, null, 2)} as const satisfies readonly RulebookSheet[];\nexport type RulebookFrameId = typeof rulebookSheets[number]["frames"][number]["id"];\n`;
  await mkdir(new URL("rulebook/layout/", root), { recursive: true });
  await writeFile(destination, header + types + body, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  await writeFrames();
}
