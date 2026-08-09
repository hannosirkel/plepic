/**
 * The header and footer, checked for the two things a rendering test misses.
 *
 * **1. A mark that is present and invisible.** `design-assets.test.tsx`
 * asserts the footer wordmark carries `alt="Plepic Games"`, and it did — the
 * footer shipped selecting `plepic-wordmark-small-print.svg`, whose
 * letterforms are `#151B46`, on `--surface-sunken`, which on the publisher
 * layer *is* `#151b46`. Contrast 1.00:1. The image element was there, the
 * alt text was there, and a sighted visitor saw three coloured bars and no
 * name. So this file resolves `--surface-sunken` out of `design/tokens.css`
 * for both layers, reads the fill colours out of whichever SVG `SiteFooter`
 * actually names, and measures them.
 *
 * **2. Navigation deleted rather than adapted.** The header shipped with
 * `@media (max-width: 640px) { .link { display: none } }` and no menu, no
 * disclosure and no replacement — three of the four destinations simply gone
 * on a phone. Nothing in the suite could tell "hidden because a sheet holds
 * it" from "hidden because it is gone", so the assertions below require the
 * links to be present in the markup, the sheet to be built from the tokens
 * `design/tokens.css` ships for it, and the disclosure that opens it to
 * exist and be operable without script.
 *
 * The threshold for the mark is 3:1 — WCAG 2.2's non-text contrast bar
 * (1.4.11). A logo is formally exempt from contrast requirements, which is
 * the reason not to demand 4.5:1 of it, and no reason at all to accept 1.00.
 *
 * ---
 *
 * **3. A control the keyboard can reach and the eye cannot.** The sheet that
 * replaced defect 2 shipped two of its own, and neither was visible to any
 * assertion above. The closed sheet was `transform: translateX(100%)` with
 * `visibility: visible`, so all three links still took focus, off-screen, on
 * a phone. And `.navToggle` was visually hidden at *every* width, so on a
 * 1280px desktop a 1x1 checkbox sat in the tab order announcing "Menu,
 * checkbox, not checked", with no focus indicator and nothing to toggle —
 * every rule that would have given it either lives inside the 640px media
 * query.
 *
 * Both are the same underlying rule and it is the one this file was created
 * to defend: **a thing that is not on the screen must not be in the tab
 * order, and a control that does nothing must not be either.** `display:
 * none` failed it by deleting the navigation; an off-screen-but-focusable
 * sheet fails it from the other side. The two checks at the bottom of this
 * file hold the header to it from the stylesheet, which is the only place it
 * is decidable without a layout engine.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FOOTER_WORDMARK_SRC, SiteFooter } from "../src/components/SiteFooter.js";
import { SiteHeader } from "../src/components/SiteHeader.js";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(storefrontDir);
/** Comments stripped, so a selector is always preceded by `}` or the file start. */
const tokensCss = readFileSync(join(repoRoot, "design", "tokens.css"), "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "");
const headerCss = readFileSync(join(storefrontDir, "src", "styles", "site-header.module.css"), "utf8");

type Layer = "publisher" | "lunar";

/**
 * Custom-property declarations from one selector's blocks, later ones
 * overriding earlier ones. A deliberately small reader: `design/tokens.css`
 * is a flat list of `--name: value;` declarations under a handful of
 * selectors, and `design/tokens.test.ts` — which this file may not edit —
 * already holds that file to that shape.
 */
function declarationsFor(selector: string): Map<string, string> {
  const declarations = new Map<string, string>();
  const pattern = new RegExp(`(?:^|\\})\\s*${selector.replaceAll(/[.[\]"^$*+?()|{}\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  for (const block of tokensCss.matchAll(pattern)) {
    for (const line of (block[1] ?? "").split(";")) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;
      const name = line.slice(0, separator).trim();
      if (!name.startsWith("--")) continue;
      declarations.set(name, line.slice(separator + 1).trim());
    }
  }
  return declarations;
}

function resolve(token: string, layer: Layer): string {
  const scope = new Map(declarationsFor(":root"));
  for (const [name, value] of declarationsFor(`[data-layer="${layer}"]`)) scope.set(name, value);

  let value = scope.get(token);
  if (value === undefined) throw new Error(`design/tokens.css declares no ${token}`);
  for (let pass = 0; pass < 10 && value.includes("var("); pass += 1) {
    value = value.replaceAll(/var\((--[\w-]+)\)/g, (whole, reference: string) => scope.get(reference) ?? whole);
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${token} on the ${layer} layer is not a plain hex: ${value}`);
  return value.toLowerCase();
}

function relativeLuminance(hex: string): number {
  const parts = [0, 1, 2].map((index) => {
    const value = Number.parseInt(hex.slice(1 + 2 * index, 3 + 2 * index), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (parts[0] ?? 0) + 0.7152 * (parts[1] ?? 0) + 0.0722 * (parts[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

/** Every distinct `fill="#rrggbb"` in an SVG, lowercased. */
function fillColours(svg: string): readonly string[] {
  return [
    ...new Set(
      [...svg.matchAll(/fill\s*[:=]\s*"?(#[0-9a-fA-F]{6})/g)].map((match) => (match[1] ?? "").toLowerCase()),
    ),
  ].toSorted();
}

const MINIMUM_MARK_CONTRAST = 3;
const LAYERS: readonly Layer[] = ["publisher", "lunar"];

describe("the token reader agrees with design/tokens.css", () => {
  it("resolves --surface-sunken to a dark value on both layers", () => {
    expect(resolve("--surface-sunken", "publisher")).toBe("#151b46");
    expect(resolve("--surface-sunken", "lunar")).toBe("#0d0d3b");
  });

  it("computes the ratio the review measured for the mark that shipped", () => {
    // plepic-wordmark-small-print.svg's letterforms against the publisher
    // layer's footer background: the same colour, twice.
    expect(contrast("#151b46", resolve("--surface-sunken", "publisher"))).toBeCloseTo(1, 5);
  });
});

describe("the footer wordmark is legible on the footer, on both token layers", () => {
  const html = renderToStaticMarkup(<SiteFooter />);
  const src = /<img[^>]*\bsrc="([^"]*)"/.exec(html)?.[1];

  it("renders the mark this module names", () => {
    expect(src).toBe(FOOTER_WORDMARK_SRC);
  });

  it("takes no prop that could make the mark follow the page layer", () => {
    // The footer is dark on both layers, so there is no correct value a
    // caller could pass. Rendering with no props at all is the whole API.
    expect(html).toContain('alt="Plepic Games"');
  });

  for (const layer of LAYERS) {
    it(`every fill in ${FOOTER_WORDMARK_SRC} clears ${MINIMUM_MARK_CONTRAST}:1 on the ${layer} layer`, () => {
      const svg = readFileSync(join(storefrontDir, "public", FOOTER_WORDMARK_SRC), "utf8");
      const background = resolve("--surface-sunken", layer);
      const fills = fillColours(svg);
      expect(fills.length).toBeGreaterThan(0);

      const failing = fills
        .map((fill) => ({ fill, ratio: contrast(fill, background) }))
        .filter((measured) => measured.ratio < MINIMUM_MARK_CONTRAST)
        .map((measured) => `${measured.fill} on ${background} is ${measured.ratio.toFixed(2)}:1`)
        .toSorted();

      expect(
        failing,
        "a wordmark whose letterforms match the surface behind them is present in the DOM, carries its " +
          "alt text, and shows nothing — pick the variant that reads on --surface-sunken, which is dark " +
          "on both layers",
      ).toEqual([]);
    });
  }
});

describe("the mobile header adapts the navigation instead of deleting it", () => {
  const html = renderToStaticMarkup(<SiteHeader wordmark="primary" />);

  it("renders every primary destination in the markup, at every width", () => {
    for (const label of ["Lunar Base", "About", "Support", "Basket"]) {
      expect(html, `${label} is missing from the header markup`).toContain(`>${label}`);
    }
  });

  it("carries a disclosure control that needs no client script", () => {
    const toggleId = /<input[^>]*\bid="([^"]*)"[^>]*type="checkbox"/.exec(html)?.[1];
    expect(toggleId, "no checkbox-based disclosure in the header markup").toBeTruthy();
    expect(html, "the visible Menu affordance must be a <label> for the disclosure").toMatch(
      new RegExp(`<label[^>]*for="${toggleId}"[^>]*>Menu</label>`),
    );
    expect(html).not.toContain("onClick");
  });

  it("gives two headers in one document independent disclosures", () => {
    const both = renderToStaticMarkup(
      <>
        <SiteHeader wordmark="primary" instanceId="one" />
        <SiteHeader wordmark="dark" instanceId="two" />
      </>,
    );
    const ids = [...both.matchAll(/<input[^>]*\bid="([^"]*)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hides no navigation link without a sheet to hold it", () => {
    // The precise defect: `.link { display: none }` at the narrow
    // breakpoint, with nothing that reveals it again.
    const revealsTheSheet = /\.navToggle:checked\s*~\s*\.nav\s*\{[^}]*transform:\s*translateX\(0\)/.test(headerCss);
    const hidesTheLinks = /\.link\s*\{[^}]*display:\s*none/.test(headerCss);
    expect(hidesTheLinks, "the narrow breakpoint must not simply remove .link").toBe(false);
    expect(revealsTheSheet, "the disclosure must actually bring the sheet on screen").toBe(true);
  });

  it("builds the sheet from the tokens design/tokens.css ships for it", () => {
    for (const token of ["--nav-sheet-bg", "--nav-sheet-width", "--nav-scrim"]) {
      expect(headerCss, `${token} is declared in design/tokens.css and nothing consumes it`).toContain(
        `var(${token})`,
      );
    }
  });
});

/**
 * The header stylesheet has exactly one breakpoint, so "wide" and "narrow"
 * are decidable by splitting the file at it. Asserted, not assumed: a second
 * media query would silently move rules out of whichever half this reader
 * thinks they are in, and the two checks below would then be measuring the
 * wrong text.
 */
const BREAKPOINT = "@media (max-width: 640px) {";
const cssWithoutComments = headerCss.replaceAll(/\/\*[\s\S]*?\*\//g, "");
const breakpointAt = cssWithoutComments.indexOf(BREAKPOINT);
const wideCss = breakpointAt === -1 ? cssWithoutComments : cssWithoutComments.slice(0, breakpointAt);
const narrowCss = breakpointAt === -1 ? "" : cssWithoutComments.slice(breakpointAt + BREAKPOINT.length);

/**
 * The declaration block of the first rule whose selector list contains
 * `selector` exactly. Matching the whole selector matters: a substring match
 * for `.nav` also hits `.navToggle:focus-visible + .scrim + .nav`, which is a
 * different rule saying a different thing.
 */
function blockFor(css: string, selector: string): string | undefined {
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (rule[1] ?? "").split(",").map((part) => part.trim()).filter((part) => part.length > 0);
    if (selectors.includes(selector)) return rule[2];
  }
  return undefined;
}

describe("nothing off-screen or inert is left in the tab order", () => {
  it("has exactly one breakpoint, so the two halves below are the whole file", () => {
    expect([...cssWithoutComments.matchAll(/@media/g)].length).toBe(1);
    expect(breakpointAt, `site-header.module.css no longer contains \`${BREAKPOINT}\``).toBeGreaterThan(-1);
  });

  it("takes the closed sheet out of the tab order rather than only sliding it away", () => {
    const closed = blockFor(narrowCss, ".nav");
    expect(closed, "no .nav rule inside the breakpoint").toBeTruthy();
    expect(closed, "the closed sheet must be translated off-screen").toMatch(/transform:\s*translateX\(100%\)/);
    expect(
      closed,
      "a sheet moved off-screen with `transform` alone keeps its links focusable: a keyboard user tabs " +
        "the mobile header and lands on three destinations that are not on the screen (WCAG 2.2 §2.4.7). " +
        "`visibility: hidden` is what removes them; transition it at 0s after the slide so the sheet " +
        "still animates out",
    ).toMatch(/visibility:\s*hidden/);
    expect(closed, "visibility must flip only after the slide finishes, or the sheet vanishes").toMatch(
      /visibility\s+0s\s+\w+\s+var\(--duration-base\)/,
    );
  });

  it("brings the open sheet back into the tab order with no delay", () => {
    const open = blockFor(narrowCss, ".navToggle:checked ~ .nav");
    expect(open, "no `.navToggle:checked ~ .nav` rule inside the breakpoint").toBeTruthy();
    expect(open, "opening the sheet must make it visible again").toMatch(/visibility:\s*visible/);
    expect(open, "the open sheet must not wait out a delay before it can be focused").toMatch(
      /visibility\s+0s\s+\w+\s+0s/,
    );
  });

  it("does not put the disclosure control in the tab order where it has no effect", () => {
    // Above the breakpoint the sheet does not exist: every `:checked ~` rule
    // that would move it, and every focus-visible rule that would indicate
    // it, is inside the media query. A focusable checkbox there is a stop in
    // the tab order that announces itself, shows no ring, and does nothing.
    expect(
      blockFor(wideCss, ".navToggle"),
      "`.navToggle` must be `display: none` outside the breakpoint",
    ).toMatch(/display:\s*none/);
    expect(wideCss, "nothing above the breakpoint may act on the disclosure's checked state").not.toContain(
      ":checked",
    );
    // ...and inside it, it must come back as a real, focusable control.
    const narrow = blockFor(narrowCss, ".navToggle");
    expect(narrow, "no .navToggle rule inside the breakpoint").toBeTruthy();
    expect(narrow, "the disclosure must be visually hidden, not removed, where it does work").not.toMatch(
      /display:\s*none/,
    );
    expect(narrowCss, "the disclosure must carry a focus indicator where it is focusable").toContain(
      ".navToggle:focus-visible",
    );
  });
});
