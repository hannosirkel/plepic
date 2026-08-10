/**
 * What the checkout form does when JavaScript has not run.
 *
 * The form is submitted by `CheckoutPageContent`'s own handler in a hydrated
 * page, and that handler calls `preventDefault()` before anything else — so
 * none of this is reached by an ordinary visitor. It exists for the two states
 * in which it *is* reached: JavaScript switched off, and the window between
 * first paint and hydration. Under this application's CSP that window is not
 * theoretical — `'strict-dynamic'` means a nonce mismatch leaves a page that
 * paints and never hydrates at all.
 *
 * ## Why the form needs a method and an action at all
 *
 * A `<form>` with neither defaults to `method="get"`. An unhydrated press of
 * the order button therefore put the delivery address — name, street,
 * postcode, town, country and email — into the query string, and from there
 * into the URL bar, the browser's history, the `Referer` header of everything
 * loaded next, and every access log between the tunnel and Loki.
 * `/legal/privacy` describes what an order holds and why; it does not describe
 * that.
 *
 * So the form declares `method="post"` and posts here. The values travel in a
 * request body, which is where form values belong: no URL, no history entry,
 * no `Referer`, no access-log line. {@link CHECKOUT_ORDER_POST_PATH} reads
 * nothing out of that body — see `src/app/checkout/order/route.ts`.
 *
 * ## And why it answers with a redirect rather than silence
 *
 * Silently accepting a submission that placed no order is its own defect: the
 * page would appear to have worked. This build genuinely cannot place an
 * order — Stripe elements are deferred — so the honest answer is the same one
 * a hydrated press already gets, `checkout.errors.paymentNotConnected`:
 * "No order was placed and nothing was charged". The route answers `303 See
 * Other` back to `/checkout` carrying {@link ORDER_OUTCOME_PARAM}, the page
 * reads it server-side, and the message is in the first paint of a page that
 * needed no JavaScript to show it.
 *
 * The marker is a fixed token. **No value a visitor typed is ever put in it**,
 * which is the whole point of the exercise.
 */

/** Where the checkout form posts when the browser, rather than React, submits it. */
export const CHECKOUT_ORDER_POST_PATH = "/checkout/order";

/** The query parameter carrying the outcome of an unhydrated submission. */
export const ORDER_OUTCOME_PARAM = "order";

/** Its one accepted value: an order attempt arrived, and no order was placed. */
export const ORDER_NOT_PLACED = "not-placed";

/** Where {@link CHECKOUT_ORDER_POST_PATH} sends the browser afterwards. */
export const ORDER_NOT_PLACED_LOCATION = `/checkout?${ORDER_OUTCOME_PARAM}=${ORDER_NOT_PLACED}`;

/** True when this request is the redirect that follows an unhydrated submission. */
export function isOrderNotPlaced(value: string | readonly string[] | undefined): boolean {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === ORDER_NOT_PLACED;
}
