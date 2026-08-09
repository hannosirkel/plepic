"use client";

/**
 * The Cloudflare Turnstile widget. Task 2 renders it and takes the site key
 * from runtime configuration; server-side verification against
 * `challenges.cloudflare.com` is Task 5 (see the packet's terminology note —
 * every "reCAPTCHA" checkbox in this plan means Turnstile).
 *
 * Both environments share one Turnstile key pair (waived 2026-08-09), so
 * `siteKey` is not itself environment-*specific* the way a base URL is — but
 * it is still configuration, not a literal, and still arrives through
 * `getRuntimeConfig()` rather than a `NEXT_PUBLIC_*` variable, for the same
 * reason every other runtime value does: so nothing about how it is
 * delivered has to change if a per-environment pair is ever reinstated.
 *
 * Pair this with {@link HoneypotField} in any form that submits to the
 * public Internet, per the plan's "alongside the honeypot" instruction.
 */

import Script from "next/script";

export interface TurnstileWidgetProps {
  /** From runtime configuration. `null` renders nothing rather than a broken widget. */
  readonly siteKey: string | null;
  readonly nonce: string | undefined;
  /** Distinguishes multiple widgets on one page, e.g. contact vs. newsletter. */
  readonly formName: string;
}

export function TurnstileWidget({ siteKey, nonce, formName }: TurnstileWidgetProps) {
  if (siteKey === null) return null;

  return (
    <>
      <Script
        id="cf-turnstile-script"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        nonce={nonce}
        async
        defer
      />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-testid={`turnstile-${formName}`}
        aria-label="Verification challenge"
      />
    </>
  );
}
