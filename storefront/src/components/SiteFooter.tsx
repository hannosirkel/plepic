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
 * reuse" — and this unit does not commit them. So the row is text, not marks,
 * and that part is unchanged.
 *
 * **What changed on 2026-08-20 is that the destinations now resolve.** The two
 * social ids `content/routes.ts` declares had no configuration behind them in
 * any deployment, so every page rendered them as plain text; the operator
 * reported them as broken links, and they were. The rule this file already
 * stated is what governs both states: plain text stays *outside* a `<nav>`,
 * because a navigation landmark containing nothing navigable lies to a screen
 * reader user who jumps to it, and when the targets resolve the text becomes
 * anchors and the `<nav>` comes back with them. Both halves are now reachable
 * and both are exercised — a footer given no `externalTargets`, which is every
 * static mockup, still renders the text-only form.
 */
import {
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  ROUTE_PATHS,
  type ExternalTargetId,
  type Locale,
  type RouteId,
} from "../../../content/routes.js";
import { publisherShort } from "../../../content/publisher.js";
import { resolveLinkHref } from "./mockups/link-target.js";
import type { ExternalTargetUrls } from "../config/runtime-config.js";
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
   * `localizedLinkFor`. Defaults to the default locale, so an English page's
   * labels and link targets are unchanged.
   *
   * **Not "the English pages render exactly what they always have".** That
   * sentence stood here through a review pass and was wrong: this is the
   * component that adds the language-switcher `<nav>`, so the five English
   * legal pages each gained ten lines of markup. No URL moved and nothing else
   * changed — but the claim as written overstated it, which is precisely the
   * error the switcher's own doc four lines below does not make.
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
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`). Absent
   * — every static mockup — keeps the inert text row described above.
   */
  readonly externalTargets?: ExternalTargetUrls;
}

/** The social row, in the order the old site listed them. */
const SOCIAL_LINK_ORDER = [
  { target: "instagram", label: "Instagram" },
  { target: "facebook", label: "Facebook" },
] as const satisfies readonly { target: ExternalTargetId; label: string }[];

export function SiteFooter({
  locale = DEFAULT_LOCALE,
  route,
  externalTargets = {},
}: SiteFooterProps) {
  const strings = CHROME_STRINGS[locale];
  const social = SOCIAL_LINK_ORDER.map((entry) => ({
    ...entry,
    href: resolveLinkHref({ kind: "external", to: entry.target }, externalTargets),
  }));
  const navigableSocial = social.filter(
    (entry): entry is (typeof social)[number] & { href: string } => entry.href !== undefined,
  );
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

      {navigableSocial.length === social.length ? (
        <nav className={styles.social} aria-label={strings.socialNavLabel}>
          {navigableSocial.map((entry) => (
            <a key={entry.target} className={styles.socialLink} href={entry.href}>
              {entry.label}
            </a>
          ))}
        </nav>
      ) : (
        /* Mixed or unresolved: plain text, deliberately outside a <nav> — see
           the file comment. A <nav> holding one of two advertised destinations
           is the same lie in a smaller size. */
        <p className={styles.social}>
          {social.map((entry) => (
            <span key={entry.target} className={styles.socialLink}>
              {entry.label}
            </span>
          ))}
        </p>
      )}
    </footer>
  );
}
