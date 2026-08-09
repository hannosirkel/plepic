/**
 * A honeypot field: visually hidden from a sighted user (off-screen, not
 * `display: none`, so a screen reader user is not confused and a bot that
 * only checks computed visibility is not tipped off), never focusable, and
 * with an autocomplete-unfriendly name a form-filling bot is likely to
 * populate anyway. Server-side handling of a filled honeypot is Task 5's, the
 * same place Turnstile's token is verified.
 *
 * **Hidden with a stylesheet class, not an inline `style` prop.** See
 * `HoneypotField.module.css`'s doc comment: this application's CSP permits
 * no inline `style="…"` attribute at all, so the previous inline-`style`
 * version rendered as a visible input the moment it was actually mounted in
 * a page under this CSP — every field is `id`d and `name`d per instance
 * (`formName`) so more than one honeypot can exist in one document (a
 * newsletter form and a contact form both mounted on the same page, say)
 * without one field's autofill leaking into the other's.
 */

import styles from "./HoneypotField.module.css";

export interface HoneypotFieldProps {
  /** Disambiguates this field's id/name when more than one form is mounted on one page. */
  readonly formName: string;
}

export function HoneypotField({ formName }: HoneypotFieldProps) {
  const fieldId = `${formName}-additional-notes`;

  return (
    <div className={styles.field} aria-hidden="true">
      <label htmlFor={fieldId}>Leave this field empty</label>
      <input id={fieldId} name="additional-notes" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
