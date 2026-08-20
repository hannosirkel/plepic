/**
 * Where a price is presented as a headline, the emphasised line carries the
 * figure **and** the tax qualification, and the unemphasised line carries the
 * shipping and duties sentence.
 *
 * That is the operator's boundary, supplied 2026-08-10 as two lines with the
 * first emphasised, and answered "unify to my wording" when the product
 * surfaces were found drawing a different one. `/legal/shipping` has rendered
 * it correctly since the wording arrived (`content/legal/shipping.ts`'s
 * `callout`, pinned in `tests/legal-pages.test.tsx`); the purchase panel and
 * the product hero rendered the figure large and the *whole* qualifier string
 * small, so "VAT included where applicable" was small print on the two most
 * prominent surfaces on the site and an emphasised line on the least
 * prominent one.
 *
 * ## Which surfaces the property reaches, and why these two
 *
 * A **headline price** is a price presented as a display figure in a slot of
 * its own — the purchase panel's `.priceHeadline` and the hero's
 * `.heroPriceHeadline`, both at `--purchase-price-size`. Those are the two
 * places a visitor reads "the price of this game", and they are the two the
 * operator's format is written for: a figure with a qualification beside it.
 *
 * `BasketPageContent` and `CheckoutPageContent` render the same
 * `priceQualifiers` string and are deliberately **not** changed. They present
 * no headline price: the goods figure is a `<dd>` at `--step-0` inside a
 * `<dl>` of goods, shipping and total, `/cart`'s total row is a *pending*
 * statement rather than a figure at all until shipping is known, and the note
 * beneath qualifies the **summary** rather than any one figure in it.
 * Splitting it there would either restate the price a third time to have
 * something to attach the qualification to, or emphasise a tax note above an
 * order total — a hierarchy the operator did not ask for and, on a checkout,
 * a worse one. The note stays one string, and `priceQualifiers` therefore
 * stays a live field with live callers rather than becoming a name nothing
 * renders.
 *
 * Prose that quotes the price mid-paragraph (the shipping FAQ's `{priceLine}`)
 * is likewise untouched: a sentence is the right shape there, which is what
 * `src/lib/catalogue.ts` has said about `priceLine` since it was written.
 *
 * ## Why there is a stylesheet assertion here as well as a markup one
 *
 * The markup half proves the *boundary* — which words are in which element.
 * It cannot prove the *emphasis*, and this repository's suite has been green
 * over a visibly broken page three times (see `tests/mockup-layout.test.ts`).
 * "Emphasised" here means, checkably: the headline rule carries the price
 * weight and the price colour, the figure inside it carries the price size,
 * and the note rule carries the muted note colour. A future edit that moves
 * the tax qualification into a muted, regular-weight rule satisfies the markup
 * assertion and fails this one, which is the failure that would otherwise
 * reach a reader.
 *
 * Neither half sees a *rendered layout*: `renderToStaticMarkup` has no layout
 * engine and this package has no browser. The wrap this presentation had to
 * solve was measured out of band, in Chromium 151 against a real `next build`
 * on `127.0.0.1` with the stylesheets confirmed loaded (303 rules,
 * `MADE Evolve Sans` computed on `body`); the numbers and the method are
 * recorded in `purchase-panel.module.css` and `README.md`.
 */
import { readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PurchasePanelMockup } from "../src/components/PurchasePanelMockup.js";
import { LunarBaseMockup } from "../src/components/mockups/LunarBaseMockup.js";
import { resolveCatalogue } from "../src/lib/catalogue.js";
import { listSourceFiles } from "./helpers/source-files.js";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const catalogue = resolveCatalogue();

/**
 * The text of the first element whose class list contains `token`, with tags
 * removed and whitespace collapsed.
 *
 * CSS module class names are hashed (`_priceHeadline_d90aac`), so the lookup
 * is by substring on the authored name — which is also what makes this fail
 * loudly if a class is renamed without this file being updated, rather than
 * silently matching nothing.
 */
function textOfElementWithClass(html: string, token: string): string {
  const opening = new RegExp(`<(\\w+)\\b[^>]*class="[^"]*\\b_${token}_[^"]*"[^>]*>`).exec(html);
  if (opening === null) throw new Error(`no element carrying the class "${token}" in the markup`);

  const tag = opening[1] ?? "";
  const from = opening.index + opening[0].length;

  // Depth-aware, because the blocks this is asked for nest same-tag children
  // (`.panel` and `.heroPurchase` are `<div>`s full of `<div>`s) and a naive
  // "first closing tag" would silently return a prefix — which is exactly the
  // shape of a test that passes because it looked at less than it meant to.
  let depth = 1;
  let cursor = from;
  let to = -1;
  const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  tags.lastIndex = from;
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    depth += match[1] === "/" ? -1 : 1;
    if (depth === 0) {
      to = match.index;
      break;
    }
    cursor = match.index;
  }
  if (to === -1) throw new Error(`unterminated <${tag}> for the class "${token}" (from ${String(cursor)})`);

  return html
    .slice(from, to)
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll(/\s+/g, " ")
    .trim();
}

const SURFACES: readonly {
  readonly name: string;
  /**
   * The component's path relative to `storefront/`, in POSIX form. The
   * enumeration below holds the `src/` walk to exactly this list, so a new
   * headline surface costs an entry here — and therefore the markup and
   * emphasis assertions that come with one — rather than nothing.
   */
  readonly file: string;
  readonly html: string;
  /** The commercial block the price is presented inside. */
  readonly block: string;
  readonly headline: string;
  readonly figure: string;
  readonly note: string;
  /** The net/VAT split — the fourth part, under the figure it explains. */
  readonly breakdown: string;
}[] = [
  {
    name: "the purchase panel",
    file: "src/components/PurchasePanelMockup.tsx",
    html: renderToStaticMarkup(<PurchasePanelMockup />),
    block: "panel",
    headline: "priceHeadline",
    figure: "priceFigure",
    note: "note",
    breakdown: "breakdown",
  },
  {
    name: "the product hero",
    file: "src/components/mockups/LunarBaseMockup.tsx",
    html: renderToStaticMarkup(<LunarBaseMockup />),
    block: "heroPurchase",
    headline: "heroPriceHeadline",
    figure: "heroPriceFigure",
    note: "heroPriceNote",
    breakdown: "heroPriceBreakdown",
  },
];

describe("every headline price presents the operator's two lines", () => {
  for (const surface of SURFACES) {
    describe(surface.name, () => {
      it("puts the figure and the tax qualification in the emphasised line", () => {
        expect(textOfElementWithClass(surface.html, surface.headline)).toBe(
          catalogue.priceHeadline,
        );
      });

      it("puts the figure, and only the figure, in the display-sized slot", () => {
        expect(textOfElementWithClass(surface.html, surface.figure)).toBe(catalogue.price);
      });

      /**
       * The plain line is the shipping and duties sentence and nothing else.
       *
       * It used to be asserted as "contains no mention of VAT at all", and that
       * stopped being the right test when the price became net: the operator's
       * own second line now says VAT is added to *shipping* inside the EU,
       * which is a fact about shipping and belongs exactly here. What must not
       * be here is the **qualification of the figure** — the destination and
       * whether tax is in the price — because demoting that into the small
       * print is the defect this file was written for, and it is a worse one
       * now that the qualification is what stops the figure reading as
       * everybody's.
       */
      it("puts the shipping and duties sentence, and no qualification of the figure, in the plain line", () => {
        const note = textOfElementWithClass(surface.html, surface.note);
        expect(note).toBe(catalogue.priceShippingNote);
        expect(
          note,
          "the tax qualification is back in the small print",
        ).not.toContain(catalogue.priceTaxQualifier);
      });

      /**
       * **The figure never appears without its destination.** This is the
       * condition the operator's United States default rests on: EUR 25.00 is
       * one destination's answer, and a surface that paints it alone has told a
       * European visitor something true of somebody else.
       */
      it("names the destination in the emphasised line, beside the figure", () => {
        const headline = textOfElementWithClass(surface.html, surface.headline);
        expect(headline).toContain(catalogue.price);
        expect(headline).toContain(catalogue.destinationName);
        expect(headline).toContain(catalogue.priceTaxQualifier);
      });

      /** And the split states what the figure is made of, as its own element. */
      it("states the net and VAT split as a separate line", () => {
        expect(textOfElementWithClass(surface.html, surface.breakdown)).toBe(
          catalogue.priceTaxBreakdown,
        );
      });

      /*
       * Scoped to the commercial block, not the whole page. The product page
       * also carries the shipping FAQ, whose answer quotes `{priceLine}` —
       * price and qualifiers as one sentence — and that is the *right* shape
       * for prose quoting a price mid-paragraph. The defect is the
       * concatenated form appearing where a headline price is presented.
       */
      it("does not render the concatenated qualifier string in the price block", () => {
        expect(
          textOfElementWithClass(surface.html, surface.block),
          "the demoted one-string form is back — the operator's line break and its change of emphasis are gone",
        ).not.toContain(catalogue.priceQualifiers);
      });
    });
  }
});

/**
 * The boundary above is a property of *components that render the bare
 * catalogue figure*, not of the two that happen to do so today. A third
 * surface that promotes the figure into a slot of its own has to carry the
 * qualification with it, and this is what says so before a reviewer has to
 * notice.
 *
 * **It has to walk `src/` to say that.** The first revision of this block
 * asserted the property against a hand-written two-element array of the two
 * files already known to satisfy it — which is a restatement of the markup
 * assertions above, not a guard, because a list nobody adds a file to cannot
 * fail on a file nobody added. Review pass 1 established it by building the
 * defect: a third component rendering a display-sized bare figure above the
 * concatenated qualifier string — precisely what this unit removed from the
 * panel and the hero — and this file and `no-hardcoded-price.test.ts` between
 * them reported 93 tests passed, green.
 *
 * So the walk is real, and it is `tests/helpers/source-files.ts`'s
 * `listSourceFiles`, the same one `tests/no-hardcoded-price.test.ts` scans the
 * tree with rather than a second implementation of it. Two ways to fail:
 *
 * 1. **A file names the bare figure without the tax qualification beside it.**
 *    That is the defect itself, reappearing on a new surface.
 * 2. **A file names the bare figure and is not in `SURFACES`.** It may well
 *    render the operator's format correctly, but nothing here has looked at
 *    its markup or its stylesheet, so the answer is to add it above — where it
 *    picks up the boundary and emphasis assertions — not to let the walk widen
 *    silently.
 *
 * What it cannot see: a component that binds the figure to a local name first
 * (`const { price } = catalogue`) reads as no match. It is a source scan, and
 * the honest statement of its reach is "names `catalogue.price`", which is how
 * both surfaces and any straightforward third one are written.
 */
describe("no surface renders the bare figure without the operator's qualification", () => {
  /**
   * The **bare** figure: `catalogue.price` and not `catalogue.priceLine`,
   * `priceQualifiers`, `priceHeadline`, `priceTaxQualifier` or
   * `priceShippingNote`, every one of which already carries a qualification
   * with it. The trailing `\b` is what draws that line — there is no word
   * boundary between `price` and `Line` — and it is the load-bearing
   * character in this file, so it gets its own assertion below.
   */
  const BARE_FIGURE = /\bcatalogue\.price\b/;

  /**
   * `src/lib/catalogue.ts` names the bare figure without rendering it: it is
   * the resolver that produces it, and its `{price}` placeholder entry reads
   * `catalogue.price`. Exempted by name, visibly, like
   * `no-hardcoded-price.test.ts` exempts the same file for the same reason.
   */
  const RESOLVER = join(storefrontDir, "src", "lib", "catalogue.ts");

  const walked = listSourceFiles(join(storefrontDir, "src"));
  const rendering = walked
    .filter((file) => file !== RESOLVER && BARE_FIGURE.test(readFileSync(file, "utf8")))
    .map((file) => relative(storefrontDir, file).split(sep).join("/"))
    .sort();

  it("walked the real tree, so an empty result would be a broken walk rather than a clean one", () => {
    expect(walked.length, "the src/ walk found almost nothing — the walk is broken, not the tree").toBeGreaterThan(20);
    expect(walked, "src/lib/catalogue.ts was not walked, so exempting it proves nothing").toContain(RESOLVER);
  });

  it("distinguishes the bare figure from the fields that carry a qualification", () => {
    expect(BARE_FIGURE.test("<span>{catalogue.price}</span>")).toBe(true);
    for (const carrier of ["priceLine", "priceQualifiers", "priceHeadline", "priceTaxQualifier", "priceShippingNote"]) {
      expect(BARE_FIGURE.test(`<p>{catalogue.${carrier}}</p>`), `${carrier} read as the bare figure`).toBe(false);
    }
  });

  it("names every file in src/ that renders catalogue.price as a slot of its own", () => {
    expect(
      rendering,
      "a file in src/ renders the bare catalogue figure and is not one of the surfaces this file asserts on — " +
        "add it to SURFACES so its markup and its emphasis are checked, or render catalogue.priceHeadline",
    ).toEqual([...SURFACES.map((surface) => surface.file)].sort());
  });

  for (const file of rendering) {
    it(`${file} carries the operator's tax qualification beside the figure`, () => {
      const source = readFileSync(join(storefrontDir, file), "utf8");
      expect(source, `${file} no longer renders catalogue.price`).toContain("{catalogue.price}");
      expect(
        source,
        `${file} promotes the figure into a slot of its own without the operator's tax qualification beside it — ` +
          "the small-print demotion this unit removed, on a new surface",
      ).toContain("catalogue.priceTaxQualifier");
    });
  }
});

/**
 * The emphasis itself, read off the stylesheets. See this file's doc comment
 * for why a markup assertion alone is not enough.
 */
describe("the emphasised line is emphasised and the plain line is not", () => {
  const sheets: readonly {
    readonly name: string;
    readonly css: string;
    readonly headline: string;
    readonly figure: string;
    readonly note: string;
  }[] = [
    {
      name: "purchase-panel.module.css",
      css: readFileSync(join(storefrontDir, "src/styles/purchase-panel.module.css"), "utf8"),
      headline: "priceHeadline",
      figure: "priceFigure",
      note: "note",
    },
    {
      name: "mockups/lunar-base.module.css",
      css: readFileSync(join(storefrontDir, "src/styles/mockups/lunar-base.module.css"), "utf8"),
      headline: "heroPriceHeadline",
      figure: "heroPriceFigure",
      note: "heroPriceNote",
    },
  ];

  /** One rule's declaration block, comments stripped. */
  function ruleBody(css: string, className: string): string {
    const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
    const match = new RegExp(`(?:^|\\})\\s*\\.${className}\\s*\\{([^}]*)\\}`).exec(withoutComments);
    if (match === null) throw new Error(`no .${className} rule`);
    return match[1] ?? "";
  }

  for (const sheet of sheets) {
    describe(sheet.name, () => {
      it("sets the price weight and the price colour on the emphasised line", () => {
        const body = ruleBody(sheet.css, sheet.headline);
        expect(body).toContain("--purchase-price-weight");
        expect(body).toContain("--purchase-price-color");
        expect(body, "the emphasised line is muted").not.toContain("--text-muted");
        expect(body, "the emphasised line is note-coloured").not.toContain(
          "--purchase-note-color",
        );
      });

      it("keeps the display size on the figure alone", () => {
        expect(ruleBody(sheet.css, sheet.figure)).toContain("--purchase-price-size");
        expect(
          ruleBody(sheet.css, sheet.headline),
          "the whole emphasised line is set at display size — this is the wall the demotion was working around",
        ).not.toContain("--purchase-price-size");
      });

      it("leaves the plain line muted", () => {
        expect(ruleBody(sheet.css, sheet.note)).toContain("--purchase-note-color");
      });
    });
  }
});
