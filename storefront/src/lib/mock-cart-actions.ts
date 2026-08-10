/**
 * The mock cart actions — **the whole data layer Task 5 replaces**, and
 * nothing else.
 *
 * The checkbox this unit implements says Task 5 "swaps the data layer
 * underneath and changes no page composition", which is only a meaningful rule
 * if the data layer is one seam rather than a habit. It is this file plus
 * `storefront/mock/catalogue.json` and `storefront/mock/shipping.json`. No
 * component calls a network, computes a total, or knows how long an action
 * takes; they call these four functions and render whatever comes back.
 *
 * ## The actions are asynchronous on purpose, and slower than they need to be
 *
 * A mock action that resolves synchronously has no loading state, so a layout
 * built against one has no loading state either — and the checkbox requires
 * "every empty, loading, and error state laid out". {@link DEFAULT_LATENCY_MS}
 * is long enough for the pending state to paint and be read by a screen
 * reader, and short enough not to be annoying. Task 5's real latency replaces
 * it; the states it drives are already built.
 *
 * ## Placing an order always fails, and that is the honest outcome
 *
 * Stripe elements and server-side Turnstile verification are deferred by the
 * checkbox, so this build genuinely cannot take a payment. The alternative to
 * failing would be to render a fabricated order confirmation — a screen
 * telling a person a contract exists when nothing was charged and no order was
 * recorded. {@link placeMockOrder} therefore resolves to
 * `payment-not-connected`, whose copy says exactly that: nothing charged, no
 * order placed. `content/legal/terms.ts` promises a confirmation email
 * containing the order and the total paid, and this build has no order and no
 * payment to put in one.
 *
 * ## The `?mock=` scenario parameter
 *
 * Every state below is reachable by using the pages normally, but the pending
 * and error states are transient by nature, which makes them awkward to
 * inspect on a real device or capture in a screenshot. {@link MockScenario}
 * lets a route be requested in a given state — `/cart?mock=updating`,
 * `/checkout?mock=error` — and it is honoured on the **server**, so the state
 * is in the first paint rather than appearing after hydration.
 *
 * It is part of the mock data layer and leaves with it: `/cart` and
 * `/checkout` are `noindex` and `Disallow`ed in `robots.txt`, the parameter
 * affects nothing but this module's own fixtures, and Task 5 deletes the file
 * that reads it. **Page composition does not depend on it** — the same
 * components render the same layout whether a state arrived through the
 * parameter or through a button press.
 */

import { catalogueLine, clampQuantity, type CartLine } from "./cart.js";

export const DEFAULT_LATENCY_MS = 450;

/**
 * A basket state a route can be requested in. See this module's doc comment.
 *
 * - `filled` — one line, quantity 1.
 * - `updating` / `removing` — that line, mid-action.
 * - `unavailable` — a line the catalogue cannot supply.
 * - `error` — a filled basket whose next action has already failed, and, on
 *   checkout, an order attempt that failed transiently rather than because
 *   payment is not connected.
 * - `placing` — checkout mid-submission, with the order button busy.
 */
export type MockScenario = "filled" | "updating" | "removing" | "unavailable" | "error" | "placing";

export const MOCK_SCENARIOS: readonly MockScenario[] = [
  "filled",
  "updating",
  "removing",
  "unavailable",
  "error",
  "placing",
];

/** The query parameter that carries a {@link MockScenario}. */
export const MOCK_SCENARIO_PARAM = "mock";

export function parseMockScenario(value: string | readonly string[] | undefined): MockScenario | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  return (MOCK_SCENARIOS as readonly string[]).includes(candidate)
    ? (candidate as MockScenario)
    : null;
}

/** What a line is currently doing. Drives the pending affordances and `aria-busy`. */
export type LinePending = "updating" | "removing";

export interface MockBasketState {
  readonly lines: readonly CartLine[];
  readonly pending: Readonly<Record<string, LinePending>>;
  /** A failed action's message key, or `null`. */
  readonly failure: "action" | null;
}

export const EMPTY_BASKET: MockBasketState = { lines: [], pending: {}, failure: null };

/** The basket a route renders for a given scenario. `null` is the empty default. */
export function basketForScenario(scenario: MockScenario | null): MockBasketState {
  if (scenario === null) return EMPTY_BASKET;

  const line = catalogueLine(1);
  const unavailableLine: CartLine = { ...catalogueLine(1), availability: "OutOfStock" };

  switch (scenario) {
    case "filled":
    case "placing":
      return { lines: [line], pending: {}, failure: null };
    case "updating":
      return { lines: [line], pending: { [line.id]: "updating" }, failure: null };
    case "removing":
      return { lines: [line], pending: { [line.id]: "removing" }, failure: null };
    case "unavailable":
      return { lines: [unavailableLine], pending: {}, failure: null };
    case "error":
      return { lines: [line], pending: {}, failure: "action" };
    default:
      return EMPTY_BASKET;
  }
}

export interface MockActionOptions {
  /** Overridden to `0` in tests. */
  readonly latencyMs?: number;
  /** Makes every action fail — the `error` scenario, and nothing else. */
  readonly failing?: boolean;
}

export type CartActionOutcome =
  | { readonly ok: true; readonly lines: readonly CartLine[] }
  | { readonly ok: false; readonly reason: "action-failed" };

function wait(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

export async function addCatalogueLineAction(
  lines: readonly CartLine[],
  options: MockActionOptions = {},
): Promise<CartActionOutcome> {
  await wait(options.latencyMs ?? DEFAULT_LATENCY_MS);
  if (options.failing === true) return { ok: false, reason: "action-failed" };

  const existing = lines[0];
  if (existing === undefined) return { ok: true, lines: [catalogueLine(1)] };
  return {
    ok: true,
    lines: [{ ...existing, quantity: clampQuantity(existing.quantity + 1) }, ...lines.slice(1)],
  };
}

export async function updateLineQuantityAction(
  lines: readonly CartLine[],
  id: string,
  quantity: number,
  options: MockActionOptions = {},
): Promise<CartActionOutcome> {
  await wait(options.latencyMs ?? DEFAULT_LATENCY_MS);
  if (options.failing === true) return { ok: false, reason: "action-failed" };

  const clamped = clampQuantity(quantity);
  if (clamped === 0) return { ok: true, lines: lines.filter((line) => line.id !== id) };

  return {
    ok: true,
    lines: lines.map((line) => (line.id === id ? { ...line, quantity: clamped } : line)),
  };
}

export async function removeLineAction(
  lines: readonly CartLine[],
  id: string,
  options: MockActionOptions = {},
): Promise<CartActionOutcome> {
  await wait(options.latencyMs ?? DEFAULT_LATENCY_MS);
  if (options.failing === true) return { ok: false, reason: "action-failed" };
  return { ok: true, lines: lines.filter((line) => line.id !== id) };
}

/**
 * Never succeeds — see this module's doc comment. `payment-not-connected` is
 * the state of this build; `order-failed` is what the `error` scenario shows,
 * so the transient-failure layout is built and reachable too.
 */
export type OrderOutcome = {
  readonly ok: false;
  readonly reason: "payment-not-connected" | "order-failed";
};

export async function placeMockOrder(options: MockActionOptions = {}): Promise<OrderOutcome> {
  await wait(options.latencyMs ?? DEFAULT_LATENCY_MS);
  return { ok: false, reason: options.failing === true ? "order-failed" : "payment-not-connected" };
}
