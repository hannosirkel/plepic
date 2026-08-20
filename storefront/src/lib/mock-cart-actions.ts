/**
 * The mock cart actions — **the whole data layer Task 5 replaces**, and
 * nothing else.
 *
 * The checkbox this unit implements says Task 5 "swaps the data layer
 * underneath and changes no page composition", which is only a meaningful rule
 * if the data layer is small and named rather than a habit. It is this file
 * plus `storefront/mock/catalogue.json` and `storefront/mock/shipping.json`. No
 * component calls a network, computes a total, or knows how long an action
 * takes; they call these functions and render whatever comes back.
 *
 * **It is not a single import seam, and claiming otherwise would be wrong.**
 * `src/lib/cart-store.tsx` consumes the four basket actions, which is the seam
 * proper — but `src/components/shop/CheckoutPageContent.tsx` imports
 * {@link placeMockOrder}, {@link MockScenario} and {@link OrderOutcome}
 * directly, because the order attempt is the checkout's own submission and
 * belongs to that component's state rather than to the basket's. So Task 5
 * edits one composition component as well as this file. What that task is
 * actually held to is its screenshot baseline, and that survives: the
 * disclosure block, the consent line and the button are rendered from
 * `content/` and the totals in every case, so replacing the call changes no
 * layout. The two page files, `src/app/{cart,checkout}/page.tsx`, also import
 * from here, for `?mock=` and its gate.
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
 * `/checkout` are `noindex` and `Disallow`ed in `robots.txt`, and Task 5
 * deletes the file that reads it. **Page composition does not depend on it** —
 * the same components render the same layout whether a state arrived through
 * the parameter or through a button press.
 *
 * ### It is inert in production, and that is enforced rather than documented
 *
 * A scenario is not free of consequence: `src/lib/cart-store.tsx` writes the
 * requested basket into `sessionStorage`, deliberately, so that
 * `/cart?mock=filled` and the `/checkout` a developer navigates to next agree.
 * That is right where the parameter belongs and wrong everywhere else — a link
 * of the form `https://<the live site>/cart?mock=filled` sent to a stranger
 * would put an item in their basket. This module used to say the parameter
 * "affects nothing but this module's own fixtures"; it wrote to a real
 * visitor's session, so the sentence was false.
 *
 * {@link isMockLayerEnabled} is the sentence made true. The two page files ask
 * it before they parse the parameter at all, so on the live site there is no
 * scenario to honour, nothing is written, and `?mock=filled` is exactly a
 * `/cart` with an ignored query string.
 */

import { catalogueLine, clampQuantity, MAX_QUANTITY_PER_LINE, type CartLine } from "./cart.js";
import { mockCatalogue } from "./catalogue.js";
import { defaultDestination, type Destination } from "./destination.js";

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

/**
 * Development hostnames, where a browser is talking to a server somebody is
 * running by hand. `127.0.0.1` and `*.localhost` are the two origins this
 * repository's own rendering notes call trustworthy (the CSP sends
 * `upgrade-insecure-requests`, so plain HTTP anywhere else loads no
 * stylesheets); `localhost` is what `next dev` prints.
 */
const DEVELOPMENT_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The `Host` header without its port, lower-cased. Keeps a bracketed IPv6 literal whole. */
function bareHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (normalized.startsWith("[")) {
    const end = normalized.indexOf("]");
    return end === -1 ? normalized : normalized.slice(0, end + 1);
  }
  return normalized.split(":")[0] ?? "";
}

/**
 * Whether `?mock=` is honoured for a request to `host`.
 *
 * **Default deny.** The parameter is a development and review affordance, and
 * the answer is "no" unless the request is demonstrably not to a live public
 * site:
 *
 * - a hostname this deployment has declared to be a test hostname, which is
 *   the same validated `SITE_TEST_HOSTNAMES` set `src/proxy.ts` uses to send
 *   `X-Robots-Tag: noindex` and `robots.txt` uses to disallow everything. The
 *   test environment is behind Cloudflare Access with an explicit list of
 *   named accounts, so it has no passing strangers to send a link to; or
 * - a development host — see {@link DEVELOPMENT_HOSTS}.
 *
 * It takes the hostname set rather than the whole `SiteHostConfig` on purpose.
 * This module is imported by a client component, and `src/config/hosts.ts`
 * reaches `process.env`; passing the resolved list keeps the per-environment
 * *reading* on the server, in the two page files, where every other
 * per-environment value in this application is already read. Nothing is baked
 * into the image: the list arrives at runtime, exactly as the base URL and the
 * Turnstile site key do.
 */
export function isMockLayerEnabled(
  host: string | undefined,
  testHostnames: readonly string[],
): boolean {
  if (host === undefined) return false;

  const requested = bareHost(host);
  if (requested === "") return false;

  if (testHostnames.some((candidate) => bareHost(candidate) === requested)) return true;

  return DEVELOPMENT_HOSTS.has(requested) || requested.endsWith(".localhost");
}

/** What a line is currently doing. Drives the pending affordances and `aria-busy`. */
export type LinePending = "adding" | "updating" | "removing";

/** Why the basket is showing a refusal, or `null`. One key per sentence. */
export type BasketFailure = "action" | "limit";

export interface MockBasketState {
  readonly lines: readonly CartLine[];
  readonly pending: Readonly<Record<string, LinePending>>;
  /** A refused action's message key, or `null`. */
  readonly failure: BasketFailure | null;
}

export const EMPTY_BASKET: MockBasketState = { lines: [], pending: {}, failure: null };

/**
 * The basket a route renders for a given scenario. `null` is the empty default.
 *
 * The destination is threaded in because a mock line is priced like a real one
 * — the catalogue's gross amount inside the EU and its net amount elsewhere.
 * A mock basket that ignored it would paint figures no buyer can be shown, and
 * the qualification the checkout renders beside them would be the one thing on
 * the screen that was false. See `catalogueLine` in `./cart.js`.
 */
export function basketForScenario(
  scenario: MockScenario | null,
  destination: Destination = defaultDestination,
): MockBasketState {
  if (scenario === null) return EMPTY_BASKET;

  const line = catalogueLine(1, mockCatalogue, "lunar-base", destination);
  const unavailableLine: CartLine = { ...line, availability: "OutOfStock" };

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
  /** The destination a newly created line is priced for. See `basketForScenario`. */
  readonly destination?: Destination;
}

/**
 * `line-limit` is a refusal, not a failure, and the two are separate because
 * they say different things to a reader: "that did not work, try again in a
 * moment" is true of one and false of the other.
 */
export type CartActionOutcome =
  | { readonly ok: true; readonly lines: readonly CartLine[] }
  | { readonly ok: false; readonly reason: "action-failed" | "line-limit" };

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
  if (existing === undefined) {
    return { ok: true, lines: [catalogueLine(1, mockCatalogue, "lunar-base", options.destination)] };
  }

  /*
   * Refuses; never reinterprets — the same rule `parseQuantityInput` states
   * for a typed entry. This read `clampQuantity(existing.quantity + 1)`, which
   * turned an eleventh copy into a tenth *while the screen said "Adding it to
   * your basket…"*, and was the last place in this module that answered a
   * request with something other than what was asked for or a refusal. It is
   * unreachable from the served basket today (the add control only exists on
   * an empty one), which is precisely why it had to be fixed rather than
   * relied upon.
   */
  if (existing.quantity >= MAX_QUANTITY_PER_LINE) return { ok: false, reason: "line-limit" };

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
