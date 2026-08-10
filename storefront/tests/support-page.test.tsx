/**
 * `SupportPageContent`: the real /support/lunar-base route — the rulebook
 * link (this site, never Google Drive), the rules FAQ, the tutorial video,
 * the component list, and the contact form with Turnstile and the honeypot
 * mounted.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { pages } from "../../content/pages.js";
import { SupportPageContent } from "../src/components/pages/SupportPageContent.js";

describe("SupportPageContent", () => {
  const html = renderToStaticMarkup(
    <SupportPageContent turnstileSiteKey="test-key" nonce="abc" merchantContactAddress="hello@example.com" />,
  );

  it("covers every anchor content/pages.ts declares for the support route", () => {
    const page = pages.find((candidate) => candidate.route === "support");
    expect(page).toBeTruthy();
    for (const anchor of page!.sections) {
      expect(html, `missing id="${anchor}"`).toMatch(new RegExp(`id="${anchor}"`));
    }
  });

  it("links the rulebook to this site's own route, never to the file-sharing host it used to live on", () => {
    expect(html).toContain('href="/support/lunar-base/rulebook"');
    // Assembled rather than written literally: this file is scanned by
    // tests/no-live-hostname.test.ts too, which would otherwise flag the
    // very hostname this assertion exists to prove absent.
    const fileShareHost = ["drive", "google", "com"].join(".");
    expect(html.toLowerCase()).not.toContain(fileShareHost);
    expect(html.toLowerCase()).not.toContain("google drive");
  });

  it("renders every rules FAQ entry content/support.ts declares", async () => {
    const { rulesFaq } = await import("../../content/support.js");
    for (const entry of rulesFaq) {
      expect(html, `missing question "${entry.question}"`).toContain(entry.question);
    }
  });

  it("renders the component list from content/lunar-base.ts's inTheBox", async () => {
    const { inTheBox } = await import("../../content/lunar-base.js");
    for (const item of inTheBox) {
      expect(html).toContain(item.term);
    }
  });

  it("mounts a Turnstile widget and a distinctly-named honeypot inside the contact form", () => {
    expect(html).toContain('data-testid="turnstile-contact"');
    expect(html).toContain("contact-additional-notes");
  });

  it("has exactly one <h1> and no duplicated heading text", () => {
    const headings = [...html.matchAll(/<h[12][^>]*>([^<]*)<\/h[12]>/g)].map((match) => match[1]);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("has exactly one <h1>", () => {
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });

  /**
   * `content/support.ts`'s contact copy ends with "You can also reach us at
   * {merchantContactAddress}." — a configuration-sourced placeholder
   * `content/schema.ts` marks `unresolved`. This page shipped it verbatim, in
   * plain body type, to every visitor at every width.
   */
  describe("the merchant contact placeholder", () => {
    it("is resolved from configuration when an address is configured", () => {
      expect(html).toContain("hello@example.com");
      expect(html).not.toContain("{merchantContactAddress}");
    });

    it("takes its whole sentence with it when no address is configured, rather than shipping the brace", () => {
      const unconfigured = renderToStaticMarkup(
        <SupportPageContent turnstileSiteKey="test-key" nonce="abc" merchantContactAddress={null} />,
      );
      expect(unconfigured).not.toContain("{merchantContactAddress}");
      expect(unconfigured).not.toContain("You can also reach us at");
      // The rest of the contact section is untouched: dropping is per
      // paragraph, so an unresolvable sentence never takes a resolvable one.
      expect(unconfigured).toContain("all of it comes to the same place");
      expect(unconfigured).toContain('data-testid="turnstile-contact"');
    });
  });
});
