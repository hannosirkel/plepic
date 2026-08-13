"use client";

import { useRef, useState } from "react";

import { createMedusaStoreClient } from "../../lib/medusa-client.js";
import type { ClientRuntimeConfig } from "../../lib/client-runtime-config.js";
import { forgetMedusaCartId, rememberMedusaCartId, storedMedusaCartId } from "../../lib/cart-store.js";
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
export function AddToCartButton({ label, variantId }: { readonly label: string; readonly variantId: string | null }) {
  const [state, setState] = useState<"idle" | "adding" | "error">("idle");
  const inFlight = useRef(false);
  const unavailable = variantId === null;
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
              const created = await sdk.store.cart.create({ region_id: regions[0]!.id });
              const createdCartId = created.cart.id;
              cartId = createdCartId;
              rememberMedusaCartId(createdCartId);
            }
            if (cartId === null) throw new Error("Medusa Store did not return a cart id");
            try {
              await sdk.store.cart.createLineItem(cartId, { variant_id: variantId, quantity: 1 });
            } catch {
              // A retired cart id must not trap a buyer in permanent retries.
              forgetMedusaCartId();
              throw new Error("The basket expired; try adding the game again");
            }
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
