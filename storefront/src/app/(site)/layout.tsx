/**
 * The root layout of the default edition — the one served at the bare route
 * paths, with no locale prefix. See `src/app/site-document.tsx` for the
 * document itself and for why there are two root layouts rather than one.
 *
 * The route group `(site)` contributes nothing to any URL. It exists so that
 * this layout and `app/[locale]/layout.tsx` can both be root layouts, which
 * Next.js allows only when there is no `app/layout.tsx` above them.
 */

import type { ReactNode } from "react";

import { DEFAULT_LOCALE } from "../../../../content/routes.js";
import { SiteDocument } from "../site-document.js";

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return <SiteDocument locale={DEFAULT_LOCALE}>{children}</SiteDocument>;
}
