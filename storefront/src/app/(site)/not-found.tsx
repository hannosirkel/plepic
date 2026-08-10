/**
 * The default edition's 404 boundary. Next.js requires one per root layout;
 * see `src/app/not-found-content.tsx`.
 */
import { NotFoundContent } from "../not-found-content.js";

export default function NotFound() {
  return <NotFoundContent />;
}
