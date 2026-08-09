/**
 * The purchase panel — copy from `content/lunar-base.ts`'s `purchase` object,
 * laid out against `tokens.css`'s `--purchase-*` component tokens.
 *
 * Price, product name and the tax note are catalogue placeholders
 * (`{price}`, `{productName}`, `{taxNote}`); this mockup renders the literal
 * placeholder text rather than a fabricated figure, because resolving them
 * against a real catalogue is runtime wiring this unit does not do — see
 * `content/schema.ts`'s `PlaceholderSource` and the migration report.
 *
 * The wrapper carries `role="group"` rather than a bare `aria-label`. A
 * `<div>` with no role is `role="generic"`, and `aria-label` is not honoured
 * on a generic element — the label was silently discarded, leaving the panel
 * with no accessible name at all. `group` is the smallest role that takes
 * one.
 */
import { purchase } from "../../../content/lunar-base.js";
import { CallToActionLink } from "./mockups/CallToActionLink.js";
import styles from "../styles/purchase-panel.module.css";

export function PurchasePanelMockup() {
  return (
    <div className={styles.panel} role="group" aria-label="Buy Lunar Base">
      <p className={styles.productName}>{purchase.productName}</p>
      <p className={styles.price}>{purchase.priceLine}</p>
      <p className={styles.note}>{purchase.taxNote}</p>
      <p className={styles.availability}>{purchase.availability}</p>

      <dl className={styles.meta}>
        {purchase.notes.map((note) => (
          <div key={note.term} className={styles.metaRow}>
            <dt>{note.term}</dt>
            <dd>{note.detail}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.actions}>
        {purchase.callsToAction.map((action) => (
          <CallToActionLink
            key={action.label}
            action={action}
            resolveLabel={(label) => label.replace("{price}", purchase.priceLine)}
          />
        ))}
      </div>
    </div>
  );
}
