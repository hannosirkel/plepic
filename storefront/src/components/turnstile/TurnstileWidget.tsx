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
import { useEffect, useRef, useState } from "react";

export interface TurnstileWidgetProps {
  /** From runtime configuration. `null` renders nothing rather than a broken widget. */
  readonly siteKey: string | null;
  readonly nonce: string | undefined;
  /** Distinguishes multiple widgets on one page, e.g. contact vs. newsletter. */
  readonly formName: string;
  /**
   * Turnstile's own `data-size`. Cloudflare documents exactly three, and
   * their dimensions are fixed by Cloudflare, not by this site's CSS:
   *
   * | `data-size` | width | height | Cloudflare's stated use |
   * |---|---|---|---|
   * | `normal` (its default) | 300px | 65px | standard |
   * | `flexible` | 100%, **minimum 300px** | 65px | responsive |
   * | `compact` | 150px | 140px | **space-constrained layouts** |
   *
   * This defaults to `"compact"`, and that is a correctness fix rather than
   * a taste one. It read `"flexible"`, on the belief that flexible fills
   * whatever it is given — but flexible has a **300px floor** and does not
   * shrink past it, and three of this site's containers are narrower than
   * that floor. Measured in a browser, the `.turnstile` box's own content
   * width, against a widget that will not render below 300px:
   *
   * | viewport | newsletter (`/`) | contact (`/support/lunar-base`) | checkout |
   * |---|---|---|---|
   * | 320px | **174px** (126 short) | **272px** (28 short) | **222px** (78 short) |
   * | 390px | **244px** (56 short) | 342px | **292px** (8 short) |
   * | 1280px | 608px | 512px | 1102px |
   *
   * So it was clipped on five of those nine combinations, not merely at
   * 320px, and the newsletter — the form most visitors meet — was the worst
   * of them.
   *
   * That overflow was invisible to every automated sweep on this plan
   * because `.turnstile` in both `styles/forms.module.css` and
   * `styles/pages/shop.module.css` carried `overflow: hidden`, which clipped
   * the widget instead of overflowing the page. Both rules have had that
   * declaration removed, so a future oversize is measurable rather than
   * silently cut off.
   *
   * **Measurable by what, exactly.** Not by a page-level sweep:
   * `styles/global.css` sets `overflow-x: hidden` on `html` and `body`, so
   * `document.documentElement.scrollWidth <= clientWidth` cannot fail on this
   * site whatever overflows, and removing this clip does not change that.
   * Measured at a 320px viewport with a 300px stand-in in the real container,
   * `documentElement.scrollWidth` was 305 against a `clientWidth` of 305 —
   * clean — while `body.scrollWidth` read 365 and the stand-in's right edge
   * sat 141px past its container's. What the removal restores is
   * detectability to a **box-level `getBoundingClientRect()` or a
   * `body.scrollWidth`** measurement, which is the conclusion
   * `tests/mockup-layout.test.ts` already records for the whole site.
   *
   * `compact` is 150px wide, which fits inside the narrowest of those boxes
   * with 24px to spare, and is Cloudflare's documented answer for exactly
   * this. It is one fixed size at every viewport, deliberately: a container
   * query cannot pick between the sizes, because `data-size` is an attribute
   * the Turnstile script reads once and CSS cannot set an attribute. The
   * alternatives — mounting two widgets and hiding one, which would open two
   * challenges and put two tokens in one form, or scaling the challenge
   * iframe with a transform — are both worse than a widget Cloudflare
   * designed for narrow layouts.
   *
   * Overridable per call site, but nothing overrides it today: contact,
   * newsletter and checkout all take this default.
   */
  readonly size?: "normal" | "compact" | "flexible";
  /** Resets an already rendered challenge after its one-use response is spent. */
  readonly resetKey?: number;
}

declare global {
  interface Window { turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void }; }
}

export function TurnstileWidget({ siteKey, nonce, formName, size = "compact", resetKey = 0 }: TurnstileWidgetProps) {
  const element = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const lastReset = useRef(resetKey);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded || element.current === null || window.turnstile === undefined) return;
    if (widgetId.current === null) {
      widgetId.current = window.turnstile.render(element.current, { sitekey: siteKey, size });
      return;
    }
    if (lastReset.current !== resetKey) window.turnstile.reset(widgetId.current);
    lastReset.current = resetKey;
  }, [loaded, resetKey, siteKey, size]);
  if (siteKey === null) return null;

  return (
    <>
      <Script
        id="cf-turnstile-script"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={nonce}
        async
        defer
        onReady={() => setLoaded(true)}
      />
      <div
        ref={element}
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-size={size}
        data-testid={`turnstile-${formName}`}
        aria-label="Verification challenge"
      />
    </>
  );
}
