"use client";

/**
 * The open and closed states of `SiteHeader`'s navigation sheet: the scrim,
 * the panel, its close action, the menu button, Escape handling and focus
 * return. The only part of the header that needs the browser.
 *
 * Everything inside the panel (`children`) and beside the menu button
 * (`actions`) is rendered by `SiteHeader` on the server, so this component
 * carries no copy and no routing of its own.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import styles from "../styles/site-header.module.css";

export interface SiteHeaderMenuProps {
  /** The panel's id, which the menu button names in `aria-controls`. */
  readonly panelId: string;
  readonly closeLabel: string;
  readonly menuLabel: string;
  /** The panel's contents: the primary navigation and the language selector. */
  readonly children: ReactNode;
  /** What follows the menu button outside the panel: the basket link. */
  readonly actions: ReactNode;
}

export function SiteHeaderMenu({ panelId, closeLabel, menuLabel, children, actions }: SiteHeaderMenuProps) {
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
    <>
      <button
        className={`${styles.scrim} ${isOpen ? styles.scrimOpen : ""}`}
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => closeMenu()}
      />

      <div id={panelId} className={`${styles.nav} ${isOpen ? styles.navOpen : ""}`}>
        <button ref={closeButtonRef} className={styles.closeButton} type="button" onClick={() => closeMenu()}>
          {closeLabel}
        </button>
        {children}
      </div>

      <div className={styles.actions}>
        <button
          ref={menuButtonRef}
          className={styles.menuButton}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={openMenu}
        >
          {menuLabel}
        </button>
        {actions}
      </div>
    </>
  );
}
