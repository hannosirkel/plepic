/**
 * The Content-Security-Policy header, as a pure function of the per-request
 * nonce. `proxy.ts` calls this once per request, with a freshly generated
 * nonce, and sets the resulting policy on the response header (what the
 * browser enforces) *and* on the `content-security-policy` request header
 * (what Next.js parses its own nonce out of, for every script and stylesheet
 * it emits itself), alongside the bare value on `x-nonce` (what a Server
 * Component reads via `getRequestNonce()`). All three carry the same nonce,
 * or the browser refuses every script that does not match the enforced one.
 *
 * `'strict-dynamic'` in `script-src` is why that matters so much: CSP Level 3
 * makes a browser **ignore** `'self'` and every host-source once
 * `'strict-dynamic'` is present, so the nonce is the only thing left that can
 * authorise a script. A nonce-less page under this policy paints and never
 * hydrates.
 *
 * `https://www.googletagmanager.com` and `https://www.google-analytics.com`
 * are here for the consent-gated GA loader; `https://challenges.cloudflare.com`
 * is here for Turnstile, both its script and the iframe it opens for the
 * interactive challenge. `https://www.youtube-nocookie.com` is restricted to
 * `frame-src` for the verified product videos; the cookie-setting YouTube host
 * is not permitted. Script-based services are loaded through `next/script`, which means
 * they are injected by an already-nonced Next.js script and are therefore
 * covered by `'strict-dynamic'` propagation; the explicit host-sources are
 * kept as a fallback for a browser that only supports CSP Level 2.
 *
 * **`https://*.js.stripe.com` is not a nicety, and the bare host does not
 * cover it.** Stripe's security guide requires the wildcard in both
 * `script-src` and `frame-src`, because Stripe.js opens frames on *different
 * origins* under that suffix — that is how Link renders inside the Payment
 * Element. With only `https://js.stripe.com` allowed, those frames are
 * refused and Link degrades or vanishes while card, which renders on the
 * bare host, keeps working: a failure that looks like a Stripe
 * misconfiguration rather than a policy one. A CSP host-source matches an
 * exact host and never its subdomains, so the wildcard has to be written
 * out; adding it does not widen the policy beyond Stripe.
 */

export function buildContentSecurityPolicy(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com`,
    `connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://challenges.cloudflare.com https://api.stripe.com`,
    `frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com`,
    `font-src 'self'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}
