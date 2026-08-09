/**
 * Authored SVG, not generated imagery — a neutral placeholder treatment for
 * a future, unannounced game. Deliberately abstract: a dashed frame, a
 * generic card outline and a token, nothing that could be read as concept
 * art for a specific product. Never render this with a caption that implies
 * a named upcoming title; the plan forbids fabricated product imagery, and a
 * confident-looking placeholder with a real name attached would cross into
 * that.
 */
import type { SVGProps } from "react";

export interface FutureGamePlaceholderProps extends SVGProps<SVGSVGElement> {
  readonly title?: string;
}

export function FutureGamePlaceholder({
  title = "Placeholder artwork for a future game",
  ...props
}: FutureGamePlaceholderProps) {
  return (
    <svg viewBox="0 0 400 300" role="img" aria-hidden={title ? undefined : true} {...props}>
      {title ? <title>{title}</title> : null}
      <rect
        x="1"
        y="1"
        width="398"
        height="298"
        rx="16"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="6 10"
      />
      <rect
        x="150"
        y="110"
        width="100"
        height="80"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="2"
      />
      <circle cx="200" cy="150" r="18" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  );
}
