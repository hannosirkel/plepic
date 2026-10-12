import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { rulebookSheets } from "./layout/frames.js";

const pdf = new URL("../storefront/public/documents/lunar-base-rulebook.pdf", import.meta.url);
const words = (text: string) => text.match(/[\p{L}\p{N}]+/gu)?.sort() ?? [];

describe("published rulebook frame map", () => {
  it("has 25 sheets, unique ids, and boxes within each sheet", () => {
    expect(rulebookSheets).toHaveLength(25);
    const ids = rulebookSheets.flatMap((sheet) => sheet.frames.map((frame) => frame.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const [index, sheet] of rulebookSheets.entries()) {
      expect(sheet.sheet).toBe(index + 1);
      expect(sheet.frames.length).toBeGreaterThan(0);
      for (const frame of sheet.frames) {
        expect(frame.id).toMatch(new RegExp(`^s${String(sheet.sheet).padStart(2, "0")}\\.f\\d+$`));
        expect(frame.box.x).toBeGreaterThanOrEqual(0);
        expect(frame.box.y).toBeGreaterThanOrEqual(0);
        expect(frame.box.width).toBeGreaterThan(0);
        expect(frame.box.height).toBeGreaterThan(0);
        expect(frame.box.x + frame.box.width).toBeLessThanOrEqual(sheet.width + 0.02);
        expect(frame.box.y + frame.box.height).toBeLessThanOrEqual(sheet.height + 0.02);
      }
    }
    expect(rulebookSheets[0]).toMatchObject({ width: 283.46, height: 283.46 });
    for (const sheet of rulebookSheets.slice(1, 24)) {
      expect(sheet.width).toBeCloseTo(566.93, 1);
      expect(sheet.height).toBeCloseTo(283.46, 1);
    }
    expect(rulebookSheets[9]?.frames).toContainEqual(expect.objectContaining({
      text: expect.stringMatching(/^CHECK FOR ARRIVING SHUTTLES/),
      box: expect.objectContaining({ x: 28.35, y: 21.26 }),
    }));
  });

  it("preserves every word returned by PDF.js on each sheet", async () => {
    const document = await getDocument({ data: new Uint8Array(await readFile(pdf)) }).promise;
    expect(document.numPages).toBe(25);
    for (const sheet of rulebookSheets) {
      const page = await document.getPage(sheet.sheet);
      const content = await page.getTextContent();
      let source = "";
      let prior: { str: string; transform: number[]; width: number } | undefined;
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        if (prior) {
          const sameLine = Math.abs((prior.transform[5] ?? 0) - (item.transform[5] ?? 0)) < 0.6;
          const gap = (item.transform[4] ?? 0) - (prior.transform[4] ?? 0) - prior.width;
          const size = Math.hypot(item.transform[0] ?? 0, item.transform[1] ?? 0);
          if (!sameLine || gap < -0.5 || gap > Math.max(1.2, size * 0.18)) source += " ";
        }
        source += item.str;
        prior = item;
      }
      expect(words(sheet.frames.map((frame) => frame.text).join(" "))).toEqual(words(source));
    }
    await document.cleanup();
  });
});
