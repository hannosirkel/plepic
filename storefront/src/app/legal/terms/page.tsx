/**
 * `/legal/terms` — a projection of `content/legal/terms.ts`, not a
 * hand-written page. See `components/pages/LegalPageContent.tsx`: this route
 * used to render `RoutePlaceholder`, so it served a heading and one sentence
 * of meta description and none of the notice itself.
 */
import { LegalPageContent } from "../../../components/pages/LegalPageContent.js";
import { getRuntimeConfig } from "../../../config/runtime-config.js";
import { terms } from "../../../../../content/legal/index.js";
import { placeholderValuesFrom } from "../../../lib/configuration-placeholders.js";
import { makeMetadata } from "../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("legalTerms");

export default function LegalTermsPage() {
  const config = getRuntimeConfig();

  return (
    <LegalPageContent
      page={terms}
      values={placeholderValuesFrom(config.merchant)}
      externalTargets={config.externalTargets}
    />
  );
}
