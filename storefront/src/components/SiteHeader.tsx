/**
 * Shared header markup for the two mockups. Uses only layer-1 `--nav-*`
 * tokens, so it repaints correctly whether the page around it is on the
 * publisher layer (homepage) or the Lunar Base layer (game page) — see
 * `design/tokens.css`.
 *
 * This is chrome, not one of the three composites the plan names, but a
 * "complete mockup" needs a header to be complete. Kept deliberately small:
 * four links and a wordmark, no mega-menu, no search, nothing this unit was
 * not asked to design.
 *
 * ---
 *
 * **The narrow viewport gets the same navigation, not less of it.** An
 * earlier revision hid `.link` outright below 640px, which deleted Lunar
 * Base, About and Support from every phone with no menu and no replacement —
 * a mobile mockup that is a wordmark and a Basket button is not the mobile
 * half of the deliverable. The links now move into a slide-in sheet built on
 * the `--nav-sheet-bg`, `--nav-sheet-width` and `--nav-scrim` tokens
 * `design/tokens.css` already ships for exactly this component and nothing
 * else had ever consumed.
 *
 * The mobile sheet is a button disclosure with an explicit controlled panel,
 * an in-sheet close action, Escape handling, and focus return. `Basket` stays
 * outside the sheet because the store's primary commercial affordance should
 * not require opening navigation first.
 *
 * The panel holds two landmarks side by side, the primary navigation and the
 * language selector, so it is a `<div>` and not a `<nav>` around both. On a
 * narrow viewport the whole panel is the sheet, and the selector is inside
 * it under the links.
 *
 * **Only the sheet's open state runs in the browser.** This component is a
 * Server Component and `SiteHeaderMenu` is the client part. The links, the
 * labels and the language selector are rendered here and handed to it as
 * children, so neither the page registry `localizedLinkFor` consults nor any
 * edition's copy is shipped to the browser for a header.
 */

import { DEFAULT_LOCALE, type Locale, type RouteId } from "../../../content/routes.js";
import { CHROME_STRINGS } from "../lib/chrome-strings.js";
import { LanguageSelector } from "./LanguageSelector.js";
import { localizedLinkFor } from "../lib/seo.js";
import { SiteHeaderMenu } from "./SiteHeaderMenu.js";
import styles from "../styles/site-header.module.css";

export interface SiteHeaderProps {
  /** Which wordmark variant reads correctly against this header's background. */
  readonly wordmark: "primary" | "dark";
  /**
   * Disambiguates the disclosure panel when two headers are rendered into
   * one document (for example, a style gallery).
   */
  readonly instanceId?: string;
  /**
   * The edition this header is chrome for. Labels come from
   * `CHROME_STRINGS[locale]`; every link comes from `localizedLinkFor`, so
   * it stays inside the edition wherever the edition publishes its target
   * and carries `hreflang` when it has to cross into another. The rule
   * itself is asserted against an independent expectation table in
   * `tests/locale-navigation.test.tsx` -- see `localizedLinkFor`'s note on
   * what is verified and how. Defaults to the default locale so the English
   * pages render what they always have.
   */
  readonly locale?: Locale;
  /**
   * The route of the page this header sits on, handed to `LanguageSelector`
   * so each edition's link leads to this same page there. Every route view
   * passes it. Absent, the links lead to each edition's home page.
   */
  readonly route?: RouteId;
}

export function SiteHeader({
  wordmark,
  instanceId = "site-nav",
  locale = DEFAULT_LOCALE,
  route,
}: SiteHeaderProps) {
  const wordmarkSrc = wordmark === "dark" ? "/brand/plepic-wordmark-dark.svg" : "/brand/plepic-wordmark-primary.svg";
  const panelId = `${instanceId}-panel`;
  const strings = CHROME_STRINGS[locale];

  return (
    <header className={styles.header}>
      <a
        className={styles.brand}
        {...localizedLinkFor(locale, "home")}
        aria-label={strings.brandHomeLabel}
      >
        <img className={styles.wordmark} src={wordmarkSrc} alt="" width={162} height={54} />
      </a>

      <SiteHeaderMenu
        panelId={panelId}
        closeLabel={strings.closeMenuLabel}
        menuLabel={strings.menuLabel}
        actions={
          <a className={styles.buy} {...localizedLinkFor(locale, "cart")}>
            {strings.basketLabel}
          </a>
        }
      >
        <nav className={styles.primary} aria-label={strings.primaryNavLabel}>
          <a className={styles.link} {...localizedLinkFor(locale, "lunarBase")}>
            Lunar Base
          </a>
          <a className={styles.link} {...localizedLinkFor(locale, "about")}>
            {strings.navAbout}
          </a>
          <a className={styles.link} {...localizedLinkFor(locale, "support")}>
            {strings.navSupport}
          </a>
        </nav>
        <LanguageSelector className={styles.language} locale={locale} route={route} />
      </SiteHeaderMenu>
    </header>
  );
}
