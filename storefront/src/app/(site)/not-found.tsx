/**
 * The default edition's 404 boundary. Next.js requires one per root layout;
 * see `src/app/not-found-content.tsx`.
 */
import type { Metadata } from "next";

import { NotFoundContent, NOT_FOUND_TITLE } from "../not-found-content.js";

export const metadata: Metadata = { title: NOT_FOUND_TITLE };

export default function NotFound() {
  return <NotFoundContent />;
}
