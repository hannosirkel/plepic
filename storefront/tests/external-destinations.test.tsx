/**
 * The named external destinations a deployment configures, and the two
 * renderings each one has.
 *
 * This exists because of a defect that no test could have caught, since
 * nothing tested the assembly. Every layer was individually correct:
 * `content/routes.ts` declared `kickstarter-campaign`, `instagram` and
 * `facebook` as external target ids; `content/proof.ts` cited the first in a
 * link; `resolveLinkHref` returned a real `href` for any id it was given a URL
 * for; and `ProofStripSection` and `SiteFooter` both rendered an anchor when
 * they had one and inert text when they did not. What nothing did was put a
 * URL behind those three ids — `getRuntimeConfig` populated exactly one entry
 * of `externalTargets` — so the served site rendered "See the campaign",
 * "Instagram" and "Facebook" as grey text on every page, for months, and the
 * operator found it by clicking them.
 *
 * So the assertions here are deliberately end-to-end across that seam rather
 * than per-unit: given an environment, does the rendered markup contain a
 * usable link? A unit test of `resolveLinkHref` would have passed throughout.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EXTERNAL_TARGETS } from "../../content/routes.js";
import { getRuntimeConfig } from "../src/config/runtime-config.js";
import { RUNTIME_ENV_VARS } from "../src/config/runtime-env.js";
import { HomepageMockup } from "../src/components/mockups/HomepageMockup.js";
import { ProofStripSection } from "../src/components/ProofStripSection.js";
import { SiteFooter } from "../src/components/SiteFooter.js";

/** Reserved example values — this repository may name no live host. */
const CONFIGURED = {
  EXTERNAL_URL_KICKSTARTER_CAMPAIGN: "https://campaign.example.org/lunar-base",
  EXTERNAL_URL_INSTAGRAM: "https://social.example.org/instagram/example",
  EXTERNAL_URL_FACEBOOK: "https://social.example.org/facebook/example",
  EXTERNAL_URL_ORIGIN_STORY: "https://stories.example.org/origin",
} as const;

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]!);
}

describe("every external destination the site links to is configurable", () => {
  it("declares an environment variable for each id that copy actually links to", () => {
    /*
     * The four ids with no variable are not an oversight and must not be
     * "fixed" by adding four more: nothing in `content/` links to the video
     * pages, the retailer or the two listing sites, so a variable for them
     * would be configuration no page reads. If copy starts linking to one,
     * this list is where the omission becomes visible.
     */
    const configured = getRuntimeConfig(CONFIGURED).externalTargets;
    const unconfigurable = EXTERNAL_TARGETS.filter((id) => configured[id] === undefined);

    expect(unconfigurable).toEqual([
      "tabletopia-listing",
      "boardgamegeek-entry",
      "retailer-braetspilscafeen",
      "video-trailer",
      "video-tutorial",
    ]);
  });

  it("reads each new destination from the environment it is handed", () => {
    const config = getRuntimeConfig(CONFIGURED);

    expect(config.externalTargets["kickstarter-campaign"]).toBe(CONFIGURED.EXTERNAL_URL_KICKSTARTER_CAMPAIGN);
    expect(config.externalTargets.instagram).toBe(CONFIGURED.EXTERNAL_URL_INSTAGRAM);
    expect(config.externalTargets.facebook).toBe(CONFIGURED.EXTERNAL_URL_FACEBOOK);
    expect(config.externalTargets["origin-story"]).toBe(CONFIGURED.EXTERNAL_URL_ORIGIN_STORY);
  });

  it("keeps every new variable in the declared runtime set, so none is baked at build time", () => {
    for (const name of Object.keys(CONFIGURED)) {
      expect(RUNTIME_ENV_VARS).toContain(name);
    }
  });
});

describe("the proof strip's campaign link", () => {
  it("is a real anchor once the campaign URL is configured", () => {
    const config = getRuntimeConfig(CONFIGURED);
    const html = renderToStaticMarkup(<ProofStripSection externalTargets={config.externalTargets} />);

    expect(hrefs(html)).toContain(CONFIGURED.EXTERNAL_URL_KICKSTARTER_CAMPAIGN);
    expect(html).toContain("See the campaign");
  });

  it("is inert text when nothing configures it — the mockup path, unchanged", () => {
    const html = renderToStaticMarkup(<ProofStripSection />);

    expect(html).toContain("See the campaign");
    expect(hrefs(html)).toEqual([]);
  });
});

describe("the footer's social row", () => {
  it("becomes anchors inside a nav once both profiles resolve", () => {
    const config = getRuntimeConfig(CONFIGURED);
    const html = renderToStaticMarkup(<SiteFooter externalTargets={config.externalTargets} />);

    expect(hrefs(html)).toContain(CONFIGURED.EXTERNAL_URL_INSTAGRAM);
    expect(hrefs(html)).toContain(CONFIGURED.EXTERNAL_URL_FACEBOOK);
    expect(html).toContain('aria-label="Social"');
  });

  it("stays plain text outside a nav when neither profile resolves", () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    expect(html).toContain("Instagram");
    expect(html).toContain("Facebook");
    expect(html).not.toContain('aria-label="Social"');
  });

  /*
   * The partial case is the one worth pinning. A `<nav>` that advertises two
   * destinations and contains one is the same lie about a landmark that the
   * all-inert case avoids, only harder to notice — so a half-configured
   * deployment degrades to text rather than to a one-item navigation.
   */
  it("stays plain text when only one of the two profiles resolves", () => {
    const config = getRuntimeConfig({ EXTERNAL_URL_INSTAGRAM: CONFIGURED.EXTERNAL_URL_INSTAGRAM });
    const html = renderToStaticMarkup(<SiteFooter externalTargets={config.externalTargets} />);

    expect(html).not.toContain('aria-label="Social"');
    expect(hrefs(html)).not.toContain(CONFIGURED.EXTERNAL_URL_INSTAGRAM);
  });
});

describe("the homepage story heading", () => {
  /*
   * The operator's note of 2026-08-20 was that the origin-story link was
   * "unformatted" — a bare anchor in body type under the last paragraph. It is
   * now the section's heading. Both states are pinned because the interesting
   * one is the unconfigured deployment: a heading that vanishes with its
   * destination would take the section's accessible name with it, since
   * `aria-labelledby` points at it.
   */
  function storyHeading(html: string): string {
    return /<h2[^>]*id="story-heading"[^>]*>([\s\S]*?)<\/h2>/.exec(html)?.[1] ?? "";
  }

  it("is a link to the origin story when one is configured", () => {
    const config = getRuntimeConfig(CONFIGURED);
    const heading = storyHeading(renderToStaticMarkup(<HomepageMockup externalTargets={config.externalTargets} />));

    expect(heading).toContain(CONFIGURED.EXTERNAL_URL_ORIGIN_STORY);
    expect(heading).toContain("Origin Story");
  });

  it("is still a heading, with its text, when nothing configures the destination", () => {
    const heading = storyHeading(renderToStaticMarkup(<HomepageMockup />));

    expect(heading, "the section would lose its accessible name").not.toBe("");
    expect(heading).toContain("Origin Story");
    expect(heading, "a heading must not become a dead anchor").not.toContain("<a");
  });
});
