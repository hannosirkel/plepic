/**
 * POST-only native fallback for the redirect-return completion form.
 *
 * Stripe may already have captured the payment before this form is shown, so
 * this endpoint must never claim that nothing was charged. It deliberately
 * reads, logs, and stores none of the submitted body (including Turnstile's
 * response) and returns a fixed, non-cacheable outcome without redirecting.
 */

import { PAYMENT_RETURN_UNCONFIRMED_MESSAGE } from "../../../../../components/shop/checkout-order-post.js";

export const dynamic = "force-dynamic";

export function POST(): Response {
  return new Response(PAYMENT_RETURN_UNCONFIRMED_MESSAGE, {
    status: 409,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
