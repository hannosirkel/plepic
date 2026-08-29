import type { CallToAction } from "../../../../content/schema.js";
import { resolveLinkHref } from "./link-target.js";
import styles from "../../styles/mockups/call-to-action.module.css";

export interface CallToActionLinkProps {
  readonly action: CallToAction;
  /** Resolves a `{token}` placeholder, e.g. `{price}`. Optional — an unresolved label renders the literal placeholder text, which is correct for a mockup with no live catalogue behind it. */
  readonly resolveLabel?: (text: string) => string;
  /**
   * Smaller secondary text rendered beneath the label — today, only "VAT
   * included" under the homepage's "Buy for {price}" call to action, and only
   * when {@link ResolvedCatalogue.vatIncludedNote} in `src/lib/catalogue.ts`
   * is non-empty.
   *
   * Absent or `""` renders nothing at all: no empty element, no reserved
   * space that shifts layout, and every other call site on this codebase
   * passes neither, so this is additive rather than a change to how the
   * component already renders. Folded into the accessible name too — see this
   * file's doc comment on WCAG 2.5.3 — because a note that is visible but
   * unannounced leaves exactly the ambiguity this exists to remove in place
   * for the people least able to resolve it themselves.
   */
  readonly note?: string;
}

/**
 * Renders one `CallToAction`. A route or anchor target becomes a real
 * site-relative `<a>`; an external target has no URL available to a static
 * mockup (see `link-target.ts`) and renders as inert styled text instead of
 * a fabricated `href`.
 *
 * The inert branch carries no `aria-label`. A `<span>` with no role is
 * `role="generic"`, on which `aria-label` is not honoured — it was not a
 * weaker label, it was no label, and writing one there only made the markup
 * look accessible. The visible text is the whole accessible name until the
 * target resolves and the element becomes a real link, at which point
 * `accessibleLabel` applies to something that can carry it.
 *
 * **WCAG 2.5.3 Label in Name, fixed.** Two things were wrong, and both are
 * fixed here rather than in content, which is not this component's to edit:
 *
 * 1. `resolveLabel` used to run over the visible `label` only. `accessibleLabel`
 *    (e.g. content/publisher.ts's `"Buy Lunar Base for {price}"`) reached the
 *    browser with a raw, unresolved `{price}` in it — a screen reader user
 *    heard the literal placeholder text. `resolveLabel` now runs over both.
 * 2. Resolving both is necessary but not sufficient: content's own
 *    `accessibleLabel` inserts extra words *before* the part that echoes the
 *    visible label ("Buy **Lunar Base** for {price}" against a visible "Buy
 *    for {price}"), so the visible text is not a contiguous substring of the
 *    accessible name even once both are resolved — the SC 2.5.3 failure this
 *    unit was asked to fix survives naive resolution. Rather than editing
 *    `content/publisher.ts` (out of this unit's Files list) to reword it, the
 *    richer `accessibleLabel` is used only when it actually contains the
 *    resolved visible label as a substring; otherwise this falls back to the
 *    visible label alone, which is always compliant by construction — a
 *    plain `<a>` with no `aria-label` has the accessible name browsers
 *    compute from its content, which is exactly its visible text.
 */
export function CallToActionLink({ action, resolveLabel, note }: CallToActionLinkProps) {
  const href = resolveLinkHref(action.target);
  const resolve = resolveLabel ?? ((text: string) => text);
  const label = resolve(action.label);
  const resolvedAccessibleLabel = action.accessibleLabel ? resolve(action.accessibleLabel) : undefined;
  // See "WCAG 2.5.3 Label in Name, fixed" above: only honour the richer
  // accessible label when the visible label is genuinely contained in it.
  const accessibleLabelBase =
    resolvedAccessibleLabel !== undefined && resolvedAccessibleLabel.includes(label)
      ? resolvedAccessibleLabel
      : undefined;
  const hasNote = note !== undefined && note.length > 0;
  /*
   * The note reaches the accessible name too — see this prop's doc comment —
   * and this is why the fallback matters rather than only applying beside an
   * existing `accessibleLabel`. `content/publisher.ts`'s own "Buy Lunar Base
   * for {price}" does **not** contain the resolved visible label "Buy for
   * {price}" as a substring (see the WCAG 2.5.3 fix above), so
   * `accessibleLabelBase` is `undefined` for the one call site this note is
   * written for today. Building the `aria-label` from `label` in that case,
   * rather than leaving it unset, is what stops the note from being visible
   * and silently unannounced on exactly the button it was added for.
   */
  const accessibleLabel = hasNote ? `${accessibleLabelBase ?? label}, ${note}` : accessibleLabelBase;
  const className = `${styles.cta} ${styles[action.emphasis]}`;

  const control =
    href === undefined ? (
      <span className={className}>{label}</span>
    ) : (
      <a className={className} href={href} aria-label={accessibleLabel}>
        {label}
      </a>
    );

  // No wrapper, no extra markup, when there is no note — every call site that
  // predates this prop renders exactly what it always rendered.
  if (!hasNote) return control;

  return (
    <span className={styles.ctaGroup}>
      {control}
      <span className={styles.note}>{note}</span>
    </span>
  );
}
