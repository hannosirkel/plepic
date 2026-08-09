/**
 * Authored SVG, not generated imagery — a low-contrast neutral dot texture
 * for section backgrounds. `currentColor` at low opacity so it reads as a
 * texture rather than a pattern: on the publisher layer it is a faint navy
 * dot on off-white, on the Lunar Base layer a faint pale dot on near-black.
 * It carries no text, so it never competes with foreground contrast ratios.
 */
import { useId } from "react";
import type { SVGProps } from "react";

export function NeutralTexture(props: SVGProps<SVGSVGElement>) {
  // A stable-but-unique id per instance, so two textures on one page (e.g. a
  // header and a footer) never collide on the same <pattern> id.
  const patternId = `plepic-neutral-texture-dots-${useId()}`;

  return (
    <svg
      viewBox="0 0 120 120"
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="currentColor" fillOpacity="0.06" />
          <circle cx="14" cy="14" r="1.4" fill="currentColor" fillOpacity="0.06" />
        </pattern>
      </defs>
      <rect width="120" height="120" fill={`url(#${patternId})`} />
    </svg>
  );
}
