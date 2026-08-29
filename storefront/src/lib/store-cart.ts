/**
 * Talking to the Medusa Store about a cart, and reading its lines back.
 *
 * Every Store call that produces a `CartLine[]` is here, and every one of them
 * asks for {@link STORE_CART_FIELDS}. That is not tidiness — it is the whole
 * point of the module.
 *
 * ## Why this file exists
 *
 * **Medusa v2 does not compute per-line totals unless the request asks for
 * them.** `POST /store/carts/:id/line-items` and `GET /store/carts/:id` both
 * answer with `items[].total`, `items[].subtotal` and `items[].tax_total`
 * *absent* — not zero, not wrong, missing — while the cart-level `item_total`
 * is computed and correct. Adding `fields=+items.total,…` to the same request
 * returns them.
 *
 * {@link cartLinesFromStore} reads each line's `total`, so against a real
 * Medusa it threw on **every** add, every restore, every quantity change and
 * every removal, in every environment, for as long as the Store path has
 * existed. The failure surfaced as a basket that stayed empty and the message
 * "That did not work. Nothing has changed." — and, from the product page, as a
 * button that appeared to do nothing at all: it created the cart, navigated to
 * `/cart`, and the restore threw and cleared the id it had just stored.
 *
 * **Nothing caught it, and the reason is worth keeping.** The mock cart layer
 * satisfies every one of these assertions, so all 2,994 unit tests and all 47
 * browser tests passed with the real path broken; the browser suite drives the
 * mock layer, and the store smoke check asked the catalogue a question but
 * never built a cart. The plan's own residual list already said the production
 * checkout block "has never been rendered by any test". This was that, cashed
 * in.
 *
 * So the field list is not repeated at five call sites where a sixth would
 * forget it. A caller that wants cart lines calls one of the functions here,
 * and `tests/store-cart.test.ts` asserts that each of them sends the fields —
 * while the smoke suite asserts, against a running Medusa, that those fields
 * are the ones the parser actually needs. Neither test alone would have caught
 * the defect: the first pins what we send, the second pins what comes back.
 */

import type { CartLine } from "./cart.js";
import { medusaMajorToMinor } from "./store-money.js";
import type { createMedusaStoreClient } from "./medusa-client.js";

type StoreClient = ReturnType<typeof createMedusaStoreClient>;

/**
 * The Store cart fields this module's parser needs, beyond the default set.
 *
 * `+` is Medusa's "in addition to the default selection" prefix, so this adds
 * to the standard cart response rather than replacing it.
 *
 * **Dropping the `+` for an explicit list is not the safer option it looks
 * like.** The sigil is the one character here that anything between the browser
 * and Medusa might normalise, so replacing the list with a fully spelled-out
 * selection is a tempting way to remove that hazard. Measured against a running
 * Medusa, it returns `item_total: 0` and `line.total: 0` — the totals are
 * *computed* for the default selection, and a selection that replaces it gets
 * the columns without the computation. A basket priced at zero is a worse
 * defect than the one being avoided.
 *
 * The hazard itself was measured too, and is not real: the same request answers
 * identically with the `+` percent-encoded, sent literally, or decoded to a
 * leading space, because Medusa trims the field name. So this list is robust to
 * whatever a proxy does to it, and that is a fact rather than a hope.
 *
 * - `items.total` — the line figure the basket is priced from. The one the
 *   defect was about.
 * - `items.subtotal`, `items.tax_total` — not read here, requested because a
 *   line total with no way to see the tax inside it is the figure this shop
 *   already got wrong once, and a reader debugging a basket needs all three in
 *   the response they are looking at.
 * - `items.variant.*` — availability and the variant id. Without it every line
 *   silently reports `InStock`, because the availability test is written to
 *   treat an absent variant as unmanaged inventory, and the analytics event
 *   that matches a line by variant id never fires.
 */
export const STORE_CART_FIELDS =
  "+items.total,+items.subtotal,+items.tax_total,+items.variant.*";

/** The query every cart request in this module sends. */
const CART_QUERY = { fields: STORE_CART_FIELDS } as const;

/**
 * The basket's lines, priced the way the buyer will be charged.
 *
 * **`item_total` and each line's `total`, never `unit_price`.** `unit_price` is
 * the stored price, and the stored price is **net**: a basket built from it
 * stated the net figure for goods Medusa charges the gross one for, on the
 * screen whose figures feed the Article 8(2) disclosure block on `/checkout`.
 * Medusa's `cart.item_total` is line items after discounts **including** tax,
 * which is what `./store-checkout.js` argues for at length on the checkout path
 * and what `./store-payment.js` already read on the confirmation path. This is
 * the basket agreeing with both.
 *
 * {@link CartLine.unitAmount} stays this — the **charged**, tax-inclusive
 * figure — unchanged by the 2026-08-29 decomposition change: it is what the
 * basket's own "Price" and "Line total" columns state, and what
 * `emitAddToCart` reports, and neither of those moved. What moved is
 * {@link CartLine.taxAmount}, added in the same change: each line's own
 * `subtotal` — Medusa's net figure for that line, requested via the same
 * {@link STORE_CART_FIELDS} — subtracted from `total` and divided by
 * quantity. It exists so `cartTotals` in `./cart.js` can net the tax back out
 * of its **summary** "Goods" total the same way it already could for a
 * mock-catalogue line, which is what makes that summary agree with
 * `/checkout`'s now-net "Price of the goods" row for the same basket, rather
 * than the two screens stating two different figures for the goods in the
 * same cart.
 *
 * The per-unit figure the basket's price column shows is each line's own
 * `total` divided by its quantity, and a division that is not exact is
 * **refused** rather than rounded. A rounded unit price beside an unrounded
 * line total is two answers to "what does one cost?", and this shop's one
 * product divides exactly at every quantity a basket may hold. If a future
 * catalogue does not, that is a presentation decision somebody has to make on
 * purpose — a column showing "from" pricing, or no unit column — rather than a
 * cent this function invented. The same divisibility refusal now applies to
 * `subtotal`, for the identical reason applied to the identical figure.
 *
 * The line totals are then checked to sum to `item_total`, for the same reason
 * `cartTotals` in `./store-checkout.js` refuses three figures that do not add
 * up: the two are computed by different parts of Medusa, and a basket whose
 * lines do not account for its own goods figure has told a buyer something
 * untrue about at least one of them. The check stays over `unitAmount` alone,
 * summed, unchanged since before 2026-08-29: `unitAmount` itself did not
 * change meaning, only a second, net figure — `unitAmount` minus this
 * addition's `taxAmount` — was added beside it.
 *
 * **A missing `total` or `subtotal` is reported as what it is.** It means the
 * request did not ask for {@link STORE_CART_FIELDS}, which is a different
 * fault from a cart whose figures disagree, and it used to be reported as the
 * latter — "does not divide into a whole unit price", because `undefined / 1`
 * is `NaN` and `NaN` fails the divisibility test first. A reader given that
 * message goes looking at prices and rounding. The message below sends them
 * to the request instead.
 */
export function cartLinesFromStore(cart: unknown): readonly CartLine[] {
  const value = cart as {
    items?: readonly {
      id?: string;
      title?: string;
      total?: number;
      subtotal?: number;
      quantity?: number;
      variant?: {
        id?: string;
        manage_inventory?: boolean;
        allow_backorder?: boolean;
        inventory_quantity?: number;
      };
    }[];
    currency_code?: string;
    item_total?: number;
  };
  if (!Array.isArray(value.items) || typeof value.currency_code !== "string") {
    throw new Error("Medusa Store cart response is malformed");
  }
  const currency = value.currency_code;
  const lines = value.items.map((line) => {
    if (
      typeof line.id !== "string" ||
      typeof line.title !== "string" ||
      !Number.isInteger(line.quantity) ||
      (line.quantity as number) <= 0
    ) {
      throw new Error("Medusa Store cart line is malformed");
    }
    if (typeof line.total !== "number" || typeof line.subtotal !== "number") {
      throw new Error(
        "Medusa Store cart line carries no total — the request must ask for " +
          `"${STORE_CART_FIELDS}"; see src/lib/store-cart.ts`,
      );
    }
    const quantity = line.quantity as number;
    const lineTotal = medusaMajorToMinor(line.total, currency);
    const lineNet = medusaMajorToMinor(line.subtotal, currency);
    if (lineTotal % quantity !== 0 || lineNet % quantity !== 0) {
      throw new Error("Medusa Store cart line does not divide into a whole unit price");
    }
    const variant = line.variant;
    const available =
      variant?.manage_inventory !== true ||
      variant.allow_backorder === true ||
      (Number.isInteger(variant.inventory_quantity) && variant.inventory_quantity! > 0);
    return {
      id: line.id,
      ...(typeof variant?.id === "string" && variant.id.length > 0 ? { variantId: variant.id } : {}),
      productName: line.title,
      unitAmount: lineTotal / quantity,
      // The tax *contained in* `unitAmount`, per unit — not an addend to it.
      // See `CartLine.taxAmount`'s doc comment in `./cart.js`: `unitAmount -
      // taxAmount` is the net figure `cartTotals` nets out for its summary.
      taxAmount: (lineTotal - lineNet) / quantity,
      currency: currency.toUpperCase(),
      quantity,
      availability: available ? "InStock" : "OutOfStock",
    } satisfies CartLine;
  });
  if (
    lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0) !==
    medusaMajorToMinor(value.item_total, currency)
  ) {
    throw new Error("Medusa Store cart lines do not add up to the cart's own goods figure");
  }
  return lines;
}

/** Creates a cart in the store's one region. */
export async function createStoreCart(sdk: StoreClient, regionId: string): Promise<string> {
  const created = await sdk.store.cart.create({ region_id: regionId }, CART_QUERY);
  const id = created.cart.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Medusa Store cart is not ready");
  }
  return id;
}

/** The cart as it stands, with its lines. */
export async function retrieveStoreCart(sdk: StoreClient, cartId: string): Promise<unknown> {
  return (await sdk.store.cart.retrieve(cartId, CART_QUERY)).cart;
}

/**
 * Tells Medusa where the parcel is going, so it can answer for a real
 * destination.
 *
 * Without a `shipping_address.country_code` a cart has no tax region, so
 * `item_total` comes back equal to the net subtotal and a European buyer's
 * basket states the export price. The destination the visitor set on this site
 * is written on as soon as a basket exists, and **the checkout overwrites it
 * the moment a real address is entered** (`prepareGuestShipping` in
 * `./store-checkout.js` sends the whole postal address). So this is a
 * provisional answer that a confirmed one replaces — never the thing a buyer is
 * charged on.
 */
export async function applyDestinationToCart(
  sdk: StoreClient,
  cartId: string,
  countryCode: string,
): Promise<void> {
  await sdk.store.cart.update(
    cartId,
    { shipping_address: { country_code: countryCode.toLowerCase() } },
    CART_QUERY,
  );
}

/** Adds one variant to a cart and returns the cart's lines. */
export async function addStoreLine(
  sdk: StoreClient,
  cartId: string,
  variantId: string,
  quantity = 1,
): Promise<readonly CartLine[]> {
  const updated = await sdk.store.cart.createLineItem(
    cartId,
    { variant_id: variantId, quantity },
    CART_QUERY,
  );
  return cartLinesFromStore(updated.cart);
}

/** Sets one line's quantity and returns the cart's lines. */
export async function updateStoreLineQuantity(
  sdk: StoreClient,
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<readonly CartLine[]> {
  const updated = await sdk.store.cart.updateLineItem(cartId, lineId, { quantity }, CART_QUERY);
  return cartLinesFromStore(updated.cart);
}

/**
 * Removes one line and returns the cart's remaining lines.
 *
 * The delete response nests the cart under `parent` rather than `cart`, which
 * is Medusa's shape for a sub-resource deletion and not a mistake here.
 */
export async function removeStoreLine(
  sdk: StoreClient,
  cartId: string,
  lineId: string,
): Promise<readonly CartLine[]> {
  const deleted = await sdk.store.cart.deleteLineItem(cartId, lineId, CART_QUERY);
  return cartLinesFromStore(deleted.parent);
}
