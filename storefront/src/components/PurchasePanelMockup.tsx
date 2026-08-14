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
 * **The price slot takes the figure and its tax qualification — the
 * operator's line, not a shorter one.** It shipped rendering `{priceLine}`
 * — the amount, the tax note and the shipping note as one sentence — at
 * `--purchase-price-size`, with `.note` beneath repeating the tax note. That
 * wrapped badly, and the first fix demoted the whole qualifier string to
 * `.note`: it stopped the wrap but moved "VAT included where applicable" into
 * the small print, where the operator's format has it in the **emphasised**
 * line beside the figure — which is how `/legal/shipping` had been rendering
 * it since the day the wording arrived.
 *
 * (The "five lines at 1280 and six at 320" that decision recorded is not a
 * number to reason from: it was measured while nothing in this repository
 * applied `--font-sans`, so it describes the page set in the user agent's
 * serif. The wrap was re-measured with the real stack loaded before this
 * change — see `purchase-panel.module.css`.)
 *
 * `.priceHeadline` is now the operator's emphasised line and `.note` is the
 * operator's second line — the boundary comes from
 * `src/lib/catalogue.ts`'s `priceHeadline` / `priceShippingNote` rather than
 * from this component's reading of one concatenated string. The wrap the
 * demotion was working around is answered where it belongs, in
 * `purchase-panel.module.css`: the figure keeps `--purchase-price-size` and
 * the qualification sits beside it at `--step--1` in the same inline flow, so
 * the emphasised block is **one line at 1280 and two at 390 and 320** —
 * against the three, three and four a single display-sized run measures in
 * this column.
 *
 * **The tax wording here has to be the wording `/legal/shipping` carries.** It
 * read a flat "VAT included", which is untrue of an export and is the claim the
 * second qualified read struck off the legal page (Minor 2). Leaving it here
 * would only have moved the contradiction to the more prominent page. Both now
 * read "VAT included where applicable", from the one resolver in
 * `src/lib/catalogue.ts` — so does the hero, which renders the same fields.
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
import {
  PRICE_HEADLINE_SEPARATOR,
  resolveCatalogue,
  resolveCataloguePlaceholders,
  type ResolvedCatalogue,
} from "../lib/catalogue.js";
import { CallToActionLink } from "./mockups/CallToActionLink.js";
import type { ReactNode } from "react";
import styles from "../styles/purchase-panel.module.css";

export interface PurchasePanelMockupProps {
  /** Defaults to the mock catalogue's own product — see `src/lib/catalogue.ts`. */
  readonly catalogue?: ResolvedCatalogue;
  /** Replaces only the existing primary CTA slot with the cart client island. */
  readonly primaryAction?: ReactNode;
}

export function PurchasePanelMockup({
  catalogue = resolveCatalogue(),
  primaryAction,
}: PurchasePanelMockupProps = {}) {
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);

  return (
    <div className={styles.panel} role="group" aria-label={`Buy ${catalogue.productName}`}>
      <p className={styles.productName}>{resolve(purchase.productName)}</p>
      {/* One paragraph, two type sizes, one inline flow — see this file's doc
          comment and `purchase-panel.module.css`. The figure and the tax
          qualification are one sentence to a screen reader and one emphasised
          block to a sighted reader, which is what the operator's format
          says. */}
      <p className={styles.priceHeadline}>
        <span className={styles.priceFigure}>{catalogue.price}</span>
        {`${PRICE_HEADLINE_SEPARATOR}${catalogue.priceTaxQualifier}`}
      </p>
      <p className={styles.note}>{catalogue.priceShippingNote}</p>
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
          action.emphasis === "primary" && primaryAction !== undefined ? primaryAction :
          <CallToActionLink key={action.label} action={action} resolveLabel={resolve} />
        ))}
      </div>
    </div>
  );
}
