"use client";

import { useEffect, useRef, useState } from "react";

import { emitAddToCart, emitViewItem, onAnalyticsEnabled } from "../../lib/analytics.js";
import { createMedusaStoreClient } from "../../lib/medusa-client.js";
import type { ClientRuntimeConfig } from "../../lib/client-runtime-config.js";
import { forgetMedusaCartId, rememberMedusaCartId, storedMedusaCartId } from "../../lib/cart-store.js";
import { addStoreLine, createStoreCart } from "../../lib/store-cart.js";
import styles from "../../styles/mockups/call-to-action.module.css";

function runtimeConfig(): ClientRuntimeConfig {
  const element = document.getElementById("plepic-runtime-config");
  if (element?.textContent === null || element === null) throw new Error("Store runtime configuration is unavailable");
  return JSON.parse(element.textContent) as ClientRuntimeConfig;
}

/** Claims the click synchronously, before a state update can trigger a rerender. */
export function claimAddAttempt(inFlight: { current: boolean }): boolean {
  if (inFlight.current) return false;
  inFlight.current = true;
  return true;
}

/** The canonical CTA slot's only client behaviour: create/reuse a guest cart and add this variant. */
export function AddToCartButton({
  label,
  variantId,
  analyticsVariantId,
  productName,
  unitAmount,
  currency,
}: {
  readonly label: string;
  readonly variantId: string | null;
  readonly analyticsVariantId: string;
  readonly productName: string;
  readonly unitAmount: number;
  readonly currency: string;
}) {
  const [state, setState] = useState<"idle" | "adding" | "error">("idle");
  const inFlight = useRef(false);
  const unavailable = variantId === null;
  useEffect(() => {
    return onAnalyticsEnabled(() => emitViewItem({ variantId: analyticsVariantId, name: productName, unitAmount, currency }));
  }, [analyticsVariantId, currency, productName, unitAmount]);
  return (
    <button
      type="button"
      className={`${styles.cta} ${styles.primary} ${styles.linkReplacement}`}
      aria-busy={state === "adding"}
      disabled={unavailable || state === "adding"}
      onClick={() => {
        if (variantId === null || !claimAddAttempt(inFlight)) return;
        void (async () => {
          setState("adding");
          try {
            const sdk = createMedusaStoreClient(runtimeConfig().medusa);
            const stored = storedMedusaCartId();
            let cartId = stored;
            if (cartId === null) {
              const { regions } = await sdk.store.region.list({ limit: 2 });
              if (regions.length !== 1) throw new Error("Store must expose exactly one region");
              const createdCartId = await createStoreCart(sdk, regions[0]!.id);
              cartId = createdCartId;
              rememberMedusaCartId(createdCartId);
            }
            if (cartId === null) throw new Error("Medusa Store did not return a cart id");
            try {
              // Through `store-cart.js` rather than the SDK directly, so this
              // button and `/cart` reach the Store by one path. It does not
              // read the lines back, but a second way of adding one is how the
              // two drift.
              await addStoreLine(sdk, cartId, variantId);
            } catch {
              // A retired cart id must not trap a buyer in permanent retries.
              forgetMedusaCartId();
              throw new Error("The basket expired; try adding the game again");
            }
            emitAddToCart({ variantId, name: productName, unitAmount, currency });
            window.location.assign("/cart");
          } catch {
            inFlight.current = false;
            setState("error");
          }
        })();
      }}
    >
      {unavailable ? "Out of stock" : state === "adding" ? "Adding to basket…" : state === "error" ? "Try adding to basket again" : label}
    </button>
  );
}
