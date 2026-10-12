import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { rulebookSheets, type RulebookSheet } from "./layout/frames.js";
import { applyOverrides, editionBoxes, editionSheets, reviewedSheets, sheetOverrides, type SheetOverride } from "./layout/overrides.js";
import { en } from "./text/en.js";
import { parseMarkup, plainText, type RulebookText } from "./text/schema.js";

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

const roles = ["h1", "h2", "p", "ol", "ul", "caption", "page-number", "label"];
const overrideFor = (sheet: number) => {
  const override = sheetOverrides.find((candidate) => candidate.sheet === sheet);
  if (!override) throw new Error(`Sheet ${sheet} has no override`);
  return override as SheetOverride;
};

describe("reviewed rulebook layout", () => {
  it("gives every frame a role and a box on its sheet", () => {
    expect(reviewedSheets).toHaveLength(25);
    for (const sheet of reviewedSheets) {
      for (const frame of sheet.frames) {
        expect(roles, frame.id).toContain(frame.role);
        expect(frame.id).toMatch(new RegExp(`^s${String(sheet.sheet).padStart(2, "0")}\\.f\\d\\d[a-z]?$`));
        expect(frame.box.x, frame.id).toBeGreaterThanOrEqual(0);
        expect(frame.box.y, frame.id).toBeGreaterThanOrEqual(0);
        expect(frame.box.width, frame.id).toBeGreaterThan(0);
        expect(frame.box.height, frame.id).toBeGreaterThan(0);
        expect(frame.box.x + frame.box.width, frame.id).toBeLessThanOrEqual(sheet.width + 0.02);
        expect(frame.box.y + frame.box.height, frame.id).toBeLessThanOrEqual(sheet.height + 0.02);
        if (frame.indent !== undefined) expect(["ol", "ul"], frame.id).toContain(frame.role);
      }
    }
  });

  it("orders each sheet as a permutation of its frames after the merges, splits and drops", () => {
    for (const sheet of rulebookSheets) {
      const override = overrideFor(sheet.sheet);
      const expected = new Set<string>(sheet.frames.map((frame) => frame.id));
      for (const change of override.changes) {
        if ("drop" in change) {
          expect(change.why).not.toBe("");
          expect(expected.delete(change.drop), change.drop).toBe(true);
        } else if ("merge" in change) {
          for (const id of change.merge) expect(expected.delete(id), id).toBe(true);
          expected.add(change.merge[0]);
        } else {
          expect(expected.delete(change.split), change.split).toBe(true);
          for (const part of change.into) {
            expect(expected.has(part.id), part.id).toBe(false);
            expected.add(part.id);
          }
        }
      }
      const order = override.order.map(([id]) => id);
      expect(new Set(order).size, `sheet ${sheet.sheet}`).toBe(order.length);
      expect([...order].sort()).toEqual([...expected].sort());
      expect(reviewedSheets[sheet.sheet - 1]?.frames.map((frame) => frame.id)).toEqual(order);
    }
  });

  it("opens every sheet with a heading, except the sheets that say why not", () => {
    const withoutHeading: number[] = [];
    for (const sheet of reviewedSheets) {
      const override = overrideFor(sheet.sheet);
      const first = sheet.frames[0]?.role;
      if (override.noHeading === undefined) {
        expect(["h1", "h2"], `sheet ${sheet.sheet}`).toContain(first);
      } else {
        expect(override.noHeading.length, `sheet ${sheet.sheet}`).toBeGreaterThan(20);
        expect(["h1", "h2"], `sheet ${sheet.sheet}`).not.toContain(first);
        withoutHeading.push(sheet.sheet);
      }
    }
    expect(withoutHeading).toEqual([2, 6, 14, 17, 23, 25]);
  });

  it("keeps what the review corrected", () => {
    const frame = (id: string) => reviewedSheets.flatMap((sheet) => sheet.frames).find((candidate) => candidate.id === id);
    // A bullet list is one frame in the body type, not in the bullet glyph's font.
    expect(frame("s09.f06")).toMatchObject({
      role: "ul", fontFamily: "MADE Evolve Sans", fontWeight: 400, fontSize: 9, color: "#15244d", indent: 18,
      box: { x: 28.35, y: 116.6, width: 208.43, height: 66.89 },
    });
    // A circled step starts after the list number hidden under its circle.
    expect(frame("s05.f05")).toMatchObject({ role: "ol", box: { x: 42.52, y: 135.24, width: 207.13, height: 61 } });
    expect(frame("s05.f07")).toMatchObject({ role: "label" });
    // A circled letter inside a paragraph's line has the room of its circle there.
    expect(frame("s09.f11b")).toMatchObject({ role: "label", room: 11, box: { x: 206.04, y: 68.35, width: 4.53, height: 7.73 } });
    // A Contents line is an entry and a page, the page flush right.
    expect(frame("s02.f05b")).toMatchObject({ role: "label", alignment: "right", fontWeight: 700, fontSize: 10 });
    // Page numbers hidden under artwork are not frames.
    expect(frame("s24.f01")).toBeUndefined();
    expect(reviewedSheets[24]?.frames).toEqual([]);
  });

  it("refuses a review that does not fit the frame map", () => {
    const sheet: RulebookSheet = {
      sheet: 1, width: 100, height: 100,
      frames: ["s01.f01", "s01.f02"].map((id, index) => ({
        id, box: { x: 10, y: 10 + index * 20, width: 50, height: 10 }, fontFamily: "Lato", fontWeight: 400,
        fontStyle: "normal", fontSize: 10, color: "#000000", alignment: "left", text: id,
      })),
    };
    const review = (override: Omit<SheetOverride, "sheet">) => () => applyOverrides([sheet], [{ sheet: 1, ...override }]);
    expect(review({ changes: [], order: [["s01.f01", "p"]] })).toThrow(/no role or reading order for s01\.f02/);
    expect(review({ changes: [], order: [["s01.f01", "p"], ["s01.f01", "p"], ["s01.f02", "p"]] })).toThrow(/used twice/);
    expect(review({ changes: [{ drop: "s01.f09", why: "missing" }], order: [] })).toThrow(/s01\.f09 is not a frame/);
    expect(review({ changes: [{ merge: ["s01.f01", "s01.f02"] }], order: [["s01.f01", "p", { trimLeft: 5 }]] })()).toEqual([
      expect.objectContaining({ frames: [expect.objectContaining({ id: "s01.f01", box: { x: 15, y: 10, width: 45, height: 30 } })] }),
    ]);
    expect(() => applyOverrides([sheet], [])).toThrow(/has not been reviewed/);
  });
});

describe("rulebook text markup", () => {
  it("parses emphasis, paragraphs, list items, line breaks and anchors", () => {
    expect(parseMarkup("A **bold** and _slanted_ word\nnext line\n\nSecond {s09.f11a}.")).toEqual([
      { kind: "paragraph", lines: [
        [
          { text: "A ", bold: false, italic: false }, { text: "bold", bold: true, italic: false },
          { text: " and ", bold: false, italic: false }, { text: "slanted", bold: false, italic: true },
          { text: " word", bold: false, italic: false },
        ],
        [{ text: "next line", bold: false, italic: false }],
      ] },
      { kind: "paragraph", lines: [[
        { text: "Second ", bold: false, italic: false }, { anchor: "s09.f11a" }, { text: ".", bold: false, italic: false },
      ]] },
    ]);
    expect(parseMarkup("1. One\n2. Two **words**\nstill two")).toEqual([
      { kind: "numbered", number: 1, lines: [[{ text: "One", bold: false, italic: false }]] },
      { kind: "numbered", number: 2, lines: [
        [{ text: "Two ", bold: false, italic: false }, { text: "words", bold: true, italic: false }],
        [{ text: "still two", bold: false, italic: false }],
      ] },
    ]);
    expect(parseMarkup("- One\n- Two").map((block) => block.kind)).toEqual(["bullet", "bullet"]);
    expect(plainText("5 * 2 costs \\_1\\_ and \\{2}")).toBe("5 * 2 costs _1_ and {2}");
    expect(plainText("1. **One**\n- two {s01.f01}here")).toBe("1. One\n• two here");
  });

  it("rejects what the markup does not allow", () => {
    for (const source of ["", "**open", "_open", "****", "__", "a\n\n\nb", "a\n", "\na", " a", "a {b}", "a {s1.f1", "a \\b", "**a\n\nb**"]) {
      expect(() => parseMarkup(source), JSON.stringify(source)).toThrow();
    }
  });
});

describe("reviewed English rulebook text", () => {
  const text: Record<string, string> = en;

  it("is a total record: an edition that misses a frame does not compile", () => {
    // @ts-expect-error -- every frame id is a required key of an edition
    const partial: RulebookText = { "s01.f01": "RULE BOOK" };
    expect(Object.keys(partial)).toHaveLength(1);
    expect(Object.keys(text)).toEqual(reviewedSheets.flatMap((sheet) => sheet.frames.map((frame) => frame.id)));
  });

  it("parses, and uses list markup only where the frame is a list", () => {
    for (const sheet of reviewedSheets) {
      const anchored: string[] = [];
      for (const [index, frame] of sheet.frames.entries()) {
        const kinds = parseMarkup(text[frame.id] ?? "").map((block) => block.kind);
        const previous = sheet.frames[index - 1];
        if (frame.role === "ul") {
          expect(new Set(kinds), frame.id).toEqual(new Set(["bullet"]));
        } else if (frame.role === "ol" && kinds.includes("numbered")) {
          expect(new Set(kinds), frame.id).toEqual(new Set(["numbered"]));
        } else if (frame.role === "ol") {
          // A step without a number follows the label that carries it: the numeral on a drawn circle.
          expect(kinds, frame.id).toEqual(["paragraph"]);
          expect(previous?.role, frame.id).toBe("label");
          expect(text[previous?.id ?? ""], frame.id).toMatch(/^\d$/);
        } else {
          expect(new Set(kinds), frame.id).toEqual(new Set(["paragraph"]));
        }
        for (const block of parseMarkup(text[frame.id] ?? "")) {
          for (const run of block.lines.flat()) if ("anchor" in run) anchored.push(run.anchor);
        }
      }
      // An anchored frame is a label on the same sheet, anchored once.
      expect(new Set(anchored).size, `sheet ${sheet.sheet}`).toBe(anchored.length);
      for (const id of anchored) expect(sheet.frames.find((frame) => frame.id === id)?.role, id).toBe("label");
      // It has room in the line that anchors it, and no other frame has.
      expect(sheet.frames.filter((frame) => frame.room !== undefined).map((frame) => frame.id).sort(), `sheet ${sheet.sheet}`).toEqual([...anchored].sort());
    }
  });

  it("sets each frame's text where the PDF prints it", async () => {
    const characters = (source: string) => [...(source.match(/[\p{L}\p{N}]/gu) ?? [])];
    const document = await getDocument({ data: new Uint8Array(await readFile(pdf)) }).promise;
    for (const sheet of reviewedSheets) {
      const page = await document.getPage(sheet.sheet);
      const content = await page.getTextContent();
      // What the PDF prints inside each frame's box; a run inside two boxes belongs to the smaller.
      const printed = new Map<string, string[]>(sheet.frames.map((frame) => [frame.id, []]));
      const outside: string[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const size = Math.hypot(item.transform[0] ?? 0, item.transform[1] ?? 0);
        const x = (item.transform[4] ?? 0) + item.width / 2;
        const y = sheet.height - (item.transform[5] ?? 0) - size * 0.3;
        const [home] = sheet.frames
          .filter(({ box }) => x >= box.x - 0.5 && x <= box.x + box.width + 0.5 && y >= box.y - 0.5 && y <= box.y + box.height + 0.5)
          .sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);
        (home ? printed.get(home.id) ?? outside : outside).push(...characters(item.str));
      }
      // Every frame's text is printed in its box. What is left over is exactly the unprinted words.
      const extra = [...outside];
      for (const frame of sheet.frames) {
        const inBox = printed.get(frame.id) ?? [];
        for (const character of characters(plainText(text[frame.id] ?? ""))) {
          const at = inBox.indexOf(character);
          expect(at, `${frame.id} prints no "${character}" in its box`).toBeGreaterThanOrEqual(0);
          inBox.splice(at, 1);
        }
        extra.push(...inBox);
      }
      const unprinted = characters((overrideFor(sheet.sheet).unprinted?.words ?? []).join(""));
      expect(extra.sort(), `sheet ${sheet.sheet}`).toEqual(unprinted.sort());
    }
    await document.cleanup();
  });

  it("holds every extracted word of each sheet except the ones the print does not show", () => {
    for (const sheet of rulebookSheets) {
      const extracted: string[] = words(sheet.frames.map((frame) => frame.text).join(" "));
      for (const word of overrideFor(sheet.sheet).unprinted?.words ?? []) {
        const at = extracted.indexOf(word);
        expect(at, `sheet ${sheet.sheet}: ${word}`).toBeGreaterThanOrEqual(0);
        extracted.splice(at, 1);
      }
      const reviewed = reviewedSheets[sheet.sheet - 1]?.frames.map((frame) => plainText(text[frame.id] ?? "")) ?? [];
      expect(words(reviewed.join(" ")), `sheet ${sheet.sheet}`).toEqual(extracted);
    }
  });
});

describe("an edition's boxes", () => {
  const frame = (sheets: ReturnType<typeof editionSheets>, id: string) => sheets.flatMap((sheet) => sheet.frames).find((candidate) => candidate.id === id);

  it("grows the frames the edition names and keeps each one's English box beside it", () => {
    const german = editionSheets("de");
    // A Contents entry runs right, towards its page number.
    expect(frame(german, "s02.f07a")).toMatchObject({ box: { x: 311.81, y: 148.09, width: 66.34, height: 10 }, englishBox: { x: 311.81, y: 148.09, width: 20.34, height: 10 } });
    // A caption grows to both sides and stays centred under its cards.
    expect(frame(german, "s03.f06a")).toMatchObject({ alignment: "center", box: { x: 92.42, y: 148.81, width: 98.63, height: 9 } });
    // An action's name stands over its icon and the printed word under it.
    expect(frame(german, "s13.f18")).toMatchObject({ skip: 27, box: { x: 308.65, y: 67.68, width: 45.57, height: 52 } });
    const grown = Object.keys(editionBoxes.de ?? {});
    for (const sheet of german) for (const candidate of sheet.frames) {
      expect(candidate.englishBox !== undefined, candidate.id).toBe(grown.includes(candidate.id));
    }
  });

  it("leaves the reading order, the type and every other edition as reviewed", () => {
    expect(editionSheets("en")).toEqual(reviewedSheets);
    const german = editionSheets("de");
    german.forEach((sheet, index) => {
      expect(sheet.frames.map(({ box: _box, englishBox: _englishBox, skip: _skip, ...rest }) => rest))
        .toEqual(reviewedSheets[index]?.frames.map(({ box: _box, ...rest }) => rest));
    });
  });

  it("fails on a frame that was not reviewed and on a box grown off its sheet", () => {
    expect(() => editionSheets("de", reviewedSheets, { "s01.f99": { right: 1 } } as never)).toThrow("de: s01.f99 is not a reviewed frame");
    expect(() => editionSheets("de", reviewedSheets, { "s01.f01": { right: 200 } })).toThrow("de: s01.f01 grows off sheet 1");
  });
});
