"use client";

/**
 * The contact form on `/support/lunar-base` — the `contactForm` copy of the
 * edition's `support` module, mounted with `TurnstileWidget` and
 * `HoneypotField` for the same reason `NewsletterForm` is: both were built
 * and mounted nowhere until this unit. Server-side verification is Task 5's.
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
 * `action`, which is a GET form — and a GET serialises every named control,
 * not only the ones somebody typed into. A press before hydration, or with
 * JavaScript off, put **5 of this form's 5 controls** into the query string:
 * a name, an email address, a subject, the entire message body, and
 * `additional-notes`, which is `HoneypotField`'s hidden anti-spam input. From
 * there into browser history, the next request's `Referer`, and every access
 * log between the tunnel and Loki. It now carries a Server Function as its
 * `action`, so the browser sends a `POST` with the values in the request
 * body. See `./public-form-actions.ts`, and `NewsletterForm.tsx` for the same
 * note on the form it shares this defect and this fix with.
 *
 * A valid submission is relayed by the Server Function to Medusa's contact
 * endpoint and answered with fixed success or failure copy, hydrated or not.
 * Field values remain in POST bodies and are never echoed into the page.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import { siteCopyFor, type SiteCopy } from "../../../../content/editions.js";
import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import { FormLocaleField } from "./form-locale.js";
import { submitContact } from "./public-form-actions.js";
import type { PublicFormOutcome } from "./public-form-actions.js";
import styles from "../../styles/forms.module.css";

export interface ContactFormProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
  /**
   * The edition whose labels and validation errors this renders, and the one
   * the Server Function answers in: the form posts it, see `./form-locale.tsx`.
   */
  readonly locale?: Locale;
}

interface FieldSpec {
  readonly name: "name" | "email" | "subject" | "message";
  readonly label: string;
  readonly type: "text" | "email";
  readonly multiline?: boolean;
  readonly autoComplete: string;
  /** What the field says when it is left empty. */
  readonly missing: string;
  /** What it says when the browser rejects a value. Only a typed field can be given one. */
  readonly invalid?: string;
}

/** The four fields, with the labels and validation errors of one edition's copy. */
export function contactFields(copy: SiteCopy): readonly FieldSpec[] {
  const labels = copy.support.contactForm;
  const errors = copy.interface.contactForm;

  return [
    { name: "name", label: labels.nameLabel, type: "text", autoComplete: "name", missing: errors.nameMissing },
    {
      name: "email",
      label: labels.emailLabel,
      type: "email",
      autoComplete: "email",
      missing: errors.emailMissing,
      invalid: errors.emailInvalid,
    },
    { name: "subject", label: labels.subjectLabel, type: "text", autoComplete: "off", missing: errors.subjectMissing },
    {
      name: "message",
      label: labels.messageLabel,
      type: "text",
      multiline: true,
      autoComplete: "off",
      missing: errors.messageMissing,
    },
  ];
}

export function ContactForm({ turnstileSiteKey, nonce, locale = DEFAULT_LOCALE }: ContactFormProps) {
  const copy = siteCopyFor(locale);
  const fields = contactFields(copy);
  const baseId = useId();
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [outcome, submit] = useActionState<PublicFormOutcome | null, FormData>(
    submitContact,
    null,
  );
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  /** See `NewsletterForm.tsx`: focus the answer only after a press made here. */
  const dispatched = useRef(false);

  /**
   * See `NewsletterForm.tsx` and `PublicFormOutcome`: the outcome is a new
   * object per submission, which is what makes this effect re-run — and the
   * answer therefore re-focus — on a second consecutive press.
   */
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

    for (const field of fields) {
      const element = form.elements.namedItem(field.name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (element === null) continue;
      if (!element.validity.valid) {
        nextErrors[field.name] = element.validity.valueMissing
          ? field.missing
          : (field.invalid ?? field.missing);
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
      aria-label={copy.support.contact.heading}
      action={submit}
      onSubmit={handleSubmit}
      noValidate
    >
      <FormLocaleField locale={locale} />
      {fields.map((field) => {
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
          it below the fold. `key={outcome.submissions}` remounts the
          paragraph on every completed submission, so a second consecutive
          press is a real DOM change inside the live region rather than a
          repaint of identical text. See `NewsletterForm.tsx` for all three. */}
      <div className={styles.alertAnchor} role="status">
        {outcome !== null && !anyError ? (
          <p
            key={outcome.submissions}
            data-submission={outcome.submissions}
            className={styles.outcome}
            ref={outcomeRef}
            tabIndex={-1}
            autoFocus
          >
            {outcome.message}
          </p>
        ) : null}
      </div>

      <HoneypotField formName="contact" />

      <div className={styles.turnstile}>
        <TurnstileWidget siteKey={turnstileSiteKey} nonce={nonce} formName="contact" locale={locale} />
      </div>

      <button type="submit" className={styles.submit}>
        {copy.support.contactForm.submitLabel}
      </button>
    </form>
  );
}
