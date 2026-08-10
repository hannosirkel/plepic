"use client";

/**
 * `/checkout` — the screen `content/legal/terms.ts` describes.
 *
 * That page is merged, live and has been through two qualified legal reads,
 * and its doc comment says its checkout section "is written to match the
 * checkout screen exactly". It is therefore the specification for this file,
 * and the five sentences it states are not paraphrased here: they are read out
 * of the legal content object by `./checkout-terms.ts` and rendered verbatim.
 *
 * ## Article 8(2) CRD, which is what this layout is for
 *
 * > "The final button on the checkout page is labelled to say that pressing it
 * > places an order with an obligation to pay. Immediately above it you see,
 * > on one screen: the goods, the price of the goods, the shipping charge, the
 * > total, the delivery address and the delivery estimate."
 *
 * The "Your order" section is exactly those six disclosures, in exactly that
 * order, in one block whose last two elements are the consent line and the
 * button. Nothing is interposed between them. Everything else a buyer must be
 * told before being bound — how the contract forms, who pays return postage,
 * where the withdrawal conditions and the model form are, what happens to a
 * card number — sits **above** that block, in "Before you order", rather than
 * below the button where a reader could be bound without having passed it.
 *
 * ## There is no consent tick box, and that is the legal page's decision
 *
 * The consent line reads "**By placing the order** you confirm that you have
 * read and accept these terms and the privacy notice…". A tick box would
 * contradict the sentence a qualified reader wrote: it would make the
 * confirmation an act separate from placing the order. The line is rendered
 * immediately above the button instead, which is what it describes.
 *
 * ## The delivery address is user input, so empty is the state this builds
 *
 * Every field starts empty. There is no fixture of invented people, no stored
 * address, and no placeholder text imitating one. Validation is on submit,
 * per-field, tied to each input with `aria-describedby` and `aria-invalid`,
 * with an error summary that takes focus — the same pattern `ContactForm`
 * already uses on this site.
 *
 * ## The order button cannot place an order in this build, and says so
 *
 * Stripe elements and server-side Turnstile verification are deferred. The
 * card step is a labelled placeholder region and nothing else — no card field,
 * no fake card number, not even a disabled one. Pressing the order button runs
 * the real validation, then reports that nothing was charged and no order was
 * placed, because that is true. The alternative — a fabricated confirmation —
 * would tell a person a contract exists when none does.
 */

import { useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { checkout } from "../../../../content/shop.js";
import type { AddressFieldCopy } from "../../../../content/shop.js";
import { resolveCatalogue } from "../../lib/catalogue.js";
import {
  cartTotals,
  declaredShippingMethod,
  formatAmount,
  isAvailable,
} from "../../lib/cart.js";
import { useCart } from "../../lib/cart-store.js";
import { placeMockOrder, type MockScenario, type OrderOutcome } from "../../lib/mock-cart-actions.js";
import { CallToActionLink } from "../mockups/CallToActionLink.js";
import { resolveLinkHref } from "../mockups/link-target.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import {
  CARD_STATEMENT,
  CONFIRMATION_PROMISE,
  CONSENT_LINE,
  CONTRACT_FORMATION,
  DELIVERY_ESTIMATE,
  RETURN_POSTAGE,
} from "./checkout-terms.js";
import styles from "../../styles/pages/shop.module.css";

const FIELDS: readonly AddressFieldCopy[] = checkout.address.fields;

type AddressValues = Readonly<Record<string, string>>;

const EMPTY_ADDRESS: AddressValues = Object.fromEntries(FIELDS.map((field) => [field.name, ""]));

/** Deliberately permissive: enough to catch a typo, never enough to reject a real address. */
function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validate(values: AddressValues): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};

  for (const field of FIELDS) {
    const value = (values[field.name] ?? "").trim();
    if (value.length === 0) {
      errors[field.name] = `${checkout.errors.missingFieldPrefix}${field.label.toLowerCase()}.`;
      continue;
    }
    if (field.type === "email" && !isPlausibleEmail(value)) {
      errors[field.name] = checkout.errors.invalidEmail;
    }
  }

  return errors;
}

function isComplete(values: AddressValues): boolean {
  return Object.keys(validate(values)).length === 0;
}

export interface CheckoutPageContentProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
  /** The `?mock=` state this route was requested in — see `src/lib/mock-cart-actions.ts`. */
  readonly scenario: MockScenario | null;
  /** Overridden to `0` by tests so the order attempt resolves without a timer. */
  readonly latencyMs?: number;
}

export function CheckoutPageContent({
  turnstileSiteKey,
  nonce,
  scenario,
  latencyMs,
}: CheckoutPageContentProps) {
  const catalogue = resolveCatalogue();
  const { lines } = useCart();
  const baseId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLParagraphElement>(null);

  const [values, setValues] = useState<AddressValues>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [placing, setPlacing] = useState(scenario === "placing");
  const [outcome, setOutcome] = useState<OrderOutcome | null>(
    scenario === "error" ? { ok: false, reason: "order-failed" } : null,
  );

  const addressComplete = isComplete(values);
  const totals = useMemo(
    () => cartTotals(lines, { hasDeliveryAddress: addressComplete }),
    [lines, addressComplete],
  );
  const unavailable = lines.some((line) => !isAvailable(line));
  const errorList = FIELDS.filter((field) => errors[field.name] !== undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (placing) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    setOutcome(null);

    if (Object.keys(nextErrors).length > 0) {
      // Focus the summary rather than the first field: a keyboard or screen
      // reader user gets the whole list and can choose, which is what SC 3.3.1
      // is for. The summary's own links move focus to each field.
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    if (lines.length === 0 || unavailable) return;

    setPlacing(true);
    void placeMockOrder({ latencyMs, failing: scenario === "error" }).then((result) => {
      setPlacing(false);
      setOutcome(result);
      window.requestAnimationFrame(() => outcomeRef.current?.focus());
    });
  }

  if (lines.length === 0) {
    return (
      <>
        <div className={styles.intro}>
          <h1 className={styles.heading}>{checkout.heading}</h1>
        </div>
        <section className={styles.card} aria-labelledby="checkout-empty-heading">
          <h2 id="checkout-empty-heading" className={styles.sectionHeading}>
            {checkout.empty.heading}
          </h2>
          <p className={styles.body}>{checkout.empty.body}</p>
          <div className={styles.actions}>
            <CallToActionLink action={checkout.empty.link} />
          </div>
        </section>
      </>
    );
  }

  const outcomeMessage =
    outcome === null
      ? null
      : outcome.reason === "order-failed"
        ? checkout.errors.orderFailed
        : checkout.errors.paymentNotConnected;

  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.heading}>{checkout.heading}</h1>
        <p className={styles.lede}>{checkout.lede}</p>
      </div>

      {/* Always in the document, so anything put into it is announced rather
          than merely appearing. `display: contents`, so an empty one costs no
          box and no gap. */}
      <div className={styles.alertAnchor} role="alert">
        {errorList.length > 0 ? (
          <div className={styles.error} ref={errorSummaryRef} tabIndex={-1}>
            <h2 className={styles.errorHeading}>{checkout.errors.heading}</h2>
            <ul>
              {errorList.map((field) => (
                <li key={field.name}>
                  <a href={`#${baseId}-${field.name}`}>{errors[field.name]}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {outcomeMessage === null ? null : (
          <p className={styles.error} ref={outcomeRef} tabIndex={-1}>
            {outcomeMessage}
          </p>
        )}
        {unavailable ? <p className={styles.error}>{checkout.errors.unavailableLine}</p> : null}
      </div>

      <form className={styles.checkoutForm} onSubmit={handleSubmit} noValidate>
        <section className={styles.card} aria-labelledby="checkout-address-heading">
          <h2 id="checkout-address-heading" className={styles.sectionHeading}>
            {checkout.address.heading}
          </h2>
          <p className={styles.body}>{checkout.address.body}</p>

          <div className={styles.fields}>
            {FIELDS.map((field) => {
              const fieldId = `${baseId}-${field.name}`;
              const errorId = `${fieldId}-error`;
              const hintId = `${fieldId}-hint`;
              const error = errors[field.name];
              const describedBy = [
                field.hint === undefined ? null : hintId,
                error === undefined ? null : errorId,
              ]
                .filter((id): id is string => id !== null)
                .join(" ");

              return (
                <div className={styles.fieldGroup} key={field.name}>
                  <label className={styles.fieldLabel} htmlFor={fieldId}>
                    {field.label}
                  </label>
                  {field.hint === undefined ? null : (
                    <p id={hintId} className={styles.fieldHint}>
                      {field.hint}
                    </p>
                  )}
                  <input
                    id={fieldId}
                    className={styles.field}
                    name={field.name}
                    type={field.type}
                    required
                    autoComplete={field.autoComplete}
                    value={values[field.name] ?? ""}
                    aria-invalid={error !== undefined}
                    aria-describedby={describedBy === "" ? undefined : describedBy}
                    onChange={(event) => {
                      const next = event.currentTarget.value;
                      setValues((current) => ({ ...current, [field.name]: next }));
                    }}
                  />
                  {error === undefined ? null : (
                    <p id={errorId} className={styles.fieldError}>
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="checkout-delivery-heading">
          <h2 id="checkout-delivery-heading" className={styles.sectionHeading}>
            {checkout.delivery.heading}
          </h2>
          <dl className={styles.summary}>
            <div className={styles.summaryRow}>
              <dt>{checkout.delivery.methodLabel}</dt>
              <dd>{declaredShippingMethod.name}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{checkout.delivery.chargeLabel}</dt>
              <dd>
                {totals.shippingAmount === null
                  ? checkout.delivery.chargePending
                  : formatAmount(totals.shippingAmount, totals.currency)}
              </dd>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryProse}`}>
              <dt>{checkout.delivery.estimateLabel}</dt>
              <dd>{DELIVERY_ESTIMATE}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.card} aria-labelledby="checkout-payment-heading">
          <h2 id="checkout-payment-heading" className={styles.sectionHeading}>
            {checkout.payment.heading}
          </h2>
          <p className={styles.body}>{CARD_STATEMENT}</p>
          {/* The card step, deferred to Task 5. A labelled region and nothing
              else: no card field, no fabricated instrument, not even a
              disabled one. */}
          <div
            className={styles.cardPlaceholder}
            role="group"
            aria-label={checkout.payment.cardRegionLabel}
            data-checkout-placeholder="card"
          >
            <p className={styles.cardPlaceholderLabel}>{checkout.payment.cardRegionLabel}</p>
            <p className={styles.note}>{checkout.payment.cardRegionBody}</p>
          </div>

          <HoneypotField formName="checkout" />
          <div className={styles.turnstile}>
            <TurnstileWidget siteKey={turnstileSiteKey} nonce={nonce} formName="checkout" />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="checkout-before-heading">
          <h2 id="checkout-before-heading" className={styles.sectionHeading}>
            {checkout.beforeYouOrder.heading}
          </h2>
          <p className={styles.body}>{CONTRACT_FORMATION}</p>

          <h3 className={styles.subHeading}>{checkout.beforeYouOrder.returnPostageLabel}</h3>
          <p className={styles.body}>{RETURN_POSTAGE}</p>

          <h3 className={styles.subHeading}>{checkout.beforeYouOrder.withdrawalLabel}</h3>
          <p className={styles.body}>{checkout.beforeYouOrder.withdrawalBody}</p>
          <ul className={styles.linkList}>
            {checkout.beforeYouOrder.links.map((link) => (
              <li key={link.label}>
                <a href={resolveLinkHref(link.target)}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>

        {/* Article 8(2): the six disclosures, the consent line, the button.
            Nothing is inserted between them. */}
        <section className={styles.orderCard} aria-labelledby="checkout-order-heading">
          <h2 id="checkout-order-heading" className={styles.sectionHeading}>
            {checkout.order.heading}
          </h2>

          <dl className={styles.summary} aria-live="polite">
            <div className={styles.summaryRow}>
              <dt>{checkout.order.goodsLabel}</dt>
              <dd>
                {lines
                  .map((line) => `${line.productName} × ${String(line.quantity)}`)
                  .join(", ")}
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{checkout.order.goodsPriceLabel}</dt>
              <dd>{formatAmount(totals.goodsAmount, totals.currency)}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>{checkout.order.shippingLabel}</dt>
              <dd>
                {totals.shippingAmount === null
                  ? checkout.delivery.chargePending
                  : formatAmount(totals.shippingAmount, totals.currency)}
              </dd>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
              <dt>{checkout.order.totalLabel}</dt>
              <dd>
                {totals.orderAmount === null
                  ? checkout.order.totalPending
                  : formatAmount(totals.orderAmount, totals.currency)}
              </dd>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryProse}`}>
              <dt>{checkout.order.addressLabel}</dt>
              <dd>
                {addressComplete
                  ? FIELDS.map((field) => values[field.name]).join(", ")
                  : checkout.address.missingValue}
              </dd>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryProse}`}>
              <dt>{checkout.order.estimateLabel}</dt>
              <dd>{DELIVERY_ESTIMATE}</dd>
            </div>
          </dl>

          <p className={styles.note}>{catalogue.priceQualifiers}</p>

          <p className={styles.consentLine}>{CONSENT_LINE}</p>

          <button type="submit" className={styles.orderButton} aria-busy={placing}>
            {placing ? checkout.placingLabel : checkout.orderButtonLabel}
          </button>

          <p className={styles.note}>{CONFIRMATION_PROMISE}</p>
        </section>
      </form>
    </>
  );
}
