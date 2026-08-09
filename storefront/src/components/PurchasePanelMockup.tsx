/**
 * The purchase panel — copy from `content/lunar-base.ts`'s `purchase` object,
 * laid out against `tokens.css`'s `--purchase-*` component tokens.
 *
 * Price, product name and the tax note are catalogue placeholders
 * (`{price}`, `{productName}`, `{taxNote}`), resolved against
 * `storefront/mock/catalogue.json` through `resolveCataloguePlaceholders` —
 * see `src/lib/catalogue.ts`. This is the job the two previous reviewers
 * correctly declined to do, because `content/` was not theirs; it is this
 * unit's, per the checkbox's "render every price and availability string
 * from data, never hardcoded." `availability` is likewise never a resolved
 * placeholder in `content/lunar-base.ts` (it is the literal string "In
 * stock") — this component renders the catalogue's own `inStock` flag rather
 * than that literal, so a future non-`InStock` mock catalogue state changes
 * what a buyer reads here instead of silently contradicting it.
 *
 * The wrapper carries `role="group"` rather than a bare `aria-label`. A
 * `<div>` with no role is `role="generic"`, and `aria-label` is not honoured
 * on a generic element — the label was silently discarded, leaving the panel
 * with no accessible name at all. `group` is the smallest role that takes
 * one.
 */
import { purchase } from "../../../content/lunar-base.js";
import { resolveCatalogue, resolveCataloguePlaceholders, type ResolvedCatalogue } from "../lib/catalogue.js";
import { CallToActionLink } from "./mockups/CallToActionLink.js";
import styles from "../styles/purchase-panel.module.css";

export interface PurchasePanelMockupProps {
  /** Defaults to the mock catalogue's own product — see `src/lib/catalogue.ts`. */
  readonly catalogue?: ResolvedCatalogue;
}

export function PurchasePanelMockup({ catalogue = resolveCatalogue() }: PurchasePanelMockupProps = {}) {
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);

  return (
    <div className={styles.panel} role="group" aria-label={`Buy ${catalogue.productName}`}>
      <p className={styles.productName}>{resolve(purchase.productName)}</p>
      <p className={styles.price}>{resolve(purchase.priceLine)}</p>
      <p className={styles.note}>{resolve(purchase.taxNote)}</p>
      <p className={styles.availability}>{catalogue.inStock ? "In stock" : "Out of stock"}</p>

      <dl className={styles.meta}>
        {purchase.notes.map((note) => (
          <div key={note.term} className={styles.metaRow}>
            <dt>{note.term}</dt>
            <dd>{resolve(note.detail)}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.actions}>
        {purchase.callsToAction.map((action) => (
          <CallToActionLink key={action.label} action={action} resolveLabel={resolve} />
        ))}
      </div>
    </div>
  );
}
