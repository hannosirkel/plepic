# Q3: order e-mails are in English

Opened 2026-10-12, when the site-translation plan was retired. The operator
has not answered this question. The reading below is in force.

The brief asks for "the site" in German, Estonian and Klingon. It does not
say whether that includes the e-mails the backend sends after an order.

## Reading in force

No. The e-mails stay English. The plan changed no file under `backend/`.

## What a customer gets

A customer who orders from `/de/checkout` reads a German checkout and a
German confirmation page, and then receives an English e-mail.

| E-mail | Written in |
| --- | --- |
| Order confirmation | `backend/src/notifications/order-confirmation.ts`. Its subject is "Order ... confirmed" |
| Fulfilment status | `backend/src/notifications/fulfillment-status.ts` |
| Shared layout | `backend/src/notifications/transactional-email.ts` |

Nothing under `backend/` knows an edition. The storefront does not send the
edition with an order, and the order holds no language.

## What closing it takes

| Step | Detail |
| --- | --- |
| Carry the edition | The checkout sends its locale with the order, and the backend stores it on the order |
| Share the copy | The backend is a separate workspace and does not import `content/`. The e-mail strings need a home both can read, or a second set under `backend/` |
| Translate and check | Three sets of e-mail text. The glossary check and the Klingon word check read `content/` and the rulebook today, not `backend/` |
| Decide the legal side | The order confirmation is part of the contract's paperwork. See [Q6](./q06-prevailing-language-clause.md) |

This is a plan of its own, not a small change.
