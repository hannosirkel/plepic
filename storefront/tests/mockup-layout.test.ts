/**
 * Layout invariants the rendering suite cannot see.
 *
 * `design-assets.test.tsx` renders each mockup to static markup and checks
 * what the markup says. That is blind to the defect this file exists for: the
 * homepage hero shipped with `.publisherLine`, `.pitch`, `.differentiator`
 * and `.heroActions` **all** carrying `grid-area: copy` inside a grid whose
 * template was `"copy image"`. Every one of those elements was present, in
 * the right order, with the right text — and a browser painted all four in
 * the same cell, on top of one another, at both breakpoints. Rendered markup
 * was perfect; the page was unreadable.
 *
 * A named grid area is a *cell*, not a column. Two items placed in one named
 * area overlap by definition, so "each named area is claimed by exactly one
 * rule" is not a style preference — it is the property that distinguishes a
 * two-column hero from four paragraphs stacked on a pile. It is checkable
 * from the stylesheet alone, with no layout engine, which is why it is here
 * and not in a screenshot test.
 *
 * ---
 *
 * **The second invariant, added after the third green-suite-broken-page.**
 *
 * The homepage then shipped horizontal overflow: at a 390px viewport the
 * document's `scrollWidth` was 403 and `Subscribe` sat at x=292→403, off the
 * right edge of the phone. The cause was `.field { flex: 1 }` with no
 * `min-width`. A flex item's initial `min-width` is `auto`, which resolves to
 * its **min-content** width, and an `<input>`'s min-content width is its
 * `size` attribute — 211px, measured. That floor beats `flex-shrink`, so the
 * row could not get narrower than the field wanted, and the button went over
 * the side. Adding a `box-sizing` reset changes nothing; `min-width: 0`
 * returns `scrollWidth` to the viewport width exactly.
 *
 * That was the third time this unit's suite was green while the page was
 * visibly broken — after the hero overlap and the invisible wordmark — and
 * every one was found by a human looking at a render.
 *
 * So the check below is deliberately written against the **class**, not the
 * instance. It pins no pixel value and names no element: it says that *any*
 * rule anywhere under `src/styles` that makes an element a growable flex item
 * must also say what its minimum size is. A future cart line, checkout field
 * row, or filter bar that repeats the mistake fails on the rule it wrote, not
 * on a number this file remembered about a newsletter form.
 *
 * **Why static and not a render.** The honest answer is that a real
 * `scrollWidth <= clientWidth` assertion needs a layout engine, and this
 * repository has none: the suite runs in vitest's `node` environment, there
 * is no jsdom or happy-dom in the tree (and jsdom would not help — it does
 * not lay out), and the only browser-driving dependency that would work is a
 * Playwright install this unit has no authority to add. The trade is stated
 * rather than hidden: this check catches the automatic-minimum-size class of
 * overflow, which is the one that shipped, and it does not catch overflow
 * from a fixed width, a long unbreakable string, or a wide table. When a
 * browser-driven harness does arrive — `t2-pages` builds the real routes and
 * the plan already names a Playwright harness as another unit's work — the
 * right move is to add the `scrollWidth <= clientWidth` assertion there at
 * 320, 390 and 1280 and keep this one, because a static check that names the
 * offending selector localises a fault a screenshot only detects.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const stylesDir = join(storefrontDir, "src", "styles");

/**
 * Deliberate overlaps. A design *may* legitimately stack two items in one
 * cell — a caption over an image, a badge over a card — but it has to say so
 * here, by area name and file, so that "these two elements overlap" is a
 * recorded decision rather than the accident it was the first time.
 * Currently empty, and the aim is that it stays that way.
 */
const INTENTIONAL_SHARED_AREAS: readonly { readonly file: string; readonly area: string }[] = [];

function cssFilesUnder(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".module.css"))
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

interface Rule {
  /** The selector text, e.g. `.heroCopy`. */
  readonly selector: string;
  /** Enclosing at-rules, e.g. `@media (max-width: 860px)`, outermost first. */
  readonly context: readonly string[];
  /** The declaration block, without the braces. */
  readonly body: string;
}

/**
 * A small brace-matching CSS reader. Enough for these stylesheets — flat rule
 * sets inside optional at-rules — and deliberately not a general CSS parser:
 * a dependency would have to be justified to the plan's "keep the component
 * surface small" constraint, and a wrong answer here fails loudly rather than
 * silently, because the assertions below name what they found.
 */
function parseRules(css: string, context: readonly string[] = []): readonly Rule[] {
  const rules: Rule[] = [];
  let index = 0;
  let preambleStart = 0;

  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open === -1) break;

    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth += 1;
      else if (css[cursor] === "}") depth -= 1;
      cursor += 1;
    }

    const preamble = css.slice(preambleStart, open).trim();
    const body = css.slice(open + 1, cursor - 1);

    if (preamble.startsWith("@")) {
      rules.push(...parseRules(body, [...context, preamble]));
    } else if (preamble.length > 0) {
      rules.push({ selector: preamble, context, body });
    }

    index = cursor;
    preambleStart = cursor;
  }

  return rules;
}

function stripComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** `grid-area: copy` → `copy`. Shorthand forms (`1 / 2 / 3 / 4`) are not named areas. */
function namedGridArea(body: string): string | undefined {
  const match = /(?:^|[;{\s])grid-area\s*:\s*([^;}]+)/.exec(body);
  if (!match) return undefined;
  const value = (match[1] ?? "").trim();
  if (value.includes("/") || /^\d/.test(value) || value === "auto") return undefined;
  return value;
}

/**
 * One declaration's value, or `undefined`. The leading `[;{\s]` boundary is
 * what keeps `width` from matching inside `min-width` and `flex` from
 * matching inside `flex-grow` or `flex-direction`.
 */
function declaration(body: string, property: string): string | undefined {
  const match = new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`).exec(body);
  return match ? (match[1] ?? "").trim() : undefined;
}

/**
 * The computed `flex-grow` this rule sets, following the shorthand's own
 * defaults: `flex: <number>` sets the grow factor, `flex: auto` is `1 1 auto`,
 * `flex: none` is `0 0 auto`, and `flex: <length>` is `1 1 <length>`.
 */
function flexGrow(body: string): number {
  const longhand = declaration(body, "flex-grow");
  if (longhand !== undefined) return Number.parseFloat(longhand) || 0;

  const shorthand = declaration(body, "flex");
  if (shorthand === undefined) return 0;

  const first = shorthand.split(/\s+/)[0] ?? "";
  if (first === "none" || first === "initial") return 0;
  if (first === "auto") return 1;

  const numeric = Number.parseFloat(first);
  // A unit or a percent means this token is the basis, not the grow factor.
  if (Number.isNaN(numeric) || /[a-z%]/i.test(first)) return 1;
  return numeric;
}

/**
 * True when the rule has said something about its minimum size, so the
 * automatic minimum size no longer floors it at its content.
 *
 * Two forms count. `min-width` set to anything but `auto` replaces the floor
 * with an author-chosen one — `0` removes it, `12rem` is a deliberate,
 * visible number rather than "however wide the widest word happens to be".
 * And per CSS Flexbox §4.5 the automatic minimum size applies only to items
 * whose overflow is `visible`, so an explicit scroll/hidden/clip is also an
 * answer.
 */
function boundsItsOwnMinimumSize(body: string): boolean {
  const minWidth = declaration(body, "min-width");
  if (minWidth !== undefined && minWidth !== "auto") return true;
  const overflow = declaration(body, "overflow");
  return overflow !== undefined && overflow !== "visible";
}

/** Every distinct name appearing in a `grid-template-areas` value. */
function templateAreaNames(body: string): readonly string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(/grid-template-areas\s*:\s*([^;}]+)/g)) {
    for (const quoted of (match[1] ?? "").matchAll(/"([^"]*)"/g)) {
      for (const name of (quoted[1] ?? "").split(/\s+/).filter((part) => part.length > 0 && part !== ".")) {
        names.add(name);
      }
    }
  }
  return [...names];
}

const stylesheets = cssFilesUnder(stylesDir).map((path) => ({
  name: relative(storefrontDir, path),
  rules: parseRules(stripComments(readFileSync(path, "utf8"))),
}));

describe("the stylesheet reader found something to check", () => {
  it("read every CSS module under src/styles, including the mockups", () => {
    const names = stylesheets.map((sheet) => sheet.name);
    expect(names).toContain(join("src", "styles", "mockups", "homepage.module.css"));
    expect(names).toContain(join("src", "styles", "mockups", "lunar-base.module.css"));
    expect(names.length).toBeGreaterThan(5);
  });

  it("parses rules out of an at-rule as well as out of the top level", () => {
    const rules = parseRules(".a { color: red } @media (max-width: 1px) { .b { color: blue } }");
    expect(rules.map((rule) => rule.selector)).toEqual([".a", ".b"]);
    expect(rules[1]?.context).toEqual(["@media (max-width: 1px)"]);
  });

  it("reads a named grid-area and ignores the numeric shorthand", () => {
    expect(namedGridArea("grid-area: copy;")).toBe("copy");
    expect(namedGridArea("grid-area: 1 / 2 / 3 / 4;")).toBeUndefined();
    expect(namedGridArea("color: red;")).toBeUndefined();
  });
});

describe("no two grid items are placed in the same named area", () => {
  for (const sheet of stylesheets) {
    const claimants = new Map<string, Set<string>>();
    for (const rule of sheet.rules) {
      const area = namedGridArea(rule.body);
      if (area === undefined) continue;
      const existing = claimants.get(area) ?? new Set<string>();
      existing.add(rule.selector);
      claimants.set(area, existing);
    }
    if (claimants.size === 0) continue;

    it(`${sheet.name}`, () => {
      const shared = [...claimants]
        .filter(([, selectors]) => selectors.size > 1)
        .filter(
          ([area]) =>
            !INTENTIONAL_SHARED_AREAS.some((entry) => entry.file === sheet.name && entry.area === area),
        )
        .map(([area, selectors]) => `${area}: ${[...selectors].toSorted().join(", ")}`)
        .toSorted();

      expect(
        shared,
        "a named grid area is one cell, so two rules placing different elements into it paint them on " +
          "top of each other — wrap them in a single element that claims the area, give them explicit " +
          "rows, or record the overlap in INTENTIONAL_SHARED_AREAS",
      ).toEqual([]);
    });
  }
});

describe("every area a grid template names is actually occupied", () => {
  for (const sheet of stylesheets) {
    const declared = new Set<string>();
    for (const rule of sheet.rules) for (const name of templateAreaNames(rule.body)) declared.add(name);
    if (declared.size === 0) continue;

    const claimed = new Set(
      sheet.rules.map((rule) => namedGridArea(rule.body)).filter((area): area is string => area !== undefined),
    );

    it(`${sheet.name}`, () => {
      const empty = [...declared].filter((name) => !claimed.has(name)).toSorted();
      expect(empty, "a grid-template-areas name with nothing placed in it is a hole in the layout").toEqual([]);

      const homeless = [...claimed].filter((name) => !declared.has(name)).toSorted();
      expect(homeless, "grid-area names a cell no grid-template-areas in this file declares").toEqual([]);
    });
  }
});

/**
 * Recorded deviations, by file and selector — the same shape, and the same
 * purpose, as `INTENTIONAL_SHARED_AREAS`. A growable flex item that genuinely
 * must not shrink below its content belongs here with a reason, so that
 * "this one overflows on purpose" is a decision somebody wrote down.
 * Currently empty, and the aim is that it stays that way.
 */
const ITEMS_ALLOWED_TO_FLOOR_AT_THEIR_CONTENT: readonly {
  readonly file: string;
  readonly selector: string;
}[] = [];

function itemsFlooredAtTheirContent(
  sheets: readonly { readonly name: string; readonly rules: readonly Rule[] }[],
): readonly string[] {
  return sheets
    .flatMap((sheet) =>
      sheet.rules
        .filter((rule) => flexGrow(rule.body) > 0 && !boundsItsOwnMinimumSize(rule.body))
        .filter(
          (rule) =>
            !ITEMS_ALLOWED_TO_FLOOR_AT_THEIR_CONTENT.some(
              (entry) => entry.file === sheet.name && entry.selector === rule.selector,
            ),
        )
        .map((rule) => `${sheet.name} ${rule.selector}${rule.context.length > 0 ? ` (${rule.context.join(" ")})` : ""}`),
    )
    .toSorted();
}

describe("a growable flex item is never floored at its own content width", () => {
  it("every rule under src/styles that grows also bounds its minimum size", () => {
    expect(
      itemsFlooredAtTheirContent(stylesheets),
      "a flex item's initial `min-width: auto` resolves to its min-content width and outranks " +
        "`flex-shrink`, so this item cannot get narrower than its contents want to be and pushes its " +
        "siblings out of the container — which is how the newsletter Subscribe button left a 390px " +
        "screen. Add `min-width: 0` (or a deliberate `min-width`, or a non-visible `overflow`), or " +
        "record the exception in ITEMS_ALLOWED_TO_FLOOR_AT_THEIR_CONTENT",
    ).toEqual([]);
  });
});

describe("the minimum-size check has teeth", () => {
  const shipped = `.field { flex: 1; padding-inline: 1rem; }`;
  const fixed = `.field { flex: 1 1 12rem; min-width: 0; padding-inline: 1rem; }`;

  function check(css: string): readonly string[] {
    return itemsFlooredAtTheirContent([{ name: "probe.module.css", rules: parseRules(stripComments(css)) }]);
  }

  it("flags the exact shape the newsletter field shipped in", () => {
    expect(check(shipped)).toEqual(["probe.module.css .field"]);
  });

  it("accepts the shape that fixed it", () => {
    expect(check(fixed)).toEqual([]);
  });

  it("reads the flex shorthand's own defaults rather than guessing", () => {
    expect(flexGrow("flex: 1;")).toBe(1);
    expect(flexGrow("flex: 1 1 0;")).toBe(1);
    expect(flexGrow("flex: 2 0 auto;")).toBe(2);
    expect(flexGrow("flex: auto;")).toBe(1);
    expect(flexGrow("flex: 200px;")).toBe(1);
    expect(flexGrow("flex: none;")).toBe(0);
    expect(flexGrow("flex-grow: 3;")).toBe(3);
    expect(flexGrow("flex-direction: column;")).toBe(0);
    expect(flexGrow("display: flex;")).toBe(0);
  });

  it("does not mistake `width` for `min-width`", () => {
    expect(boundsItsOwnMinimumSize("width: 0;")).toBe(false);
    expect(boundsItsOwnMinimumSize("min-width: 0;")).toBe(true);
    expect(boundsItsOwnMinimumSize("min-width: auto;")).toBe(false);
    expect(boundsItsOwnMinimumSize("overflow: hidden;")).toBe(true);
    expect(boundsItsOwnMinimumSize("overflow: visible;")).toBe(false);
  });
});

describe("the layout check has teeth", () => {
  const overlapping = `
    .hero { display: grid; grid-template-areas: "copy image"; }
    .publisherLine { grid-area: copy; }
    .pitch { grid-area: copy; }
    .heroImage { grid-area: image; }
  `;

  it("flags the exact shape the homepage hero shipped in", () => {
    const rules = parseRules(stripComments(overlapping));
    const claimants = new Map<string, string[]>();
    for (const rule of rules) {
      const area = namedGridArea(rule.body);
      if (area === undefined) continue;
      claimants.set(area, [...(claimants.get(area) ?? []), rule.selector]);
    }
    expect(claimants.get("copy")).toEqual([".publisherLine", ".pitch"]);
    expect(claimants.get("image")).toEqual([".heroImage"]);
  });
});
