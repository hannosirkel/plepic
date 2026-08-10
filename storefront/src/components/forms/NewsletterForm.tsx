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
 * ## The address never reaches the URL, in any state of this page
 *
 * This form used to be `<form onSubmit={…}>` with no `method` and no
 * `action` — a GET form, and a GET serialises every named control, not only
 * the ones somebody typed into. A press before hydration, or with JavaScript
 * off, put **2 of this form's 2 controls** in the query string: the visitor's
 * email address *and* `additional-notes`, which is `HoneypotField`'s hidden
 * anti-spam input. Measured on a rebuilt base revision, the URL after an
 * unhydrated Subscribe was `/?email=…&additional-notes=`. From there into the
 * URL bar, the browser history, the next request's `Referer`, and every
 * access log on the way to Loki. `event.preventDefault()` in the handler
 * below only ever covered the hydrated case, and this is a `"use client"`
 * component: every visitor passes through the unhydrated window, and under
 * this application's `'strict-dynamic'` CSP a nonce mismatch means the page
 * never leaves it.
 *
 * It now carries a Server Function as its `action`, so React renders a real
 * `method="POST"` form. The values travel in a request body — no query
 * string, nothing in history, nothing in a log line — and the answer comes
 * back rendered into the HTML of the POST response, which is why it is
 * legible with no JavaScript at all. See `./public-form-actions.ts` for the
 * whole reasoning, including why that shape rather than the checkout's route
 * handler.
 *
 * ## And it does not pretend to have subscribed anybody
 *
 * There is still nothing behind this form: the plan forbids building a
 * newsletter subsystem, and the provider integration is Task 5's. So a valid
 * submission — hydrated or not, identically — is answered with
 * `newsletter.notSentMessage`, which says nothing was sent and nothing was
 * stored. The previous revision did nothing at all and said nothing at all,
 * which looks exactly like success to the person who pressed the button.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import { newsletter } from "../../../../content/publisher.js";
import { HoneypotField } from "../turnstile/HoneypotField.js";
import { TurnstileWidget } from "../turnstile/TurnstileWidget.js";
import { reportNewsletterNotSent } from "./public-form-actions.js";
import type { PublicFormOutcome } from "./public-form-actions.js";
import styles from "../../styles/forms.module.css";

export interface NewsletterFormProps {
  readonly turnstileSiteKey: string | null;
  readonly nonce: string | undefined;
}

export function NewsletterForm({ turnstileSiteKey, nonce }: NewsletterFormProps) {
  const fieldId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [outcome, submit] = useActionState<PublicFormOutcome | null, FormData>(
    reportNewsletterNotSent,
    null,
  );
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  /**
   * True only when *this* page's handler let a submission through — so the
   * outcome is focused after a press a visitor just made, and not on the
   * hydration of a page that was itself the answer to an unhydrated press.
   */
  const dispatched = useRef(false);

  /**
   * Keyed on the whole outcome, which is a **new object per submission** —
   * see `PublicFormOutcome`. When the action returned the bare sentence, a
   * second consecutive press produced a value React judged equal to the last
   * one and this effect did not re-run at all, so focus stayed on the submit
   * button.
   */
  useEffect(() => {
    if (outcome === null || !dispatched.current) return;
    dispatched.current = false;
    outcomeRef.current?.focus();
  }, [outcome]);

  /**
   * Note what this does **not** do: it does not call `preventDefault()`
   * unconditionally any more. A valid submission is allowed through to the
   * form's `action`, which is what makes the hydrated answer and the
   * unhydrated answer the same sentence. Only an invalid one is stopped, and
   * only so this component's own accessible error can replace the browser's
   * validation bubble (`noValidate`).
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    const email = event.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
    if (email === null) return;

    if (!email.validity.valid) {
      event.preventDefault();
      setError(
        email.validity.valueMissing
          ? "Enter your email address."
          : "Enter a valid email address.",
      );
      email.focus();
      return;
    }

    setError(null);
    dispatched.current = true;
  }

  return (
    <form
      className={styles.form}
      aria-label={newsletter.heading}
      action={submit}
      onSubmit={handleSubmit}
      noValidate
    >
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

      {/* Always in the document, so what lands in it is announced rather than
          merely appearing. `display: contents`, so an empty one costs no box
          and no gap — the idiom `pages/shop.module.css` already ships.

          `autoFocus` is the unhydrated half of the same job. The POST response
          is a fresh load at the top of a long homepage and the answer sits far
          below the fold, so an answer nobody scrolls to is an answer nobody
          reads. `autofocus` is an HTML attribute, not a script: measured with
          JavaScript switched off, the browser scrolls to it (scrollY 5166) and
          focuses it. Hydrated, the effect above does the same thing.

          `key={outcome.submissions}` is what makes the *second* consecutive
          press audible. The sentence is identical every time, so re-rendering
          the same <p> with the same text changes nothing in the DOM and a
          polite live region with unchanged contents announces nothing —
          measured at zero mutations before this key existed. Keying the
          paragraph on the submission count remounts it, which is a real
          childList change inside an `aria-atomic` region, so every completed
          submission is announced, including consecutive identical ones.

          A React key is invisible in rendered markup, so the same count is
          also written to `data-submission`, which is what
          `tests/build-and-serve.test.ts` can actually read off a built
          server's POST response. The attribute is the observable; the key is
          the mechanism. */}
      <div className={styles.alertAnchor} role="status">
        {outcome !== null && error === null ? (
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

      <HoneypotField formName="newsletter" />

      <div className={styles.turnstile}>
        <TurnstileWidget siteKey={turnstileSiteKey} nonce={nonce} formName="newsletter" />
      </div>

      <p className={styles.consentNote}>{newsletter.consentNote}</p>
    </form>
  );
}
