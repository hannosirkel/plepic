/**
 * The space a viewport-pinned consent banner has to pay for.
 *
 * `styles/consent-manager.module.css` pins the banner to the bottom of the
 * viewport with `position: fixed`, because a consent request a visitor only
 * meets by scrolling past the footer is not a consent request. A fixed
 * element is out of flow, so on its own it takes **no** space: it paints on
 * top of whatever happens to be under it and the document neither grows nor
 * scrolls to compensate. Measured in a real build, that banner is 154 CSS px
 * tall at a 390px viewport and 173 at 320 — 18% and 30% of the screen — and
 * with nothing reserved it left the footer's Imprint, Terms, Shipping,
 * Returns and Privacy links **permanently** underneath it: at the bottom of
 * the document there is no scroll left to give, so no amount of scrolling
 * could reveal them. A pointer user could not reach the statutory Imprint
 * until they answered the analytics question, and a keyboard user tabbing
 * into the contact form landed in a `subject` field that was 100% hidden —
 * WCAG 2.2 AA SC 2.4.11 Focus Not Obscured (Minimum).
 *
 * Both are one defect: no space was reserved. This module reserves it, and
 * it has to be measured rather than declared because the height is a
 * function of how the banner's sentence wraps, which is a function of the
 * viewport width and the visitor's font settings. It publishes that measured
 * height as a custom property on the document element, which
 * `styles/global.css` consumes **twice**:
 *
 * - `padding-block-end` on `body`, which lengthens the document so the last
 *   row of the footer can be scrolled clear of the banner; and
 * - `scroll-padding-block-end` on the scrolling element, which shrinks the
 *   scrollport the browser scrolls focus into, so a newly focused control
 *   lands *above* the banner instead of behind it.
 *
 * One without the other closes neither: scroll padding cannot scroll to
 * space that does not exist, and the extra space alone does not stop focus
 * landing under the banner higher up the page.
 *
 * The property is **removed**, not zeroed, the moment the banner goes away,
 * so a decided visitor's page is byte-for-byte the layout it would have had
 * if this component had never rendered.
 */

/** The custom property `styles/global.css` reads. Exported so a test can pin the pair together. */
export const CONSENT_RESERVED_SPACE_PROPERTY = "--consent-banner-block-size";

/** The minimum shape this module needs, so it is testable without a DOM. */
export interface MeasurableElement {
  getBoundingClientRect(): { readonly height: number };
}

/** The minimum shape this module needs of the element it writes the property to. */
export interface StyledElement {
  readonly style: {
    getPropertyValue(property: string): string;
    setProperty(property: string, value: string): void;
    removeProperty(property: string): void;
  };
}

/**
 * Measures `banner` and publishes its height on `root` as
 * {@link CONSENT_RESERVED_SPACE_PROPERTY}. Returns `true` when the property
 * changed, so a caller driven by a `ResizeObserver` can tell a real resize
 * from a re-measure of the same box.
 *
 * The height is rounded **up**: a fractional device-pixel shortfall is a row
 * of text clipped by the banner's own border, and reserving a whole extra
 * pixel costs nothing.
 *
 * Writing a custom property through the CSSOM is not an inline `style`
 * attribute as far as Content-Security-Policy is concerned — `src/lib/csp.ts`
 * sends `style-src 'self' 'nonce-…'` with no `'unsafe-inline'`, and this was
 * verified against a real build under that exact header. The same is *not*
 * true of a `style` attribute rendered into markup, which is why
 * `HoneypotField` uses a class.
 */
export function reserveConsentBannerSpace(root: StyledElement, banner: MeasurableElement): boolean {
  const next = `${Math.ceil(banner.getBoundingClientRect().height)}px`;
  if (root.style.getPropertyValue(CONSENT_RESERVED_SPACE_PROPERTY) === next) return false;
  root.style.setProperty(CONSENT_RESERVED_SPACE_PROPERTY, next);
  return true;
}

/** Gives the space back. Called when the banner unmounts and on every teardown. */
export function releaseConsentBannerSpace(root: StyledElement): void {
  root.style.removeProperty(CONSENT_RESERVED_SPACE_PROPERTY);
}
