"use client";

/**
 * The newsletter signup form — content/publisher.ts's `newsletter` copy,
 * mounted with the two components that were built and mounted nowhere:
 * `TurnstileWidget` and `HoneypotField`. Server-side token verification and
 * the actual subscribe call are Task 5's; this unit renders the widget,
 * takes the site key from runtime configuration, and makes the form itself
 * fully keyboard- and screen-reader-operable — required field, native email
 * validation, and an error tied to its field with `aria-describedby` and
 * `aria-invalid`, per the checkbox's "errors announced and tied to their
 * field."
 *
 * No network call is wired here. `event.preventDefault()` stops the
 * browser's default GET-and-reload (which would otherwise put the visitor's
 * email address in the URL and browser history — worse than doing nothing),
 * and once the field validates there is nothing further to do yet: this
 * unit does not build a newsletter subsystem (the plan forbids one outright)
 * and does not fabricate a success message for a request that was never
 * sent. See the migration report's judgment calls for this trade recorded
 * plainly.
 */

import { useId, useState } from "react";
import type { FormEvent } from "react";

import { newsletter } from "../../../../content/publisher.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import styles from "../../styles/forms.module.css";

export interface NewsletterFormProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
}

export function NewsletterForm({ turnstileSiteKey, nonce }: NewsletterFormProps) {
  const fieldId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const email = event.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
    if (email === null) return;

    if (!email.validity.valid) {
      setError(
        email.validity.valueMissing
          ? "Enter your email address."
          : "Enter a valid email address.",
      );
      email.focus();
      return;
    }

    setError(null);
    // Nothing further to do yet — see this file's doc comment.
  }

  return (
    <form className={styles.form} aria-label={newsletter.heading} onSubmit={handleSubmit} noValidate>
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor={fieldId}>
          {newsletter.fieldLabel}
        </label>
        <div className={styles.fieldRow}>
          <input
            id={fieldId}
            className={styles.field}
            type="email"
            name="email"
            required
            autoComplete="email"
            aria-invalid={error !== null}
            aria-describedby={error !== null ? errorId : undefined}
          />
          <button type="submit" className={styles.submit}>
            {newsletter.submitLabel}
          </button>
        </div>
        {error !== null ? (
          <p id={errorId} className={styles.fieldError} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <HoneypotField formName="newsletter" />

      <div className={styles.turnstile}>
        <TurnstileWidget siteKey={turnstileSiteKey} nonce={nonce} formName="newsletter" />
      </div>

      <p className={styles.consentNote}>{newsletter.consentNote}</p>
    </form>
  );
}
