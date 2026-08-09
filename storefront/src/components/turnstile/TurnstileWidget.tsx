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
  /**
   * Turnstile's own `data-size`. Defaults to `"flexible"` — Cloudflare's own
   * answer to a widget that has to sit inside a narrow, responsive card:
   * the fixed `"normal"` size renders at 300x65 regardless of its
   * container, which is wider than this site's newsletter and contact
   * cards at a 320px viewport (measured: the card's content box is ~192px
   * there) and overflowed its own card, cut off at the edge, when this
   * unit rendered it for the first time. `"flexible"` fills the available
   * container width instead.
   */
  readonly size?: "normal" | "compact" | "flexible";
}

export function TurnstileWidget({ siteKey, nonce, formName, size = "flexible" }: TurnstileWidgetProps) {
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
        data-size={size}
        data-testid={`turnstile-${formName}`}
        aria-label="Verification challenge"
      />
    </>
  );
}
