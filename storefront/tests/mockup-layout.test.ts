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
 *
 * Widened for t2-pages, which carried three gaps in this file forward from
 * review, all the same shape as the overflow this file already catches (an
 * item floored at a size nobody chose), just missed by scope:
 *
 * 1. The scan covered src/styles only. A stylesheet co-located beside its
 *    component escaped every check here entirely. cssFilesUnder now walks
 *    the whole of src/, not one directory under it.
 * 2. The flex check only looked at a rule that itself declared flex or
 *    flex-grow. purchase-panel.module.css's .metaRow dt / .metaRow dd are
 *    flex items purely by inheritance from their parent's display: flex,
 *    and CSS Flexbox's automatic minimum size applies to every flex item
 *    regardless of its own flex-grow/flex-shrink, not only the ones a rule
 *    happens to say so about. itemsFlooredAtTheirContent now also treats a
 *    rule as an at-risk flex item when a sibling rule in the same file
 *    declares its immediate ancestor selector display: flex (or
 *    inline-flex), whether or not this rule mentions flex at all.
 * 3. Grid items were missed entirely. A bare 1fr grid-template-columns track
 *    (as opposed to minmax(0, 1fr) or minmax(<length>, 1fr)) implicitly
 *    floors at minmax(auto, 1fr) - the same automatic-minimum-size defect
 *    under a different property name. bareFrGridTracks flags a
 *    grid-template-columns value carrying an un-minmax'd <number>fr token.
 *
 * Widened again after the t2-pages review, which found every review card
 * overflowing its grid cell by exactly 50px at all three widths, with card 1
 * painting 26px outside its own card and under card 5's top edge on
 * /games/lunar-base. review-composite.module.css's .figure set height: 100%
 * alongside padding and a border under the default content-box sizing, so
 * two paddings and two borders were added on top of the full cell height.
 * This repository has no global box-sizing reset by deliberate choice, and
 * the README claimed "every element like this now sets box-sizing:
 * border-box explicitly" - a claim nothing enforced and which was false when
 * written. percentageSizedWithoutBorderBox makes it true: any rule combining
 * a percentage width/height with padding or a border must say which box it
 * means.
 *
 * ## What this file still cannot see, and what a browser harness must do
 *
 * src/styles/global.css sets overflow-x: hidden on html and body, for a
 * documented and defensible reason (a fixed, translated navigation sheet
 * widening the root scroll width). One consequence is permanent and belongs
 * written down here: document.documentElement.scrollWidth <= clientWidth can
 * never fail again on this site, whatever overflows. It is not a horizontal
 * overflow detector any more. A browser-driven harness must compare
 * per-element getBoundingClientRect() against the viewport (and against each
 * element's own container) instead. The 50px card overflow above is the
 * concrete case: the root scroll width was clean at every width while five
 * cards each hung 50px out of their cells.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
/**
 * Everything under src/, not just src/styles: a .module.css co-located
 * beside its component (src/components/cart/Cart.module.css, say) is just as
 * capable of shipping the overflow this file exists to catch, and a scan
 * scoped to one directory is exactly the kind of guard a new location
 * disappears from silently.
 */
const scanDir = join(storefrontDir, "src");

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

/**
 * True when the rule sets `flex-shrink: 0` (longhand, or the `flex`
 * shorthand's second number, or `flex: none`).
 *
 * The automatic minimum size (CSS Flexbox §4.5) is specifically the floor on
 * how far an item may *shrink* — it plays no part at all in an item that
 * never shrinks. So a `flex-shrink: 0` item cannot exhibit this file's
 * overflow defect regardless of its `min-width`, and flagging one anyway
 * would be exactly the wrong kind of strictness: it would push authors to
 * add a meaningless `min-width: 0` to satisfy the check rather than to fix
 * anything, and `purchase-panel.module.css`'s `.metaRow dt` is the concrete
 * case that found this — the *label* half of a term/detail row must never
 * shrink (or it wraps into illegibility, a real and worse defect this
 * widened check caused while chasing the overflow one), while the *detail*
 * half is exactly the one that should grow, shrink and wrap.
 *
 * **The residue this exemption leaves, recorded rather than papered over.** A
 * `flex-shrink: 0` item cannot exhibit the *automatic-minimum-size* defect,
 * which is what this file checks — but it can still overflow its container
 * the ordinary way, by being wider than the space available and refusing to
 * shrink. `.metaRow dt` is safe today because its content is a fixed set of
 * one-word labels from `content/lunar-base.ts` ("Availability", "Dispatch",
 * "Duties"). It would not be safe if a future row's label were user- or
 * catalogue-supplied prose. Narrowing the exemption to "flex-shrink: 0 *and*
 * a bounded flex-basis" was considered and rejected: `flex: 0 0 auto` is the
 * correct and idiomatic spelling for a label that must not shrink, and
 * flagging it would push authors to write a meaningless `min-width` to
 * silence the check — the same wrong-kind-of-strictness this exemption was
 * added to undo. A long-content overflow needs a layout engine to detect;
 * this file states in its own header that it has none.
 */
function hasZeroFlexShrink(body: string): boolean {
  const longhand = declaration(body, "flex-shrink");
  if (longhand !== undefined) return Number.parseFloat(longhand) === 0;

  const shorthand = declaration(body, "flex");
  if (shorthand === undefined) return false;
  if (shorthand.trim() === "none") return true;

  const parts = shorthand.split(/\s+/);
  // `flex: <grow> <shrink> ...` — shrink is the second token only when the
  // first token was itself the grow factor (a bare number), not a basis.
  if (parts.length >= 2 && /^\d+(\.\d+)?$/.test(parts[0] ?? "") && /^\d+(\.\d+)?$/.test(parts[1] ?? "")) {
    return Number.parseFloat(parts[1] ?? "") === 0;
  }
  return false;
}

/** True when this rule's own body makes it a flex container. */
function isFlexContainer(body: string): boolean {
  const display = declaration(body, "display");
  return display === "flex" || display === "inline-flex";
}

/**
 * The immediate ancestor selector text for a descendant-combinator selector
 * such as `.metaRow dt` (→ `.metaRow`), or `undefined` for a selector with no
 * ancestor (`.metaRow` itself). A trailing child/sibling combinator
 * (`.metaRow > dt`) is stripped from the ancestor half so it still matches
 * `.metaRow`'s own rule.
 */
function immediateAncestorSelector(selector: string): string | undefined {
  const tokens = selector.trim().split(/\s+/);
  if (tokens.length < 2) return undefined;
  return tokens
    .slice(0, -1)
    .join(" ")
    .replace(/[>~+]\s*$/, "")
    .trim();
}

/**
 * True when a sibling rule in `sheetRules` declares `selector` (or names it
 * among a comma-separated selector list) as a flex container. This is how
 * `.metaRow dt` is recognised as a flex item even though it declares no
 * `flex` property of its own — its parent, `.metaRow`, is `display: flex`,
 * and CSS Flexbox's automatic minimum size applies to every flex item, not
 * only the ones that opted into growing or shrinking explicitly.
 *
 * **Recorded residue.** This matches an ancestor only by *exact selector
 * text within the same stylesheet*. Three shapes therefore still escape it,
 * and no static reader that does not resolve CSS Modules composition can
 * close them:
 *
 * 1. a flex container declared in one module and its child styled in
 *    another (a component composing `styles.row` from a shared sheet);
 * 2. an ancestor written differently from the child's prefix — `.a .b c`
 *    against a container rule spelled `.a > .b`, or a container reached
 *    through more than one level;
 * 3. a flex container created in an inline `style` or by a UA default.
 *
 * The shapes this repository actually ships are all case-zero — parent and
 * child in the same file, spelled the same way — which is why the check is
 * worth having as written. It is a floor, not a proof.
 */
function hasFlexContainerAncestor(selector: string, sheetRules: readonly Rule[]): boolean {
  const ancestor = immediateAncestorSelector(selector);
  if (ancestor === undefined || ancestor.length === 0) return false;
  return sheetRules.some(
    (candidate) =>
      isFlexContainer(candidate.body) &&
      candidate.selector
        .split(",")
        .map((part) => part.trim())
        .includes(ancestor),
  );
}

/**
 * Splits a declaration value into its top-level, whitespace-separated
 * tokens, respecting parenthesis nesting — so `minmax(14rem, 1fr)` and
 * `repeat(auto-fit, minmax(14rem, 1fr))` are each read as one token, not
 * split on the comma or space inside them.
 */
function topLevelTokens(value: string): readonly string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (/\s/.test(char) && depth === 0) {
      if (current.length > 0) tokens.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

/**
 * Bare `<number>fr` tracks in a `grid-template-columns` declaration that
 * carries **more than one track** — the grid equivalent of the flex-sibling
 * squeeze this file already catches. A track written as plain `1fr` is
 * shorthand for `minmax(auto, 1fr)`, so it floors at its content's
 * min-content size exactly like an unbounded flex item; wrapping it as
 * `minmax(0, 1fr)` (or any explicit `minmax(<length>, 1fr)`) chooses the
 * floor instead of inheriting one. Because `topLevelTokens` treats a whole
 * `minmax(...)` or `repeat(...)` call as one token, a bare `fr` token can
 * only survive here when it was never wrapped at all.
 *
 * **Single-track `grid-template-columns: 1fr` is deliberately not flagged.**
 * With exactly one track there is no sibling for it to be squeezed against —
 * the track simply fills the row, the same as `width: 100%` — which is
 * exactly the shape both mockups' narrow-breakpoint `.hero` collapses to and
 * `TeamPhotoSection`'s stacked layout uses. Flagging that would be a false
 * positive for the single commonest responsive pattern in this codebase, for
 * a class of overflow (a track wider than its content demands) this
 * automatic-minimum-size check is not about. The risk this function exists
 * for only exists once two or more tracks are sharing a row.
 *
 * **Residue, recorded rather than claimed fixed.** `repeat(5, 1fr)` is one
 * token to `topLevelTokens`, so a bare `fr` inside a `repeat()` is not seen
 * here. `feature-spec-strip.module.css`'s `.strip` ships exactly that shape
 * and is correct in practice (five equal columns of short, unbreakable
 * labels), but the check does not prove it — it does not reach inside the
 * call.
 */
function bareFrTracks(body: string): readonly string[] {
  const value = declaration(body, "grid-template-columns");
  if (value === undefined) return [];
  const tracks = topLevelTokens(value);
  if (tracks.length < 2) return [];
  return tracks.filter((token) => /^\d*\.?\d+fr$/.test(token));
}

/**
 * True when this rule sizes itself as a percentage of its container — the
 * only case where "does padding count inside or outside?" changes the
 * result. A fixed length plus padding is a deliberate sum; `100%` plus
 * padding is a promise the box cannot keep under `content-box`.
 */
function hasPercentageSize(body: string): boolean {
  for (const property of ["width", "height", "max-width", "max-height"]) {
    const value = declaration(body, property);
    if (value !== undefined && value.includes("%")) return true;
  }
  return false;
}

const BOX_EXTENT_DECLARATION =
  /(?:^|[;{\s])(?:padding|border)(?:-(?:block|inline|top|right|bottom|left)(?:-(?:start|end))?)?(?:-width)?\s*:\s*([^;}]+)/g;

/** Every length token in the value is zero, so the declaration adds no extent. */
const ALL_ZERO_LENGTHS = /^(?:0(?:[a-z]+|%)?[\s,]*)+$/i;

/**
 * True when this rule adds padding or a border **width** to its own box.
 *
 * The value matters, not just the property: `border: 0` and `padding: 0` add
 * nothing, and flagging them would have made `video-embed.module.css`'s
 * `.iframe` — `width: 100%; height: 100%; border: 0`, which is exactly right
 * — into a false positive that teaches authors to ignore this check.
 * `border-radius` and `box-shadow` are not matched at all: neither changes
 * the box's extent.
 */
function addsPaddingOrBorder(body: string): boolean {
  for (const match of body.matchAll(BOX_EXTENT_DECLARATION)) {
    const value = (match[1] ?? "").trim();
    if (value === "none" || ALL_ZERO_LENGTHS.test(value)) continue;
    return true;
  }
  return false;
}

/**
 * Rules that size themselves by percentage *and* add padding or a border
 * without saying which box the percentage refers to. Under this repository's
 * deliberate no-global-reset policy the answer is `content-box`, so the
 * padding and border are added on top — 50px per card, in the case that
 * found this.
 */
function percentageSizedWithoutBorderBox(
  sheets: readonly { readonly name: string; readonly rules: readonly Rule[] }[],
): readonly string[] {
  return sheets
    .flatMap((sheet) =>
      sheet.rules
        .filter(
          (rule) =>
            hasPercentageSize(rule.body) &&
            addsPaddingOrBorder(rule.body) &&
            declaration(rule.body, "box-sizing") !== "border-box",
        )
        .map((rule) => `${sheet.name} ${rule.selector}`),
    )
    .toSorted();
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

const stylesheets = cssFilesUnder(scanDir).map((path) => ({
  name: relative(storefrontDir, path),
  rules: parseRules(stripComments(readFileSync(path, "utf8"))),
}));

describe("the stylesheet reader found something to check", () => {
  it("read every CSS module under src/, including the mockups", () => {
    const names = stylesheets.map((sheet) => sheet.name);
    expect(names).toContain(join("src", "styles", "mockups", "homepage.module.css"));
    expect(names).toContain(join("src", "styles", "mockups", "lunar-base.module.css"));
    expect(names.length).toBeGreaterThan(5);
  });

  it("would find a .module.css co-located beside a component, not only one under src/styles", () => {
    // cssFilesUnder walks scanDir (src/) recursively with no directory
    // filter, so a stylesheet co-located next to its component is picked up
    // exactly like one under src/styles — proven here against the real
    // directory tree rather than a synthetic fixture, since the whole point
    // is that no directory is special-cased.
    const underStyles = stylesheets.filter((sheet) => sheet.name.split(/[/\\]/).includes("styles"));
    expect(underStyles.length, "expected at least one stylesheet under src/styles").toBeGreaterThan(0);
    expect(
      stylesheets.length,
      "cssFilesUnder(scanDir) found nothing outside src/styles to prove the widened scan against — " +
        "add or keep a component-co-located .module.css (e.g. src/components/turnstile/HoneypotField.module.css)",
    ).toBeGreaterThan(underStyles.length);
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
        .filter(
          (rule) =>
            // At risk either because the rule itself opts into growing, or
            // because a sibling rule makes its parent a flex container — see
            // this file's "Widened for t2-pages" note. Either way, CSS
            // Flexbox's automatic minimum size floors the item unless it
            // bounds its own minimum — unless the item never shrinks at all
            // (`flex-shrink: 0`), in which case the floor never applies. See
            // hasZeroFlexShrink's doc comment.
            (flexGrow(rule.body) > 0 || hasFlexContainerAncestor(rule.selector, sheet.rules)) &&
            !boundsItsOwnMinimumSize(rule.body) &&
            !hasZeroFlexShrink(rule.body),
        )
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

  it("flags a flex child that inherits its flex-item-ness from its parent's display: flex and declares no flex property of its own — the exact shape .metaRow dt/dd shipped in", () => {
    const shipped = `.metaRow { display: flex; justify-content: space-between; } .metaRow dt { font-weight: 500; } .metaRow dd { margin: 0; }`;
    expect(check(shipped)).toEqual(["probe.module.css .metaRow dd", "probe.module.css .metaRow dt"]);
  });

  it("accepts the same shape once each child bounds its own minimum", () => {
    const fixed = `.metaRow { display: flex; justify-content: space-between; } .metaRow dt { font-weight: 500; min-width: 0; } .metaRow dd { margin: 0; min-width: 0; }`;
    expect(check(fixed)).toEqual([]);
  });

  it("also accepts the label/detail shape purchase-panel.module.css actually ships: the label never shrinks, only the detail does", () => {
    // The shape min-width: 0 alone produced: .metaRow dt squeezed to a
    // handful of pixels and wrapping "Availability" into "Availab"/"ility"
    // on two lines, colliding with .metaRow dd's own first line — legible
    // boxes that don't overlap by rect, illegible text that does. A label
    // that never shrinks (flex-shrink: 0) keeps its own content width
    // instead, and only the detail — ordinary prose, meant to wrap — grows
    // and shrinks.
    const shipped = `.metaRow { display: flex; justify-content: space-between; gap: 1rem; } .metaRow dt { flex: 0 0 auto; } .metaRow dd { flex: 1 1 auto; min-width: 0; text-align: right; }`;
    expect(check(shipped)).toEqual([]);
  });

  it("hasZeroFlexShrink reads the longhand, the flex shorthand's second number, and flex: none", () => {
    expect(hasZeroFlexShrink("flex-shrink: 0;")).toBe(true);
    expect(hasZeroFlexShrink("flex-shrink: 1;")).toBe(false);
    expect(hasZeroFlexShrink("flex: 0 0 auto;")).toBe(true);
    expect(hasZeroFlexShrink("flex: 1 1 auto;")).toBe(false);
    expect(hasZeroFlexShrink("flex: none;")).toBe(true);
    expect(hasZeroFlexShrink("flex: 1 1 12rem;")).toBe(false);
    // A basis-only shorthand's first token is a length/percentage, not the
    // grow factor — must not be misread as "shrink is the second token".
    expect(hasZeroFlexShrink("flex: 12rem;")).toBe(false);
    expect(hasZeroFlexShrink("color: red;")).toBe(false);
  });

  it("does not flag a plain descendant selector whose ancestor is not a flex container", () => {
    expect(check(`.list { display: block; } .list li { margin: 0; }`)).toEqual([]);
  });

  it("reads the immediate ancestor selector, combinators included", () => {
    expect(immediateAncestorSelector(".metaRow dt")).toBe(".metaRow");
    expect(immediateAncestorSelector(".metaRow > dt")).toBe(".metaRow");
    expect(immediateAncestorSelector(".metaRow")).toBeUndefined();
  });
});

describe("no bare <number>fr grid-template-columns track — the grid equivalent of an unbounded flex item", () => {
  function bareFrOffenders(
    sheets: readonly { readonly name: string; readonly rules: readonly Rule[] }[],
  ): readonly string[] {
    return sheets
      .flatMap((sheet) =>
        sheet.rules
          .filter((rule) => bareFrTracks(rule.body).length > 0)
          .map((rule) => `${sheet.name} ${rule.selector}: ${bareFrTracks(rule.body).join(", ")}`),
      )
      .toSorted();
  }

  it("every grid-template-columns declaration under src/ wraps its fr tracks in minmax()", () => {
    expect(
      bareFrOffenders(stylesheets),
      "a bare `1fr` track is shorthand for `minmax(auto, 1fr)`, which floors the track at its content's " +
        "min-content size exactly like an unbounded flex item — wrap it as `minmax(0, 1fr)` (or an " +
        "explicit `minmax(<length>, 1fr)`) so the floor is chosen rather than inherited",
    ).toEqual([]);
  });

  it("has teeth: flags a bare fr track", () => {
    const shipped = `.grid { display: grid; grid-template-columns: 1fr 1fr; }`;
    expect(bareFrOffenders([{ name: "probe.module.css", rules: parseRules(stripComments(shipped)) }])).toEqual([
      "probe.module.css .grid: 1fr, 1fr",
    ]);
  });

  it("accepts a track wrapped in minmax(), with a zero or a length floor", () => {
    const fixed = `.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(14rem, 1fr); }`;
    expect(bareFrOffenders([{ name: "probe.module.css", rules: parseRules(stripComments(fixed)) }])).toEqual([]);
  });

  it("accepts a track wrapped in repeat(), which nests its own minmax()", () => {
    const fixed = `.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }`;
    expect(bareFrOffenders([{ name: "probe.module.css", rules: parseRules(stripComments(fixed)) }])).toEqual([]);
  });

  it("tokenises grid-template-columns at the top level only, treating a minmax()/repeat() call as one token", () => {
    expect(topLevelTokens("minmax(0, 1fr) minmax(14rem, 1fr)")).toEqual([
      "minmax(0, 1fr)",
      "minmax(14rem, 1fr)",
    ]);
    expect(topLevelTokens("1fr 1fr").length).toBe(2);
    expect(topLevelTokens("repeat(auto-fit, minmax(14rem, 1fr))").length).toBe(1);
  });
});

describe("a percentage-sized box that also has padding or a border says which box it means", () => {
  it("every such rule under src/ sets box-sizing: border-box", () => {
    expect(
      percentageSizedWithoutBorderBox(stylesheets),
      "this repository ships no global box-sizing reset on purpose, so `height: 100%` (or `width: 100%`) " +
        "next to padding or a border resolves against the *content* box and the padding and border are " +
        "added on top of it — which is how every review card overflowed its grid cell by exactly 50px. " +
        "Add `box-sizing: border-box`",
    ).toEqual([]);
  });

  it("has teeth: flags the exact shape .figure shipped in", () => {
    const shipped = `.figure { height: 100%; padding: 1.5rem; border: 1px solid red; }`;
    expect(
      percentageSizedWithoutBorderBox([
        { name: "probe.module.css", rules: parseRules(stripComments(shipped)) },
      ]),
    ).toEqual(["probe.module.css .figure"]);
  });

  it("accepts the shape that fixed it", () => {
    const fixed = `.figure { box-sizing: border-box; height: 100%; padding: 1.5rem; border: 1px solid red; }`;
    expect(
      percentageSizedWithoutBorderBox([
        { name: "probe.module.css", rules: parseRules(stripComments(fixed)) },
      ]),
    ).toEqual([]);
  });

  it("does not flag a percentage size with no padding or border, nor padding with no percentage size", () => {
    const benign = `.a { width: 100%; height: auto; } .b { padding: 1rem; border: 1px solid red; }`;
    expect(
      percentageSizedWithoutBorderBox([
        { name: "probe.module.css", rules: parseRules(stripComments(benign)) },
      ]),
    ).toEqual([]);
  });

  it("does not mistake border-radius or box-shadow for a border", () => {
    expect(addsPaddingOrBorder("border-radius: 4px; box-shadow: none;")).toBe(false);
    expect(addsPaddingOrBorder("border: 1px solid red;")).toBe(true);
    expect(addsPaddingOrBorder("padding-inline: 1rem;")).toBe(true);
    expect(addsPaddingOrBorder("border-block-start: 1px solid red;")).toBe(true);
  });

  it("does not flag a zero border or zero padding, which add no extent", () => {
    expect(addsPaddingOrBorder("border: 0;")).toBe(false);
    expect(addsPaddingOrBorder("border: none;")).toBe(false);
    expect(addsPaddingOrBorder("padding: 0;")).toBe(false);
    expect(addsPaddingOrBorder("padding: 0 0;")).toBe(false);
    // The exact rule this exemption exists for.
    const iframe = `.iframe { display: block; width: 100%; height: 100%; border: 0; }`;
    expect(
      percentageSizedWithoutBorderBox([
        { name: "probe.module.css", rules: parseRules(stripComments(iframe)) },
      ]),
    ).toEqual([]);
  });
});

/**
 * `--accent-fill` is a background, and `design/tokens.css` says so in its own
 * comment: it "is a background and is not readable as text". Used as a `color`
 * it measures **2.91:1** on this site's off-white surface and **3.19:1** on
 * white, at `--step--1` (14px) weight 500 — WCAG 1.4.3 asks for 4.5:1, and both
 * numbers are measurements from a browser, not estimates.
 *
 * It shipped anyway, twice, and survived a fix pass: `pages/shop.module.css`
 * copied `.fieldError` out of `styles/forms.module.css`, a review found and
 * fixed the copy, and the original stood for another pass. A third pass proved
 * by mutation that reverting either rule left the whole suite green — nothing
 * in this repository could see it. This is that missing check, and it lives
 * here rather than in a form-specific suite because `scanDir` already reads
 * **every** `.module.css` under `src/`: a third copy in a fourth stylesheet is
 * caught the day it is written.
 *
 * The property scanned is `color` alone. `--accent-fill` as a `background`, a
 * `border-color` or a marker is what the token is for — `.fieldError`'s own
 * `border-inline-start` is the shape that replaced the defect — and
 * `--accent-fill-text` is a different token, so `var(--accent-fill-text)` must
 * not match. Both facts are asserted below.
 */
const ACCENT_FILL = /var\(\s*--accent-fill\s*\)/;

function fillUsedAsText(
  sheets: readonly { readonly name: string; readonly rules: readonly Rule[] }[],
): readonly string[] {
  const offenders: string[] = [];
  for (const sheet of sheets) {
    for (const rule of sheet.rules) {
      const value = declaration(rule.body, "color");
      if (value !== undefined && ACCENT_FILL.test(value)) {
        offenders.push(`${sheet.name} ${rule.selector}: color: ${value}`);
      }
    }
  }
  return offenders.toSorted();
}

describe("--accent-fill is never used as a text colour", () => {
  it("is used as a colour by no rule in any stylesheet under src/", () => {
    expect(fillUsedAsText(stylesheets)).toEqual([]);
  });

  it("read the two stylesheets that shipped the defect, so that means something", () => {
    const names = stylesheets.map((sheet) => sheet.name);
    expect(names).toContain(join("src", "styles", "forms.module.css"));
    expect(names).toContain(join("src", "styles", "pages", "shop.module.css"));
  });
});

describe("the text-colour check has teeth", () => {
  const check = (css: string): readonly string[] =>
    fillUsedAsText([{ name: "probe.module.css", rules: parseRules(stripComments(css)) }]);

  it("flags the exact rule both stylesheets shipped", () => {
    const shipped = `
      .fieldError {
        margin: 0;
        font-size: var(--step--1);
        font-weight: var(--font-weight-medium);
        color: var(--accent-fill);
      }
    `;
    expect(check(shipped)).toEqual(["probe.module.css .fieldError: color: var(--accent-fill)"]);
  });

  it("passes the rule that replaced it — navy text, orange as a marker", () => {
    const fixed = `
      .fieldError {
        color: var(--text);
        border-inline-start: var(--border-width-thick) solid var(--accent-fill);
        padding-inline-start: var(--space-2xs);
      }
    `;
    expect(check(fixed)).toEqual([]);
  });

  it("does not confuse --accent-fill-text, which is a foreground token", () => {
    expect(check(`.chip { color: var(--accent-fill-text); }`)).toEqual([]);
  });

  it("leaves the token's real uses alone", () => {
    expect(
      check(`.button { background: var(--accent-fill); border-color: var(--accent-fill); }`),
    ).toEqual([]);
  });

  it("sees it inside a media query too, where a copy would hide well", () => {
    expect(
      check(`@media (max-width: 860px) { .fieldError { color: var(--accent-fill); } }`),
    ).toEqual(["probe.module.css .fieldError: color: var(--accent-fill)"]);
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
