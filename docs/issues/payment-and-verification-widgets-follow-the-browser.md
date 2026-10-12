# The payment and verification widgets follow the browser's language

Opened 2026-10-12, when the site-translation plan was retired. The plan's
review raised it and left it for the operator.

## What is open

Two third-party widgets are given no language, so each picks one from the
browser.

| Widget | Where | Today |
| --- | --- | --- |
| Stripe Payment Element | `storefront/src/components/shop/StripePaymentElement.tsx` | `Elements` gets `clientSecret` and no `locale`. Stripe's default follows the browser's language |
| Cloudflare Turnstile | `storefront/src/components/turnstile/TurnstileWidget.tsx` | `turnstile.render` gets `sitekey` and `size` and no `language` |

A visitor whose browser is set to German sees a German card form on the
English checkout. A visitor on `/de/checkout` with an English browser sees an
English card form among German labels.

This does not break the rule that nothing negotiates a locale. The site's own
edition still comes from the URL alone. It is the provider's widget that
reads the browser.

## What closing it takes

Pass the edition's language tag to both: `locale` in the `Elements` options,
`language` in the Turnstile render options. Neither provider has Klingon, so
`tlh` needs a stated fallback. English is the consistent one: the Klingon
edition already keeps English country names.

The operator decides, because it changes what a visitor sees inside the
provider's frame.
