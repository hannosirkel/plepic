# Q12: changing the destination from a prefixed basket

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. The reading below is in force.

A task of the plan asked that a visitor who changes the delivery destination
from `/de/cart` stays in the German edition. It was unclear whether that
needs a POST handler that knows the edition.

## Reading in force

No. The basket has no destination control and no POST handler of its own. The
destination selector on the product page writes the destination cookie and
calls `router.refresh()`. A refresh keeps the URL, and the URL is the
edition.

## Where it shows

| Fact | Where |
| --- | --- |
| The selector takes the edition for its labels and country names | `storefront/src/components/shop/DestinationSelector.tsx` |
| A destination change keeps the URL prefix | `BasketRoute` in `storefront/src/app/localized-routes.tsx`; the browser suite |
| Language and delivery country are separate | [`docs/current/locales.md`](../current/locales.md), section How an edition is chosen |

## If the answer differs

The selector works only with JavaScript, in every edition: it sets the cookie
in the browser. If it must work without, the selector needs a form and a POST
handler, and the handler must redirect back under the prefix the form was
rendered in.
