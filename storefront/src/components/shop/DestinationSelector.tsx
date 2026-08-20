"use client";

/**
 * The control that says where a visitor is buying from, and therefore which
 * figure they are being quoted.
 *
 * ## Why the price needs a control at all
 *
 * The advertised figure is net. VAT is added for a delivery address in the EU
 * and not added anywhere else, so there is a figure per destination and no figure that
 * is simply "the price". Before a delivery address exists, the only honest way
 * to print one is to say which destination it belongs to — and to let the
 * reader change it. This is that.
 *
 * It **never decides what anybody is charged.** The charge follows the
 * delivery address confirmed at checkout; this only chooses which of two true
 * figures the page shows beforehand. `content/legal/shipping.ts` says so in the
 * reader's own words, and it is the last sentence of the VAT section for a
 * reason.
 *
 * ## The cookie, and the disclosure that comes with it
 *
 * The write is a `document.cookie` assignment, here and nowhere else. A cookie
 * rather than `sessionStorage` because the price is server-rendered — the
 * server has to read the destination before the first byte, and session storage
 * is invisible to it — and because where somebody lives is not a fact about one
 * tab. `src/lib/destination.ts` carries the rest of that argument.
 *
 * **A first-party cookie is a disclosure event.** `/legal/privacy` carries a
 * table captioned "Cookies this site can set", and
 * `tests/browser-storage-disclosure.test.ts` refuses a cookie write in `src/`
 * that has no row in it, in every published edition. That row exists in both;
 * adding a second cookie here means adding a second row there, in both
 * languages, in the same change.
 *
 * `SameSite=Lax` and no `Secure` on plain HTTP: the value is a country code, it
 * identifies nobody, and a `Secure` cookie set over `http://127.0.0.1` is
 * silently dropped by the browser — which would make the selector look broken
 * in local development and in the browser baselines. `Path=/` because every
 * surface that shows a price reads it.
 *
 * ## Why it re-renders the server component rather than updating state
 *
 * The figure is composed on the server, from `resolveCatalogue`, out of two
 * amounts Medusa returned. `router.refresh()` re-runs that composition with the
 * new cookie, so the new figure arrives the same way the first one did.
 * Recomputing it in the browser would mean a second implementation of the
 * choice, in the one place this change is trying to have only one of.
 */

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import {
  deliveryCountries,
  DESTINATION_COOKIE_MAX_AGE_SECONDS,
  DESTINATION_COOKIE_NAME,
} from "../../lib/destination.js";
import styles from "../../styles/destination-selector.module.css";

/**
 * The one browser-storage write this component makes. Exported so a test can
 * name it, and separate so the write site is a function rather than a line
 * inside an event handler.
 */
export function rememberDestination(code: string): void {
  const attributes = [
    `${DESTINATION_COOKIE_NAME}=${encodeURIComponent(code)}`,
    "Path=/",
    `Max-Age=${String(DESTINATION_COOKIE_MAX_AGE_SECONDS)}`,
    "SameSite=Lax",
  ];
  if (window.location.protocol === "https:") attributes.push("Secure");
  document.cookie = attributes.join("; ");
}

export interface DestinationSelectorProps {
  /** The destination currently in effect, as an ISO 3166-1 alpha-2 code. */
  readonly destinationCode: string;
  /** The label a reader sees. Defaults to the wording the product surfaces use. */
  readonly label?: string;
  /** One sentence under the control saying what it does and does not decide. */
  readonly hint?: string;
}

export const DESTINATION_SELECTOR_LABEL = "Delivering to";

/**
 * The sentence under the control.
 *
 * It states the limit rather than the feature, because the limit is the part a
 * reader needs: changing this changes the figure on the screen and nothing
 * about the bill.
 */
export const DESTINATION_SELECTOR_HINT =
  "This decides which price is shown, not what you are charged. " +
  "The charge follows the delivery address you confirm at checkout.";

export function DestinationSelector({
  destinationCode,
  label = DESTINATION_SELECTOR_LABEL,
  hint = DESTINATION_SELECTOR_HINT,
}: DestinationSelectorProps) {
  const router = useRouter();
  const baseId = useId();
  const [selected, setSelected] = useState(destinationCode);
  const [pending, startTransition] = useTransition();
  const fieldId = `${baseId}-destination`;
  const hintId = `${baseId}-destination-hint`;

  return (
    <div className={styles.selector}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
      </label>
      <select
        id={fieldId}
        className={styles.field}
        name="destination"
        value={selected}
        aria-describedby={hintId}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setSelected(next);
          rememberDestination(next);
          // The figure is composed on the server; ask the server for it again.
          startTransition(() => {
            router.refresh();
          });
        }}
      >
        {deliveryCountries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
      {/* Always in the document so the change is announced rather than merely
          appearing, and empty when nothing is happening. */}
      <p className={styles.status} role="status">
        {pending ? "Updating the price…" : ""}
      </p>
    </div>
  );
}
