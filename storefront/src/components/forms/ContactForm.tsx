"use client";

/**
 * The contact form on `/support/lunar-base` — content/support.ts's
 * `contactForm` copy, mounted with `TurnstileWidget` and `HoneypotField` for
 * the same reason `NewsletterForm` is: both were built and mounted nowhere
 * until this unit. Server-side verification is Task 5's.
 *
 * Four required fields (name, email, subject, message), each with its own
 * native validation and an error tied to it with `aria-describedby` and
 * `aria-invalid` — WCAG 3.3.1/3.3.2. `noValidate` on the `<form>` turns off
 * the browser's own (inconsistently accessible) validation bubble in favour
 * of this component's own, identically-styled one for every field.
 *
 * ## Nothing typed here reaches the URL, in any state of this page
 *
 * This form used to be `<form onSubmit={…}>` with no `method` and no
 * `action`, which is a GET form: a press before hydration, or with
 * JavaScript off, put a name, an email address, a subject and the entire
 * message body into the query string — and from there into browser history,
 * the next request's `Referer`, and every access log between the tunnel and
 * Loki. It now carries a Server Function as its `action`, so the browser
 * sends a `POST` with the values in the request body. See
 * `./public-form-actions.ts`, and `NewsletterForm.tsx` for the same note on
 * the form it shares this defect and this fix with.
 *
 * A valid submission is answered with `contactForm.notSentMessage`, hydrated
 * or not, identically: this build has no submission host, so the honest
 * answer is that the message was not delivered and the address printed above
 * the form is the way through. Doing nothing silently — which is what this
 * component did before — reads as success to the person who pressed Send.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import { contact, contactForm } from "../../../../content/support.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import { reportContactNotSent } from "./public-form-actions.js";
import styles from "../../styles/forms.module.css";

export interface ContactFormProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
}

interface FieldSpec {
  readonly name: "name" | "email" | "subject" | "message";
  readonly label: string;
  readonly type: "text" | "email";
  readonly multiline?: boolean;
  readonly autoComplete: string;
}

const FIELDS: readonly FieldSpec[] = [
  { name: "name", label: contactForm.nameLabel, type: "text", autoComplete: "name" },
  { name: "email", label: contactForm.emailLabel, type: "email", autoComplete: "email" },
  { name: "subject", label: contactForm.subjectLabel, type: "text", autoComplete: "off" },
  { name: "message", label: contactForm.messageLabel, type: "text", multiline: true, autoComplete: "off" },
];

export function ContactForm({ turnstileSiteKey, nonce }: ContactFormProps) {
  const baseId = useId();
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [outcome, submit] = useActionState<string | null, FormData>(reportContactNotSent, null);
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  /** See `NewsletterForm.tsx`: focus the answer only after a press made here. */
  const dispatched = useRef(false);

  useEffect(() => {
    if (outcome === null || !dispatched.current) return;
    dispatched.current = false;
    outcomeRef.current?.focus();
  }, [outcome]);

  /**
   * `preventDefault()` is called only for an invalid submission. A valid one
   * goes through to the form's `action`, which is what makes the hydrated
   * answer and the unhydrated answer the same sentence — see this file's doc
   * comment and `./public-form-actions.ts`.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const form = event.currentTarget;
    const nextErrors: Record<string, string> = {};
    let firstInvalid: HTMLElement | null = null;

    for (const field of FIELDS) {
      const element = form.elements.namedItem(field.name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (element === null) continue;
      if (!element.validity.valid) {
        nextErrors[field.name] = element.validity.valueMissing
          ? `Enter ${field.label.toLowerCase()}.`
          : `Enter a valid ${field.label.toLowerCase()}.`;
        firstInvalid ??= element;
      }
    }

    setErrors(nextErrors);
    if (firstInvalid !== null) {
      event.preventDefault();
      firstInvalid.focus();
      return;
    }

    dispatched.current = true;
  }

  const anyError = Object.keys(errors).length > 0;

  return (
    <form
      className={styles.form}
      aria-label={contact.heading}
      action={submit}
      onSubmit={handleSubmit}
      noValidate
    >
      {FIELDS.map((field) => {
        const fieldId = `${baseId}-${field.name}`;
        const errorId = `${fieldId}-error`;
        const error = errors[field.name];
        const commonProps = {
          id: fieldId,
          name: field.name,
          required: true,
          autoComplete: field.autoComplete,
          "aria-invalid": error !== undefined,
          "aria-describedby": error !== undefined ? errorId : undefined,
        } as const;

        return (
          <div className={styles.fieldGroup} key={field.name}>
            <label className={styles.fieldLabel} htmlFor={fieldId}>
              {field.label}
            </label>
            {field.multiline ? (
              <textarea className={styles.stackedField} rows={5} {...commonProps} />
            ) : (
              <input className={styles.stackedField} type={field.type} {...commonProps} />
            )}
            {error !== undefined ? (
              <p id={errorId} className={styles.fieldError} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      {/* Always in the document, so what lands in it is announced rather than
          merely appearing, and `autoFocus` so an unhydrated POST response
          scrolls to the answer instead of landing at the top of the page with
          it below the fold. See `NewsletterForm.tsx` for both. */}
      <div className={styles.alertAnchor} role="status">
        {outcome !== null && !anyError ? (
          <p className={styles.outcome} ref={outcomeRef} tabIndex={-1} autoFocus>
            {outcome}
          </p>
        ) : null}
      </div>

      <HoneypotField formName="contact" />

      <div className={styles.turnstile}>
        <TurnstileWidget siteKey={turnstileSiteKey} nonce={nonce} formName="contact" />
      </div>

      <button type="submit" className={styles.submit}>
        {contactForm.submitLabel}
      </button>
    </form>
  );
}
