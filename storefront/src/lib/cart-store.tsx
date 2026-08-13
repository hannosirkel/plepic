"use client";

/**
 * The live basket, and the only place cart state is held.
 *
 * `src/lib/cart.ts` owns the arithmetic and `src/lib/mock-cart-actions.ts`
 * owns the mock data layer; this file is the seam between them and the two
 * routes. Task 5 replaces the action module and this provider's persistence
 * with a Medusa cart id, and no component above it changes.
 *
 * ## Persistence: session storage, holding one opaque cart id and nothing else
 *
 * `/cart` and `/checkout` are separate documents, so the basket has to survive
 * a navigation. It is kept in **`sessionStorage`, not a cookie**, and that is
 * a compliance decision rather than a technical preference:
 * `content/legal/privacy.ts` truthfully describes this tab-scoped identifier.
 * A basket is in any case storage "strictly necessary for a service the
 * user explicitly requested" under ePrivacy Article 5(3) and needs no consent.
 *
 * **What is stored is only the opaque Medusa cart id.** Product details,
 * quantities, prices, email and postal addresses remain in Medusa and are
 * retrieved again for the current tab. Nothing about a person is written to
 * browser storage.
 *
 * **That sentence is also on `/legal/privacy`, as operator-approved copy: the
 * basket store records only that opaque id. Storing anything more here — a
 * product detail, shipping address, email address, or order draft — makes a
 * legal page false.** And it does so *quietly from this file*:
 * `tests/browser-storage-disclosure.test.ts` pins the write sites, so a new
 * module persisting something would go red, but a second key added inside this
 * one would not. The write is `setItem(STORAGE_KEY, …)`, an identifier, which
 * is why the guard stops at modules rather than keys. Read the hazard in
 * `README.md` before adding one; this is the checkout's shape, so Task 5 is
 * where it lands.
 *
 * ## Why the read is a layout effect and not a render
 *
 * Reading `sessionStorage` during render would make the client's first render
 * disagree with the server's HTML, which is a hydration error. Reading it in a
 * *layout* effect runs after hydration commits and **before the browser
 * paints**, so a restored basket is never visible as a flash of the empty
 * state. `useLayoutEffect` does nothing on the server, so the isomorphic alias
 * below picks `useEffect` there to avoid React's warning; the branch is on
 * `typeof window`, which is constant per environment.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { CartLine } from "./cart.js";
import { createMedusaStoreClient } from "./medusa-client.js";
import type { ClientRuntimeConfig } from "./client-runtime-config.js";
import { medusaMajorToMinor } from "./store-money.js";
import {
  addCatalogueLineAction,
  basketForScenario,
  removeLineAction,
  updateLineQuantityAction,
  type BasketFailure,
  type CartActionOutcome,
  type LinePending,
  type MockBasketState,
  type MockScenario,
} from "./mock-cart-actions.js";

const STORAGE_KEY = "plepic.medusa.cart-id";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function runtimeConfig(): ClientRuntimeConfig {
  const element = document.getElementById("plepic-runtime-config");
  if (element === null || element.textContent === null) throw new Error("Store runtime configuration is unavailable");
  return JSON.parse(element.textContent) as ClientRuntimeConfig;
}

export function cartLinesFromStore(cart: unknown): readonly CartLine[] {
  const value = cart as { items?: readonly { id?: string; title?: string; unit_price?: number; quantity?: number; variant?: { manage_inventory?: boolean; allow_backorder?: boolean; inventory_quantity?: number } }[]; currency_code?: string };
  if (!Array.isArray(value.items) || typeof value.currency_code !== "string") throw new Error("Medusa Store cart response is malformed");
  return value.items.map((line) => {
    if (typeof line.id !== "string" || typeof line.title !== "string" || !Number.isInteger(line.quantity)) throw new Error("Medusa Store cart line is malformed");
    const variant = line.variant;
    const available = variant?.manage_inventory !== true || variant.allow_backorder === true || (Number.isInteger(variant.inventory_quantity) && variant.inventory_quantity! > 0);
    return { id: line.id, productName: line.title, unitAmount: medusaMajorToMinor(line.unit_price, value.currency_code!), currency: value.currency_code!.toUpperCase(), quantity: line.quantity, availability: available ? "InStock" : "OutOfStock" };
  });
}

/** Reads only the opaque, tab-scoped cart identifier; no other module touches this key. */
export function storedMedusaCartId(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // A private-mode browser, a quota error, or a corrupted value. An empty
    // basket is the correct fallback: it is the honest default state, and it
    // is never wrong in a way that costs a buyer money.
    return null;
  }
}

/** The single audited browser-storage writer: only an opaque cart identifier. */
export function rememberMedusaCartId(id: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable. The basket still works for this document.
  }
}

/** Removes an expired cart identity so the next add can create a fresh guest cart. */
export function forgetMedusaCartId(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // A subsequent attempt may still create a cart for this document.
  }
}

export interface CartContextValue extends MockBasketState {
  readonly add: () => void;
  readonly updateQuantity: (id: string, quantity: number) => void;
  readonly remove: (id: string) => void;
  /** True while any line has an action in flight. */
  readonly busy: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  /** The scenario the route was requested with, or `null` for the real default. */
  readonly scenario: MockScenario | null;
  /** Overridden to `0` by tests so an action resolves without a timer. */
  readonly latencyMs?: number;
  readonly children: ReactNode;
}

export function CartProvider({ scenario, latencyMs, children }: CartProviderProps) {
  const initial = useMemo(() => basketForScenario(scenario), [scenario]);
  const [lines, setLines] = useState<readonly CartLine[]>(initial.lines);
  const [pending, setPending] = useState<Readonly<Record<string, LinePending>>>(initial.pending);
  const [failure, setFailure] = useState<BasketFailure | null>(initial.failure);
  const cartId = useRef<string | null>(null);
  const restored = useRef(false);
  /* The lines an in-flight action started from. A ref rather than a read
     inside a state updater: a reducer must stay pure, and an action that
     resolves after another has already landed must not resurrect the state it
     captured when it started. */
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const failing = scenario === "error";
  const options = useMemo(() => ({ latencyMs, failing }), [latencyMs, failing]);

  // Restore before the first paint; see this module's doc comment. A scenario
  // is an explicit request for a particular state and wins over the session —
  // which is a write to somebody's basket, so it is deliberately unreachable in
  // production: `src/app/{cart,checkout}/page.tsx` resolve `?mock=` through
  // `isMockLayerEnabled` and hand this provider `null` everywhere else.
  useIsomorphicLayoutEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (scenario !== null) {
      return;
    }
    const stored = storedMedusaCartId();
    if (stored === null) return;
    cartId.current = stored;
    void (async () => {
      try {
        const { cart } = await createMedusaStoreClient(runtimeConfig().medusa).store.cart.retrieve(stored);
        setLines(cartLinesFromStore(cart));
      } catch { forgetMedusaCartId(); cartId.current = null; setFailure("action"); }
    })();
  }, [scenario, initial.lines]);

  const run = useCallback(
    async (
      id: string,
      state: LinePending,
      action: (current: readonly CartLine[]) => Promise<CartActionOutcome>,
    ) => {
      setFailure(null);
      setPending((current) => ({ ...current, [id]: state }));
      let outcome: CartActionOutcome;
      try {
        outcome = await action(linesRef.current);
      } catch {
        if (scenario === null) { forgetMedusaCartId(); cartId.current = null; }
        outcome = { ok: false, reason: "action-failed" };
      }
      setPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      if (outcome.ok) setLines(outcome.lines);
      // A refusal and a failure are different sentences on the screen — see
      // `CartActionOutcome`.
      else setFailure(outcome.reason === "line-limit" ? "limit" : "action");
    },
    [scenario],
  );

  const add = useCallback(() => {
    // "adding", not "updating": nothing is being updated when the first line
    // of an empty basket is created, and the status line says what is
    // happening rather than what is usually happening.
    if (scenario !== null) {
      void run("lunar-base", "adding", (current) => addCatalogueLineAction(current, options));
      return;
    }
    void run("lunar-base", "adding", async () => {
      const sdk = createMedusaStoreClient(runtimeConfig().medusa);
      const id = cartId.current;
      const { products } = await sdk.store.product.list({ limit: 1, fields: "id,variants.*" });
      if (products.length !== 1 || products[0]?.variants?.[0] === undefined) throw new Error("Medusa Store catalogue is not ready");
      if (id === null) {
        const { regions } = await sdk.store.region.list({ limit: 2 });
        if (regions.length !== 1) throw new Error("Medusa Store catalogue is not ready");
        const created = await sdk.store.cart.create({ region_id: regions[0]!.id });
        const createdCartId = created.cart.id;
        cartId.current = createdCartId;
        rememberMedusaCartId(createdCartId);
        const updated = await sdk.store.cart.createLineItem(createdCartId, { variant_id: products[0].variants[0].id, quantity: 1 });
        return { ok: true, lines: cartLinesFromStore(updated.cart) };
      }
      const updated = await sdk.store.cart.createLineItem(id, { variant_id: products[0].variants[0].id, quantity: 1 });
      return { ok: true, lines: cartLinesFromStore(updated.cart) };
    });
  }, [run, options, scenario]);

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (scenario !== null) { void run(id, "updating", (current) => updateLineQuantityAction(current, id, quantity, options)); return; }
      if (cartId.current === null) { setFailure("action"); return; }
      void run(id, "updating", async () => ({ ok: true, lines: cartLinesFromStore((await createMedusaStoreClient(runtimeConfig().medusa).store.cart.updateLineItem(cartId.current!, id, { quantity })).cart) }));
    },
    [run, options, scenario],
  );

  const remove = useCallback(
    (id: string) => {
      if (scenario !== null) { void run(id, "removing", (current) => removeLineAction(current, id, options)); return; }
      if (cartId.current === null) { setFailure("action"); return; }
      void run(id, "removing", async () => ({ ok: true, lines: cartLinesFromStore((await createMedusaStoreClient(runtimeConfig().medusa).store.cart.deleteLineItem(cartId.current!, id)).parent) }));
    },
    [run, options, scenario],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      pending,
      failure,
      add,
      updateQuantity,
      remove,
      busy: Object.keys(pending).length > 0,
    }),
    [lines, pending, failure, add, updateQuantity, remove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (value === null) {
    throw new Error("useCart was called outside a CartProvider");
  }
  return value;
}
