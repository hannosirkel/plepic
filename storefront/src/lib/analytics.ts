import { lineChargedAmount, type CartLine } from "./cart.js";

export type AnalyticsItem = Readonly<{
  variantId: string;
  name: string;
  unitAmount: number;
  currency: string;
  quantity?: number;
}>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

type CheckoutInput = Readonly<{ currency: string; value: number; items: readonly AnalyticsItem[] }>;
type PurchaseInput = CheckoutInput & Readonly<{ transactionId: string }>;
type PaymentFailureInput = Readonly<{
  failureStage: "stripe_confirmation" | "order_completion";
  currency?: string;
  value?: number;
}>;

let enabled = false;
const enabledListeners = new Set<() => void>();
const viewedProducts = new Set<string>();
let checkoutStarted = false;
const purchases = new Set<string>();

function major(amount: number): number {
  return amount / 100;
}

function items(value: readonly AnalyticsItem[]) {
  return value.map((item) => ({
    item_id: item.variantId,
    item_name: item.name,
    price: major(item.unitAmount),
    quantity: item.quantity ?? 1,
  }));
}

function emit(name: "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "payment_failure", parameters: object): void {
  try {
    if (!enabled || typeof window === "undefined") return;
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    const dataLayer = window.dataLayer;
    function gtag(..._arguments: unknown[]): void {
      // eslint-disable-next-line prefer-rest-params -- Google documents gtag commands as the function's Arguments object.
      dataLayer.push(arguments);
    }
    gtag("event", name, parameters);
  } catch {
    // Measurement is best-effort and must never affect commerce state.
  }
}

/**
 * Maps only complete, supplyable Store lines; cart and line ids never leave
 * this boundary.
 *
 * **Reports {@link lineChargedAmount}, not `line.unitAmount`.** `unitAmount`
 * is net since the basket-lines fix that followed 2026-08-29 — see
 * `CartLine.unitAmount`'s doc comment in `./cart.js` — but `add_to_cart`,
 * `begin_checkout` and `purchase` reported the tax-inclusive figure before
 * that fix and keep doing so here: reported revenue must not appear to drop
 * by the VAT rate for every EU visitor on the day a screen's decomposition
 * changed, when no money actually moved. See {@link lineChargedAmount}'s doc
 * comment for the reasoning and the alternative this rejects.
 */
export function analyticsItemsFromCartLines(lines: readonly CartLine[]): readonly AnalyticsItem[] | null {
  try {
    if (lines.length === 0) return null;
    const result: AnalyticsItem[] = [];
    let currency: string | null = null;
    for (const line of lines) {
      const charged = lineChargedAmount(line);
      if (
        line.availability !== "InStock" ||
        typeof line.variantId !== "string" || line.variantId.length === 0 ||
        typeof line.productName !== "string" || line.productName.length === 0 ||
        !Number.isInteger(charged) || !Number.isInteger(line.quantity) || line.quantity < 1 ||
        typeof line.currency !== "string" || line.currency.length === 0
      ) return null;
      const normalizedCurrency = line.currency.toUpperCase();
      if (currency !== null && currency !== normalizedCurrency) return null;
      currency = normalizedCurrency;
      result.push({
        variantId: line.variantId,
        name: line.productName,
        unitAmount: charged,
        currency: normalizedCurrency,
        quantity: line.quantity,
      });
    }
    return result;
  } catch {
    return null;
  }
}

export function setAnalyticsEnabled(next: boolean): void {
  const becameEnabled = !enabled && next;
  enabled = next;
  if (becameEnabled) {
    for (const listener of enabledListeners) {
      try { listener(); } catch { /* One measurement callback cannot affect another or the consent UI. */ }
    }
  }
}

export function onAnalyticsEnabled(callback: () => void): () => void {
  try {
    enabledListeners.add(callback);
    if (enabled) {
      try { callback(); } catch { /* Measurement is best-effort. */ }
    }
  } catch {
    // Registration itself must not affect the mounted commerce component.
  }
  return () => {
    try { enabledListeners.delete(callback); } catch { /* Best-effort cleanup. */ }
  };
}

export function emitViewItem(item: AnalyticsItem): void {
  try {
    if (viewedProducts.has(item.variantId) || !enabled) return;
    viewedProducts.add(item.variantId);
    const converted = items([item]);
    emit("view_item", { currency: item.currency.toUpperCase(), value: converted[0]!.price * converted[0]!.quantity, items: converted });
  } catch { /* Measurement is best-effort. */ }
}

export function emitAddToCart(item: AnalyticsItem): void {
  try {
    const converted = items([item]);
    emit("add_to_cart", { currency: item.currency.toUpperCase(), value: converted[0]!.price * converted[0]!.quantity, items: converted });
  } catch { /* Measurement is best-effort. */ }
}

export function emitBeginCheckout(input: CheckoutInput): void {
  try {
    if (checkoutStarted || input.items.length === 0 || !enabled) return;
    checkoutStarted = true;
    emit("begin_checkout", { currency: input.currency.toUpperCase(), value: major(input.value), items: items(input.items) });
  } catch { /* Measurement is best-effort. */ }
}

export function emitPurchase(input: PurchaseInput): void {
  try {
    if (purchases.has(input.transactionId) || !enabled) return;
    purchases.add(input.transactionId);
    emit("purchase", { transaction_id: input.transactionId, currency: input.currency.toUpperCase(), value: major(input.value), items: items(input.items) });
  } catch { /* Measurement is best-effort. */ }
}

export function emitPaymentFailure(input: PaymentFailureInput): void {
  try {
    const parameters: { failure_stage: PaymentFailureInput["failureStage"]; currency?: string; value?: number } = {
      failure_stage: input.failureStage,
    };
    if (input.currency !== undefined) parameters.currency = input.currency.toUpperCase();
    if (input.value !== undefined) parameters.value = major(input.value);
    emit("payment_failure", parameters);
  } catch { /* Measurement is best-effort. */ }
}
