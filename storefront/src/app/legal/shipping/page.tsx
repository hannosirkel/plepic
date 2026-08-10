/**
 * `/legal/shipping` — a projection of `content/legal/shipping.ts`, not a
 * hand-written page. See `components/pages/LegalPageContent.tsx`: this route
 * used to render `RoutePlaceholder`, so it served a heading and one sentence
 * of meta description and none of the notice itself.
 */
import { LegalPageContent } from "../../../components/pages/LegalPageContent.js";
import { getRuntimeConfig } from "../../../config/runtime-config.js";
import { shipping } from "../../../../../content/legal/index.js";
import { placeholderValuesFrom } from "../../../lib/configuration-placeholders.js";
import { makeMetadata } from "../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("legalShipping");

export default function LegalShippingPage() {
  const config = getRuntimeConfig();

  return (
    <LegalPageContent
      page={shipping}
      values={placeholderValuesFrom(config.merchant)}
      externalTargets={config.externalTargets}
    />
  );
}
