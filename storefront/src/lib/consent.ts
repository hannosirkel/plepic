/**
 * Analytics consent, as a pure decision function plus the tiny amount of
 * parsing around it. No DOM, no cookies, no `localStorage` here — those live
 * in `components/analytics/ConsentManager.tsx`, which is the only place this
 * module's types touch the browser. Keeping the decision itself pure is what
 * makes "no measurement request before consent, and none at all on a test
 * host" a two-line test instead of something that needs a browser to check.
 */

export type ConsentDecision = "granted" | "declined";

export const CONSENT_STORAGE_KEY = "plepic-consent-analytics";

/** Parses whatever `localStorage` handed back. Anything else is "no decision yet". */
export function parseStoredConsent(value: string | null | undefined): ConsentDecision | null {
  return value === "granted" || value === "declined" ? value : null;
}

export interface AnalyticsGateInput {
  /** From validated host configuration — never a request-time string match. */
  readonly isTestHost: boolean;
  readonly decision: ConsentDecision | null;
  readonly measurementId: string | null;
}

/**
 * Whether the analytics loader may fire a measurement request right now.
 *
 * - A test hostname never loads analytics, full stop — the plan's later
 *   constraint ("the test environment has no analytics at all") supersedes
 *   the checkbox's "beyond its own data stream": there is one GA property and
 *   no second stream, so the correct behaviour on a test host is no loader at
 *   all.
 * - No measurement ID configured means nothing to load.
 * - Anything short of an explicit "granted" — no decision yet, or an explicit
 *   "declined" — blocks the request.
 */
export function shouldLoadAnalytics(input: AnalyticsGateInput): boolean {
  if (input.isTestHost) return false;
  if (input.measurementId === null) return false;
  return input.decision === "granted";
}
