"use client";

import { useActionState, useId } from "react";

import { siteCopyFor } from "../../../../content/editions.js";
import { DEFAULT_LOCALE, type Locale } from "../../../../content/routes.js";
import { FormLocaleField } from "../forms/form-locale.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import { submitNewsletter, type PublicFormOutcome } from "../forms/public-form-actions.js";
import styles from "../../styles/forms.module.css";

interface PostPurchaseNewsletterFormProps {
  /**
   * The edition the order was placed in. The default edition's when absent.
   * It is posted with the form, so the answer comes back in the same edition.
   */
  readonly locale?: Locale;
  readonly defaultEmail: string;
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
}

/** A separate, unticked marketing choice rendered only after order confirmation. */
export function PostPurchaseNewsletterForm({
  locale = DEFAULT_LOCALE,
  defaultEmail,
  turnstileSiteKey,
  nonce,
}: PostPurchaseNewsletterFormProps) {
  const { newsletter } = siteCopyFor(locale).publisher;
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
      <FormLocaleField locale={locale} />
      <HoneypotField formName="post-purchase-newsletter" />
      <div className={styles.turnstile}>
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          nonce={nonce}
          formName="post-purchase-newsletter"
          locale={locale}
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
