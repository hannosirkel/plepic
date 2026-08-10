"use client";

/**
 * The live basket, and the only place cart state is held.
 *
 * `src/lib/cart.ts` owns the arithmetic and `src/lib/mock-cart-actions.ts`
 * owns the mock data layer; this file is the seam between them and the two
 * routes. Task 5 replaces the action module and this provider's persistence
 * with a Medusa cart id, and no component above it changes.
 *
 * ## Persistence: session storage, holding a quantity and nothing else
 *
 * `/cart` and `/checkout` are separate documents, so the basket has to survive
 * a navigation. It is kept in **`sessionStorage`, not a cookie**, and that is
 * a compliance decision rather than a technical preference:
 * `content/legal/privacy.ts` carries a table captioned "Cookies this site can
 * set" listing exactly three, and `content/legal/` is not this unit's to edit
 * — a fourth cookie set by this site would make a merged, legally-read page
 * false. A basket is in any case storage "strictly necessary for a service the
 * user explicitly requested" under ePrivacy Article 5(3) and needs no consent.
 *
 * **What is stored is a product id and a quantity.** Never a price (the
 * catalogue is the only source of a figure, so a tampered or stale stored
 * price cannot reach a total), never an address, never anything about a
 * person.
 *
 * **That sentence is also on `/legal/privacy`, as operator-approved copy: the
 * basket store "records nothing but which game you chose and how many".
 * Storing anything more here — a shipping address, an email address, an order
 * draft — makes a legal page false, and no test will fail.** The guard walks
 * store *kinds*, not keys, so a second `sessionStorage` key is invisible to it.
 * Read the hazard in `README.md` before adding one; this is the checkout's
 * shape, so Task 5 is where it lands.
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

import { catalogueLine, clampQuantity, type CartLine } from "./cart.js";
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

const STORAGE_KEY = "plepic.basket";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface StoredLine {
  readonly id: string;
  readonly quantity: number;
}

function readStoredLines(): readonly CartLine[] | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const lines = (parsed as readonly StoredLine[])
      .filter((entry) => typeof entry?.id === "string" && typeof entry.quantity === "number")
      .map((entry) => catalogueLine(clampQuantity(entry.quantity), undefined, entry.id))
      .filter((line) => line.quantity > 0);

    return lines;
  } catch {
    // A private-mode browser, a quota error, or a corrupted value. An empty
    // basket is the correct fallback: it is the honest default state, and it
    // is never wrong in a way that costs a buyer money.
    return null;
  }
}

function writeStoredLines(lines: readonly CartLine[]): void {
  try {
    const stored: readonly StoredLine[] = lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
    }));
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage unavailable. The basket still works for this document.
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
      writeStoredLines(initial.lines);
      return;
    }
    const stored = readStoredLines();
    if (stored !== null && stored.length > 0) setLines(stored);
  }, [scenario, initial.lines]);

  useEffect(() => {
    writeStoredLines(lines);
  }, [lines]);

  const run = useCallback(
    async (
      id: string,
      state: LinePending,
      action: (current: readonly CartLine[]) => Promise<CartActionOutcome>,
    ) => {
      setFailure(null);
      setPending((current) => ({ ...current, [id]: state }));
      const outcome = await action(linesRef.current);
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
    [],
  );

  const add = useCallback(() => {
    // "adding", not "updating": nothing is being updated when the first line
    // of an empty basket is created, and the status line says what is
    // happening rather than what is usually happening.
    void run("lunar-base", "adding", (current) => addCatalogueLineAction(current, options));
  }, [run, options]);

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      void run(id, "updating", (current) =>
        updateLineQuantityAction(current, id, quantity, options),
      );
    },
    [run, options],
  );

  const remove = useCallback(
    (id: string) => {
      void run(id, "removing", (current) => removeLineAction(current, id, options));
    },
    [run, options],
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
