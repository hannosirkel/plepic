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
 * The disclosure is a checkbox, not script. Three reasons, in order of
 * weight: these mockups are rendered with `renderToStaticMarkup` in the
 * suite and have no client runtime at all; the next unit lifts this markup
 * into real routes, and a Server Component with no `"use client"` boundary
 * is the cheaper thing to inherit; and a sheet that depends on JavaScript is
 * a navigation that disappears when a bundle fails, which is the same defect
 * as `display: none` arriving by a slower route. `Basket` stays outside the
 * sheet, in the header bar, because a store's one commercial affordance
 * should not need two taps.
 *
 * ---
 *
 * **HAND-OFF TO `t2-pages`: this sheet is not shippable on a route as it
 * stands.** Not "revisit it if a client boundary turns up for other
 * reasons" — it needs the following work *before* it appears on a real
 * page, and the reason is that every gap below is a keyboard user's problem,
 * not a purist's:
 *
 * 1. **A real `<button aria-expanded>`.** The checkbox announces as "Menu,
 *    checkbox, not checked" — a state, where a disclosure should announce a
 *    name and an expanded/collapsed relationship to the thing it controls.
 * 2. **Escape must close it**, and
 * 3. **focus must return** to the control that opened it.
 * 4. **There is no close control inside the sheet.** With the sheet open,
 *    the only way back out by keyboard is Shift-Tab to the checkbox — and
 *    the checkbox's focus indicator paints on `.menuButton`, which sits in
 *    `.actions` with no stacking context, *underneath* the scrim at
 *    `z-index: 1`. So the one escape route is signposted by a focus ring the
 *    user cannot see. Raising `.actions` above the scrim would fix the
 *    symptom and change what the scrim means (Basket would become clickable
 *    through it), so it is deliberately left to the same change that adds
 *    the button, Escape and focus return, rather than patched here in
 *    isolation.
 *
 * What the checkbox does buy is real and is why it ships in a *mockup*:
 * these mockups are rendered with `renderToStaticMarkup` in the suite and
 * have no client runtime at all, so a script-driven disclosure could not be
 * exercised here in any form. The trade is recorded rather than papered over
 * with an `aria-*` attribute that would misdescribe the element to the
 * accessibility tree.
 */
import { ROUTE_PATHS } from "../../../content/routes.js";
import styles from "../styles/site-header.module.css";

export interface SiteHeaderProps {
  /** Which wordmark variant reads correctly against this header's background. */
  readonly wordmark: "primary" | "dark";
  /**
   * Disambiguates the disclosure's `id`/`for` pair when two headers are
   * rendered into one document (a style gallery, a side-by-side review
   * render). Duplicate ids would make the first header's checkbox drive both.
   */
  readonly instanceId?: string;
}

export function SiteHeader({ wordmark, instanceId = "site-nav" }: SiteHeaderProps) {
  const wordmarkSrc = wordmark === "dark" ? "/brand/plepic-wordmark-dark.svg" : "/brand/plepic-wordmark-primary.svg";
  const toggleId = `${instanceId}-toggle`;

  return (
    <header className={styles.header}>
      <a className={styles.brand} href={ROUTE_PATHS.home} aria-label="Plepic Games, home">
        <img className={styles.wordmark} src={wordmarkSrc} alt="" width={162} height={54} />
      </a>

      {/* Must precede .scrim and .nav: the sheet is driven by `:checked ~`. */}
      <input id={toggleId} className={styles.navToggle} type="checkbox" aria-label="Menu" />

      {/* Tapping outside the sheet closes it. Decorative and unlabelled — the
          same control is reachable as the visible Menu button below. */}
      <label className={styles.scrim} htmlFor={toggleId} aria-hidden="true" />

      <nav className={styles.nav} aria-label="Primary">
        <a className={styles.link} href={ROUTE_PATHS.lunarBase}>
          Lunar Base
        </a>
        <a className={styles.link} href={ROUTE_PATHS.about}>
          About
        </a>
        <a className={styles.link} href={ROUTE_PATHS.support}>
          Support
        </a>
      </nav>

      <div className={styles.actions}>
        <label className={styles.menuButton} htmlFor={toggleId}>
          Menu
        </label>
        <a className={styles.buy} href={ROUTE_PATHS.cart}>
          Basket
        </a>
      </div>
    </header>
  );
}
