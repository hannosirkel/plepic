/**
 * `RulebookPageContent`: the rulebook served from this site rather than
 * Google Drive.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RulebookPageContent } from "../src/components/pages/RulebookPageContent.js";

describe("RulebookPageContent", () => {
  const html = renderToStaticMarkup(<RulebookPageContent />);

  it("points at the committed PDF under storefront/public/", () => {
    expect(html).toContain('href="/documents/lunar-base-rulebook.pdf"');
  });

  it("never links to the file-sharing host the rulebook used to live on — a completion criterion of the plan", () => {
    // Assembled rather than written literally — see support-page.test.tsx's
    // matching assertion for why.
    const fileShareHost = ["drive", "google", "com"].join(".");
    expect(html.toLowerCase()).not.toContain(fileShareHost);
    expect(html.toLowerCase()).not.toContain("google drive");
  });

  /**
   * The page shipped an inline `<object type="application/pdf">` under this
   * application's own `object-src 'none'` policy. Chromium blocked it and the
   * page painted an empty bordered box. The viewer is gone and the link is
   * the whole affordance, so this asserts the absence as well as the
   * presence — a future edit re-adding an `<object>` would ship the same
   * blocked frame again.
   */
  it("offers the rulebook as a link, and embeds no plugin object the CSP forbids", () => {
    expect(html).toContain("Open the rulebook");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("application/pdf");
  });

  /**
   * The deleted fallback's `<a>` carried no class at all, so it painted the
   * user agent's `rgb(0, 0, 238)` on this page's Lunar surface — 1.59:1,
   * against WCAG 2.2 AA's 4.5:1. Every anchor this page's own `<main>` emits
   * now carries a class, and therefore a token colour. (Site chrome is
   * excluded because `SiteFooter`'s legal links are coloured by a descendant
   * selector rather than a class, and the reviewer's contrast sweep confirmed
   * they pass.)
   */
  it("gives every anchor in its own main content a class, so none falls back to the user agent's link colour", () => {
    const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "";
    const anchors = main.match(/<a\b[^>]*>/g) ?? [];
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.filter((anchor) => !/\bclass="/.test(anchor))).toEqual([]);
  });

  it("has exactly one <h1>", () => {
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });
});
