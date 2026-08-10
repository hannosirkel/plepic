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
 *   The basket has **no goods figure at all** in that state — not a figure of
 *   nothing — and the way to checkout is blocked. Excluding the line from the
 *   sum instead is what put a false price and a false total into the Article
 *   8(2) block on `/checkout`; see `cartTotals` in `src/lib/cart.ts`.
 *
 * ## The quantity field never disagrees with the basket
 *
 * A basket that says one thing while the field above it says another is a
 * misdisclosure, not a cosmetic bug: these figures feed the Article 8(2)
 * disclosure block on `/checkout`, and the two screens read the same state.
 * So the field is bound to a small reducer in `src/lib/cart.ts` with three
 * jobs, and this component is a binding over it rather than the place the
 * rules live:
 *
 * - **it resynchronises.** Whenever the line's quantity changes — an update
 *   landing, a scenario arriving, another tab — the field is set back to what
 *   the basket holds. The field showing `99` beside a line total for `10` is
 *   the state this removes;
 * - **it rejects rather than reinterprets.** A cleared field is not "one" and
 *   `-4` is not "empty the basket". An entry that is not a whole number in
 *   range is refused, the basket is left exactly as it was, and the message
 *   says so;
 * - **it says so the way this unit already says things.** The refusal is a
 *   `role="alert"` region wrapping the same `.fieldError` paragraph the
 *   checkout's per-field errors use, with `aria-invalid` and `aria-describedby`
 *   on the input — the pattern `CheckoutPageContent` and `ContactForm` already
 *   use, not a new one.
 *
 * One case is deliberately not a resynchronisation: when an accepted entry is
 * sent and the *action* fails, the field keeps what was asked for while the
 * basket keeps what it had. The basket-level `role="alert"` says "That did not
 * work. Nothing has changed. Try again in a moment.", every figure on both
 * screens still comes from the basket rather than the field, and retrying is
 * one press rather than retyping. `tests/shop-pages.test.tsx` records it.
 *
 * `min`, `max` and `step` stay on the input: they drive the spinner and are
 * read by assistive technology. They are not the enforcement — the control is
 * a button, not a form submit, so constraint validation never fires — and
 * `parseQuantityInput` is.
 *
 * The control stays a button rather than becoming a real submit inside a
 * per-line `<form>`, which would have made `min`/`max` live. A form here with
 * no `method` is the defect this unit's checkout form was failed for: before
 * hydration it would GET the typed quantity into the URL. Enter in the field
 * is wired to the same handler as the button instead, so a keyboard user loses
 * nothing.
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

import { basket, checkout as checkoutCopy, unavailableFigure } from "../../../../content/shop.js";
import { resolveCatalogue, resolveCataloguePlaceholders } from "../../lib/catalogue.js";
import {
  cartTotals,
  formatAmount,
  initialQuantityField,
  isAvailable,
  lineAmount,
  MAX_QUANTITY_PER_LINE,
  MIN_QUANTITY_PER_LINE,
  quantityFieldReducer,
  type CartLine,
  type QuantityFieldEvent,
} from "../../lib/cart.js";
import { useCart } from "../../lib/cart-store.js";
import type { LinePending } from "../../lib/mock-cart-actions.js";
import { CallToActionLink } from "../mockups/CallToActionLink.js";
import { resolveLinkHref } from "../mockups/link-target.js";
import styles from "../../styles/pages/shop.module.css";

/**
 * The one message a refused entry gets, composed with the accepted range —
 * see `basket.quantityError` in `content/shop.ts` for why the two numbers are
 * not written into the copy.
 */
const QUANTITY_ERROR_MESSAGE =
  `${basket.quantityError.prefix}${String(MIN_QUANTITY_PER_LINE)}` +
  `${basket.quantityError.rangeSeparator}${String(MAX_QUANTITY_PER_LINE)}` +
  `${basket.quantityError.suffix}`;

/**
 * What "Add … to your basket" says when the line is already at the limit —
 * composed with `MAX_QUANTITY_PER_LINE` for the same reason as the message
 * above. The add action refuses rather than clamping; see
 * `src/lib/mock-cart-actions.ts`.
 */
const LIMIT_ERROR_MESSAGE = `${basket.limitError.prefix}${String(MAX_QUANTITY_PER_LINE)}${basket.limitError.suffix}`;

function BasketLine({ line }: { readonly line: CartLine }) {
  const catalogue = resolveCatalogue();
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);
  const { pending, updateQuantity, remove } = useCart();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const [field, setField] = useState(() => initialQuantityField(line.quantity));

  /*
   * Resynchronise during render, not in an effect.
   *
   * This is React's documented way to adjust state when a prop changes: the
   * component re-renders immediately with the corrected value and the browser
   * never paints the stale one. An effect would paint `99` beside a basket
   * holding `10` for a frame, which is the very disagreement this exists to
   * remove. `field.settled` is the quantity the field was last synchronised
   * to, so this fires exactly once per landed change.
   */
  if (field.settled !== line.quantity) {
    setField(quantityFieldReducer(field, { kind: "settle", quantity: line.quantity }).state);
  }

  const state = pending[line.id];
  const busy = state !== undefined;
  const available = isAvailable(line);

  function dispatch(event: QuantityFieldEvent): void {
    const transition = quantityFieldReducer(field, event);
    setField(transition.state);
    if (transition.request !== null) updateQuantity(line.id, transition.request);
  }

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
            min={MIN_QUANTITY_PER_LINE}
            max={MAX_QUANTITY_PER_LINE}
            step={1}
            value={field.draft}
            readOnly={busy}
            aria-label={resolve(basket.quantityAccessibleLabel)}
            aria-invalid={field.rejection !== null}
            aria-describedby={field.rejection === null ? undefined : errorId}
            onChange={(event) => {
              dispatch({ kind: "type", value: event.currentTarget.value });
            }}
            onKeyDown={(event) => {
              // Enter in a lone field would submit a form if there were one.
              // There is not — see this module's doc comment — so it is wired
              // to the same handler the button uses.
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (busy) return;
              dispatch({ kind: "submit" });
            }}
          />
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          aria-disabled={busy}
          aria-label={resolve(basket.updateAccessibleLabel)}
          onClick={() => {
            if (busy) return;
            dispatch({ kind: "submit" });
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

      {/* Always in the document, so a refusal is announced rather than merely
          appearing — the same `display: contents` anchor the checkout uses for
          its error summary. */}
      <div className={styles.alertAnchor} role="alert">
        {field.rejection === null ? null : (
          <p id={errorId} className={styles.fieldError}>
            {QUANTITY_ERROR_MESSAGE}
          </p>
        )}
      </div>

      <p className={styles.lineTotal}>
        <span className={styles.rowLabel}>{basket.columns.lineTotal}</span>{" "}
        <strong>{available ? formatAmount(lineAmount(line), line.currency) : "—"}</strong>
      </p>

      {busy ? (
        <p className={styles.pending} role="status">
          {pendingLabel(state)}
        </p>
      ) : null}
    </li>
  );
}

/** What the `role="status"` line says while an action is in flight. */
function pendingLabel(state: LinePending | undefined): string {
  switch (state) {
    case "removing":
      return basket.removingLabel;
    case "adding":
      return basket.addingLabel;
    default:
      return basket.updatingLabel;
  }
}

export function BasketPageContent() {
  const catalogue = resolveCatalogue();
  const resolve = (text: string) => resolveCataloguePlaceholders(text, catalogue);
  const { lines, failure, add, busy } = useCart();

  // No address form here, so no zone and therefore no charge. The basket says
  // "Calculated at checkout", which is what `content/legal/shipping.ts` says
  // and is now true of two rates rather than one.
  const totals = cartTotals(lines, { deliveryZone: null });
  const blocked = lines.some((line) => !isAvailable(line));

  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.heading}>{basket.heading}</h1>
        <p className={styles.lede}>{basket.lede}</p>
      </div>

      {/* Two different refusals, two different sentences. "Try again in a
          moment" is true of an action that failed and false of a limit that
          will still be there in a moment. */}
      {failure === null ? null : (
        <p className={styles.error} role="alert">
          {failure === "limit" ? LIMIT_ERROR_MESSAGE : checkoutCopy.errors.actionFailed}
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
              {/* A line is being created, not updated. This said "Updating the
                  quantity…" while an empty basket gained its first item. */}
              {basket.addingLabel}
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
                {/* A basket holding something we cannot supply has no goods
                    figure — see `cartTotals` in `src/lib/cart.ts`. It used to
                    read as a formatted zero, which is a statement about a price rather
                    than the absence of one, and the same arithmetic put a
                    false price and total into the Article 8(2) block on
                    `/checkout`. */}
                <dd>
                  {totals.goodsAmount === null
                    ? unavailableFigure
                    : formatAmount(totals.goodsAmount, totals.currency)}
                </dd>
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
