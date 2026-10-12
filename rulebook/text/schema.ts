import type { FrameId } from "../layout/overrides.js";

export type { FrameId };

/**
 * One edition's text: a string for every reviewed frame. The record is
 * total, so an edition that misses a frame, or names one that does not
 * exist, does not compile.
 */
export type RulebookText = Record<FrameId, string>;

/**
 * The markup a frame's text may use. It is deliberately small:
 *
 * | Written | Means |
 * | --- | --- |
 * | `**words**` | bold |
 * | `_words_` | italic |
 * | a blank line | a new paragraph |
 * | a line starting `1. ` (any number) | a numbered list item |
 * | a line starting `- ` | a bullet list item |
 * | a line break | a line break inside the paragraph or item |
 * | `{s09.f11a}` | the frame with that id is set here, inside the line |
 * | `\*`, `\_`, `\{`, `\\` | that character itself |
 *
 * A single `*` is an ordinary character. Emphasis may run over a line break
 * but must close before its paragraph or item ends.
 */
export type Run = { text: string; bold: boolean; italic: boolean } | { anchor: string };
export type Block =
  | { kind: "paragraph" | "bullet"; lines: Run[][] }
  | { kind: "numbered"; number: number; lines: Run[][] };

const anchorPattern = /^s\d\d\.f\d\d[a-z]?$/;

function parseInline(lines: readonly string[]): Run[][] {
  let bold = false;
  let italic = false;
  let boldIsEmpty = false;
  let italicIsEmpty = false;
  const parsed = lines.map((line) => {
    const runs: Run[] = [];
    let text = "";
    const flush = () => {
      if (!text) return;
      runs.push({ text, bold, italic });
      text = "";
      boldIsEmpty = false;
      italicIsEmpty = false;
    };
    for (let index = 0; index < line.length; index += 1) {
      const char = line.charAt(index);
      const next = line.charAt(index + 1);
      if (char === "\\") {
        if (!next || !"\\*_{".includes(next)) throw new Error(`"\\" must be followed by one of \\ * _ {: ${line}`);
        text += next;
        index += 1;
      } else if (char === "*" && next === "*") {
        flush();
        if (bold && boldIsEmpty) throw new Error(`Empty bold: ${line}`);
        bold = !bold;
        boldIsEmpty = bold;
        index += 1;
      } else if (char === "_") {
        flush();
        if (italic && italicIsEmpty) throw new Error(`Empty italic: ${line}`);
        italic = !italic;
        italicIsEmpty = italic;
      } else if (char === "{") {
        const end = line.indexOf("}", index);
        const anchor = end < 0 ? "" : line.slice(index + 1, end);
        if (!anchorPattern.test(anchor)) throw new Error(`"{" must open a frame id such as {s09.f11a}: ${line}`);
        flush();
        runs.push({ anchor });
        boldIsEmpty = false;
        italicIsEmpty = false;
        index = end;
      } else {
        text += char;
      }
    }
    flush();
    return runs;
  });
  if (bold || italic) throw new Error(`Unclosed ${bold ? "**" : "_"}: ${lines.join(" / ")}`);
  return parsed;
}

/** Parses a frame's text, and throws on anything outside the markup above. */
export function parseMarkup(source: string): Block[] {
  if (!source) throw new Error("A frame's text cannot be empty");
  const blocks: { kind: Block["kind"]; number: number; lines: string[] }[] = [];
  let open = false;
  for (const line of source.split("\n")) {
    if (line === "") {
      if (!open) throw new Error(`A blank line must follow text and come alone: ${JSON.stringify(source)}`);
      open = false;
      continue;
    }
    if (line !== line.trim()) throw new Error(`A line cannot start or end with a space: ${JSON.stringify(line)}`);
    const numbered = /^(\d+)\. (.+)$/.exec(line);
    const bullet = /^- (.+)$/.exec(line);
    const current = blocks.at(-1);
    if (numbered) {
      blocks.push({ kind: "numbered", number: Number(numbered[1]), lines: [numbered[2] ?? ""] });
    } else if (bullet) {
      blocks.push({ kind: "bullet", number: 0, lines: [bullet[1] ?? ""] });
    } else if (open && current) {
      current.lines.push(line);
    } else {
      blocks.push({ kind: "paragraph", number: 0, lines: [line] });
    }
    open = true;
  }
  if (!open) throw new Error(`A frame's text cannot end with a blank line: ${JSON.stringify(source)}`);
  return blocks.map((block): Block => {
    const lines = parseInline(block.lines);
    return block.kind === "numbered" ? { kind: "numbered", number: block.number, lines } : { kind: block.kind, lines };
  });
}

/**
 * The text a reader sees, without the markup: list numbers and bullets as
 * printed, and nothing where another frame is anchored.
 */
export function plainText(source: string): string {
  return parseMarkup(source)
    .map((block) => {
      const lead = block.kind === "numbered" ? `${block.number}. ` : block.kind === "bullet" ? "• " : "";
      return lead + block.lines.map((line) => line.map((run) => ("text" in run ? run.text : "")).join("")).join("\n");
    })
    .join("\n");
}
