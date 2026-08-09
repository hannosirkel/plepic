"use client";

/**
 * The contact form on `/support/lunar-base` — content/support.ts's
 * `contactForm` copy, mounted with `TurnstileWidget` and `HoneypotField` for
 * the same reason `NewsletterForm` is: both were built and mounted nowhere
 * until this unit. Server-side verification is Task 5's; see
 * `NewsletterForm.tsx`'s doc comment for why no network call is wired here
 * yet and why that is a deliberate, recorded trade rather than an oversight.
 *
 * Four required fields (name, email, subject, message), each with its own
 * native validation and an error tied to it with `aria-describedby` and
 * `aria-invalid` — WCAG 3.3.1/3.3.2. `noValidate` on the `<form>` turns off
 * the browser's own (inconsistently accessible) validation bubble in favour
 * of this component's own, identically-styled one for every field.
 */

import { useId, useState } from "react";
import type { FormEvent } from "react";

import { contact, contactForm } from "../../../../content/support.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
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

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
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
      firstInvalid.focus();
      return;
    }
    // Nothing further to do yet — see NewsletterForm.tsx's doc comment.
  }

  return (
    <form className={styles.form} aria-label={contact.heading} onSubmit={handleSubmit} noValidate>
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
