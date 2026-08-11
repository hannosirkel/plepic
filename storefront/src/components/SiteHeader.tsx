"use client";

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
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_LOCALE, type Locale } from "../../../content/routes.js";
import { CHROME_STRINGS } from "../lib/chrome-strings.js";
import { localizedLinkFor } from "../lib/seo.js";
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
}

export function SiteHeader({
  wordmark,
  instanceId = "site-nav",
  locale = DEFAULT_LOCALE,
}: SiteHeaderProps) {
  const wordmarkSrc = wordmark === "dark" ? "/brand/plepic-wordmark-dark.svg" : "/brand/plepic-wordmark-primary.svg";
  const panelId = `${instanceId}-panel`;
  const strings = CHROME_STRINGS[locale];
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openMenu = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, []);
  const closeMenu = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeMenu, isOpen]);

  return (
    <header className={styles.header}>
      <a
        className={styles.brand}
        {...localizedLinkFor(locale, "home")}
        aria-label={strings.brandHomeLabel}
      >
        <img className={styles.wordmark} src={wordmarkSrc} alt="" width={162} height={54} />
      </a>

      <button
        className={`${styles.scrim} ${isOpen ? styles.scrimOpen : ""}`}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => closeMenu()}
      />

      <nav
        id={panelId}
        className={`${styles.nav} ${isOpen ? styles.navOpen : ""}`}
        aria-label={strings.primaryNavLabel}
      >
        <button ref={closeButtonRef} className={styles.closeButton} type="button" onClick={() => closeMenu()}>
          {strings.closeMenuLabel}
        </button>
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

      <div className={styles.actions}>
        <button
          ref={menuButtonRef}
          className={styles.menuButton}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={openMenu}
        >
          {strings.menuLabel}
        </button>
        <a className={styles.buy} {...localizedLinkFor(locale, "cart")}>
          {strings.basketLabel}
        </a>
      </div>
    </header>
  );
}
