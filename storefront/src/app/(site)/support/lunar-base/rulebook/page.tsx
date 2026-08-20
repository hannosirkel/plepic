import { RulebookPageContent } from "../../../../../components/pages/RulebookPageContent.js";
import { getRuntimeConfig } from "../../../../../config/runtime-config.js";
import { makeMetadata } from "../../../../../lib/page-shell.js";

export const generateMetadata = makeMetadata("rulebook");

export default function RulebookPage() {
  return <RulebookPageContent externalTargets={getRuntimeConfig().externalTargets} />;
}
