/**
 * Authored SVG, not generated imagery — a geometric section divider. Colour
 * comes from `currentColor` so it follows `color` on whichever token layer
 * it sits in, the same rule every other component in this design system
 * follows (see `design/README.md`).
 *
 * **Purely decorative, and the markup now says so once.** It shipped
 * carrying `role="img"`, a `<title>Section divider</title>` *and*
 * `aria-hidden="true"` — a contradiction in which the `aria-hidden` wins:
 * the subtree is removed from the accessibility tree, so the role and the
 * accessible name it was given are never exposed to anything. A rule about
 * where the page changes topic is presentation, and it is already carried by
 * the heading structure around it, so `aria-hidden` is the right half to
 * keep. `FutureGamePlaceholder` keeps its `<title>` for the opposite
 * reason — it stands in for a product and is not hidden.
 */
import type { SVGProps } from "react";

export function SectionDivider(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 240 16" aria-hidden="true" focusable="false" {...props}>
      <line x1="0" y1="8" x2="102" y2="8" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="120" cy="8" r="3.5" fill="currentColor" />
      <line x1="138" y1="8" x2="240" y2="8" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
    </svg>
  );
}
