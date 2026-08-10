/**
 * `AboutPageContent`: the real /about route, built around the team
 * photograph, the origin story, and the timeline — with six founders,
 * uniformly, and no invented names or roles. See the component's own doc
 * comment for the two recorded deviations from the checkbox this enforces.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { pages } from "../../content/pages.js";
import { AboutPageContent } from "../src/components/pages/AboutPageContent.js";

function headingOutline(html: string): readonly number[] {
  return [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
}

describe("AboutPageContent", () => {
  const html = renderToStaticMarkup(<AboutPageContent />);

  it("has exactly one <h1> and skips no heading level", () => {
    const outline = headingOutline(html);
    expect(outline.filter((level) => level === 1)).toHaveLength(1);
    expect(outline[0]).toBe(1);
    let previous = 0;
    for (const level of outline) {
      expect(level, `heading jumped from h${previous} to h${level}`).toBeLessThanOrEqual(previous + 1);
      previous = level;
    }
  });

  it("covers every anchor content/pages.ts declares for the about route", () => {
    const page = pages.find((candidate) => candidate.route === "about");
    expect(page, "no content/pages.ts entry for about").toBeTruthy();
    for (const anchor of page!.sections) {
      expect(html, `missing id="${anchor}"`).toMatch(new RegExp(`id="${anchor}"`));
    }
  });

  it("says six people, never seven", () => {
    expect(html).toContain("six");
    expect(html.toLowerCase()).not.toMatch(/\bseven\b/);
  });

  it("invents no name or role — no list markup carries a roster", () => {
    // Mirrors design-assets.test.tsx's TeamPhotoSection assertion: a
    // photo-and-paragraph section has no roster to lay out. The timeline
    // below legitimately uses <ol>, so this checks specifically that no
    // <ul>/<dl> (the shapes a name-and-role grid would take) appears before
    // the timeline's own <ol>.
    const beforeTimeline = html.split('id="timeline"')[0] ?? "";
    expect(beforeTimeline).not.toMatch(/<(ul|dl)\b/);
  });

  it("renders the real team photograph with non-empty alt text, not as the page's only human element", () => {
    const photoTag = /<img\b[^>]*src="\/images\/team\/[^"]*"[^>]*>/.exec(html)?.[0];
    expect(photoTag, "no team photograph found").toBeTruthy();
    const alt = /\balt="([^"]*)"/.exec(photoTag ?? "")?.[1] ?? "";
    expect(alt.length).toBeGreaterThan(20);
    // The timeline (a compact list of dates) exists too, but is not the only
    // human element — the photograph appears in the markup before it.
    expect(html.indexOf(photoTag ?? "")).toBeLessThan(html.indexOf('id="timeline"'));
  });

  it("gives the header wordmark an accessible home link, like every other real route", () => {
    expect(html).toMatch(/<a[^>]*aria-label="Plepic Games, home"/);
  });
});
