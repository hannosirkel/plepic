import { readFile } from "node:fs/promises";
import type { FontSpec } from "./fonts.js";
import { frameFont } from "./fonts.js";
import type { ReviewedSheet, FrameId } from "./layout/overrides.js";
import type { RulebookText, Run, Block } from "./text/schema.js";
import { parseMarkup } from "./text/schema.js";
import type { Underlay } from "./underlay.js";

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The frame anchored in a line stays where English has it, on its drawn
 * circle. The line is kept clear by an empty box as wide as that circle,
 * which the build moves to where the frame stands once the line is set.
 */
function renderRun(run: Run, room: (id: string) => string): string {
  if ("anchor" in run) return `<span class="anchor" data-frame="${run.anchor}" ${room(run.anchor)}></span>`;
  let html = escape(run.text);
  if (run.bold) html = `<strong>${html}</strong>`;
  if (run.italic) html = `<em>${html}</em>`;
  return html;
}

function renderBlock(block: Block, room: (id: string) => string, inList = false): string {
  const body = block.lines.map((line) => line.map((run) => renderRun(run, room)).join("")).join("<br>");
  if (block.kind === "bullet") return `<li class="list-item bullet"><span aria-hidden="true">•</span>${body}</li>`;
  if (block.kind === "numbered") return `<li class="list-item numbered"><span aria-hidden="true">${block.number}.</span>${body}</li>`;
  if (inList) return `<li>${body}</li>`;
  return `<p>${body}</p>`;
}

const roleTag: Record<string, string> = { h1: "h1", h2: "h2", p: "div", ol: "ol", ul: "ul", caption: "figcaption", "page-number": "span", label: "span" };

export async function renderRulebookHtml(input: {
  locale: string;
  languageTag: string;
  title: string;
  sheets: readonly ReviewedSheet<FrameId>[];
  text: RulebookText;
  underlays: readonly Underlay[];
  fonts: readonly FontSpec[];
}): Promise<string> {
  const faces = await Promise.all(input.fonts.map(async (font) => {
    const data = await readFile(font.file);
    const format = font.file.endsWith(".otf") ? "opentype" : "woff2";
    const mime = font.file.endsWith(".otf") ? "font/otf" : "font/woff2";
    return `@font-face{font-family:'${font.name}';src:url(data:${mime};base64,${data.toString("base64")}) format('${format}');font-weight:400;font-style:normal}`;
  }));
  const pages = await Promise.all(input.sheets.map(async (sheet) => {
    const underlay = input.underlays.find((item) => item.sheet === sheet.sheet);
    if (!underlay) throw new Error(`Sheet ${sheet.sheet} has no underlay`);
    const bytes = await readFile(underlay.path);
    const mime = underlay.kind === "svg" ? "image/svg+xml" : "image/jpeg";
    const frames = sheet.frames.map((frame) => {
      const source = input.text[frame.id];
      if (source === undefined) throw new Error(`Missing ${input.locale} text for ${frame.id}`);
      const tag = roleTag[frame.role];
      if (!tag) throw new Error(`Unknown role ${frame.role}`);
      const name = frameFont(frame.fontFamily, frame.fontWeight, frame.fontStyle);
      const boldName = frameFont(frame.fontFamily, 700, frame.fontStyle);
      const room = (id: string) => {
        const label = sheet.frames.find((candidate) => candidate.id === id);
        if (label?.room === undefined) throw new Error(`${frame.id} anchors ${id}, which is not a frame of sheet ${sheet.sheet} with room`);
        // Only the room inside the frame's box takes room in its line: a label closing a line stands past the box, and half a point is kept against rounding.
        const inside = frame.box.x + frame.box.width - (label.box.x + (label.box.width - label.room) / 2) - 0.5;
        return `data-room="${label.room}" style="width:${Math.round(Math.min(Math.max(inside, 0), label.room) * 100) / 100}pt"`;
      };
      const style = `--bold-font:'${boldName}';left:${frame.box.x}pt;top:${frame.box.y}pt;width:${frame.box.width}pt;height:${frame.box.height}pt;color:${frame.color};font-family:'${name}';font-size:${frame.fontSize}pt;text-align:${frame.alignment};${frame.indent === undefined ? "" : `--indent:${frame.indent}pt;`}`;
      let blocks = parseMarkup(source).map((block) => renderBlock(block, room, tag === "ol" || tag === "ul")).join("");
      if (tag === "h1" || tag === "h2") blocks = blocks.replace(/<\/?p>/g, "");
      return `<${tag} class="frame role-${frame.role}${frame.role === "label" && frame.box.height <= frame.fontSize * 1.3 ? " nowrap" : ""}" id="${frame.id}" data-size="${frame.fontSize}" style="${style}">${blocks}</${tag}>`;
    }).join("\n");
    const page = sheet.width === sheet.height ? "cover" : "spread";
    return `<section class="sheet ${page}" aria-label="Sheet ${sheet.sheet}" style="width:${sheet.width}pt;height:${sheet.height}pt;background-image:url(data:${mime};base64,${bytes.toString("base64")})">${frames}</section>`;
  }));
  return `<!doctype html><html lang="${escape(input.languageTag)}"><head><meta charset="utf-8"><title>${escape(input.title)}</title><style>
${faces.join("\n")}
@page cover{size:283.46pt 283.46pt;margin:0}
@page spread{size:566.93pt 283.46pt;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0}body{color:#15244d}
.sheet{position:relative;background-size:100% 100%;background-repeat:no-repeat;break-after:page;overflow:hidden}.sheet.cover{page:cover}.sheet.spread{page:spread}.sheet:last-child{break-after:auto}
.frame{position:absolute;display:block;overflow:visible;white-space:normal;line-height:1.25;margin:0;padding:0;font-synthesis:none;text-rendering:geometricPrecision}
.frame p,.frame div,.frame li{margin:0;padding:0}.frame p:not(:last-child),.frame li:not(:last-child){margin-bottom:.25em}.frame.role-ul,.frame.role-ol{list-style:none;margin:0;padding:0}.frame.nowrap,.role-page-number{white-space:nowrap}.anchor{display:inline-block}.frame strong{font-family:var(--bold-font);font-weight:normal}.frame em{font-style:italic}
.list-item{position:relative;padding-left:var(--indent,12pt)!important}.list-item span{position:absolute;left:0}.bullet span{font-family:'JosefinSans-Bold'}
</style></head><body>${pages.join("\n")}</body></html>`;
}
