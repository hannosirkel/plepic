import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fitFrame, fitSizes } from "./fit.js";
import { sourceLeading } from "./leading.js";
import { renderRulebookHtml } from "./template.js";
import type { ReviewedSheet } from "./layout/overrides.js";
import { reviewedSheets } from "./layout/overrides.js";

it("tries English size through 90 percent and respects the 6 pt floor", async () => {
  expect(fitSizes(10)).toEqual([10, 9.9, 9.8, 9.7, 9.6, 9.5, 9.4, 9.3, 9.2, 9.1, 9]);
  expect(fitSizes(6)).toEqual([6]);
  const fit = await fitFrame(10, 13, (size) => size <= 9.5);
  expect(fit).toEqual({ size: 9.5, scale: 95, leading: 12.35, leadingScale: 100 });
  const reducedLeading = await fitFrame(10, 13, (_size, leading) => leading <= 12.35);
  expect(reducedLeading).toEqual({ size: 10, scale: 100, leading: 12.35, leadingScale: 95 });
  await expect(fitFrame(10, 13, () => false)).rejects.toThrow("does not fit");
});

it("uses the published baselines for English line spacing", async () => {
  const source = new URL("../storefront/public/documents/lunar-base-rulebook.pdf", import.meta.url);
  const leading = await sourceLeading(source.pathname, reviewedSheets);
  expect(leading["s10.f04"]).toBe(13);
  expect(leading["s10.f05"]).toBe(13);
});

describe("rulebook template", () => {
  it("sets language, title, sheet geometry, role and frame reading order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rulebook-template-"));
    const asset = join(dir, "art.svg");
    const font = join(dir, "font.otf");
    await writeFile(asset, "<svg xmlns='http://www.w3.org/2000/svg'/>");
    await writeFile(font, "font fixture");
    const sheets = [{ sheet: 1, width: 283.46, height: 283.46, frames: [
      { id: "s01.f01", role: "h1", box: { x: 1, y: 2, width: 80, height: 12 }, fontFamily: "MADE Evolve Sans", fontWeight: 700, fontStyle: "normal", fontSize: 12, color: "#ffffff", alignment: "center" },
      { id: "s01.f02", role: "ul", box: { x: 1, y: 20, width: 80, height: 20 }, fontFamily: "MADE Evolve Sans", fontWeight: 400, fontStyle: "normal", fontSize: 9, color: "#ffffff", alignment: "left", indent: 12 },
    ] }] as unknown as ReviewedSheet[];
    const html = await renderRulebookHtml({ locale: "en", languageTag: "en", title: "Rule Book", sheets: sheets as Parameters<typeof renderRulebookHtml>[0]["sheets"], text: { "s01.f01": "RULE BOOK", "s01.f02": "- One" } as unknown as Parameters<typeof renderRulebookHtml>[0]["text"], underlays: [{ sheet: 1, path: asset, kind: "svg", pixelRatio: 0 }], fonts: [{ name: "MADEEvolveSans-Bold", family: "MADE Evolve Sans", weight: 700, style: "normal", file: font }] });
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Rule Book</title>');
    expect(html).toContain('@page cover{size:283.46pt 283.46pt');
    expect(html).toContain('<h1 class="frame role-h1" id="s01.f01"');
    expect(html).toContain('RULE BOOK</h1>');
    expect(html).toContain('<ul class="frame role-ul" id="s01.f02"');
    expect(html).toContain('<li class="list-item bullet"');
  });
});
