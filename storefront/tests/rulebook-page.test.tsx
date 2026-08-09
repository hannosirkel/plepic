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
    expect(html).toContain('data="/documents/lunar-base-rulebook.pdf"');
    expect(html).toContain('href="/documents/lunar-base-rulebook.pdf"');
  });

  it("never links to the file-sharing host the rulebook used to live on — a completion criterion of the plan", () => {
    // Assembled rather than written literally — see support-page.test.tsx's
    // matching assertion for why.
    const fileShareHost = ["drive", "google", "com"].join(".");
    expect(html.toLowerCase()).not.toContain(fileShareHost);
    expect(html.toLowerCase()).not.toContain("google drive");
  });

  it("gives the <object> an accessible label and real fallback content, not a blank frame", () => {
    expect(html).toMatch(/<object[^>]*aria-label="Lunar Base rulebook"/);
    expect(html).toContain("Open the rulebook");
  });

  it("has exactly one <h1>", () => {
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });
});
