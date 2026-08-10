/**
 * The purchase panel — copy from `content/lunar-base.ts`'s `purchase` object,
 * laid out against `tokens.css`'s `--purchase-*` component tokens.
 *
 * Every figure here comes from `storefront/mock/catalogue.json` through
 * `src/lib/catalogue.ts`, never from a literal, per the checkbox's "render
 * every price and availability string from data, never hardcoded." The
 * product name is still a resolved `content/` placeholder (`{productName}`);
 * the price, its qualifiers and the stock statement are read straight off the
 * resolved catalogue, because `content/lunar-base.ts` has no placeholder
 * shaped like the slot each of them fills.
 *
 * **The price slot takes the figure, not the sentence.** It shipped rendering
 * `{priceLine}` — the amount, the tax note and the shipping note as one
 * sentence — at `--purchase-price-size`, which wrapped over five lines at
 * 1280 and six at 320, with `.note` beneath repeating the tax note. The
 * data binding was right and the string was wrong for its slot: `.price` now
 * holds `catalogue.price` (the bare amount, which is what a display figure
 * is for) and `.note` holds `catalogue.priceQualifiers` (the tax and shipping
 * notes, stated exactly once).
 *
 * `availability` is likewise never a resolved placeholder in
 * `content/lunar-base.ts` (it is the literal string "In stock") — this
 * component renders `catalogue.availabilityLabel` rather than that literal,
 * so a future non-`InStock` mock catalogue state changes what a buyer reads
 * here instead of silently contradicting it.
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
      <p className={styles.price}>{catalogue.price}</p>
      <p className={styles.note}>{catalogue.priceQualifiers}</p>
      <p className={styles.availability}>{catalogue.availabilityLabel}</p>

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
