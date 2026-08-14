"use client";

import { useActionState, useId } from "react";

import { newsletter } from "../../../../content/publisher.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import { submitNewsletter, type PublicFormOutcome } from "../forms/public-form-actions.js";
import styles from "../../styles/forms.module.css";

interface PostPurchaseNewsletterFormProps {
  readonly defaultEmail: string;
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
}

/** A separate, unticked marketing choice rendered only after order confirmation. */
export function PostPurchaseNewsletterForm({
  defaultEmail,
  turnstileSiteKey,
  nonce,
}: PostPurchaseNewsletterFormProps) {
  const emailId = useId();
  const consentId = useId();
  const [outcome, action] = useActionState<PublicFormOutcome | null, FormData>(
    submitNewsletter,
    null,
  );

  return (
    <form className={styles.form} action={action} noValidate>
      <h2>{newsletter.postPurchaseHeading}</h2>
      <p className={styles.consentNote}>{newsletter.postPurchaseBody}</p>
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor={emailId}>{newsletter.fieldLabel}</label>
        <input
          id={emailId}
          className={styles.stackedField}
          type="email"
          name="email"
          defaultValue={defaultEmail}
          required
          autoComplete="email"
        />
      </div>
      <label className={styles.fieldLabel} htmlFor={consentId}>
        <input id={consentId} type="checkbox" name="newsletter-consent" required />{" "}
        {newsletter.postPurchaseConsentLabel}
      </label>
      <HoneypotField formName="post-purchase-newsletter" />
      <div className={styles.turnstile}>
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          nonce={nonce}
          formName="post-purchase-newsletter"
        />
      </div>
      <button type="submit" className={styles.submit}>{newsletter.submitLabel}</button>
      <div role="status">
        {outcome === null ? null : (
          <p className={styles.outcome} data-submission={outcome.submissions}>{outcome.message}</p>
        )}
      </div>
    </form>
  );
}
