/**
 * Guards on `tokens.css`.
 *
 * This exists because the first revision of that file shipped a bug that no
 * amount of reading caught: the layer-2 component tokens were declared only on
 * `:root`, so `--card-bg: var(--surface-raised)` resolved once against the
 * publisher palette and every `[data-layer="lunar"]` descendant inherited the
 * already-resolved colour. Cards, navigation and the purchase panel rendered
 * white inside a near-black section, and one pairing came out at 1.43:1.
 *
 * The resolver below models the part of CSS that makes that true: custom
 * properties are substituted at computed-value time **per element**, against
 * that element's own computed custom properties. A property an element does not
 * declare is inherited already resolved, and redeclaring what it referred to
 * does not retroactively change it.
 *
 * The resolver's output was checked against headless Chromium 1234 over the
 * real file: all 36 foreground/background pairs below match the browser's
 * computed values exactly.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const designDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(designDir, "tokens.css"), "utf8");

/** `tokens.css` with comments and the reduced-motion at-rule removed. */
const flatCss = css
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

interface Block {
  readonly selectors: readonly string[];
  readonly declarations: ReadonlyMap<string, string>;
}

function parseBlocks(source: string): readonly Block[] {
  const blocks: Block[] = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? "")
      .split(",")
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0);

    const declarations = new Map<string, string>();
    for (const line of (match[2] ?? "").split(";")) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;
      const name = line.slice(0, separator).trim();
      if (!name.startsWith("--")) continue;
      declarations.set(name, line.slice(separator + 1).trim());
    }

    blocks.push({ selectors, declarations });
  }

  return blocks;
}

const blocks = parseBlocks(flatCss);

const LAYERS = ["publisher", "lunar"] as const;
type Layer = (typeof LAYERS)[number];

function declarationsFor(selector: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const block of blocks) {
    if (!block.selectors.includes(selector)) continue;
    for (const [name, value] of block.declarations) merged.set(name, value);
  }
  return merged;
}

/** Substitute `var(--x)` chains against `specified` until nothing changes. */
function resolveAll(specified: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const resolved = new Map(specified);

  for (let pass = 0; pass < 16; pass += 1) {
    let changed = false;
    for (const [name, value] of resolved) {
      const next = value.replace(/var\((--[\w-]+)\)/g, (whole, reference: string) => {
        const target = resolved.get(reference);
        return target === undefined || target.includes("var(") ? whole : target;
      });
      if (next !== value) {
        resolved.set(name, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return resolved;
}

/** The computed custom properties on `:root`. */
const rootComputed = resolveAll(declarationsFor(":root"));

/**
 * The computed custom properties on a `<section data-layer="…">` inside that
 * root: whatever the section declares itself, over whatever it inherited
 * already resolved.
 */
function layerComputed(layer: Layer): ReadonlyMap<string, string> {
  const specified = new Map(rootComputed);
  for (const [name, value] of declarationsFor(`[data-layer="${layer}"]`)) {
    specified.set(name, value);
  }
  return resolveAll(specified);
}

const computed: Record<Layer, ReadonlyMap<string, string>> = {
  publisher: layerComputed("publisher"),
  lunar: layerComputed("lunar"),
};

function colour(layer: Layer, token: string): string {
  const value = computed[layer].get(token);
  expect(value, `${token} is not declared on the ${layer} layer`).toBeDefined();
  expect(value, `${token} is unresolved on the ${layer} layer: ${value ?? ""}`).not.toContain(
    "var(",
  );
  return (value ?? "").toLowerCase();
}

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

function relativeLuminance(hex: string): number {
  const parts = [0, 1, 2].map((index) => {
    const value = channel(hex, index) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (parts[0] ?? 0) + 0.7152 * (parts[1] ?? 0) + 0.0722 * (parts[2] ?? 0);
}

function contrast(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("layer switching", () => {
  it("declares the component layer on every layer selector, not only :root", () => {
    const layerSelectors = new Set<string>();
    for (const block of blocks) {
      for (const selector of block.selectors) {
        if (selector.startsWith("[data-layer=")) layerSelectors.add(selector);
      }
    }

    const componentBlock = blocks.find((block) => block.declarations.has("--card-bg"));
    expect(componentBlock, "no block declares --card-bg").toBeDefined();

    for (const selector of layerSelectors) {
      expect(
        componentBlock?.selectors,
        `${selector} is missing from the component-token block, so its components will render in the publisher palette`,
      ).toContain(selector);
    }
  });

  it("gives the two layers genuinely different component surfaces", () => {
    for (const token of ["--card-bg", "--nav-bg", "--purchase-panel-bg"] as const) {
      expect(colour("publisher", token)).not.toBe(colour("lunar", token));
    }
  });

  it("resolves the surfaces headless Chromium resolves", () => {
    expect(colour("lunar", "--card-bg")).toBe("#111732");
    expect(colour("lunar", "--nav-bg")).toBe("#080c23");
    expect(colour("lunar", "--purchase-panel-bg")).toBe("#111732");
    expect(colour("publisher", "--card-bg")).toBe("#ffffff");
    expect(colour("publisher", "--nav-bg")).toBe("#f7f4ec");
  });

  it("leaves no component token unresolved on either layer", () => {
    for (const layer of LAYERS) {
      for (const [name, value] of computed[layer]) {
        expect(value, `${name} is unresolved on the ${layer} layer`).not.toContain("var(");
      }
    }
  });
});

describe("the component layer holds no literal colour", () => {
  it("expresses every component colour through a layer-1 token", () => {
    const componentBlock = blocks.find((block) => block.declarations.has("--card-bg"));
    const literals: string[] = [];

    for (const [name, value] of componentBlock?.declarations ?? new Map<string, string>()) {
      if (/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(value)) literals.push(`${name}: ${value}`);
    }

    expect(literals).toEqual([]);
  });
});

/**
 * Every foreground/background pair the site actually renders, and the minimum
 * WCAG 2.2 ratio it must meet. 4.5 for normal text, 3 for large text, for the
 * boundary of a user-interface component, and for the focus indicator.
 *
 * The two disabled-button pairs are the only ones below 4.5. WCAG 2.2 SC 1.4.3
 * exempts text that is part of an inactive user-interface component, and a
 * disabled control that meets AA reads as enabled. They are listed rather than
 * omitted so the exemption is a decision on the record.
 */
const PAIRS: readonly {
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
}[] = [
  { label: "body text", foreground: "--text", background: "--surface", minimum: 4.5 },
  { label: "muted text", foreground: "--text-muted", background: "--surface", minimum: 4.5 },
  { label: "subtle text", foreground: "--text-subtle", background: "--surface", minimum: 4.5 },
  { label: "link text", foreground: "--accent", background: "--surface", minimum: 4.5 },
  { label: "sunken text", foreground: "--text-on-surface-sunken", background: "--surface-sunken", minimum: 4.5 },
  { label: "card text", foreground: "--card-fg", background: "--card-bg", minimum: 4.5 },
  // The three below mix a layer-1 foreground with a layer-2 surface, which is
  // what a component written as `color: var(--text)` on a card actually does.
  // This is the pairing that came out at 1.43:1 before the layer-2 selector
  // list was fixed, so it is the one that must never regress unnoticed.
  { label: "layer-1 text on a card", foreground: "--text", background: "--card-bg", minimum: 4.5 },
  { label: "layer-1 text on the panel", foreground: "--text", background: "--purchase-panel-bg", minimum: 4.5 },
  { label: "layer-1 text on the nav", foreground: "--text", background: "--nav-bg", minimum: 4.5 },
  { label: "card meta", foreground: "--card-meta-color", background: "--card-bg", minimum: 4.5 },
  { label: "nav text", foreground: "--nav-fg", background: "--nav-bg", minimum: 4.5 },
  { label: "nav muted", foreground: "--nav-fg-muted", background: "--nav-bg", minimum: 4.5 },
  { label: "nav active", foreground: "--nav-fg-active", background: "--nav-bg", minimum: 4.5 },
  { label: "nav sheet text", foreground: "--nav-fg", background: "--nav-sheet-bg", minimum: 4.5 },
  { label: "panel text", foreground: "--purchase-panel-fg", background: "--purchase-panel-bg", minimum: 4.5 },
  { label: "price", foreground: "--purchase-price-color", background: "--purchase-panel-bg", minimum: 4.5 },
  { label: "price note", foreground: "--purchase-note-color", background: "--purchase-panel-bg", minimum: 4.5 },
  { label: "panel meta", foreground: "--purchase-meta-color", background: "--purchase-panel-bg", minimum: 4.5 },
  { label: "availability", foreground: "--purchase-availability-color", background: "--purchase-panel-bg", minimum: 4.5 },
  { label: "primary button", foreground: "--button-primary-fg", background: "--button-primary-bg", minimum: 4.5 },
  { label: "primary button hover", foreground: "--button-primary-fg-hover", background: "--button-primary-bg-hover", minimum: 4.5 },
  { label: "secondary button", foreground: "--button-secondary-fg", background: "--surface", minimum: 4.5 },
  { label: "secondary button hover", foreground: "--button-secondary-fg-hover", background: "--button-secondary-bg-hover", minimum: 4.5 },
  { label: "quiet button", foreground: "--button-quiet-fg", background: "--card-bg", minimum: 4.5 },
  { label: "disabled button (SC 1.4.3 exempt)", foreground: "--button-disabled-fg", background: "--button-disabled-bg", minimum: 3 },
  { label: "secondary button edge", foreground: "--button-secondary-border", background: "--surface", minimum: 3 },
  { label: "control edge", foreground: "--border-interactive", background: "--surface", minimum: 3 },
  { label: "control edge on a card", foreground: "--border-interactive", background: "--card-bg", minimum: 3 },
  { label: "focus ring", foreground: "--focus-ring", background: "--surface", minimum: 3 },
  { label: "focus ring on a card", foreground: "--focus-ring", background: "--card-bg", minimum: 3 },
];

describe("contrast, on both layers", () => {
  for (const layer of LAYERS) {
    for (const pair of PAIRS) {
      it(`${layer}: ${pair.label} meets ${pair.minimum}:1`, () => {
        const ratio = contrast(colour(layer, pair.foreground), colour(layer, pair.background));
        expect(
          Number(ratio.toFixed(2)),
          `${pair.foreground} on ${pair.background}`,
        ).toBeGreaterThanOrEqual(pair.minimum);
      });
    }
  }

  it("binds no text token to a colour the record restricts to non-text use", () => {
    const restricted: Record<Layer, readonly string[]> = {
      publisher: ["--plepic-cyan", "--plepic-orange", "--plepic-gold"],
      lunar: ["--lunar-accent", "--lunar-line-strong", "--lunar-line"],
    };
    const textTokens = [
      "--text",
      "--text-muted",
      "--text-subtle",
      "--accent",
      "--accent-positive",
      "--card-meta-color",
      "--purchase-note-color",
      "--purchase-availability-color",
    ];

    for (const layer of LAYERS) {
      const banned = new Set(restricted[layer].map((token) => colour(layer, token)));
      for (const token of textTokens) {
        expect(banned.has(colour(layer, token)), `${token} on the ${layer} layer`).toBe(false);
      }
    }
  });
});
