/**
 * The chrome the two commercial routes share: the site header, a single
 * `<main>` column, and the site footer.
 *
 * The footer is not decoration here. Article 6(1)(h) CRD requires the
 * withdrawal conditions and the model withdrawal form to be available to the
 * consumer **before** the order is concluded, and specifically requires that
 * checkout is not the first point at which they become reachable. `SiteFooter`
 * carries Terms, Shipping, Returns and Privacy on every page of this site,
 * including the product page and the basket, which is what makes that true;
 * the links on the basket and checkout screens themselves are the last step of
 * a chain, not the whole of it.
 */
import type { ReactNode } from "react";

import { SiteFooter } from "../SiteFooter.js";
import type { ExternalTargetUrls } from "../../config/runtime-config.js";
import { SiteHeader } from "../SiteHeader.js";
import styles from "../../styles/pages/shop.module.css";

export interface ShopPageShellProps {
  /**
   * From runtime configuration (`getRuntimeConfig().externalTargets`), passed
   * to the footer's social row. Absent keeps it inert text.
   */
  readonly externalTargets?: ExternalTargetUrls;
  readonly children: ReactNode;
}

export function ShopPageShell({ children, externalTargets = {} }: ShopPageShellProps) {
  return (
    <div data-layer="publisher" className={styles.page}>
      <SiteHeader wordmark="primary" />
      <main className={styles.main}>{children}</main>
      <SiteFooter externalTargets={externalTargets} />
    </div>
  );
}
