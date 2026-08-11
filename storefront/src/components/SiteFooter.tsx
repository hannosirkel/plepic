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
import {
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
  type Locale,
  type RouteId,
} from "../../../content/routes.js";
import { publisherShort } from "../../../content/publisher.js";
import {
  CHROME_STRINGS,
  LANGUAGE_SWITCHER_LABELS,
  type LegalRouteId,
} from "../lib/chrome-strings.js";
import { localesPublishing, localizedLinkFor } from "../lib/seo.js";
import { localizedPath } from "../lib/urls.js";
import styles from "../styles/site-footer.module.css";

/** Light-on-dark, unconditionally — see the file comment above. */
export const FOOTER_WORDMARK_SRC = "/brand/plepic-wordmark-dark.svg";

/** The five legal links, in the order a reader meets the pages. */
const LEGAL_LINK_ORDER: readonly LegalRouteId[] = [
  "legalImprint",
  "legalTerms",
  "legalShipping",
  "legalReturns",
  "legalPrivacy",
];

export interface SiteFooterProps {
  /**
   * The edition this footer is chrome for. Labels come from
   * `CHROME_STRINGS[locale]`; the legal links stay inside the edition, per
   * `localizedHrefFor`. Defaults to the default locale so the English pages
   * render exactly what they always have.
   */
  readonly locale?: Locale;
  /**
   * The route of the page this footer sits on. When given, and when another
   * edition publishes the same route, the footer renders a language
   * switcher: one link per other publishing edition, at that edition's own
   * URL for **this** page, labelled in the target's own language with `lang`
   * and `hreflang` saying so. This is the one place a reader can cross
   * editions without retyping a URL — before it existed, `/et` had no
   * internal inbound link at all and no way back out but the browser bar.
   */
  readonly route?: RouteId;
}

export function SiteFooter({ locale = DEFAULT_LOCALE, route }: SiteFooterProps) {
  const strings = CHROME_STRINGS[locale];
  const alternates =
    route === undefined
      ? []
      : localesPublishing(route)
          .filter((candidate) => candidate !== locale)
          .map((candidate) => ({
            locale: candidate,
            href: localizedPath(candidate, ROUTE_PATHS[route]),
            label: LANGUAGE_SWITCHER_LABELS[candidate],
            languageTag: LOCALE_DEFINITIONS[candidate].languageTag,
          }));

  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <img className={styles.wordmark} src={FOOTER_WORDMARK_SRC} alt="Plepic Games" width={140} height={47} />
        <p className={styles.tagline}>{publisherShort.text}</p>
      </div>

      <nav className={styles.legal} aria-label={strings.legalNavLabel}>
        {LEGAL_LINK_ORDER.map((legalRoute) => (
          <a key={legalRoute} {...localizedLinkFor(locale, legalRoute)}>
            {strings.legalLinkLabels[legalRoute]}
          </a>
        ))}
      </nav>

      {alternates.length > 0 ? (
        <nav className={styles.legal} aria-label={strings.languageNavLabel}>
          {alternates.map((alternate) => (
            <a
              key={alternate.locale}
              href={alternate.href}
              lang={alternate.languageTag}
              hrefLang={alternate.languageTag}
            >
              {alternate.label}
            </a>
          ))}
        </nav>
      ) : null}

      {/* Plain text, deliberately outside a <nav> — see the file comment above. */}
      <p className={styles.social}>
        <span className={styles.socialLink}>Instagram</span>
        <span className={styles.socialLink}>Facebook</span>
      </p>
    </footer>
  );
}
