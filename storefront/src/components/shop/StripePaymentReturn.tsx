"use client";

import { useEffect, useState } from "react";

import type { ClientRuntimeConfig } from "../../lib/client-runtime-config.js";
import { forgetMedusaCartId, storedMedusaCartId } from "../../lib/cart-store.js";
import { createMedusaStoreClient } from "../../lib/medusa-client.js";
import { completeStripeOrderWithRetry, type CompletedStoreOrder } from "../../lib/store-payment.js";
import styles from "../../styles/pages/shop.module.css";

function runtimeConfig(): ClientRuntimeConfig {
  const element = document.getElementById("plepic-runtime-config");
  if (element === null || element.textContent === null) {
    throw new Error("Store runtime configuration is unavailable");
  }
  return JSON.parse(element.textContent) as ClientRuntimeConfig;
}

/** Completes a redirect-based Stripe payment without persisting buyer details in the browser. */
export function StripePaymentReturn() {
  const [order, setOrder] = useState<CompletedStoreOrder | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const cartId = storedMedusaCartId();
    if (cartId === null) {
      setFailed(true);
      return;
    }
    let active = true;
    void completeStripeOrderWithRetry(createMedusaStoreClient(runtimeConfig().medusa), cartId).then(
      (completed) => {
        if (!active) return;
        forgetMedusaCartId();
        setOrder(completed);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (order !== null) {
    return (
      <section className={styles.card} aria-labelledby="payment-return-heading">
        <h1 id="payment-return-heading" className={styles.heading}>Order confirmed</h1>
        <p className={styles.body}>
          Your order number is {String(order.displayId)}. A confirmation will be sent by email.
        </p>
      </section>
    );
  }
  if (failed) {
    return (
      <section className={styles.card} aria-labelledby="payment-return-heading">
        <h1 id="payment-return-heading" className={styles.heading}>We could not confirm the order</h1>
        <p className={styles.error} role="alert">
          Check your basket before trying again. An order is shown only after the shop confirms it.
        </p>
        <p><a href="/checkout">Return to checkout</a></p>
      </section>
    );
  }
  return <p className={styles.body} role="status">Confirming your order…</p>;
}
