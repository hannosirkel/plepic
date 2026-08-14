"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { ClientRuntimeConfig } from "../../lib/client-runtime-config.js";
import { forgetMedusaCartId, storedMedusaCartId } from "../../lib/cart-store.js";
import { createMedusaStoreClient } from "../../lib/medusa-client.js";
import { completeStripeOrder, returnOrderDisclosure, type CompletedStoreOrder, type ReturnOrderDisclosure } from "../../lib/store-payment.js";
import { formatAmount } from "../../lib/cart.js";
import { resolveCatalogue } from "../../lib/catalogue.js";
import { checkout } from "../../../../content/shop.js";
import { PAYMENT_RETURN_ORDER_POST_PATH } from "./checkout-order-post.js";
import { CONFIRMATION_PROMISE, CONSENT_LINE, DELIVERY_ESTIMATE } from "./checkout-terms.js";
import styles from "../../styles/pages/shop.module.css";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import { PostPurchaseNewsletterForm } from "./PostPurchaseNewsletterForm.js";
import { emitPaymentFailure, emitPurchase } from "../../lib/analytics.js";

function browserRuntimeConfig(): ClientRuntimeConfig {
  const element = document.getElementById("plepic-runtime-config");
  if (element === null || element.textContent === null) {
    throw new Error("Store runtime configuration is unavailable");
  }
  return JSON.parse(element.textContent) as ClientRuntimeConfig;
}

/** Requires a fresh response before completing a redirect-based Stripe payment. */
export function StripePaymentReturn({
  turnstileSiteKey,
  nonce,
}: {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
}) {
  const catalogue = resolveCatalogue();
  const [order, setOrder] = useState<CompletedStoreOrder | null>(null);
  const [failed, setFailed] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [challengeRevision, setChallengeRevision] = useState(0);
  const [disclosure, setDisclosure] = useState<ReturnOrderDisclosure | null>(null);
  const [disclosureFailed, setDisclosureFailed] = useState(false);

  useEffect(() => {
    const cartId = storedMedusaCartId();
    if (cartId === null) { setDisclosureFailed(true); return; }
    let active = true;
    void createMedusaStoreClient(browserRuntimeConfig().medusa).store.cart.retrieve(cartId).then(
      (cart) => {
        if (!active) return;
        try { setDisclosure(returnOrderDisclosure(cart, cartId)); } catch { setDisclosureFailed(true); }
      },
      () => { if (active) setDisclosureFailed(true); },
    );
    return () => { active = false; };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (completing) return;
    const currentDisclosure = disclosure;
    if (currentDisclosure === null) return;
    const token = new FormData(event.currentTarget).get("cf-turnstile-response");
    if (typeof token !== "string" || token.trim().length === 0 || token.trim().length > 4096) {
      setFailed(true);
      return;
    }
    const cartId = storedMedusaCartId();
    if (cartId === null) {
      setFailed(true);
      return;
    }
    setCompleting(true);
    setFailed(false);
    void completeStripeOrder(
      createMedusaStoreClient(browserRuntimeConfig().medusa),
      cartId,
      token,
    ).then(
      (completed) => {
        if (currentDisclosure.analyticsItems !== null) {
          emitPurchase({
            transactionId: completed.orderId,
            currency: currentDisclosure.currency,
            value: currentDisclosure.orderAmount,
            items: currentDisclosure.analyticsItems,
          });
        }
        forgetMedusaCartId();
        setOrder(completed);
      },
      () => {
        emitPaymentFailure({
          failureStage: "order_completion",
          currency: currentDisclosure.currency,
          value: currentDisclosure.orderAmount,
        });
        setFailed(true);
        setChallengeRevision((value) => value + 1);
      },
    ).finally(() => setCompleting(false));
  }

  if (order !== null) {
    return (
      <section className={styles.card} aria-labelledby="payment-return-heading">
        <h1 id="payment-return-heading" className={styles.heading}>Order confirmed</h1>
        <p className={styles.body}>
          Your order number is {String(order.displayId)}. A confirmation will be sent by email.
        </p>
        <PostPurchaseNewsletterForm
          defaultEmail=""
          turnstileSiteKey={turnstileSiteKey}
          nonce={nonce}
        />
      </section>
    );
  }

  if (disclosure === null) {
    return (
      <section className={styles.card} aria-labelledby="payment-return-heading">
        <h1 id="payment-return-heading" className={styles.heading}>Complete your order</h1>
        {disclosureFailed ? (
          <p className={styles.error} role="alert">We could not load your current order details. <a href="/checkout">Return to checkout</a> before trying again.</p>
        ) : <p className={styles.body} role="status">Loading your order details…</p>}
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="payment-return-heading">
      <h1 id="payment-return-heading" className={styles.heading}>Complete your order</h1>
      <p className={styles.body}>Complete a fresh verification challenge to finish your order.</p>
      <form method="post" action={PAYMENT_RETURN_ORDER_POST_PATH} onSubmit={handleSubmit} noValidate>
        <div className={styles.turnstile}>
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            nonce={nonce}
            formName="checkout-return"
            resetKey={challengeRevision}
          />
        </div>
        <dl className={styles.summary}>
          <div className={styles.summaryRow}><dt>{checkout.order.goodsLabel}</dt><dd>{disclosure.goods}</dd></div>
          <div className={styles.summaryRow}><dt>{checkout.order.goodsPriceLabel}</dt><dd>{formatAmount(disclosure.goodsAmount, disclosure.currency)}</dd></div>
          <div className={styles.summaryRow}><dt>{checkout.order.shippingLabel}</dt><dd>{formatAmount(disclosure.shippingAmount, disclosure.currency)}</dd></div>
          <div className={styles.summaryRow}><dt>{checkout.order.totalLabel}</dt><dd>{formatAmount(disclosure.orderAmount, disclosure.currency)}</dd></div>
          <div className={styles.summaryRow}><dt>{checkout.order.addressLabel}</dt><dd>{disclosure.address}</dd></div>
          <div className={styles.summaryRow}><dt>{checkout.order.estimateLabel}</dt><dd>{DELIVERY_ESTIMATE}</dd></div>
        </dl>
        <p className={styles.note}>{catalogue.priceQualifiers}</p>
        <p className={styles.consentLine}>{CONSENT_LINE}</p>
        <button type="submit" className={styles.orderButton} disabled={completing}>
          {completing ? "Completing order…" : checkout.orderButtonLabel}
        </button>
        <p className={styles.note}>{CONFIRMATION_PROMISE}</p>
      </form>
      {failed ? (
        <>
          <p className={styles.error} role="alert">
            Check your basket before trying again. An order is shown only after the shop confirms it.
          </p>
          <p><a href="/checkout">Return to checkout</a></p>
        </>
      ) : null}
    </section>
  );
}
