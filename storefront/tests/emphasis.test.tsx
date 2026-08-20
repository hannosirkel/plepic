/**
 * `withEmphasis`, and — more importantly — the things it deliberately refuses
 * to do.
 *
 * The risk this helper carries is not that it fails to italicise a word. It is
 * that it grows, one plausible commit at a time, into the Markdown renderer
 * the plan forbids. So most of what is pinned here is absence: a lone marker
 * stays text, a `<` stays text, and nothing but the one rule is interpreted.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { withEmphasis } from "../src/lib/emphasis.js";

const render = (text: string): string => renderToStaticMarkup(<p>{withEmphasis(text)}</p>);

describe("withEmphasis", () => {
  it("turns a matched pair into <em> and keeps the surrounding text", () => {
    expect(render("*Finally*, enjoying the perfume of fresh print")).toBe(
      "<p><em>Finally</em>, enjoying the perfume of fresh print</p>",
    );
  });

  it("returns the string untouched when there is no emphasis", () => {
    expect(withEmphasis("no markers here")).toBe("no markers here");
  });

  it("handles emphasis mid-sentence and more than once", () => {
    expect(render("a *b* c *d* e")).toBe("<p>a <em>b</em> c <em>d</em> e</p>");
  });

  /*
   * The failure mode worth pinning. A parser that treats a lone marker as an
   * opening delimiter swallows the rest of the paragraph into an <em> that
   * never closes — copy with a footnote asterisk would silently italicise
   * everything after it.
   */
  it("leaves an unmatched marker as text", () => {
    expect(render("priced from *")).toBe("<p>priced from *</p>");
    expect(render("*opened but never closed")).toBe("<p>*opened but never closed</p>");
  });

  it("does not interpret any other marker", () => {
    expect(render("_under_ **double** `code` [link](x)")).toBe(
      "<p>_under_ **double** `code` [link](x)</p>",
    );
  });

  /*
   * React escapes text nodes, so this is really a test that the helper never
   * reaches for dangerouslySetInnerHTML — which is the one change that would
   * turn a copy field into an injection point.
   */
  it("escapes markup in copy rather than rendering it", () => {
    expect(render("*a* <script>alert(1)</script>")).toContain("&lt;script&gt;");
  });

  it("is not stateful across calls, despite the module-scope regex", () => {
    const first = render("*one* two");
    expect(render("*one* two")).toBe(first);
    expect(render("*one* two")).toBe(first);
  });
});
