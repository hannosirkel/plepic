import { rulebookSheets, type RulebookFrame, type RulebookSheet } from "./frames.js";

/**
 * The hand review of `frames.ts`. Extraction reads positions and type; it
 * cannot know what a frame is, what belongs together, or what comes first.
 * Each sheet below says which generated frames to merge, split or drop, and
 * then lists every remaining frame once, in reading order, with its role.
 *
 * Five rules were applied to every sheet, each against the rendered page:
 *
 * - A numbered step whose number is a white numeral on a drawn circle keeps
 *   that numeral as its own `label` frame, placed directly before the step.
 *   The published file also carries the step's number as live text hidden
 *   under the circle (on sheet 17 it is even one too low). The reviewed
 *   frame starts after it (`trimLeft`) and the English text leaves it out.
 * - A bullet list is one `ul` frame. Extraction took the bullet glyph's font
 *   (Josefin Sans 12 pt) for the whole first line; the frame is given the
 *   body type back.
 * - A frame that mixes weights is given its regular weight, and
 *   `rulebook/text/en.ts` marks the bold words.
 * - `alignment` is corrected where a frame is centred on something or set
 *   flush right against it, so a longer translation grows the right way.
 * - A circled letter set inside a line of another frame is a `label` with
 *   `room`: the width of its drawn circle, which stays in the artwork. The
 *   other frame's text names the label where it stands (`{s09.f11a}`), and
 *   its line is kept clear there.
 *
 * Boxes are ink boxes in PDF points from the top left, as in `frames.ts`.
 */

export type FrameRole = "h1" | "h2" | "p" | "ol" | "ul" | "caption" | "page-number" | "label";

type Box = RulebookFrame["box"];
type Style = Partial<Pick<RulebookFrame, "fontFamily" | "fontWeight" | "fontStyle" | "fontSize" | "color" | "alignment">>;

/**
 * `trimLeft` moves the left edge right by that many points. `indent` is the
 * gutter of a list frame: its numbers or bullets sit at the left edge and
 * the item text starts `indent` points in. `room` is the width a label
 * takes in the line of the frame whose text anchors it.
 */
type Tweak = Style & { trimLeft?: number; indent?: number; room?: number };

type Change =
  /** One frame with the first id, the union of the boxes, and the type of `styleOf` (default: the first). */
  | { merge: readonly [string, string, ...string[]]; styleOf?: string }
  /** New frames that inherit the type of the frame they replace. */
  | { split: string; into: readonly { id: string; box: Box }[] }
  | { drop: string; why: string };

export type SheetOverride = {
  sheet: number;
  /** Why the sheet's reading order does not open with an `h1` or `h2`. */
  noHeading?: string;
  /** Words in the live text that the printed sheet does not show, so the English text omits them. */
  unprinted?: { words: readonly string[]; why: string };
  changes: readonly Change[];
  order: readonly (readonly [id: string, role: FrameRole, tweak?: Tweak])[];
};

const hiddenNumbers = "List numbers hidden under the drawn circles; the white numerals on the circles are the visible ones.";
const body = { fontFamily: "MADE Evolve Sans", fontWeight: 400, color: "#15244d" } as const;
const center = { alignment: "center" } as const;
const right = { alignment: "right" } as const;
const regular = { fontWeight: 400 } as const;

export const sheetOverrides = [
  {
    sheet: 1,
    changes: [],
    order: [["s01.f01", "h1"]],
  },
  {
    sheet: 2,
    noHeading: "The inside-cover introduction on the left has no heading and is read before Contents on the right.",
    changes: [
      { split: "s02.f05", into: [
        { id: "s02.f05a", box: { x: 311.81, y: 47.25, width: 53.78, height: 10 } },
        { id: "s02.f05b", box: { x: 534.62, y: 47.25, width: 3.96, height: 10 } },
        { id: "s02.f05c", box: { x: 311.81, y: 63.46, width: 50.78, height: 10 } },
        { id: "s02.f05d", box: { x: 533.33, y: 63.46, width: 5.25, height: 10 } },
        { id: "s02.f05e", box: { x: 311.81, y: 79.67, width: 65.1, height: 10 } },
        { id: "s02.f05f", box: { x: 533.27, y: 79.67, width: 5.31, height: 10 } },
        { id: "s02.f05g", box: { x: 311.81, y: 95.88, width: 45.34, height: 10 } },
        { id: "s02.f05h", box: { x: 530.66, y: 95.88, width: 7.92, height: 10 } },
      ] },
      { split: "s02.f06", into: [
        { id: "s02.f06a", box: { x: 311.81, y: 109.92, width: 55.41, height: 8 } },
        { id: "s02.f06b", box: { x: 532.53, y: 109.92, width: 6.05, height: 8 } },
        { id: "s02.f06c", box: { x: 311.81, y: 121.92, width: 51.77, height: 8 } },
        { id: "s02.f06d", box: { x: 532.04, y: 121.92, width: 6.54, height: 8 } },
        { id: "s02.f06e", box: { x: 311.81, y: 133.92, width: 87.12, height: 8 } },
        { id: "s02.f06f", box: { x: 531.83, y: 133.92, width: 6.75, height: 8 } },
      ] },
      { split: "s02.f07", into: [
        { id: "s02.f07a", box: { x: 311.81, y: 148.09, width: 20.34, height: 10 } },
        { id: "s02.f07b", box: { x: 530.11, y: 148.09, width: 8.47, height: 10 } },
        { id: "s02.f07c", box: { x: 311.81, y: 164.3, width: 52.61, height: 10 } },
        { id: "s02.f07d", box: { x: 529.86, y: 164.3, width: 8.72, height: 10 } },
      ] },
      { split: "s02.f08", into: [
        { id: "s02.f08a", box: { x: 311.81, y: 182.3, width: 31.87, height: 10 } },
        { id: "s02.f08b", box: { x: 529.87, y: 182.3, width: 8.71, height: 10 } },
      ] },
      { split: "s02.f09", into: [
        { id: "s02.f09a", box: { x: 311.81, y: 196.34, width: 41.47, height: 8 } },
        { id: "s02.f09b", box: { x: 530.95, y: 196.34, width: 7.62, height: 8 } },
      ] },
      { split: "s02.f10", into: [
        { id: "s02.f10a", box: { x: 311.81, y: 210.51, width: 53.34, height: 10 } },
        { id: "s02.f10b", box: { x: 529.68, y: 210.51, width: 8.9, height: 10 } },
        { id: "s02.f10c", box: { x: 311.81, y: 226.71, width: 77.62, height: 10 } },
        { id: "s02.f10d", box: { x: 528.5, y: 226.71, width: 10.08, height: 10 } },
        { id: "s02.f10e", box: { x: 311.81, y: 242.92, width: 23.06, height: 10 } },
        { id: "s02.f10f", box: { x: 528.58, y: 242.92, width: 10, height: 10 } },
      ] },
    ],
    order: [
      ["s02.f01", "p"], ["s02.f02", "p", regular], ["s02.f03", "p"],
      ["s02.f04", "h1", center],
      // Contents: each line is an entry and, flush right, its page.
      ["s02.f05a", "label"], ["s02.f05b", "label", right],
      ["s02.f05c", "label"], ["s02.f05d", "label", right],
      ["s02.f05e", "label"], ["s02.f05f", "label", right],
      ["s02.f05g", "label"], ["s02.f05h", "label", right],
      ["s02.f06a", "label"], ["s02.f06b", "label", right],
      ["s02.f06c", "label"], ["s02.f06d", "label", right],
      ["s02.f06e", "label"], ["s02.f06f", "label", right],
      ["s02.f07a", "label"], ["s02.f07b", "label", right],
      ["s02.f07c", "label"], ["s02.f07d", "label", right],
      ["s02.f08a", "label"], ["s02.f08b", "label", right],
      ["s02.f09a", "label"], ["s02.f09b", "label", right],
      ["s02.f10a", "label"], ["s02.f10b", "label", right],
      ["s02.f10c", "label"], ["s02.f10d", "label", right],
      ["s02.f10e", "label"], ["s02.f10f", "label", right],
    ],
  },
  {
    sheet: 3,
    changes: [
      { split: "s03.f06", into: [
        { id: "s03.f06a", box: { x: 122.42, y: 148.81, width: 38.63, height: 9 } },
        { id: "s03.f06b", box: { x: 340.66, y: 148.81, width: 38.35, height: 9 } },
        { id: "s03.f06c", box: { x: 468.72, y: 148.81, width: 45.78, height: 9 } },
      ] },
    ],
    order: [
      ["s03.f03", "h1"], ["s03.f04", "p", regular],
      ["s03.f06a", "caption", center], ["s03.f05", "caption", center],
      ["s03.f02", "page-number"],
      ["s03.f06b", "caption", center], ["s03.f06c", "caption", center],
      ["s03.f07", "p"],
      ["s03.f01", "page-number"],
    ],
  },
  {
    sheet: 4,
    changes: [
      { split: "s04.f21", into: [
        { id: "s04.f21a", box: { x: 164.45, y: 196.95, width: 3.56, height: 6.4 } },
        { id: "s04.f21b", box: { x: 257.07, y: 196.95, width: 3.56, height: 6.4 } },
      ] },
      { split: "s04.f27", into: [
        { id: "s04.f27a", box: { x: 208.68, y: 154.01, width: 3.47, height: 6.4 } },
        { id: "s04.f27b", box: { x: 216.98, y: 154.87, width: 26.69, height: 5 } },
      ] },
      { split: "s04.f31", into: [
        { id: "s04.f31a", box: { x: 368.8, y: 211.99, width: 3.29, height: 6.4 } },
        { id: "s04.f31b", box: { x: 377.02, y: 213.1, width: 24.27, height: 5 } },
      ] },
      { split: "s04.f32", into: [
        { id: "s04.f32a", box: { x: 407.99, y: 226.84, width: 3.71, height: 6.4 } },
        { id: "s04.f32b", box: { x: 416.41, y: 227.95, width: 19.01, height: 5 } },
      ] },
      { split: "s04.f52", into: [
        { id: "s04.f52a", box: { x: 490.96, y: 243.23, width: 3.29, height: 6.4 } },
        { id: "s04.f52b", box: { x: 499.17, y: 244.34, width: 24.27, height: 5 } },
      ] },
      { split: "s04.f57", into: [
        { id: "s04.f57a", box: { x: 469.67, y: 163.87, width: 3.36, height: 6.4 } },
        { id: "s04.f57b", box: { x: 478.36, y: 164.73, width: 59.79, height: 5 } },
      ] },
      { merge: ["s04.f34", "s04.f35"] },
      { merge: ["s04.f55", "s04.f56"] },
    ],
    order: [
      ["s04.f20", "h2"],
      // The legend: nine numbered circles, each with its meaning.
      ["s04.f11", "label"], ["s04.f02", "ol"],
      ["s04.f12", "label"], ["s04.f03", "ol"],
      ["s04.f13", "label"], ["s04.f04", "ol"],
      ["s04.f14", "label"], ["s04.f05", "ol"],
      ["s04.f15", "label"], ["s04.f06", "ol"],
      ["s04.f16", "label"], ["s04.f07", "ol"],
      ["s04.f17", "label"], ["s04.f08", "ol"],
      ["s04.f18", "label"], ["s04.f09", "ol"],
      ["s04.f19", "label"], ["s04.f10", "ol"],
      // Station card. A callout left of its circle is set flush right against it.
      ["s04.f25", "label"], ["s04.f26", "label", right],
      ["s04.f23", "label"], ["s04.f24", "label"],
      ["s04.f29", "label"], ["s04.f30", "label"],
      ["s04.f28", "label"], ["s04.f22", "label"],
      ["s04.f27a", "label"], ["s04.f27b", "label", { ...body, fontSize: 5 }],
      ["s04.f21a", "label"], ["s04.f21b", "label"],
      // Module card.
      ["s04.f42", "label"], ["s04.f43", "label", right],
      ["s04.f38", "label"], ["s04.f39", "label", right],
      ["s04.f47", "label"],
      ["s04.f48", "label"], ["s04.f49", "label"],
      ["s04.f44", "label"], ["s04.f45", "label"],
      ["s04.f54", "label"], ["s04.f55", "label", right],
      ["s04.f46", "label"],
      ["s04.f31a", "label"], ["s04.f31b", "label", { ...body, fontSize: 5 }],
      ["s04.f33", "label"], ["s04.f34", "label", right],
      ["s04.f32a", "label"], ["s04.f32b", "label", { ...body, fontSize: 5 }],
      ["s04.f53", "label"],
      // Agent card.
      ["s04.f40", "label"], ["s04.f41", "label"],
      ["s04.f50", "label"], ["s04.f51", "label"],
      ["s04.f36", "label"], ["s04.f37", "label"],
      ["s04.f57a", "label"], ["s04.f57b", "label", { ...body, fontSize: 5 }],
      ["s04.f52a", "label"], ["s04.f52b", "label", { ...body, fontSize: 5 }],
      ["s04.f01", "page-number"],
    ],
  },
  {
    sheet: 5,
    unprinted: { words: ["1", "2"], why: hiddenNumbers },
    changes: [],
    order: [
      ["s05.f03", "h1"], ["s05.f04", "p"],
      ["s05.f07", "label"], ["s05.f05", "ol", { trimLeft: 14.17 }],
      ["s05.f08", "label"], ["s05.f06", "ol", { trimLeft: 14.17 }],
      ["s05.f02", "page-number"],
      ["s05.f10", "label", center], ["s05.f11", "label", center], ["s05.f09", "label"],
      ["s05.f14", "label"], ["s05.f13", "label"], ["s05.f12", "label"],
      ["s05.f01", "page-number"],
    ],
  },
  {
    sheet: 6,
    noHeading: "Continues the Game Setup steps from sheet 5.",
    unprinted: { words: ["3", "4", "5"], why: hiddenNumbers },
    changes: [],
    order: [
      ["s06.f07", "label"], ["s06.f03", "ol", { trimLeft: 14.17 }],
      ["s06.f08", "label"], ["s06.f04", "ol", { trimLeft: 14.17 }],
      ["s06.f09", "label"], ["s06.f05", "ol", { trimLeft: 14.17 }],
      ["s06.f06", "p"],
      ["s06.f02", "page-number"],
      ["s06.f10", "label", center], ["s06.f11", "label", center],
      ["s06.f19", "label"], ["s06.f12", "label"],
      ["s06.f17", "label"], ["s06.f18", "label"],
      ["s06.f15", "label"], ["s06.f16", "label"],
      ["s06.f13", "label"], ["s06.f14", "label"],
      ["s06.f01", "page-number"],
    ],
  },
  {
    sheet: 7,
    changes: [],
    order: [
      ["s07.f03", "h1"], ["s07.f04", "p"],
      // The four victory conditions, each beside its icon.
      ["s07.f05", "p"], ["s07.f06", "p", regular], ["s07.f07", "p", regular], ["s07.f08", "p", regular],
      ["s07.f02", "page-number"],
      ["s07.f10", "p"], ["s07.f09", "caption", center],
      ["s07.f01", "page-number"],
    ],
  },
  {
    sheet: 8,
    changes: [
      { merge: ["s08.f05", "s08.f06", "s08.f07"] },
    ],
    order: [
      ["s08.f03", "h1"], ["s08.f04", "p"],
      ["s08.f05", "ol", { indent: 14.17 }],
      ["s08.f08", "p"],
      ["s08.f09", "h2"], ["s08.f10", "p"],
      ["s08.f02", "page-number"],
      ["s08.f11", "p"],
      // These three steps never had a hidden number: their boxes start at the text.
      ["s08.f19", "label"], ["s08.f12", "ol"],
      ["s08.f20", "label"], ["s08.f13", "ol"],
      ["s08.f21", "label"], ["s08.f14", "ol"],
      ["s08.f15", "p"], ["s08.f16", "p"],
      ["s08.f17", "label"], ["s08.f18", "label"],
      ["s08.f01", "page-number"],
    ],
  },
  {
    sheet: 9,
    unprinted: { words: ["B"], why: "The B on the Station card is set twice at the same spot." },
    changes: [
      { split: "s09.f11", into: [
        { id: "s09.f11a", box: { x: 189.57, y: 68.35, width: 5.16, height: 7.73 } },
        { id: "s09.f11b", box: { x: 206.04, y: 68.35, width: 4.53, height: 7.73 } },
        { id: "s09.f11c", box: { x: 232.7, y: 68.35, width: 5.25, height: 7.73 } },
      ] },
      { merge: ["s09.f06", "s09.f07", "s09.f08", "s09.f09"], styleOf: "s09.f07" },
      { merge: ["s09.f12", "s09.f13"] },
      { split: "s09.f14", into: [
        { id: "s09.f14a", box: { x: 451.77, y: 159.97, width: 3.86, height: 6.58 } },
        { id: "s09.f14b", box: { x: 478.09, y: 159.97, width: 4.47, height: 6.58 } },
      ] },
      { drop: "s09.f15", why: "A second B set at the same spot as s09.f14a." },
    ],
    order: [
      ["s09.f03", "h2"],
      // The three circled letters sit inside this paragraph's third line; its text anchors them.
      ["s09.f04", "p"], ["s09.f11a", "label", { room: 11 }], ["s09.f11b", "label", { room: 11 }], ["s09.f11c", "label", { room: 11 }],
      ["s09.f05", "p"],
      ["s09.f06", "ul", { indent: 18 }],
      ["s09.f10", "p"],
      ["s09.f02", "page-number"],
      ["s09.f16", "label"], ["s09.f14a", "label"], ["s09.f14b", "label"],
      ["s09.f12", "caption", center],
      ["s09.f01", "page-number"],
    ],
  },
  {
    sheet: 10,
    changes: [
      { merge: ["s10.f05", "s10.f06"] },
    ],
    order: [
      ["s10.f03", "h2"], ["s10.f04", "p"],
      ["s10.f05", "ol", { indent: 18 }],
      ["s10.f02", "page-number"],
      ["s10.f19", "caption", center],
      // One slot per player count: a number over the word PLAYER, both centred on the slot.
      ["s10.f07", "label", center], ["s10.f08", "label", center],
      ["s10.f09", "label", center], ["s10.f10", "label", center],
      ["s10.f11", "label", center], ["s10.f12", "label", center],
      ["s10.f13", "label", center], ["s10.f14", "label", center],
      ["s10.f15", "label", center], ["s10.f16", "label", center],
      ["s10.f17", "label", center], ["s10.f18", "label", center],
      ["s10.f01", "page-number"],
    ],
  },
  {
    sheet: 11,
    unprinted: { words: ["1", "2", "3", "4", "5", "6"], why: hiddenNumbers },
    changes: [
      { merge: ["s11.f05", "s11.f06"], styleOf: "s11.f06" },
      { split: "s11.f09", into: [
        { id: "s11.f09a", box: { x: 62.36, y: 188.41, width: 113.27, height: 8.5 } },
        { id: "s11.f09b", box: { x: 62.36, y: 200.91, width: 109.94, height: 8.5 } },
        { id: "s11.f09c", box: { x: 62.36, y: 213.41, width: 135.07, height: 8.5 } },
        { id: "s11.f09d", box: { x: 62.36, y: 225.91, width: 114.57, height: 8.5 } },
        { id: "s11.f09e", box: { x: 62.36, y: 238.41, width: 116.43, height: 8.5 } },
        { id: "s11.f09f", box: { x: 62.36, y: 250.91, width: 131.37, height: 8.5 } },
      ] },
      { split: "s11.f16", into: [
        { id: "s11.f16a", box: { x: 360.89, y: 128.98, width: 2.32, height: 5.85 } },
        { id: "s11.f16b", box: { x: 424.47, y: 128.98, width: 2.96, height: 5.85 } },
      ] },
    ],
    order: [
      ["s11.f03", "h1"], ["s11.f04", "p"],
      ["s11.f05", "ul", { indent: 14.17 }],
      ["s11.f07", "p"],
      ["s11.f08", "p"],
      ["s11.f10", "label"], ["s11.f09a", "ol"],
      ["s11.f11", "label"], ["s11.f09b", "ol"],
      ["s11.f12", "label"], ["s11.f09c", "ol"],
      ["s11.f13", "label"], ["s11.f09d", "ol"],
      ["s11.f14", "label"], ["s11.f09e", "ol"],
      ["s11.f15", "label"], ["s11.f09f", "ol"],
      ["s11.f02", "page-number"],
      ["s11.f16a", "label"], ["s11.f16b", "label"], ["s11.f17", "label"],
      ["s11.f18", "label"], ["s11.f21", "label"], ["s11.f19", "label"], ["s11.f20", "label"],
      ["s11.f01", "page-number"],
    ],
  },
  {
    sheet: 12,
    unprinted: { words: ["1", "2", "3"], why: hiddenNumbers },
    changes: [
      { merge: ["s12.f04", "s12.f05", "s12.f06"], styleOf: "s12.f05" },
      { split: "s12.f11", into: [
        { id: "s12.f11a", box: { x: 332.5, y: 242.44, width: 59.26, height: 8 } },
        { id: "s12.f11b", box: { x: 449.43, y: 242.44, width: 61.52, height: 8 } },
      ] },
    ],
    order: [
      ["s12.f02", "h1"], ["s12.f03", "p"],
      ["s12.f04", "ul", { indent: 14.17 }],
      ["s12.f01", "page-number"],
      ["s12.f07", "p", regular],
      ["s12.f12", "label"], ["s12.f08", "ol", { trimLeft: 14.18 }],
      ["s12.f13", "label"], ["s12.f09", "ol", { trimLeft: 14.18 }],
      ["s12.f14", "label"], ["s12.f10", "ol", { trimLeft: 14.18 }],
      ["s12.f11a", "label", center], ["s12.f11b", "label", center],
      ["s12.f15", "label"], ["s12.f16", "label"], ["s12.f17", "label"],
    ],
  },
  {
    sheet: 13,
    unprinted: { words: ["1", "2", "3"], why: hiddenNumbers },
    changes: [],
    order: [
      ["s13.f03", "h1"],
      // Each action is a panel: its name over an icon, and the rule beside it.
      ["s13.f06", "h2"], ["s13.f04", "p"],
      ["s13.f05", "h2"], ["s13.f07", "p"],
      ["s13.f08", "p", { ...regular, ...center }],
      ["s13.f02", "page-number"],
      ["s13.f18", "h2"], ["s13.f17", "p"],
      ["s13.f09", "h2"], ["s13.f10", "p"],
      ["s13.f14", "label"], ["s13.f11", "ol", { trimLeft: 11.34 }],
      ["s13.f15", "label"], ["s13.f12", "ol", { trimLeft: 11.34 }],
      ["s13.f16", "label"], ["s13.f13", "ol", { trimLeft: 11.34 }],
      ["s13.f19", "label"], ["s13.f20", "label"], ["s13.f22", "label"], ["s13.f21", "label"],
      ["s13.f01", "page-number"],
    ],
  },
  {
    sheet: 14,
    noHeading: "Continues the Build action from sheet 13.",
    unprinted: { words: ["1", "2", "3"], why: hiddenNumbers },
    changes: [],
    order: [
      ["s14.f03", "p"],
      ["s14.f05", "label"], ["s14.f04", "ol", { trimLeft: 18 }],
      ["s14.f06", "label"],
      ["s14.f02", "page-number"],
      ["s14.f09", "label"], ["s14.f07", "ol", { trimLeft: 18 }],
      ["s14.f10", "label"], ["s14.f08", "ol", { trimLeft: 18 }],
      // INCORRECT ends at the panel's right edge, as CORRECT starts at the other panel's left.
      ["s14.f11", "label", right],
      ["s14.f01", "page-number"],
    ],
  },
  {
    sheet: 15,
    changes: [
      { merge: ["s15.f04", "s15.f05"] },
      { merge: ["s15.f14", "s15.f15"] },
    ],
    order: [
      // The action names over an icon are centred on it.
      ["s15.f04", "h2", center], ["s15.f03", "p"],
      ["s15.f07", "h2", center], ["s15.f06", "p"],
      ["s15.f09", "h2"], ["s15.f08", "p"],
      ["s15.f02", "page-number"],
      ["s15.f12", "h2"], ["s15.f10", "p"], ["s15.f11", "p"],
      ["s15.f14", "h2", center], ["s15.f13", "p"],
      ["s15.f01", "page-number"],
    ],
  },
  {
    sheet: 16,
    unprinted: { words: ["1", "2", "3", "4"], why: hiddenNumbers },
    changes: [
      { split: "s16.f15", into: [
        { id: "s16.f15a", box: { x: 340.84, y: 30.29, width: 52.78, height: 8 } },
        { id: "s16.f15b", box: { x: 467.84, y: 30.29, width: 45.67, height: 8 } },
      ] },
      { split: "s16.f18", into: [
        { id: "s16.f18a", box: { x: 480.12, y: 239.37, width: 26.45, height: 6 } },
        { id: "s16.f18b", box: { x: 518.75, y: 239.37, width: 16.06, height: 6 } },
      ] },
    ],
    order: [
      ["s16.f02", "h2"], ["s16.f03", "p"],
      ["s16.f04", "p", center],
      // Steps 1 and 4 each hold a circled A inside a line; their text anchors it.
      ["s16.f09", "label"], ["s16.f05", "ol", { trimLeft: 14.17 }], ["s16.f13", "label", { room: 11.5 }],
      ["s16.f10", "label"], ["s16.f06", "ol", { trimLeft: 14.17 }],
      ["s16.f11", "label"], ["s16.f07", "ol", { trimLeft: 14.17 }],
      ["s16.f12", "label"], ["s16.f08", "ol", { trimLeft: 14.17 }], ["s16.f14", "label", { room: 11.5 }],
      ["s16.f01", "page-number"],
      ["s16.f15a", "label", center], ["s16.f16", "label"], ["s16.f17", "label"], ["s16.f21", "label"], ["s16.f23", "label"],
      ["s16.f15b", "label", center], ["s16.f24", "label"],
      ["s16.f22", "label", center], ["s16.f19", "label"], ["s16.f20", "label"],
      ["s16.f18a", "label", center], ["s16.f18b", "label", center],
    ],
  },
  {
    sheet: 17,
    noHeading: "Continues the Sample Turn from sheet 16.",
    unprinted: {
      words: ["5", "6", "7"],
      why: "List numbers hidden under the circles for steps 6 to 8. They read 5, 6 and 7, one lower than the circles; step 5 has none.",
    },
    changes: [
      { split: "s17.f12", into: [
        { id: "s17.f12a", box: { x: 340.84, y: 30.29, width: 52.78, height: 8 } },
        { id: "s17.f12b", box: { x: 467.84, y: 30.29, width: 45.67, height: 8 } },
      ] },
      { split: "s17.f13", into: [
        { id: "s17.f13a", box: { x: 477.45, y: 239.37, width: 26.45, height: 6 } },
        { id: "s17.f13b", box: { x: 518.75, y: 239.37, width: 16.06, height: 6 } },
      ] },
      { split: "s17.f20", into: [
        { id: "s17.f20a", box: { x: 391.43, y: 170.92, width: 2.87, height: 5.85 } },
        { id: "s17.f20b", box: { x: 416.44, y: 170.92, width: 3.4, height: 5.85 } },
      ] },
    ],
    order: [
      ["s17.f08", "label"], ["s17.f03", "ol"],
      ["s17.f09", "label"], ["s17.f04", "ol", { trimLeft: 14.17 }],
      ["s17.f10", "label"], ["s17.f05", "ol", { trimLeft: 14.17 }],
      ["s17.f11", "label"], ["s17.f06", "ol", { trimLeft: 14.17 }],
      ["s17.f07", "p", center],
      ["s17.f02", "page-number"],
      ["s17.f12a", "label", center], ["s17.f15", "label"], ["s17.f16", "label"], ["s17.f17", "label"], ["s17.f18", "label"],
      ["s17.f12b", "label", center],
      ["s17.f14", "label", center], ["s17.f20a", "label"], ["s17.f20b", "label"],
      ["s17.f19", "label"],
      ["s17.f13a", "label", center], ["s17.f13b", "label", center],
      ["s17.f01", "page-number"],
    ],
  },
  {
    sheet: 18,
    changes: [
      { merge: ["s18.f12", "s18.f13"] },
    ],
    order: [
      ["s18.f03", "h1"], ["s18.f04", "p"],
      // The panel of four victory conditions is what the sentence above introduces.
      ["s18.f06", "p"], ["s18.f07", "p"], ["s18.f08", "p"], ["s18.f09", "p", regular], ["s18.f10", "p", regular],
      ["s18.f05", "p"],
      ["s18.f02", "page-number"],
      ["s18.f11", "caption", center], ["s18.f12", "caption", center],
      ["s18.f01", "page-number"],
    ],
  },
  {
    sheet: 19,
    changes: [
      { split: "s19.f04", into: [
        { id: "s19.f04a", box: { x: 28.35, y: 57.18, width: 50.32, height: 10 } },
        { id: "s19.f04b", box: { x: 28.35, y: 73.11, width: 224.24, height: 49 } },
      ] },
      { split: "s19.f07", into: [
        { id: "s19.f07a", box: { x: 311.81, y: 57.18, width: 153.37, height: 10 } },
        { id: "s19.f07b", box: { x: 311.81, y: 73.1, width: 197.59, height: 36 } },
      ] },
    ],
    order: [
      ["s19.f03", "h1"],
      // The tagline is filled with a gradient from #f35e42 to #f9ad33, which extraction
      // cannot read; it reported the fill before it. This is the middle of the gradient.
      ["s19.f10", "p", { color: "#f6853b" }],
      ["s19.f04a", "h2"], ["s19.f04b", "p", { fontWeight: 500 }],
      ["s19.f05", "p", regular], ["s19.f06", "p"],
      ["s19.f02", "page-number"],
      ["s19.f07a", "h2"], ["s19.f07b", "p", regular],
      ["s19.f08", "ul", { ...body, fontSize: 10, indent: 14.18 }],
      ["s19.f09", "p"],
      ["s19.f01", "page-number"],
    ],
  },
  {
    sheet: 20,
    changes: [
      { split: "s20.f03", into: [
        { id: "s20.f03a", box: { x: 28.35, y: 21.5, width: 153.66, height: 10 } },
        { id: "s20.f03b", box: { x: 28.35, y: 37.43, width: 225.8, height: 23 } },
      ] },
    ],
    order: [
      ["s20.f03a", "h2"], ["s20.f03b", "p", { fontWeight: 500 }],
      ["s20.f04", "p"], ["s20.f05", "p"],
      ["s20.f02", "page-number"],
      ["s20.f06", "h2"],
      ["s20.f12", "label"], ["s20.f07", "ol"],
      ["s20.f14", "label"], ["s20.f08", "ol"],
      ["s20.f13", "label"], ["s20.f09", "ol"],
      ["s20.f15", "label"], ["s20.f10", "ol"], ["s20.f11", "p"],
      ["s20.f16", "label"], ["s20.f18", "label"], ["s20.f17", "label"], ["s20.f19", "label"],
      ["s20.f01", "page-number"],
    ],
  },
  {
    sheet: 21,
    unprinted: { words: ["1", "2", "3", "4", "5"], why: hiddenNumbers },
    changes: [
      { split: "s21.f17", into: [
        { id: "s21.f17a", box: { x: 332.71, y: 153.74, width: 49.62, height: 9 } },
        { id: "s21.f17b", box: { x: 439.25, y: 153.74, width: 52.16, height: 9 } },
      ] },
    ],
    order: [
      ["s21.f03", "h2"],
      ["s21.f09", "label"], ["s21.f04", "ol", { trimLeft: 14.17 }],
      ["s21.f10", "label"], ["s21.f05", "ol", { trimLeft: 14.17 }],
      ["s21.f11", "label"], ["s21.f06", "ol", { trimLeft: 14.17 }],
      ["s21.f12", "label"], ["s21.f07", "ol", { trimLeft: 14.17 }],
      ["s21.f13", "label"], ["s21.f08", "ol", { trimLeft: 14.17 }],
      ["s21.f02", "page-number"],
      ["s21.f18", "label", center], ["s21.f15", "label", center], ["s21.f14", "label", center],
      ["s21.f17a", "label", center], ["s21.f17b", "label", center],
      ["s21.f16", "label"], ["s21.f19", "label"], ["s21.f22", "label"], ["s21.f20", "label"], ["s21.f21", "label"],
      ["s21.f01", "page-number"],
    ],
  },
  {
    sheet: 22,
    changes: [
      { merge: ["s22.f04", "s22.f05"] },
    ],
    order: [
      ["s22.f03", "h1"], ["s22.f04", "p"],
      ["s22.f02", "page-number"],
      ["s22.f06", "p", regular],
      ["s22.f01", "page-number"],
    ],
  },
  {
    sheet: 23,
    noHeading: "Continues the Story from sheet 22: one paragraph for each Station, beside its card.",
    changes: [],
    order: [
      ["s23.f03", "p", regular], ["s23.f04", "p", regular], ["s23.f05", "p", regular],
      ["s23.f02", "page-number"],
      ["s23.f06", "p", regular], ["s23.f07", "p", regular], ["s23.f08", "p", regular],
      ["s23.f01", "page-number"],
    ],
  },
  {
    sheet: 24,
    unprinted: { words: ["43", "44"], why: "The page numbers lie under the artwork and are not visible." },
    changes: [
      { drop: "s24.f02", why: "Page number 43 lies under the artwork and is not visible." },
      { drop: "s24.f01", why: "Page number 44 lies under the artwork and is not visible." },
      // Each column of backers is one block of centred lines; extraction cut it wherever two lines happened to start together.
      { merge: ["s24.f04", "s24.f05", "s24.f06", "s24.f07", "s24.f08", "s24.f09", "s24.f10"] },
      { merge: ["s24.f11", "s24.f12", "s24.f13", "s24.f14", "s24.f15", "s24.f16", "s24.f17", "s24.f18", "s24.f19"] },
      { merge: ["s24.f25", "s24.f26"] },
      // A row of names is one frame per person, each centred where it stands.
      { split: "s24.f23", into: [
        { id: "s24.f23a", box: { x: 310, y: 65.17, width: 39.05, height: 9 } },
        { id: "s24.f23b", box: { x: 368.15, y: 65.17, width: 50.32, height: 9 } },
        { id: "s24.f23c", box: { x: 435.02, y: 65.17, width: 44.14, height: 9 } },
        { id: "s24.f23d", box: { x: 497.82, y: 65.17, width: 46.1, height: 9 } },
      ] },
      { split: "s24.f31", into: [
        { id: "s24.f31a", box: { x: 437.71, y: 124.42, width: 45.12, height: 9 } },
        { id: "s24.f31b", box: { x: 495.29, y: 124.42, width: 53.27, height: 9 } },
      ] },
      { split: "s24.f27", into: [
        { id: "s24.f27a", box: { x: 313.52, y: 193.34, width: 53.27, height: 9 } },
        { id: "s24.f27b", box: { x: 396.24, y: 193.34, width: 57.92, height: 9 } },
        { id: "s24.f27c", box: { x: 486.32, y: 193.34, width: 47.83, height: 9 } },
      ] },
      { split: "s24.f21", into: [
        { id: "s24.f21a", box: { x: 316.87, y: 248.25, width: 46.57, height: 9 } },
        { id: "s24.f21b", box: { x: 388.03, y: 248.25, width: 74.34, height: 9 } },
        { id: "s24.f21c", box: { x: 485.89, y: 248.25, width: 48.7, height: 9 } },
      ] },
    ],
    order: [
      ["s24.f03", "h1", { fontWeight: 300, ...center }],
      ["s24.f20", "p", center],
      ["s24.f04", "p", center], ["s24.f11", "p", center],
      ["s24.f22", "h1", { fontWeight: 300, ...center }],
      ["s24.f29", "h2", center],
      ["s24.f23a", "p", center], ["s24.f23b", "p", center], ["s24.f23c", "p", center], ["s24.f23d", "p", center],
      ["s24.f25", "h2", center], ["s24.f24", "p", center],
      ["s24.f32", "h2", center],
      ["s24.f31a", "p", center], ["s24.f31b", "p", center], ["s24.f33", "p", center],
      ["s24.f28", "h2", center],
      ["s24.f27a", "p", center], ["s24.f27b", "p", center], ["s24.f27c", "p", center],
      ["s24.f30", "h2", center],
      ["s24.f21a", "p", center], ["s24.f21b", "p", center], ["s24.f21c", "p", center],
    ],
  },
  {
    sheet: 25,
    noHeading: "The back cover has no visible live text: its logo, addresses and QR code are artwork.",
    unprinted: { words: ["45"], why: "The page number lies under the artwork and is not visible." },
    changes: [
      { drop: "s25.f01", why: "Page number 45 lies under the artwork and is not visible." },
    ],
    order: [],
  },
] as const satisfies readonly SheetOverride[];

/** Every reviewed frame. A text edition is a total record over this union. */
export type FrameId = (typeof sheetOverrides)[number]["order"][number][0];

export type ReviewedFrame<Id extends string = string> = Omit<RulebookFrame, "id" | "text"> & {
  id: Id;
  role: FrameRole;
  indent?: number;
  room?: number;
  /** Where the published English text stands, when an edition's box is another (`editionBoxes`). */
  englishBox?: Box;
  /** Points left empty above the text's last line, where a picture stands between its lines. */
  skip?: number;
};
export type ReviewedSheet<Id extends string = string> = {
  sheet: number;
  width: number;
  height: number;
  /** In reading order. */
  frames: readonly ReviewedFrame<Id>[];
};

const round = (value: number) => Math.round(value * 100) / 100;

function union(boxes: readonly Box[]): Box {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const farX = Math.max(...boxes.map((box) => box.x + box.width));
  const farY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: round(x), y: round(y), width: round(farX - x), height: round(farY - y) };
}

/**
 * Applies the review to a frame map. It fails on a change that names a
 * missing frame, and on a frame left without a role and a place in the
 * reading order, so a re-extraction that moves frames cannot pass unseen.
 */
export function applyOverrides(
  sheets: readonly RulebookSheet[],
  overrides: readonly SheetOverride[],
): ReviewedSheet[] {
  return sheets.map((sheet) => {
    const override = overrides.find((candidate) => candidate.sheet === sheet.sheet);
    if (!override) throw new Error(`Sheet ${sheet.sheet} has not been reviewed`);
    const frames = new Map<string, Omit<RulebookFrame, "text">>();
    for (const frame of sheet.frames) {
      frames.set(frame.id, {
        id: frame.id,
        box: frame.box,
        fontFamily: frame.fontFamily,
        fontWeight: frame.fontWeight,
        fontStyle: frame.fontStyle,
        fontSize: frame.fontSize,
        color: frame.color,
        alignment: frame.alignment,
      });
    }
    const take = (id: string) => {
      const frame = frames.get(id);
      if (!frame) throw new Error(`Sheet ${sheet.sheet}: ${id} is not a frame, or is used twice`);
      frames.delete(id);
      return frame;
    };
    const add = (frame: Omit<RulebookFrame, "text">) => {
      if (frames.has(frame.id)) throw new Error(`Sheet ${sheet.sheet}: ${frame.id} already exists`);
      frames.set(frame.id, frame);
    };

    for (const change of override.changes) {
      if ("drop" in change) {
        take(change.drop);
      } else if ("merge" in change) {
        const parts = change.merge.map(take);
        const styleOf = change.styleOf ?? change.merge[0];
        const style = parts.find((part) => part.id === styleOf);
        if (!style) throw new Error(`Sheet ${sheet.sheet}: ${styleOf} is not part of its merge`);
        add({ ...style, id: change.merge[0], box: union(parts.map((part) => part.box)) });
      } else {
        const source = take(change.split);
        for (const part of change.into) add({ ...source, id: part.id, box: part.box });
      }
    }

    const ordered = override.order.map(([id, role, tweak]): ReviewedFrame => {
      const frame = take(id);
      const { trimLeft = 0, indent, room, ...style } = tweak ?? {};
      const box = { ...frame.box, x: round(frame.box.x + trimLeft), width: round(frame.box.width - trimLeft) };
      return { ...frame, ...style, box, role, ...(indent === undefined ? {} : { indent }), ...(room === undefined ? {} : { room }) };
    });
    if (frames.size > 0) {
      throw new Error(`Sheet ${sheet.sheet}: no role or reading order for ${[...frames.keys()].join(", ")}`);
    }
    return { sheet: sheet.sheet, width: sheet.width, height: sheet.height, frames: ordered };
  });
}

/** The published layout as reviewed: every sheet's frames in reading order, each with its role. */
export const reviewedSheets = applyOverrides(rulebookSheets, sheetOverrides) as readonly ReviewedSheet<FrameId>[];

/**
 * Points added to a frame's box on each named side. `skip` leaves that many
 * points empty above the text's last line, for a frame whose text stands
 * around a picture: its name above an icon and the printed word under it.
 * The box has to grow `down` by as much.
 */
export type Grow = { left?: number; right?: number; up?: number; down?: number; skip?: number };

/**
 * Where a translation needs more room than the English text took and the
 * sheet has it, the frame's box grows for that edition alone. A frame not
 * named here keeps its English box, and its text is shortened to fit it.
 * Every entry was looked at on the rendered sheet: the grown box lies on
 * empty ground and reaches no other frame or picture.
 */
export const editionBoxes: Readonly<Record<string, Readonly<Partial<Record<FrameId, Grow>>>>> = {
  de: {
    // Sheet 1: the title, centred under the logo.
    "s01.f01": { left: 11, right: 11 },
    // Sheet 2: contents entries run right, towards their page numbers.
    "s02.f01": { down: 6 }, "s02.f02": { right: 10, down: 6 },
    "s02.f06a": { right: 20 }, "s02.f06c": { right: 13 }, "s02.f06e": { right: 5 }, "s02.f07a": { right: 46 }, "s02.f07c": { right: 18 },
    "s02.f08a": { right: 8 }, "s02.f10c": { right: 24 }, "s02.f10e": { right: 26 },
    // Sheet 3: each caption stays one line, centred under its cards.
    "s03.f04": { right: 20 }, "s03.f07": { right: 8 },
    "s03.f06a": { left: 30, right: 30 }, "s03.f05": { left: 26, right: 26 }, "s03.f06b": { left: 26, right: 26 }, "s03.f06c": { left: 46, right: 46 },
    // Sheet 4: the list on the left panel; a two-line entry stands around its numeral, as the English fifth entry does.
    "s04.f03": { right: 10 }, "s04.f05": { right: 40 }, "s04.f07": { right: 18, up: 5, down: 6 }, "s04.f08": { up: 5, down: 6 },
    "s04.f09": { right: 10 }, "s04.f10": { right: 16 },
    // Sheet 4: no callout around the cards grows. Each stands on a white pill drawn for the English words, and is shortened to fit it.
    // Sheets 5 and 6: the pile labels, centred under their piles.
    "s05.f06": { right: 5, down: 6 }, "s05.f10": { left: 9, right: 9 }, "s05.f11": { left: 16.5, right: 16.5 },
    "s06.f10": { left: 9, right: 9 }, "s06.f11": { left: 18.5, right: 14.5 }, "s06.f12": { right: 6 },
    // Sheet 7: the victory conditions run right inside their panel; the caption is centred in its own.
    "s07.f05": { right: 20 }, "s07.f06": { right: 48 }, "s07.f07": { right: 32 }, "s07.f08": { right: 20 }, "s07.f09": { left: 25, right: 25 }, "s07.f10": { right: 15 },
    // Sheets 8 to 12: headings and list lines run right in their column or panel.
    "s08.f05": { right: 37 }, "s08.f09": { right: 45 }, "s08.f12": { right: 8 }, "s08.f13": { right: 10 }, "s08.f15": { right: 8 },
    "s09.f03": { right: 40 }, "s09.f05": { right: 70 }, "s09.f10": { right: 15, down: 4 },
    "s10.f04": { right: 25 }, "s10.f19": { left: 6, right: 6 },
    "s11.f03": { right: 110 }, "s11.f05": { right: 6, down: 4 }, "s11.f08": { right: 50 }, "s11.f09a": { right: 60 }, "s11.f09b": { right: 60 }, "s11.f09c": { right: 48 },
    "s11.f09d": { right: 50 }, "s11.f09e": { right: 45 }, "s11.f09f": { right: 48 },
    "s12.f02": { right: 60 }, "s12.f03": { right: 8 }, "s12.f04": { right: 6 },
    // Sheets 13 and 15: an action's name stays over its icon, and the word the cards print stands under the icon.
    "s13.f03": { right: 15 }, "s13.f06": { left: 5, right: 10, down: 40, skip: 25 }, "s13.f05": { right: 14, down: 43, skip: 28 }, "s13.f07": { right: 6, down: 8 },
    "s13.f18": { left: 6, right: 8, down: 42, skip: 27 }, "s13.f09": { right: 10, down: 37, skip: 22 }, "s13.f11": { right: 30 }, "s13.f12": { right: 14 },
    // Sheet 14: the rules above the two diagrams.
    "s14.f04": { right: 5, down: 4 }, "s14.f07": { right: 4 }, "s14.f08": { right: 15 },
    // Sheet 15: each panel has room right of and under its text.
    "s15.f04": { left: 5.5, right: 5.5, down: 37, skip: 23 }, "s15.f03": { right: 8, down: 8 }, "s15.f07": { left: 9.5, right: 9.5, down: 47, skip: 32 },
    "s15.f06": { right: 8, down: 8 }, "s15.f09": { right: 40 }, "s15.f12": { right: 12 }, "s15.f10": { right: 20 },
    // Sheets 16 and 17: the pile labels take two lines under their piles.
    "s16.f07": { right: 28 }, "s16.f18a": { down: 8 }, "s16.f18b": { left: 8, right: 8, down: 8 },
    "s17.f07": { down: 11 }, "s17.f12a": { left: 11, right: 11 }, "s17.f13a": { down: 8 }, "s17.f13b": { left: 8, right: 8, down: 8 },
    // Sheet 18: the victory conditions in their narrow panel, and the caption under the first Base.
    "s18.f06": { right: 8 }, "s18.f07": { right: 25 }, "s18.f08": { right: 2 }, "s18.f09": { right: 9, down: 9 }, "s18.f10": { right: 6 }, "s18.f11": { left: 16, right: 16 },
    "s19.f03": { right: 100 }, "s19.f05": { down: 9 },
    // Sheet 20: the left column is free under its last paragraph.
    "s20.f03a": { right: 25 }, "s20.f04": { down: 9 }, "s20.f05": { down: 12 }, "s20.f06": { right: 25 }, "s20.f07": { right: 8 }, "s20.f08": { right: 8 }, "s20.f09": { right: 8 }, "s20.f10": { right: 23 },
    // Sheet 21.
    "s21.f03": { right: 110 }, "s21.f04": { right: 25 }, "s21.f05": { right: 5 }, "s21.f06": { right: 12 }, "s21.f07": { right: 20 }, "s21.f08": { right: 10 }, "s21.f18": { left: 21, right: 21 },
    "s21.f15": { left: 9, right: 9, down: 9 }, "s21.f14": { left: 2, right: 2, down: 9 }, "s21.f17a": { left: 12, right: 12 },
    "s22.f03": { right: 50 },
    // Sheet 23: each Station's paragraph may run further right and down beside its card.
    "s23.f03": { right: 8, down: 8 }, "s23.f05": { down: 11 }, "s23.f06": { right: 10, down: 10 }, "s23.f08": { right: 8, down: 11 },
    "s24.f20": { left: 22, right: 22 }, "s24.f32": { left: 13, right: 13 },
  },
  et: {
    // Estonian labels and captions have room beside their English frames.
    // Sheet 2.
    "s02.f05a": { right: 30 },
    "s02.f05c": { right: 34 },
    "s02.f06a": { right: 40 },
    "s02.f06e": { right: 31 },
    "s02.f07a": { right: 46 },
    "s02.f07c": { right: 18 },
    "s02.f08a": { right: 12 },
    // Sheet 3.
    "s03.f06a": { left: 30, right: 30 },
    "s03.f05": { left: 26, right: 26 },
    "s03.f06b": { left: 26, right: 26 },
    "s03.f06c": { left: 46, right: 46 },
    // Sheet 3 heading and sheet 4 card labels stay within their artwork.
    "s03.f03": { right: 30 },
    // Sheet 4.
    "s04.f05": { right: 40 },
    "s04.f07": { right: 18, up: 5, down: 6 },
    "s04.f10": { right: 16 },
    "s04.f08": { up: 5, down: 6 },
    "s04.f34": { left: 4, right: 5 },
    "s05.f03": { right: 100 },
    // Sheet 5.
    "s05.f10": { left: 20, right: 20 },
    "s05.f11": { left: 16.5, right: 16.5 },
    "s06.f05": { right: 18, down: 8 },
    // Sheet 6.
    "s06.f10": { left: 20, right: 20, down: 11 },
    "s06.f11": { left: 18.5, right: 14.5 },
    // Sheet 7.
    "s07.f05": { right: 20 },
    "s07.f06": { right: 48 },
    "s08.f03": { right: 70 }, "s08.f14": { right: 28 },
    // Sheet 8.
    "s08.f05": { right: 37 },
    "s08.f09": { right: 45 },
    "s10.f03": { right: 75 },
    // Sheet 10.
    "s10.f19": { left: 6, right: 6, down: 8 },
    // Sheet 11.
    "s11.f03": { right: 110 },
    "s11.f09a": { right: 60 },
    "s11.f09b": { right: 60 },
    "s11.f09c": { right: 48 },
    "s11.f09d": { right: 50 },
    "s11.f09e": { right: 45 },
    "s11.f09f": { right: 48 },
    "s12.f10": { right: 30 },
    // Sheet 12.
    "s12.f02": { right: 60 },
    // Sheet 13.
    "s13.f03": { right: 22 },
    "s13.f06": { left: 5, right: 10, down: 40, skip: 25 },
    "s13.f05": { right: 14, down: 43, skip: 28 },
    "s13.f18": { left: 6, right: 8, down: 42, skip: 27 },
    "s13.f09": { right: 10, down: 37, skip: 22 },
    "s13.f11": { right: 30 },
    // Sheet 15.
    "s15.f04": { left: 13.5, right: 7.5, up: 8, down: 37, skip: 15 },
    "s15.f07": { left: 9.5, right: 9.5, down: 47, skip: 32 },
    "s15.f09": { right: 40 },
    "s15.f12": { right: 35 },
    // Sheet 16.
    "s16.f05": { right: 15, down: 5 },
    "s16.f07": { right: 28 },
    "s16.f08": { right: 15, down: 5 },
    "s16.f18a": { left: 5, right: 5, down: 8 },
    "s16.f18b": { left: 3, right: 18, down: 8 },
    // Sheet 17.
    "s17.f13a": { left: 5, right: 5, down: 8 },
    "s17.f13b": { left: 3, right: 18, down: 8 },
    // Sheet 18.
    "s18.f06": { right: 8, down: 8 },
    "s18.f08": { right: 2, down: 8 },
    // Sheet 19.
    "s19.f03": { right: 100 },
    // Sheet 20.
    "s20.f07": { right: 8 },
    // Sheet 21.
    "s21.f04": { right: 25 },
    "s21.f05": { right: 75 },
    "s21.f07": { right: 20 },
    "s21.f15": { left: 6, right: 6, down: 9 },
    "s21.f14": { left: 2, right: 8, down: 9 },
    "s24.f25": { down: 8 },
    // Sheet 24.
    "s24.f22": { right: 45 },
    "s24.f32": { left: 13, right: 13 },
    "s24.f28": { left: 20, right: 20 },
  },
  tlh: {
    // Sheet 2: contents entries run right, towards their page numbers.
    "s02.f05c": { right: 34 }, "s02.f06e": { right: 31 }, "s02.f07a": { right: 46 }, "s02.f07c": { right: 18 }, "s02.f10c": { right: 38 },
    // Sheet 3: each caption stays one line, centred under its cards.
    "s03.f06a": { left: 30, right: 30 }, "s03.f05": { left: 26, right: 26 }, "s03.f06b": { left: 26, right: 26 }, "s03.f06c": { left: 46, right: 46 },
    // Sheet 4: the list on the left panel; a two-line entry stands around its numeral, as the English fifth entry does.
    "s04.f05": { right: 40 }, "s04.f07": { right: 18, up: 5, down: 6 }, "s04.f09": { right: 25 }, "s04.f10": { right: 40 },
    // Sheet 4: no callout around the cards grows. Each stands on a white pill drawn for the English words, and is shortened to fit it.
    // Sheets 5 and 6: the heading and the first step run right; the pile labels are centred under their piles.
    "s05.f03": { right: 100 }, "s05.f06": { right: 5, down: 6 }, "s05.f10": { left: 2, right: 2, down: 8 }, "s05.f11": { left: 9.5, right: 9.5 },
    "s06.f10": { left: 2, right: 2, up: 3, down: 5 }, "s06.f11": { left: 9.5, right: 9.5 }, "s06.f12": { right: 15 },
    // Sheet 7: the victory conditions run right inside their panel.
    "s07.f05": { right: 20 }, "s07.f06": { right: 48 },
    // Sheets 8 to 12: headings and list lines run right in their column or panel.
    "s08.f05": { right: 37 }, "s08.f12": { right: 8 }, "s08.f14": { right: 28 },
    "s10.f04": { right: 28 }, "s10.f19": { left: 6, right: 6 },
    "s11.f03": { right: 110 }, "s11.f08": { right: 50 }, "s11.f09a": { right: 60 }, "s11.f09c": { right: 52 }, "s11.f09d": { right: 73 }, "s11.f09e": { right: 72 }, "s11.f09f": { right: 57 },
    "s12.f02": { right: 60 }, "s12.f03": { right: 8 }, "s12.f07": { right: 28 },
    // Sheets 13 and 15: an action's name stays over its icon, and the word the cards print stands under the icon.
    "s13.f06": { left: 5, right: 10, down: 40, skip: 25 }, "s13.f05": { right: 14, down: 43, skip: 28 },
    "s13.f18": { left: 6, right: 8, down: 42, skip: 27 }, "s13.f09": { left: 7, right: 10, down: 37, skip: 22 }, "s13.f11": { right: 30 },
    "s15.f04": { left: 4, right: 4, up: 5, down: 33, skip: 16 }, "s15.f07": { left: 9.5, right: 9.5, down: 47, skip: 32 },
    // Sheets 16 and 17: the sample turn's steps, and the pile labels on two lines under their piles.
    "s16.f05": { right: 22 }, "s16.f08": { right: 10, down: 5 }, "s16.f18a": { left: 3, right: 3, down: 8 }, "s16.f18b": { left: 3, right: 3, down: 8 },
    "s17.f12a": { left: 4, right: 4 }, "s17.f13a": { right: 6, down: 8 }, "s17.f13b": { left: 3, right: 3, down: 8 },
    // Sheet 18: the victory conditions in their narrow panel, and the caption under the first Base.
    "s18.f06": { right: 8, down: 8 }, "s18.f07": { right: 25 }, "s18.f08": { right: 2, down: 8 }, "s18.f11": { left: 16, right: 16 },
    // Sheet 19.
    "s19.f03": { right: 98 }, "s19.f05": { down: 9 },
    // Sheet 21: the diagram's labels, centred where English has them.
    "s21.f18": { left: 26, right: 26 }, "s21.f15": { left: 3, right: 3, down: 9 }, "s21.f14": { left: 3, right: 3, down: 9 }, "s21.f17a": { left: 7, right: 7 },
    // Sheet 24.
    "s24.f29": { left: 10, right: 10 },
  },
};

/** The reviewed layout with an edition's boxes grown. Each grown frame keeps its English box as `englishBox`. */
export function editionSheets(
  locale: string,
  sheets: readonly ReviewedSheet<FrameId>[] = reviewedSheets,
  grown: Readonly<Partial<Record<FrameId, Grow>>> = editionBoxes[locale] ?? {},
): readonly ReviewedSheet<FrameId>[] {
  const known = new Set(sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.id)));
  for (const id of Object.keys(grown)) if (!known.has(id as FrameId)) throw new Error(`${locale}: ${id} is not a reviewed frame`);
  return sheets.map((sheet) => ({
    ...sheet,
    frames: sheet.frames.map((frame) => {
      const { left = 0, right = 0, up = 0, down = 0, skip } = grown[frame.id] ?? {};
      if (left === 0 && right === 0 && up === 0 && down === 0 && skip === undefined) return frame;
      const box = { x: round(frame.box.x - left), y: round(frame.box.y - up), width: round(frame.box.width + left + right), height: round(frame.box.height + up + down) };
      if (box.x < 0 || box.y < 0 || box.x + box.width > sheet.width || box.y + box.height > sheet.height) throw new Error(`${locale}: ${frame.id} grows off sheet ${sheet.sheet}`);
      return { ...frame, box, englishBox: frame.box, ...(skip === undefined ? {} : { skip }) };
    }),
  }));
}
