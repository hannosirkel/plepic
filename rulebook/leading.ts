import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ReviewedSheet } from "./layout/overrides.js";

/** Measure line baselines in the published PDF, inside each reviewed frame. */
export async function sourceLeading(source: string, sheets: readonly ReviewedSheet[]): Promise<Record<string, number>> {
  const document = await getDocument({ data: new Uint8Array(await readFile(source)) }).promise;
  const leading: Record<string, number> = {};
  try {
    for (const sheet of sheets) {
      const page = await document.getPage(sheet.sheet);
      const content = await page.getTextContent();
      const runs = content.items.filter((item) => "str" in item && item.str).map((item) => {
        if (!("str" in item)) throw new Error("Expected a text run");
        return { x: item.transform[4] ?? 0, baseline: sheet.height - (item.transform[5] ?? 0), width: item.width };
      });
      for (const frame of sheet.frames) {
        const { x, y, width, height } = frame.box;
        const baselines = [...new Set(runs.filter((run) =>
          run.x + run.width >= x - 1 && run.x <= x + width + 1 &&
          run.baseline >= y && run.baseline <= y + height + frame.fontSize * 0.3,
        ).map((run) => Math.round(run.baseline * 10) / 10))].sort((a, b) => a - b);
        const gaps = baselines.slice(1).map((value, index) => value - (baselines[index] ?? value))
          .filter((gap) => gap >= frame.fontSize * 0.9 && gap <= frame.fontSize * 2);
        gaps.sort((a, b) => a - b);
        // Larger gaps between source baselines belong to separate list items
        // or paragraphs; CSS provides those gaps independently.
        const measured = gaps[0] ?? frame.fontSize * 1.25;
        const lineGap = frame.role === "ol" || frame.role === "ul"
          ? Math.min(measured, frame.fontSize * 1.45)
          : measured;
        leading[frame.id] = Math.round(lineGap * 100) / 100;
      }
    }
  } finally { await document.cleanup(); }
  return leading;
}
