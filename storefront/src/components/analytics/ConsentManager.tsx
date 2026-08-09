"use client";

/**
 * Owns the analytics consent decision end to end: the banner that asks for
 * it, the always-visible control that reopens it later, and the gate on
 * whether Google Analytics actually loads.
 *
 * `measurementId`, `isTestHost` and `nonce` all arrive as props from
 * `src/app/layout.tsx` — a Server Component that read them from
 * `process.env` and the request's `Host` header — so this file never touches
 * `NEXT_PUBLIC_*` and never has to guess which environment it is in.
 *
 * Nothing renders on the very first client render pass (`mounted` starts
 * `false`): the decision lives in `localStorage`, which does not exist on
 * the server, so rendering the banner (or not) before that read would either
 * flash or mismatch the server-rendered markup. This also happens to be
 * exactly what "no measurement request before the visitor has agreed"
 * requires — the GA `<Script>` tags are inside the same gate, so they cannot
 * mount before the stored decision has been read.
 */

import Script from "next/script";
import { useEffect, useState } from "react";

import { legalPrivacyPath } from "../../lib/route-paths.js";
import {
  CONSENT_STORAGE_KEY,
  parseStoredConsent,
  shouldLoadAnalytics,
  type ConsentDecision,
} from "../../lib/consent.js";

export interface ConsentManagerProps {
  readonly isTestHost: boolean;
  readonly measurementId: string | null;
  readonly nonce: string | undefined;
}

export function ConsentManager({ isTestHost, measurementId, nonce }: ConsentManagerProps) {
  const [mounted, setMounted] = useState(false);
  const [decision, setDecision] = useState<ConsentDecision | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);

  useEffect(() => {
    const stored = parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    setDecision(stored);
    setBannerOpen(stored === null);
    setMounted(true);
  }, []);

  function decide(next: ConsentDecision): void {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, next);
    setDecision(next);
    setBannerOpen(false);
  }

  if (!mounted) return null;

  const loadAnalytics = shouldLoadAnalytics({ isTestHost, decision, measurementId });

  return (
    <>
      {loadAnalytics && measurementId !== null ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="plepic-ga-init" strategy="afterInteractive" nonce={nonce}>
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)}, { anonymize_ip: true });`}
          </Script>
        </>
      ) : null}

      {bannerOpen ? (
        <div role="dialog" aria-label="Cookie and analytics consent" data-testid="consent-banner">
          <p>
            We use Google Analytics to see how the site is used, and only once you agree. See the{" "}
            <a href={legalPrivacyPath}>privacy page</a> for the lawful basis and every processor involved.
          </p>
          <button type="button" onClick={() => decide("granted")} data-testid="consent-accept">
            Agree
          </button>
          <button type="button" onClick={() => decide("declined")} data-testid="consent-decline">
            Decline
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setBannerOpen(true)}
          aria-label="Change your privacy choices"
          data-testid="consent-reopen"
        >
          Privacy choices
        </button>
      )}
    </>
  );
}
