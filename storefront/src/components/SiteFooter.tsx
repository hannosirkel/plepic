/**
 * Shared footer markup for the two mockups.
 *
 * **The wordmark variant does not follow the page's token layer.** The footer
 * paints itself on `--surface-sunken`, which is dark on *both* layers —
 * `--plepic-navy` (#151b46) on the publisher layer and `--lunar-ink` on the
 * Lunar Base layer — so the mark that reads here is the light-on-dark one,
 * always. An earlier revision took a `wordmark` prop and let the caller pass
 * the page's layer through, which selected `plepic-wordmark-small-print.svg`
 * on the homepage: its letterforms are `#151B46`, i.e. the footer background,
 * 1.00:1, and the rendered footer showed nothing but the three coloured
 * E-bars. There is no correct value a caller could pass, so the prop is gone
 * rather than defaulted. `tests/site-chrome.test.tsx` measures every fill in
 * whichever mark this file names against `--surface-sunken` on both layers.
 *
 * The social row is a rights question, not a design decision: the platform
 * marks (Facebook, Instagram, Twitter, YouTube, Kickstarter) in
 * `~/lunarfiles/Web/Elements/Icons/` are the operator's asset manifest's own
 * flag — "adapt — confirm current platform brand-mark guidelines before
 * reuse" — and this unit does not commit them. The two social destinations
 * `content/routes.ts` declares (`instagram`, `facebook`) are external targets
 * with no URL resolvable in a static mockup (see `mockups/link-target.ts`),
 * so they render as plain text and *not* inside a `<nav>`: a navigation
 * landmark containing nothing navigable is a landmark that lies to a screen
 * reader user who jumps to it. When the targets resolve, the text becomes
 * anchors and the `<nav>` comes back with them.
 */
import { ROUTE_PATHS } from "../../../content/routes.js";
import { publisherShort } from "../../../content/publisher.js";
import styles from "../styles/site-footer.module.css";

/** Light-on-dark, unconditionally — see the file comment above. */
export const FOOTER_WORDMARK_SRC = "/brand/plepic-wordmark-dark.svg";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <img className={styles.wordmark} src={FOOTER_WORDMARK_SRC} alt="Plepic Games" width={140} height={47} />
        <p className={styles.tagline}>{publisherShort.text}</p>
      </div>

      <nav className={styles.legal} aria-label="Legal">
        <a href={ROUTE_PATHS.legalImprint}>Imprint</a>
        <a href={ROUTE_PATHS.legalTerms}>Terms</a>
        <a href={ROUTE_PATHS.legalShipping}>Shipping</a>
        <a href={ROUTE_PATHS.legalReturns}>Returns</a>
        <a href={ROUTE_PATHS.legalPrivacy}>Privacy</a>
      </nav>

      {/* Plain text, deliberately outside a <nav> — see the file comment above. */}
      <p className={styles.social}>
        <span className={styles.socialLink}>Instagram</span>
        <span className={styles.socialLink}>Facebook</span>
      </p>
    </footer>
  );
}
