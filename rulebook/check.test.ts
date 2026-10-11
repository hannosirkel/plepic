import { describe, expect, it } from "vitest";
import {
  checkCollisions, checkFit, checkGlyphs, checkPixels, checkSheets, checkSize, checkStructure,
  fontFailures, leadingBound, parseFonts, parseWords, sizeFloor, unread, type Built, type BuiltRun,
} from "./check.js";
import type { Edition } from "./editions.js";
import type { ReviewedFrame, ReviewedSheet } from "./layout/overrides.js";

const frame = (id: string, role: ReviewedFrame["role"], x: number, y: number, width: number, height: number, fontSize = 10): ReviewedFrame => ({
  id, role, box: { x, y, width, height }, fontFamily: "MADE Evolve Sans", fontWeight: 400, fontStyle: "normal", fontSize, color: "#000000", alignment: "left",
});
/** A heading over a two-line paragraph, 20 pt apart. */
const sheets: ReviewedSheet[] = [{ sheet: 1, width: 283.46, height: 283.46, frames: [frame("s01.f01", "h1", 20, 20, 100, 10), frame("s01.f02", "p", 20, 50, 100, 23)] }];
const edition = { tag: "de", title: "Regelbuch", text: { "s01.f01": "Aufbau", "s01.f02": "Mische die Karten und\nteile sie aus." } } as unknown as Edition;
const run = (text: string, x: number, baseline: number, size = 10, width = text.length * 5): BuiltRun => ({ text, x, width, baseline, size });
/** The same sheet as the build prints it when everything fits. */
const fitting = (): Built => ({ language: "de", sheets: [{ width: 282.96, height: 282.96, elements: [
  { role: "H1", runs: [run("Aufbau", 20, 29.8)] },
  { role: "Div", runs: [run("Mische die Karten und", 20, 59.8, 10, 99), run("teile sie aus.", 20, 72.8)] },
] }] });
const leading = { "s01.f01": 12.5, "s01.f02": 13 };

describe("layout check: sheets, structure and size", () => {
  it("passes a sheet within a point of English and fails one beyond it or a missing one", () => {
    expect(checkSheets(sheets, fitting()).failures).toEqual([]);
    const wide = fitting();
    (wide.sheets[0] as { width: number }).width = 285;
    expect(checkSheets(sheets, wide).failures).toEqual(["sheet 1 is 285.00 x 282.96 pt, English is 283.46 x 283.46 pt"]);
    expect(checkSheets(sheets, { language: "de", sheets: [] }).failures).toEqual(["0 sheets, not 1"]);
  });

  it("fails an untagged PDF, another language, a heading not marked up and a sheet whose elements do not match its frames", () => {
    expect(checkStructure(sheets, fitting(), edition, true).failures).toEqual([]);
    expect(checkStructure(sheets, fitting(), edition, false).failures).toEqual(["the PDF is not tagged"]);
    expect(checkStructure(sheets, { ...fitting(), language: "en" }, edition, true).failures).toEqual(["the PDF's language is en, not de"]);
    const flat = fitting();
    (flat.sheets[0]?.elements[0] as { role: string }).role = "Div";
    expect(checkStructure(sheets, flat, edition, true).failures).toEqual(["s01.f01 (sheet 1) is tagged Div, not H1"]);
    const short = fitting();
    short.sheets[0]?.elements.pop();
    expect(checkStructure(sheets, short, edition, true).failures).toEqual(["sheet 1 has 1 structure elements for 2 frames"]);
  });

  it("fails a file over 16 MB and a sheet over its pixel ratio", () => {
    expect(checkSize(16_000_000).failures).toEqual([]);
    expect(checkSize(16_000_001).failures).toEqual(["the file is 16.0 MB"]);
    const result = checkPixels("Artwork", 0.01, [{ sheet: 1, ratio: 0.002 }, { sheet: 2, ratio: 0.03 }]);
    expect(result.summary).toContain("worst sheet 2 differs in 3.000%");
    expect(result.failures).toEqual(["sheet 2 differs in 3.000% of its pixels"]);
  });
});

describe("layout check: fit", () => {
  it("takes the floor of the ladder from the English size", () => {
    expect(sizeFloor(10)).toBe(9);
    expect(sizeFloor(6.5)).toBe(6);
    expect(sizeFloor(5)).toBe(5);
  });

  it("bounds the leading by the tightest run of baselines, allowing the pixel grid", () => {
    // 12.35 pt leading printed on whole pixels, then a paragraph gap.
    const runs = [0, 12, 24.75, 36.75, 52.5].map((baseline) => run("x", 0, baseline));
    expect(leadingBound(runs)).toBeCloseTo((36.75 + 0.75) / 3);
    expect(leadingBound([run("x", 0, 0)])).toBeUndefined();
  });

  it("passes text inside its box and names a frame whose text runs out of it", () => {
    expect(checkFit(sheets, fitting(), leading).failures).toEqual([]);
    const long = fitting();
    long.sheets[0]?.elements[1]?.runs.push(run("und noch zwei Zeilen", 20, 85.8), run("mehr als im Original.", 20, 98.8));
    expect(checkFit(sheets, long, leading).failures).toEqual(["s01.f02 (sheet 1) does not fit: its text runs 26.0 pt below its box at 100% size; shorten the text"]);
  });

  it("names a frame set under the floor of the ladder, in size or in leading", () => {
    const small = fitting();
    small.sheets[0]?.elements[0]?.runs.splice(0, 1, run("Aufbau", 20, 29.8, 8.5));
    expect(checkFit(sheets, small, leading).failures).toEqual(["s01.f01 (sheet 1) is set at 8.50 pt, under the floor of 9.00 pt for 10 pt type"]);
    const tight = fitting();
    tight.sheets[0]?.elements[1]?.runs.splice(1, 1, run("teile sie aus.", 20, 70.3));
    expect(checkFit(sheets, tight, leading).failures).toEqual(["s01.f02 (sheet 1) has at most 11.25 pt leading, 86.5% of English at this size; the floor is 95%"]);
  });
});

describe("layout check: collisions", () => {
  it("names two frames whose ink overlaps, unless they overlap in English", () => {
    expect(checkCollisions(sheets, fitting()).failures).toEqual([]);
    const grown = fitting();
    grown.sheets[0]?.elements[0]?.runs.push(run("in zwei Schritten", 20, 42.8), run("und drei Zeilen", 20, 55.8));
    expect(checkCollisions(sheets, grown).failures).toEqual(["s01.f01 and s01.f02 (sheet 1) overlap by 6.0 pt and do not overlap in English"]);
    const nested: ReviewedSheet[] = [{ ...sheets[0] as ReviewedSheet, frames: [frame("s01.f01", "h1", 20, 20, 100, 40), frame("s01.f02", "p", 20, 50, 100, 23)] }];
    expect(checkCollisions(nested, grown).failures).toEqual([]);
  });
});

describe("layout check: glyphs", () => {
  const words = () => parseWords(`<doc>
  <page width="282.96" height="282.96">
    <word xMin="20" yMin="22" xMax="50" yMax="30">Aufbau</word>
    <word xMin="20" yMin="52" xMax="50" yMax="60">Mische</word>
    <word xMin="52" yMin="52" xMax="66" yMax="60">die</word>
    <word xMin="68" yMin="52" xMax="98" yMax="60">Karten</word>
    <word xMin="100" yMin="52" xMax="118" yMax="60">und</word>
    <word xMin="20" yMin="65" xMax="40" yMax="73">teile</word>
    <word xMin="42" yMin="65" xMax="54" yMax="73">sie</word>
    <word xMin="56" yMin="65" xMax="74" yMax="73">aus.</word>
  </page>
</doc>`);
  const allowed = ["MADEEvolveSans", "JosefinSansThin-Bold"];
  const fonts = [{ name: "MADEEvolveSans", embedded: true }];

  it("reads the word boxes of pdftotext -bbox", () => {
    expect(parseWords('<page width="1" height="1">\n<word xMin="1" yMin="2" xMax="3" yMax="6">A&amp;B</word>\n</page><page width="1" height="1"></page>')).toEqual([[{ text: "A&B", x: 2, y: 4 }], []]);
  });

  it("reads a frame's text out of its words, past foreign words, split words and ligatures", () => {
    expect(unread("Draft 2 cards", ["Draft", "PLAYER", "2", "cards"])).toBe("");
    expect(unread("**Note**: refill".replaceAll("*", ""), ["Note", ":", "refill"])).toBe("");
    expect(unread("infiltrate", ["inﬁltrate"])).toBe("");
    expect(unread("Draft 2 cards", ["Draft", "2"])).toBe("cards");
  });

  it("passes when pdftotext returns every frame's text in allowed, embedded fonts", () => {
    expect(checkGlyphs(sheets, fitting(), edition, words(), fonts, allowed).failures).toEqual([]);
  });

  it("names the frame whose text pdftotext does not return, and a replacement character", () => {
    const lost = words();
    lost[0]?.splice(5, 3, { text: "teile", x: 30, y: 69 }, { text: "���", x: 48, y: 69 }, { text: "aus.", x: 65, y: 69 });
    expect(checkGlyphs(sheets, fitting(), edition, lost, fonts, allowed).failures).toEqual([
      "sheet 1 holds a replacement character",
      's01.f02 (sheet 1): pdftotext does not return its text from "sieaus." on',
    ]);
  });

  it("reads the font table of pdffonts and strips the subset prefix", () => {
    expect(parseFonts(`name                                 type              encoding         emb sub uni object ID
------------------------------------ ----------------- ---------------- --- --- --- ---------
AAAAAA+MADEEvolveSans                Type 3            Custom           yes yes yes      6  0
GAAAAA+JosefinSansThin-Bold          CID TrueType      Identity-H       yes yes yes    715  0
Helvetica                            Type 1            WinAnsi          no  no  no      12  0
`)).toEqual([{ name: "MADEEvolveSans", embedded: true }, { name: "JosefinSansThin-Bold", embedded: true }, { name: "Helvetica", embedded: false }]);
  });

  it("names a font outside the allowed set although it is embedded, and a font that is not embedded", () => {
    expect(fontFailures([...fonts, { name: "DejaVuSans", embedded: true }, { name: "MADEEvolveSans", embedded: false }], allowed)).toEqual([
      "font DejaVuSans is not one rulebook/fonts.ts allows, although it is embedded",
      "font MADEEvolveSans is not embedded",
    ]);
  });
});
