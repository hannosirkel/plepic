/**
 * The consent banner had **nothing that rendered it**. A hundred-line
 * stylesheet, a restructured DOM and a `position: fixed` shipped with a suite
 * that covered `parseStoredConsent` and `shouldLoadAnalytics` and nothing
 * else, and the two defects that escaped were both properties of the rendered
 * box rather than of either function:
 *
 * - at the bottom of the document the footer's Imprint, Terms, Shipping,
 *   Returns and Privacy links were *permanently* underneath the banner, with
 *   no scroll left to reveal them — a visitor could not reach the statutory
 *   Imprint until they answered the analytics question; and
 * - tabbing into the contact form focused a `subject` field that was 100%
 *   hidden behind it — WCAG 2.2 AA SC 2.4.11 Focus Not Obscured (Minimum).
 *
 * One property would have caught both: **a fixed banner reserves its own
 * height as page.** So that is what this file pins, from three directions,
 * because no single one of them is sufficient on its own:
 *
 * 1. the banner renders at all, with the roles, labels and controls it is
 *    supposed to have (`renderToStaticMarkup`, consistent with the rest of
 *    this suite — there is no jsdom in this tree);
 * 2. `reserveConsentBannerSpace` writes the **measured** height of the box it
 *    is given, and gives the space back on release; and
 * 3. the stylesheets agree with it — if `.banner` is `position: fixed`, then
 *    `global.css` must spend that measured property as *both*
 *    `padding-block-end` and `scroll-padding-block-end`. Either one alone
 *    closes neither failure: scroll padding cannot scroll into space that
 *    does not exist, and the space alone does not stop focus landing behind
 *    the banner higher up the page.
 *
 * Check 3 is written as an implication rather than as three unrelated
 * assertions on purpose. Reverting the banner to normal flow is a legitimate
 * design decision that makes the reservation unnecessary; shipping it fixed
 * without the reservation is the defect. The test tracks that distinction
 * instead of freezing today's choice.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConsentBanner, ConsentManager } from "../src/components/analytics/ConsentManager.js";
import {
  CONSENT_RESERVED_SPACE_PROPERTY,
  releaseConsentBannerSpace,
  reserveConsentBannerSpace,
} from "../src/lib/consent-reserved-space.js";

const storefrontDir = dirname(dirname(fileURLToPath(import.meta.url)));
const stylesDir = join(storefrontDir, "src", "styles");
const bannerCss = readFileSync(join(stylesDir, "consent-manager.module.css"), "utf8");
const globalCss = readFileSync(join(stylesDir, "global.css"), "utf8");

/** Strips comments so a rule quoted in prose cannot satisfy a check. */
function declarations(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** The declaration block of the first rule whose selector list contains `selector`. */
function ruleBody(css: string, selector: string): string {
  const source = declarations(css);
  const pattern = new RegExp(`(^|[,}])\\s*${selector}\\s*(,[^{]*)?\\{([^}]*)\\}`, "m");
  const match = pattern.exec(source);
  return match?.[3] ?? "";
}

/** Every declaration block of every rule that targets `selector`, concatenated. */
function allRuleBodies(css: string, selector: string): string {
  const source = declarations(css);
  const pattern = new RegExp(`(?:^|[,}])\\s*${selector}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, "gm");
  return [...source.matchAll(pattern)].map((match) => match[1]).join("\n");
}

describe("the banner renders", () => {
  const html = renderToStaticMarkup(<ConsentBanner onAccept={() => {}} onDecline={() => {}} />);

  it("is a labelled dialog a screen reader can announce", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Cookie and analytics consent"');
  });

  it("offers both decisions, as buttons and not as links", () => {
    expect(html).toMatch(/<button[^>]*data-testid="consent-accept"[^>]*>Agree<\/button>/);
    expect(html).toMatch(/<button[^>]*data-testid="consent-decline"[^>]*>Decline<\/button>/);
    expect(html).toContain('type="button"');
  });

  it("names the processor and links the privacy page, which is the lawful-basis disclosure", () => {
    expect(html).toContain("Google Analytics");
    expect(html).toContain('href="/legal/privacy"');
  });

  it("wears the site's own call-to-action classes rather than re-implementing focus and hit target", () => {
    expect(html).toMatch(/data-testid="consent-accept"[^>]*class="[^"]*cta/);
  });

  it("renders nothing at all on the server pass, so no banner can paint before the stored decision is read", () => {
    const served = renderToStaticMarkup(
      <ConsentManager isTestHost={false} measurementId={null} nonce="test-nonce" />,
    );
    expect(served).toBe("");
  });
});

describe("the banner reserves its own height as page", () => {
  interface FakeRoot {
    readonly style: {
      getPropertyValue(property: string): string;
      setProperty(property: string, value: string): void;
      removeProperty(property: string): void;
    };
    readonly written: Record<string, string>;
  }

  function fakeRoot(): FakeRoot {
    const written: Record<string, string> = {};
    return {
      written,
      style: {
        getPropertyValue: (property) => written[property] ?? "",
        setProperty: (property, value) => {
          written[property] = value;
        },
        removeProperty: (property) => {
          delete written[property];
        },
      },
    };
  }

  const banner = (height: number) => ({ getBoundingClientRect: () => ({ height }) });

  it("publishes the height it measured, not a height it was told", () => {
    const root = fakeRoot();
    reserveConsentBannerSpace(root, banner(154));
    expect(root.written[CONSENT_RESERVED_SPACE_PROPERTY]).toBe("154px");

    // The same banner at 320 CSS px is a different box. A per-breakpoint
    // constant would have to be right about this; a measurement cannot be wrong.
    reserveConsentBannerSpace(root, banner(173));
    expect(root.written[CONSENT_RESERVED_SPACE_PROPERTY]).toBe("173px");
  });

  it("rounds a fractional height up, because a rounded-down pixel clips a row of text", () => {
    const root = fakeRoot();
    reserveConsentBannerSpace(root, banner(153.4));
    expect(root.written[CONSENT_RESERVED_SPACE_PROPERTY]).toBe("154px");
  });

  it("reports whether it changed anything, so a resize observer cannot loop on its own writes", () => {
    const root = fakeRoot();
    expect(reserveConsentBannerSpace(root, banner(154))).toBe(true);
    expect(reserveConsentBannerSpace(root, banner(154))).toBe(false);
    expect(reserveConsentBannerSpace(root, banner(160))).toBe(true);
  });

  it("removes the property rather than zeroing it, so a decided visitor's layout is untouched", () => {
    const root = fakeRoot();
    reserveConsentBannerSpace(root, banner(154));
    releaseConsentBannerSpace(root);
    expect(CONSENT_RESERVED_SPACE_PROPERTY in root.written).toBe(false);
  });
});

describe("a fixed banner and the space it costs cannot be changed apart", () => {
  const bannerRule = ruleBody(bannerCss, "\\.banner");
  const isFixed = /position:\s*fixed/.test(bannerRule);

  it("reads the banner rule at all — the checks below are vacuous if this ever stops matching", () => {
    expect(bannerRule).toContain("inset-block-end");
  });

  it("either the banner is in normal flow, or global.css lengthens the page by the measured height", () => {
    if (!isFixed) return;
    const body = allRuleBodies(globalCss, "body");
    expect(body, "a fixed consent banner must reserve padding-block-end for itself").toMatch(
      new RegExp(`padding-block-end:\\s*var\\(\\s*${CONSENT_RESERVED_SPACE_PROPERTY}`),
    );
  });

  it("either the banner is in normal flow, or global.css keeps focus scrolling clear of it", () => {
    if (!isFixed) return;
    const html = allRuleBodies(globalCss, "html");
    expect(html, "a fixed consent banner must reserve scroll-padding-block-end for itself").toMatch(
      new RegExp(`scroll-padding-block-end:\\s*var\\(\\s*${CONSENT_RESERVED_SPACE_PROPERTY}`),
    );
  });

  it("both reservations fall back to zero, so no page pays for a banner it is not showing", () => {
    const reservations = [...declarations(globalCss).matchAll(
      new RegExp(`var\\(\\s*${CONSENT_RESERVED_SPACE_PROPERTY}\\s*,\\s*([^)]*)\\)`, "g"),
    )];
    expect(reservations.length).toBe(2);
    for (const match of reservations) expect((match[1] ?? "").trim()).toBe("0px");
  });

  it("has teeth: the same check fails against a fixed banner with nothing reserved", () => {
    const withoutReservation = declarations(globalCss).replace(/padding-block-end:[^;]*;/g, "");
    expect(
      new RegExp(`padding-block-end:\\s*var\\(\\s*${CONSENT_RESERVED_SPACE_PROPERTY}`).test(withoutReservation),
    ).toBe(false);
  });
});

describe("the canvas is painted, so a short page shows no user-agent white below its footer", () => {
  it("body carries a background from the layer tokens", () => {
    expect(allRuleBodies(globalCss, "body")).toMatch(/background:\s*var\(--surface/);
  });
});
