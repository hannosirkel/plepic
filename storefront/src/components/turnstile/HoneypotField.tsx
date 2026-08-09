/**
 * A honeypot field: visually hidden from a sighted user (off-screen, not
 * `display: none`, so a screen reader user is not confused and a bot that
 * only checks computed visibility is not tipped off), never focusable, and
 * with an autocomplete-unfriendly name a form-filling bot is likely to
 * populate anyway. Server-side handling of a filled honeypot is Task 5's, the
 * same place Turnstile's token is verified.
 */

const FIELD_NAME = "additional-notes";

export function HoneypotField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
      }}
    >
      <label htmlFor={FIELD_NAME}>Leave this field empty</label>
      <input id={FIELD_NAME} name={FIELD_NAME} type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
