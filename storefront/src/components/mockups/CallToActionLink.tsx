import type { CallToAction } from "../../../../content/schema.js";
import { resolveLinkHref } from "./link-target.js";
import styles from "../../styles/mockups/call-to-action.module.css";

export interface CallToActionLinkProps {
  readonly action: CallToAction;
  /** Resolves a `{token}` placeholder in the label, e.g. `{price}`. Optional — an unresolved label renders the literal placeholder text, which is correct for a mockup with no live catalogue behind it. */
  readonly resolveLabel?: (label: string) => string;
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
 */
export function CallToActionLink({ action, resolveLabel }: CallToActionLinkProps) {
  const href = resolveLinkHref(action.target);
  const label = resolveLabel ? resolveLabel(action.label) : action.label;
  const className = `${styles.cta} ${styles[action.emphasis]}`;

  if (href === undefined) {
    return <span className={className}>{label}</span>;
  }

  return (
    <a className={className} href={href} aria-label={action.accessibleLabel}>
      {label}
    </a>
  );
}
