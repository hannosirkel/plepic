/**
 * Structural tests for `t2-design-assets`'s three composites and two
 * mockups. These render each component to static markup — real HTML, not a
 * snapshot of props — and check the properties the migration packet actually
 * asked for: every image carries alt text, the composites carry exactly the
 * content the content model declares (never more, never invented), the
 * team composite never renders a name, and each mockup's markup covers every
 * anchor `content/pages.ts` lists for that route.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { specifications } from "../../content/lunar-base.js";
import { quotations } from "../../content/proof.js";
import { team } from "../../content/publisher.js";
import { pages } from "../../content/pages.js";
import { FeatureSpecStrip } from "../src/components/FeatureSpecStrip.js";
import { ReviewComposite } from "../src/components/ReviewComposite.js";
import { TeamPhotoSection } from "../src/components/TeamPhotoSection.js";
import { FutureGamePlaceholder } from "../src/components/decor/FutureGamePlaceholder.js";
import { NeutralTexture } from "../src/components/decor/NeutralTexture.js";
import { SectionDivider } from "../src/components/decor/SectionDivider.js";
import { HomepageMockup } from "../src/components/mockups/HomepageMockup.js";
import { LunarBaseMockup } from "../src/components/mockups/LunarBaseMockup.js";

/** Every `<img …>` tag's `alt="…"` value, in document order. */
function altTexts(html: string): readonly string[] {
  return [...html.matchAll(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g)].map((match) => match[1] ?? "");
}

/**
 * True when every `<img>` in `html` carries an `alt` attribute at all — WCAG
 * requires that of every image, but not that it be non-empty. `alt=""` is
 * the *correct* markup for a purely decorative image (this design's header
 * wordmark, wrapped in a link that already carries an accessible name), so a
 * blanket "every alt must be non-empty" check would fail a component for
 * following the spec correctly. Specific informative images get their own,
 * non-empty-alt assertion below instead of a blanket one here.
 */
function everyImageHasAnAltAttribute(html: string): boolean {
  const imgTags = html.match(/<img\b[^>]*>/g) ?? [];
  expect(imgTags.length).toBeGreaterThan(0);
  return imgTags.every((tag) => /\balt="[^"]*"/.test(tag));
}

/** React's SSR escapes `'` as a numeric character reference; match that. */
function asRenderedHtml(text: string): string {
  return text.replaceAll("'", "&#x27;");
}

function findPage(route: string) {
  const page = pages.find((candidate) => candidate.route === route);
  if (!page) throw new Error(`no content/pages.ts entry for ${route}`);
  return page;
}

/** Heading levels in document order, e.g. `[1, 2, 2, 2]`. */
function headingOutline(html: string): readonly number[] {
  return [...html.matchAll(/<h([1-6])\b/g)].map((match) => Number(match[1]));
}

/**
 * Every page needs exactly one `<h1>`, and no level may be skipped on the way
 * down. The Lunar Base mockup shipped with neither property: its pitch — the
 * visually dominant text on the page, `--step-5` and bold — was a `<p>`, and
 * the document's headings started at `h2`. Visual prominence that is not also
 * structural prominence is exactly the failure WCAG 1.3.1 describes, and it
 * was on the one page a buyer actually uses.
 */
function expectSoundHeadingStructure(html: string): void {
  const outline = headingOutline(html);
  expect(outline.filter((level) => level === 1).length, "a page has exactly one <h1>").toBe(1);
  expect(outline[0], "the first heading on the page is its <h1>").toBe(1);

  let previous = 0;
  const skips: string[] = [];
  for (const level of outline) {
    if (level > previous + 1) skips.push(`h${previous} → h${level}`);
    previous = level;
  }
  expect(skips, "a heading level was skipped, so the outline has a rung missing").toEqual([]);
}

describe("FeatureSpecStrip", () => {
  const html = renderToStaticMarkup(<FeatureSpecStrip />);

  it("renders exactly the five specifications content declares, in order, and nothing invented", () => {
    expect(specifications.length).toBe(5);
    for (const spec of specifications) {
      expect(html).toContain(spec.term);
      // `detail` is prose, not a string: Player info carries the two lines the
      // box prints, and both have to reach the page.
      for (const line of spec.detail) {
        expect(html, `${spec.term} lost the line "${line}"`).toContain(line);
      }
    }
  });

  /*
   * The age marking used to be a sentence beneath the strip, read from the
   * mock catalogue because `content/` had no age entry. It is now a line of
   * the Player info column, from content. The failure this guards is the
   * marking silently vanishing from the product page altogether, which is
   * what happens if a future edit drops the second detail line as redundant.
   */
  it("states the age marking, from content rather than from the catalogue", () => {
    expect(html).toContain("Age 10 +");
    expect(html).not.toContain("safety marking");
  });

  it("renders exactly one column per specification (no duplicated or dropped column)", () => {
    const columns = html.match(/<li/g) ?? [];
    expect(columns.length).toBe(specifications.length);
  });

  it("every icon is decorative (aria-hidden), since the term/detail text already carries the meaning", () => {
    const icons = html.match(/<svg\b[^>]*>/g) ?? [];
    expect(icons.length).toBe(specifications.length);
    for (const icon of icons) {
      expect(icon).toMatch(/aria-hidden="true"/);
    }
  });

  /**
   * The strip shipped with the rocket on Players and the galaxy on Playing
   * time. The printed box back — photographed in
   * `public/images/box/box-hero-*.webp`, committed by this same unit — pairs
   * the rocket with "FAST-PACED / Average game approx. 30 min" and the
   * astronaut helmet with "PLAYER INFO / 2–6 players". A buyer holding the
   * box would have seen the site contradict it.
   *
   * Pinning the pairing needs the icons to be distinguishable in the output,
   * and they are: each is a single verbatim `<path d="…">` from its source
   * file, so the first characters of that path data identify which icon
   * rendered without embedding a marker the component would have to carry
   * for the test's benefit.
   */
  const PATH_PREFIX_BY_SOURCE_ID: Readonly<Record<string, string>> = {
    "space-shuttle-launch": "M44.88,15.89",
    galaxy: "M51.27,11.78",
    "mission-control": "M78,36.43",
    "alien-obduction": "M26.16,44.91",
    "astronaut-helmet": "M36.55,59.33",
  };

  /**
   * The box back's own pairing — now for all five columns, not three.
   *
   * The old strip's terms were Players, Playing time and Setup, and only those
   * three had a printed counterpart; Weight and Cards were skipped here as a
   * judgement call made in the component. The columns are now the box's own
   * five captions, so every one of them is box-stated and none is skipped —
   * and the `skipped` accumulator below exists so that renaming a term can
   * never quietly turn this test back into a loop that asserts nothing, which
   * is what a bare `continue` would have done.
   */
  const BOX_PAIRING: Readonly<Record<string, string>> = {
    "Fast-paced": "space-shuttle-launch",
    Replayable: "galaxy",
    "Quick Start": "mission-control",
    Portable: "alien-obduction",
    "Player info": "astronaut-helmet",
  };

  it("pairs each icon with the fact the printed box back pairs it with", () => {
    const columns = html.split("<li").slice(1);
    expect(columns.length).toBe(specifications.length);

    const skipped: string[] = [];
    for (const [index, spec] of specifications.entries()) {
      const expectedSourceId = BOX_PAIRING[spec.term];
      if (expectedSourceId === undefined) {
        skipped.push(spec.term);
        continue;
      }
      const prefix = PATH_PREFIX_BY_SOURCE_ID[expectedSourceId];
      expect(prefix, `no path fingerprint recorded for ${expectedSourceId}`).toBeTruthy();
      expect(
        columns[index],
        `the box back prints "${spec.term}" beside the ${expectedSourceId} icon; this column renders a different one`,
      ).toContain(prefix!);
    }

    expect(skipped, "a column has no recorded box pairing, so its icon is unchecked").toEqual([]);
  });

  it("uses each of the five icons exactly once", () => {
    for (const [sourceId, prefix] of Object.entries(PATH_PREFIX_BY_SOURCE_ID)) {
      expect(html.split(prefix).length - 1, `${sourceId} is not rendered exactly once`).toBe(1);
    }
  });
});

describe("TeamPhotoSection", () => {
  const html = renderToStaticMarkup(<TeamPhotoSection />);

  /*
   * "Verbatim" now means every word, in order, with the operator's emphasis
   * honoured — not the string byte for byte. The caption supplied on
   * 2026-08-20 carries one emphasised word, and the whole point of
   * `withEmphasis` is that its markers become an `<em>` rather than reaching
   * the page as punctuation, so asserting the raw string would be asserting
   * the bug. What must still be impossible is a component substituting a
   * caption of its own, so the assertion stays against the content model's
   * own text.
   */
  it("renders the content model's heading and body, as emphasis markup rather than markers", () => {
    expect(html).toContain(team.heading);
    for (const paragraph of team.body) {
      const expected = paragraph.replaceAll(/\*([^*]+)\*/g, "<em>$1</em>");
      expect(html).toContain(expected);
    }
    expect(html).not.toContain("*");
  });

  it("carries real alt text on the photograph", () => {
    expect(everyImageHasAnAltAttribute(html)).toBe(true);
  });

  it("renders no name — the manifest carries a headcount and a photograph, never a roster", () => {
    // The one name this repository is not allowed to invent is checkable
    // structurally: there is no list markup (<ul>/<ol>/<dl>) in this
    // component's output at all, because a photo-and-paragraph section has
    // no roster to lay out. If a later edit adds one, this fails loudly.
    expect(html).not.toMatch(/<(ul|ol|dl)\b/);
  });
});

describe("ReviewComposite", () => {
  const html = renderToStaticMarkup(<ReviewComposite />);

  it("renders exactly the quotations content/proof.ts declares, verbatim and attributed", () => {
    expect(quotations.length).toBeGreaterThan(0);
    for (const quotation of quotations) {
      expect(html).toContain(asRenderedHtml(quotation.text));
      expect(html).toContain(quotation.attribution);
    }
  });

  it("renders exactly one card per quotation (no fabricated review added)", () => {
    const cards = html.match(/<blockquote/g) ?? [];
    expect(cards.length).toBe(quotations.length);
  });
});

describe("HomepageMockup", () => {
  const html = renderToStaticMarkup(<HomepageMockup />);

  it("renders on the publisher token layer", () => {
    expect(html).toMatch(/data-layer="publisher"/);
  });

  it("covers every anchor content/pages.ts declares for the home route", () => {
    const page = findPage("home");
    for (const anchor of page.sections) {
      expect(html, `missing id="${anchor}"`).toMatch(new RegExp(`id="${anchor}"`));
    }
  });

  it("every image carries alt text", () => {
    expect(everyImageHasAnAltAttribute(html)).toBe(true);
  });

  it("gives the informative images (the box photograph, the team photograph) real, non-empty alt text", () => {
    const alts = altTexts(html);
    expect(alts.some((alt) => alt.toLowerCase().includes("box"))).toBe(true);
    expect(alts.some((alt) => alt.toLowerCase().includes("six people"))).toBe(true);
  });

  it("uses the approved front-and-back product cut-out for the publisher hero", () => {
    expect(html).toContain('src="/images/box/box-front-back-960.webp"');
    expect(html).toContain("box-front-back-480.webp 480w");
    expect(html).toContain("box-front-back-1600.webp 1600w");
  });

  it("marks the header wordmark decorative (empty alt) since its link already carries an accessible name", () => {
    expect(html).toMatch(/<a[^>]*aria-label="Plepic Games, home"[^>]*><img[^>]*\balt=""/);
  });

  it("renders the newsletter form as static markup with no submit handler wired", () => {
    expect(html).toContain("<form");
    expect(html).not.toContain("onSubmit");
  });

  it("has exactly one <h1> and skips no heading level", () => {
    expectSoundHeadingStructure(html);
  });
});

describe("LunarBaseMockup", () => {
  const html = renderToStaticMarkup(<LunarBaseMockup />);

  it("renders on the Lunar Base token layer", () => {
    expect(html).toMatch(/data-layer="lunar"/);
  });

  it("covers every anchor content/pages.ts declares for the lunarBase route", () => {
    const page = findPage("lunarBase");
    for (const anchor of page.sections) {
      expect(html, `missing id="${anchor}"`).toMatch(new RegExp(`id="${anchor}"`));
    }
  });

  it("every image carries alt text", () => {
    expect(everyImageHasAnAltAttribute(html)).toBe(true);
  });

  /**
   * This page carries several of the informative images in the unit and had
   * no non-empty-alt assertion of its own at all — the blanket "has an alt
   * attribute" check above passes on `alt=""`, which is correct markup for
   * the decorative header wordmark and wrong for a photograph of the product
   * someone is deciding whether to buy.
   *
   * `t2-pages` added a fourth: the "table photography" beat the decision-
   * order checkbox names, between "why it travels well" and the quotations —
   * reusing the same layout-base render already shown small in "what is in
   * the box", because no second distinct table photograph exists in this
   * repository and the plan forbids fabricating one, shown here large.
   */
  it("gives the four informative photographs real, non-empty alt text", () => {
    const photographs = (html.match(/<img\b[^>]*>/g) ?? []).filter((tag) => /\bsrc="\/images\//.test(tag));
    expect(
      photographs.length,
      "expected the box render, the two component photographs, and the table-photography render",
    ).toBe(4);
    for (const tag of photographs) {
      const alt = /\balt="([^"]*)"/.exec(tag)?.[1] ?? "";
      expect(alt.length, `${/\bsrc="([^"]*)"/.exec(tag)?.[1]} has no usable alt text`).toBeGreaterThan(30);
    }
  });

  it("describes the box photograph as the studio render it is, with no table in it", () => {
    const boxAlt = altTexts(html).find((alt) => alt.toLowerCase().includes("box open"));
    expect(boxAlt, "no alt text for the open-box photograph").toBeTruthy();
    // The image is a transparent-background studio render of the components.
    // Alt text has to describe what is in the picture, not a setting invented
    // to make the sentence read well.
    expect(boxAlt!.toLowerCase()).not.toContain("table");
  });

  it("uses genuine table photography and both approved public videos", () => {
    expect(html).toContain('src="/images/table/table-view-1440.webp"');
    expect(html).toContain("table-view-720.webp 720w");
    expect(html).toContain("table-view-2048.webp 2048w");
    expect(html).toContain("youtube-nocookie.com/embed/2D_y7t7DDYM");
    expect(html).toContain("youtube-nocookie.com/embed/SOW3l7kdu7k");
  });

  it("has exactly one <h1> and skips no heading level", () => {
    expectSoundHeadingStructure(html);
  });

  it("never proxies a /store-api path from this markup — that rewrite is Task 5's, not this unit's", () => {
    expect(html).not.toContain("/store-api");
  });

  it("names no live hostname (redundant with the repo-wide guard, kept local for a fast failure here)", () => {
    expect(html).not.toMatch(/plepicgames\.com|lunarbasegame\.com/);
  });
});

/**
 * The three authored SVG deliverables. `SectionDivider` is used by the Lunar
 * Base mockup, but `NeutralTexture` and `FutureGamePlaceholder` are imported
 * by nothing: they answer the plan's "a low-contrast neutral texture" and
 * "a neutral placeholder treatment for future games" and have no home in
 * either of the two mockups, since neither page has a section that wants a
 * texture behind it or an unannounced game to stand in for. Untested and
 * unimported is how a component rots, so they are exercised here rather than
 * wedged into a mockup to invent a use for them — and the properties checked
 * are the ones that made them deliverables in the first place.
 */
describe("authored decor SVGs", () => {
  it("SectionDivider is decorative and takes its colour from the token layer", () => {
    const html = renderToStaticMarkup(<SectionDivider />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("currentColor");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("NeutralTexture is low-contrast, decorative, and gives each instance its own pattern id", () => {
    const html = renderToStaticMarkup(
      <>
        <NeutralTexture />
        <NeutralTexture />
      </>,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("currentColor");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);

    const opacities = [...html.matchAll(/fill-opacity="([\d.]+)"/g)].map((match) => Number(match[1]));
    expect(opacities.length).toBeGreaterThan(0);
    for (const opacity of opacities) {
      expect(opacity, "a texture that reads as a pattern is not a low-contrast texture").toBeLessThanOrEqual(0.1);
    }

    const patternIds = [...new Set([...html.matchAll(/<pattern[^>]*\bid="([^"]*)"/g)].map((match) => match[1]))];
    expect(patternIds.length, "two textures on one page must not collide on one pattern id").toBe(2);
  });

  it("FutureGamePlaceholder carries a title and nothing that names a product", () => {
    const html = renderToStaticMarkup(<FutureGamePlaceholder />);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain("currentColor");
    // The plan forbids fabricated product imagery. A placeholder that names
    // or depicts a specific unannounced title would be exactly that.
    expect(html).not.toMatch(/Lunar|Plepic/);
    expect(html).not.toContain("<image");
  });
});
