/**
 * The root layout of every prefixed edition.
 *
 * A root layout under a dynamic segment is the Next.js mechanism for
 * internationalisation, and the reason is this file's one interesting line:
 * `<html lang>` can only be set by a root layout, and only a root layout under
 * a dynamic segment can know which locale the request resolved to. See
 * `src/app/site-document.tsx` for the document this wraps and for what the
 * alternatives were.
 *
 * **An unrecognised first segment does not 404 here.** `/nonsense/anything`
 * matches this layout too, and calling `notFound()` from a layout throws away
 * the page's own, more specific reasoning about *why* a path is not a route.
 * The document falls back to the default edition's language — a 404 page is
 * served in the site's own language — and
 * `[locale]/[[...segments]]/page.tsx` answers 404.
 */

import type { ReactNode } from "react";

import { DEFAULT_LOCALE } from "../../../../content/routes.js";
import { localeForPathSegment } from "../../lib/urls.js";
import { SiteDocument } from "../site-document.js";

export const dynamic = "force-dynamic";

export default async function LocalizedRootLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;

  return (
    <SiteDocument locale={localeForPathSegment(locale) ?? DEFAULT_LOCALE}>{children}</SiteDocument>
  );
}
