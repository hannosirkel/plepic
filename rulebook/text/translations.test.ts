import { describe, expect, it } from "vitest";
import { reviewedSheets } from "../layout/overrides.js";
import { de } from "./de/index.js";
import { en } from "./en.js";
import { es } from "./es/index.js";
import { et } from "./et/index.js";
import { fr } from "./fr/index.js";
import { it as italian } from "./it/index.js";
import { parseMarkup, plainText, type FrameId, type RulebookText } from "./schema.js";
import { tlh } from "./tlh/index.js";

/**
 * Every translated edition, read beside the English text frame by frame.
 * `sheets` is how far the edition has got: it holds every frame of its
 * first `sheets` sheets and no frame of a later one.
 */
const translations: Readonly<Record<string, { text: Partial<RulebookText>; sheets: number }>> = {
  de: { text: de, sheets: 25 },
  et: { text: et, sheets: 25 },
  tlh: { text: tlh, sheets: 25 },
  fr: { text: fr, sheets: 25 },
  es: { text: es, sheets: 25 },
  it: { text: italian, sheets: 25 },
};

/**
 * The frames whose digits differ from the English frame's, and why. An
 * entry whose frame no longer differs fails the test, so the list cannot rot.
 */
const digitExceptions: readonly { locale: string; frame: FrameId; reason: string }[] = [];

/** The digits a reader sees, in order: list numbers count, a frame named in the text does not. */
const digits = (source: string) => plainText(source).replace(/\D/g, "");

/** What a translation keeps of a frame's markup: its blocks, their list numbers, and the frames each names. */
const shape = (source: string) => parseMarkup(source).map((block) => ({
  kind: block.kind,
  number: block.kind === "numbered" ? block.number : undefined,
  anchors: block.lines.flat().flatMap((run) => ("anchor" in run ? [run.anchor] : [])),
}));

/** How many stretches of the text are bold. */
const boldStretches = (source: string) => parseMarkup(source).reduce((count, block) => {
  const runs = block.lines.flat().flatMap((run) => ("text" in run ? [run] : []));
  return count + runs.filter((run, index) => run.bold && !runs[index - 1]?.bold).length;
}, 0);

describe.each(Object.entries(translations))("translated rulebook text: %s", (locale, { text, sheets }) => {
  const frames = reviewedSheets.slice(0, sheets).flatMap((sheet) => sheet.frames.map((frame) => frame.id));
  const translated = (id: FrameId) => text[id] ?? "";

  it("has a string for every frame of its sheets, in reading order, and for no other frame", () => {
    expect(frames.length).toBeGreaterThan(0);
    expect(Object.keys(text)).toEqual(frames);
    for (const id of frames) expect(translated(id).trim(), id).not.toBe("");
  });

  it("parses, and keeps the blocks, list numbers, named frames and bold stretches of the English frame", () => {
    for (const id of frames) {
      expect(shape(translated(id)), id).toEqual(shape(en[id]));
      expect(boldStretches(translated(id)), `${id}: bold stretches`).toBe(boldStretches(en[id]));
    }
  });

  it("holds the digits of each English frame, in the same order, less the named exceptions", () => {
    const excepted = digitExceptions.filter((exception) => exception.locale === locale);
    const differing = frames.filter((id) => digits(translated(id)) !== digits(en[id]));
    expect(differing.filter((id) => !excepted.some((exception) => exception.frame === id))).toEqual([]);
    for (const exception of excepted) {
      expect(exception.reason.trim(), `${exception.frame}: the exception gives no reason`).not.toBe("");
      expect(differing, `${exception.frame}: the exception suppresses nothing`).toContain(exception.frame);
    }
  });
});

describe("the digit check, on fixture text", () => {
  it("reads list numbers and prose alike, and skips a frame named in the text", () => {
    expect(digits("1. Deal 3 cards, see page 17.\n2. Deal 1 more {s09.f11a}.")).toBe("131721");
    expect(digits("Seite 33–38")).toBe(digits("page 33–38"));
    expect(digits("Ziehe drei Karten")).not.toBe(digits("Draw 3 cards"));
    expect(digits("1 Karte, dann 3")).not.toBe(digits("3 cards, then 1"));
  });

  it("knows every exception's locale", () => {
    for (const exception of digitExceptions) expect(Object.keys(translations), exception.frame).toContain(exception.locale);
  });
});
