/**
 * `CallToActionLink`'s WCAG 2.5.3 Label in Name fix.
 *
 * The real-world case this guards is content/publisher.ts's homepage "Buy"
 * CTA: `label: "Buy for {price}"`, `accessibleLabel: "Buy Lunar Base for
 * {price}"`. Before the fix, the raw `{price}` reached the accessible name
 * unresolved, and even resolved, "Buy for €25.00" is not a contiguous
 * substring of "Buy Lunar Base for €25.00" — the extra "Lunar Base" sits
 * between the two halves. See `CallToActionLink.tsx`'s doc comment for the
 * two-part fix this exercises.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CallToAction } from "../../content/schema.js";
import { CallToActionLink } from "../src/components/mockups/CallToActionLink.js";

function ariaLabel(html: string): string | undefined {
  return /aria-label="([^"]*)"/.exec(html)?.[1];
}

function visibleText(html: string): string {
  return (/<a[^>]*>([^<]*)<\/a>/.exec(html)?.[1] ?? /<span[^>]*>([^<]*)<\/span>/.exec(html)?.[1] ?? "").trim();
}

const buyAction: CallToAction = {
  label: "Buy for {price}",
  emphasis: "secondary",
  target: { kind: "route", to: "lunarBase", anchor: "buy" },
  accessibleLabel: "Buy Lunar Base for {price}",
};

const resolvePrice = (text: string): string => text.replaceAll("{price}", "€25.00");

describe("CallToActionLink: resolution reaches the accessible name, not only the visible label", () => {
  it("no longer leaks a raw {price} into aria-label", () => {
    const html = renderToStaticMarkup(<CallToActionLink action={buyAction} resolveLabel={resolvePrice} />);
    expect(html).not.toContain("{price}");
  });

  it("falls back to no aria-label (native accessible name) when the richer label is not a superset of the visible one", () => {
    const html = renderToStaticMarkup(<CallToActionLink action={buyAction} resolveLabel={resolvePrice} />);
    // "Buy Lunar Base for €25.00" does not contain "Buy for €25.00" as a
    // contiguous substring, so the component must not emit an aria-label
    // that fails WCAG 2.5.3 — it omits aria-label entirely and lets the
    // browser compute the accessible name from the link's own text content.
    expect(ariaLabel(html)).toBeUndefined();
    expect(visibleText(html)).toBe("Buy for €25.00");
  });

  it("the visible label is always a substring of the accessible name — the SC 2.5.3 invariant itself", () => {
    const html = renderToStaticMarkup(<CallToActionLink action={buyAction} resolveLabel={resolvePrice} />);
    const label = visibleText(html);
    const name = ariaLabel(html) ?? label; // no aria-label => accessible name is the visible text itself
    expect(name).toContain(label);
  });

  it("does honour a richer accessible label that genuinely contains the resolved visible label", () => {
    const action: CallToAction = {
      label: "Explore",
      emphasis: "primary",
      target: { kind: "route", to: "lunarBase" },
      accessibleLabel: "Explore the Lunar Base game page",
    };
    const html = renderToStaticMarkup(<CallToActionLink action={action} />);
    expect(ariaLabel(html)).toBe("Explore the Lunar Base game page");
    expect(ariaLabel(html)).toContain(visibleText(html));
  });

  it("renders no aria-label at all when content declares none", () => {
    const action: CallToAction = {
      label: "Explore Lunar Base",
      emphasis: "primary",
      target: { kind: "route", to: "lunarBase" },
    };
    const html = renderToStaticMarkup(<CallToActionLink action={action} />);
    expect(html).not.toContain("aria-label");
  });

  it("still renders inert text (no href) for an external target, with no aria-label", () => {
    const action: CallToAction = {
      label: "See the campaign",
      emphasis: "quiet",
      target: { kind: "external", to: "kickstarter-campaign" },
      accessibleLabel: "See the Lunar Base Kickstarter campaign",
    };
    const html = renderToStaticMarkup(<CallToActionLink action={action} />);
    expect(html).toContain("<span");
    expect(html).not.toContain("aria-label");
  });
});
