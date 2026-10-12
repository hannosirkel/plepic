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
 *
 * It was inherited unstyled and stayed that way while every route was a
 * placeholder: a raw `<p>` and two default `<button>`s below the footer of
 * every page. It now ships on the homepage and the product page, so it is
 * styled to the token system — see `styles/consent-manager.module.css` for
 * why the banner is fixed and the reopen control deliberately is not.
 *
 * Because it is fixed, this component owes the page the space it covers, and
 * it pays it: it measures the rendered banner and publishes the height for
 * `styles/global.css` to spend as `padding-block-end` and
 * `scroll-padding-block-end`. `src/lib/consent-reserved-space.ts` holds the
 * reasoning and the two failures that came of not doing it. The banner markup
 * lives in {@link ConsentBanner} below, split out so it can be rendered by a
 * test — this component cannot be, since it returns `null` until an effect
 * has run.
 */

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type Ref } from "react";

import { siteCopyByLocale } from "../../../../content/editions.js";
import { interfaceCopy } from "../../../../content/interface.js";
import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { localizedPath } from "../../lib/urls.js";
import { legalPrivacyPath } from "../../lib/route-paths.js";
import ctaStyles from "../../styles/mockups/call-to-action.module.css";
import styles from "../../styles/consent-manager.module.css";
import {
  CONSENT_STORAGE_KEY,
  parseStoredConsent,
  shouldLoadAnalytics,
  type ConsentDecision,
} from "../../lib/consent.js";
import { setAnalyticsEnabled } from "../../lib/analytics.js";
import {
  releaseConsentBannerSpace,
  reserveConsentBannerSpace,
} from "../../lib/consent-reserved-space.js";

export interface ConsentManagerProps {
  readonly locale?: Locale;
  readonly isTestHost: boolean;
  readonly measurementId: string | null;
  readonly nonce: string | undefined;
}

export function ConsentManager({ isTestHost, measurementId, nonce, locale = DEFAULT_LOCALE }: ConsentManagerProps) {
  const copy = (siteCopyByLocale[locale]?.interface ?? interfaceCopy).consent;
  const [mounted, setMounted] = useState(false);
  const [decision, setDecision] = useState<ConsentDecision | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    setDecision(stored);
    setBannerOpen(stored === null);
    setMounted(true);
  }, []);

  /**
   * Reserve exactly as much page as the banner is covering, for as long as it
   * is covering it — see `src/lib/consent-reserved-space.ts` for what breaks
   * without this and `styles/global.css` for the two declarations that consume
   * it. `ResizeObserver` and not a one-off measurement: the banner's height is
   * its sentence's wrap height, so it changes on rotation, on a browser-zoom
   * or minimum-font-size change, and on the reflow that adding the reservation
   * itself can cause by introducing a scrollbar.
   */
  const measure = useCallback((): void => {
    const banner = bannerRef.current;
    if (banner === null) return;
    reserveConsentBannerSpace(document.documentElement, banner);
  }, []);

  useEffect(() => {
    const banner = bannerRef.current;
    if (banner === null) {
      releaseConsentBannerSpace(document.documentElement);
      return;
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      releaseConsentBannerSpace(document.documentElement);
    };
  }, [measure, mounted, bannerOpen]);

  function decide(next: ConsentDecision): void {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, next);
    setDecision(next);
    setBannerOpen(false);
  }

  const loadAnalytics = shouldLoadAnalytics({ isTestHost, decision, measurementId });

  useEffect(() => {
    setAnalyticsEnabled(loadAnalytics);
    return () => setAnalyticsEnabled(false);
  }, [loadAnalytics]);

  if (!mounted) return null;

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
        <ConsentBanner
          locale={locale}
          ref={bannerRef}
          onAccept={() => decide("granted")}
          onDecline={() => decide("declined")}
        />
      ) : (
        <div className={styles.reopenBar}>
          <button
            type="button"
            onClick={() => setBannerOpen(true)}
            aria-label={copy.reopenLabel}
            data-testid="consent-reopen"
            className={styles.reopen}
          >
            {copy.choicesLabel}
          </button>
        </div>
      )}
    </>
  );
}

export interface ConsentBannerProps {
  readonly locale?: Locale;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
  /** The measured element. `ConsentManager` observes it and reserves its height as page. */
  readonly ref?: Ref<HTMLDivElement>;
}

/**
 * The banner itself, split out from the stateful component above for one
 * reason: **it had nothing that rendered it.** A hundred-line stylesheet, a
 * restructured DOM and a `position: fixed` shipped with no test that produced
 * this markup at all, and the two defects that escaped were both properties of
 * the rendered box. `ConsentManager` cannot be rendered statically — it returns
 * `null` until an effect has read `localStorage` — so a test of *it* can only
 * ever assert the empty first pass. This can be rendered, and
 * `tests/consent-banner.test.tsx` does.
 *
 * Presentational and stateless on purpose: it owns no decision, reads no
 * storage and measures nothing. It is handed a ref because the element it
 * renders is the one whose height has to be paid for in page.
 */
export function ConsentBanner({ onAccept, onDecline, ref, locale = DEFAULT_LOCALE }: ConsentBannerProps) {
  const copy = (siteCopyByLocale[locale]?.interface ?? interfaceCopy).consent;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={copy.dialogLabel}
      data-testid="consent-banner"
      className={styles.banner}
    >
      <div className={styles.bannerInner}>
        <p className={styles.bannerText}>
          {copy.introduction}{" "}
          <a className={styles.bannerLink} href={localizedPath(locale, legalPrivacyPath)}>
            {copy.privacyLink}
          </a>{" "}
          {copy.conclusion}
        </p>
        <div className={styles.bannerActions}>
          <button
            type="button"
            onClick={onAccept}
            data-testid="consent-accept"
            className={`${ctaStyles.cta} ${ctaStyles.primary}`}
          >
            {copy.agree}
          </button>
          <button
            type="button"
            onClick={onDecline}
            data-testid="consent-decline"
            className={`${ctaStyles.cta} ${ctaStyles.secondary}`}
          >
            {copy.decline}
          </button>
        </div>
      </div>
    </div>
  );
}
