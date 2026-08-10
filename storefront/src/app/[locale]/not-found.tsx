/**
 * The prefixed editions' 404 boundary — and, because the optional catch-all
 * beneath it matches any first path segment, the boundary that answers every
 * unmatched URL on this site. See `src/app/not-found-content.tsx` for what
 * Next.js does with the surrounding document and what was measured.
 */
import { NotFoundContent } from "../not-found-content.js";

export default function NotFound() {
  return <NotFoundContent />;
}
