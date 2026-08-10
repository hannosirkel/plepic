"use client";

/**
 * `/cart` — the basket itself.
 *
 * Empty is the default state and is what an ordinary first visit renders: the
 * delivery address is user input and the basket starts with nothing in it.
 * There are no invented customers and no stored fixture of plausible people;
 * the only product is the one `storefront/mock/catalogue.json` describes.
 *
 * Every figure on this page is resolved from the catalogue and
 * `storefront/mock/shipping.json` through `src/lib/cart.ts`. Nothing here
 * writes an amount, and nothing here decides one.
 *
 * ## The four states, and how each is reached
 *
 * - **empty** — the default; no basket in this session.
 * - **filled** — after "Add … to your basket", or `?mock=filled`.
 * - **loading** — while a mock action is in flight (the quantity being
 *   updated, a line being removed), or `?mock=updating` / `?mock=removing`.
 *   The line is `aria-busy`, its controls carry `aria-disabled` and refuse a
 *   second press while the first is in flight, and a `role="status"` line says
 *   what is happening. **`aria-disabled`, not `disabled`**, for two reasons:
 *   a control that becomes `disabled` while it has focus drops focus to the
 *   body, so a keyboard user loses their place mid-action and can miss the
 *   status message; and `--button-disabled-fg` on `--button-disabled-bg`
 *   measures 4.12:1, which WCAG 1.4.3 exempts for an inactive component but
 *   which is not worth taking when the control does not need to look inactive
 *   at all — the status line is the affordance. `design/tokens.css` is not
 *   this unit's to change.
 * - **error** — a failed action, or `?mock=error`. The message is
 *   `role="alert"`, states that nothing changed, and leaves every control
 *   usable so retrying is simply pressing the button again.
 * - **unavailable** — a line the catalogue cannot supply (`?mock=unavailable`).
 *   It is excluded from the goods figure and blocks checkout rather than being
 *   quietly priced into a total we could not honour.
 *
 * ## Shipping is not priced here, deliberately
 *
 * `content/legal/shipping.ts` says shipping "is calculated at checkout once
 * you have entered a delivery address". This page has no address form, so the
 * shipping row says "Calculated at checkout" and the total says "Shown at
 * checkout" rather than showing a figure the legal page says does not exist
 * yet. The complete set — goods, price, shipping, total, address, estimate —
 * appears on `/checkout`, immediately above the order button, which is where
 * Article 8(2) CRD requires it.
 */

import { useId, useState } from "react";

import { basket, checkout as checkoutCopy } from "../../../../content/shop.js";
import { resolveCatalogue, resolveCataloguePlaceholders } from "../../lib/catalogue.js";
import {
  cartTotals,
  formatAmount,
  isAvailable,
  lineAmount,
  MAX_QUANTITY_PER_LINE,
  type CartLine,
} from "../../lib/cart.js";
import { useCart } from "../../lib/cart-store.js";
import { CallToActionLink } from "../mockups/CallToActionLink.js";
import { resolveLinkHref } from "../mockups/link-target.js";
import styles from "../../styles/pages/shop.module.css";

function BasketLine({ line }: { readonly line: CartLine }) {
  const catalogue = resolveCatalogue();
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);
  const { pending, updateQuantity, remove } = useCart();
  const fieldId = useId();
  const [draft, setDraft] = useState(String(line.quantity));

  const state = pending[line.id];
  const busy = state !== undefined;
  const available = isAvailable(line);

  return (
    <li className={styles.line} aria-busy={busy}>
      <div className={styles.lineHead}>
        <h3 className={styles.lineName}>{line.productName}</h3>
        <p className={styles.lineUnitPrice}>
          <span className={styles.rowLabel}>{basket.columns.unitPrice}</span>{" "}
          {formatAmount(line.unitAmount, line.currency)}
        </p>
      </div>

      {available ? null : (
        <p className={styles.lineUnavailable}>
          <strong>{basket.unavailableLabel}.</strong> {basket.unavailableNote}
        </p>
      )}

      <div className={styles.lineControls}>
        <div className={styles.quantityField}>
          <label className={styles.fieldLabel} htmlFor={fieldId}>
            {basket.quantityLabel}
          </label>
          <input
            id={fieldId}
            className={styles.quantityInput}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY_PER_LINE}
            step={1}
            value={draft}
            readOnly={busy}
            aria-label={resolve(basket.quantityAccessibleLabel)}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          aria-disabled={busy}
          aria-label={resolve(basket.updateAccessibleLabel)}
          onClick={() => {
            if (busy) return;
            updateQuantity(line.id, Number.parseInt(draft, 10));
          }}
        >
          {basket.updateLabel}
        </button>

        <button
          type="button"
          className={styles.quietButton}
          aria-disabled={busy}
          aria-label={resolve(basket.removeAccessibleLabel)}
          onClick={() => {
            if (busy) return;
            remove(line.id);
          }}
        >
          {basket.removeLabel}
        </button>
      </div>

      <p className={styles.lineTotal}>
        <span className={styles.rowLabel}>{basket.columns.lineTotal}</span>{" "}
        <strong>{available ? formatAmount(lineAmount(line), line.currency) : "—"}</strong>
      </p>

      {busy ? (
        <p className={styles.pending} role="status">
          {state === "removing" ? basket.removingLabel : basket.updatingLabel}
        </p>
      ) : null}
    </li>
  );
}

export function BasketPageContent() {
  const catalogue = resolveCatalogue();
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);
  const { lines, failure, add, busy } = useCart();

  const totals = cartTotals(lines, { hasDeliveryAddress: false });
  const blocked = lines.some((line) => !isAvailable(line));

  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.heading}>{basket.heading}</h1>
        <p className={styles.lede}>{basket.lede}</p>
      </div>

      {failure === null ? null : (
        <p className={styles.error} role="alert">
          {checkoutCopy.errors.actionFailed}
        </p>
      )}

      {lines.length === 0 ? (
        <section className={styles.card} aria-labelledby="basket-empty-heading">
          <h2 id="basket-empty-heading" className={styles.sectionHeading}>
            {basket.empty.heading}
          </h2>
          <p className={styles.body}>{basket.empty.body}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              aria-disabled={busy}
              onClick={() => {
                if (busy) return;
                add();
              }}
            >
              {resolve(basket.empty.addLabel)}
            </button>
            <CallToActionLink action={basket.empty.browse} />
          </div>
          {busy ? (
            <p className={styles.pending} role="status">
              {basket.updatingLabel}
            </p>
          ) : null}
        </section>
      ) : (
        <div className={styles.basketLayout}>
          <section className={styles.card} aria-labelledby="basket-lines-heading">
            <h2 id="basket-lines-heading" className={styles.sectionHeading}>
              {basket.linesHeading}
            </h2>
            <ul className={styles.lines}>
              {lines.map((line) => (
                <BasketLine key={line.id} line={line} />
              ))}
            </ul>
          </section>

          <section className={styles.summaryCard} aria-labelledby="basket-summary-heading">
            <h2 id="basket-summary-heading" className={styles.sectionHeading}>
              {basket.summary.heading}
            </h2>
            <dl className={styles.summary}>
              <div className={styles.summaryRow}>
                <dt>{basket.summary.goodsLabel}</dt>
                <dd>{formatAmount(totals.goodsAmount, totals.currency)}</dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>{basket.summary.shippingLabel}</dt>
                <dd>{basket.summary.shippingPending}</dd>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <dt>{basket.summary.totalLabel}</dt>
                <dd>{basket.summary.totalPending}</dd>
              </div>
            </dl>
            <p className={styles.note}>{catalogue.priceQualifiers}</p>
            <div className={styles.actions}>
              {blocked ? (
                <p className={styles.error}>{checkoutCopy.errors.unavailableLine}</p>
              ) : (
                <CallToActionLink action={basket.checkout} />
              )}
            </div>
          </section>
        </div>
      )}

      <section className={styles.card} aria-labelledby="basket-before-heading">
        <h2 id="basket-before-heading" className={styles.sectionHeading}>
          {basket.beforeYouBuy.heading}
        </h2>
        {basket.beforeYouBuy.body.map((paragraph) => (
          <p key={paragraph} className={styles.body}>
            {paragraph}
          </p>
        ))}
        <ul className={styles.linkList}>
          {basket.beforeYouBuy.links.map((link) => (
            <li key={link.label}>
              <a href={resolveLinkHref(link.target)}>{link.label}</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
