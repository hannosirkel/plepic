/**
 * The language selector: how a reader moves between the editions of the site.
 * Rendered in the header and in the footer of every page, and on the 404.
 *
 * It is a `<nav>` of plain links and nothing else. There is no script, no
 * form and no cookie: an edition is chosen by the URL the reader opens, and
 * the links inside an edition keep its prefix, so the choice lasts for as
 * long as the reader browses. See `docs/current/locales.md`.
 *
 * **Which editions are listed.** The one being read, and every other edition
 * that publishes this page's route. An edition that does not publish the
 * route is left out, rather than linked at a URL that would answer 404.
 *
 * **What an entry says.** Each edition is named in its own language, so a
 * reader can find theirs without reading the page's. `lang` says which
 * language the name is in, and `hreflang` says which language the link leads
 * to. The edition being read is text marked `aria-current="true"`, never a
 * link to the page the reader is already on.
 */
import { LOCALES, LOCALE_DEFINITIONS, ROUTE_PATHS, type Locale, type RouteId } from "../../../content/routes.js";
import { CHROME_STRINGS, LANGUAGE_SWITCHER_LABELS } from "../lib/chrome-strings.js";
import { lookupPage } from "../lib/seo.js";
import { localizedPath } from "../lib/urls.js";
import styles from "../styles/language-selector.module.css";

export interface LanguageSelectorProps {
  /** The edition being read. */
  readonly locale: Locale;
  /**
   * The route of the page the selector sits on. Each link leads to the same
   * route in its edition. Absent on a page that is no route, which is the
   * 404: each link then leads to its edition's home page.
   */
  readonly route?: RouteId;
  /** Where the host places the selector, and in what colour. */
  readonly className?: string;
}

export function LanguageSelector({ locale, route = "home", className }: LanguageSelectorProps) {
  const editions = LOCALES.filter(
    (candidate) => candidate === locale || lookupPage(route, candidate) !== undefined,
  );

  return (
    <nav
      className={className === undefined ? styles.selector : `${styles.selector} ${className}`}
      aria-label={CHROME_STRINGS[locale].languageNavLabel}
    >
      {editions.map((edition) => {
        const { languageTag } = LOCALE_DEFINITIONS[edition];
        return edition === locale ? (
          <span key={edition} className={`${styles.entry} ${styles.current}`} lang={languageTag} aria-current="true">
            {LANGUAGE_SWITCHER_LABELS[edition]}
          </span>
        ) : (
          <a
            key={edition}
            className={styles.entry}
            href={localizedPath(edition, ROUTE_PATHS[route])}
            lang={languageTag}
            hrefLang={languageTag}
          >
            {LANGUAGE_SWITCHER_LABELS[edition]}
          </a>
        );
      })}
    </nav>
  );
}
