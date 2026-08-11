/**
 * `/legal/shipping` in the default edition — a projection of
 * `content/legal/shipping.ts` through the one renderer every locale's copy of
 * this page goes through. See `src/app/localized-routes.tsx` for that
 * renderer and `components/pages/LegalPageContent.tsx` for what it projects:
 * this route used to render `RoutePlaceholder`, so it served a heading and
 * one sentence of meta description and none of the notice itself.
 */
import { DEFAULT_LOCALE } from "../../../../../../content/routes.js";
import { LegalRoute } from "../../../localized-routes.js";
import { makeMetadata } from "../../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("legalShipping", DEFAULT_LOCALE);

export default function LegalShippingPage() {
  return <LegalRoute routeId="legalShipping" locale={DEFAULT_LOCALE} />;
}
