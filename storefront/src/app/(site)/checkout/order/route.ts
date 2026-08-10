/**
 * `POST /checkout/order` — where the checkout form goes when the browser
 * submits it rather than React.
 *
 * See `src/components/shop/checkout-order-post.ts` for why this exists: a
 * `<form>` with no `method` is a GET, and an unhydrated press of the order
 * button was putting a delivery address into the URL.
 *
 * **It reads nothing.** The request body is never parsed, never logged and
 * never stored — it is not even consumed. There is nothing this build could
 * honestly do with a delivery address: Stripe elements are deferred, no order
 * can be placed, and a route that quietly swallowed one would be pretending
 * otherwise. It answers `303 See Other` back to the checkout with a fixed
 * marker, and the page says, in its first paint and without any JavaScript,
 * that no order was placed and nothing was charged.
 *
 * `303` rather than `302`: it is the status that means "the response is at
 * this other URI, fetch it with GET", so a reload of the destination cannot
 * re-post the form.
 *
 * Only `POST` is exported. Next.js answers `405` for every other method, which
 * is right — there is nothing to see here, and `robots.txt` disallows the
 * whole `/checkout` prefix.
 */

import { ORDER_NOT_PLACED_LOCATION } from "../../../../components/shop/checkout-order-post.js";

export const dynamic = "force-dynamic";

export function POST(): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: ORDER_NOT_PLACED_LOCATION,
      "Cache-Control": "no-store",
    },
  });
}
